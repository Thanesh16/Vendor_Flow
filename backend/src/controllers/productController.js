const { Product } = require('../models/Product');
const { Vendor, OnboardingStatus } = require('../models/Vendor');
const { PurchaseOrder } = require('../models/PurchaseOrder');
const { UserRoles } = require('../models/User');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { escapeRegex, isValidObjectId, toSafeInteger } = require('../utils/sanitize');
const storageService = require('../services/storageService');
const auditService = require('../services/auditService');

// Default standard categories
const STANDARD_CATEGORIES = [
  'IT Hardware',
  'Electronics',
  'Office Equipment',
  'Furniture',
  'Industrial Equipment',
  'Stationery',
  'Safety Equipment',
  'Software',
];

/**
 * Helper to get the associated Vendor document for an authenticated user
 */
const getAuthenticatedVendor = async (user) => {
  return await Vendor.findOne({
    $or: [{ createdBy: user._id }, { email: user.email }],
  });
};

/**
 * Create a new Product
 * @access VENDOR, ADMIN
 * @route POST /api/products
 */
const createProduct = async (req, res, next) => {
  try {
    const {
      productName,
      category,
      description,
      specifications,
      price,
      availableQuantity,
      unit,
      deliveryDays,
      isAvailable,
      images,
      imageUrl,
      imagePublicId,
      vendorId: bodyVendorId,
      masterProduct,
      masterCatalogId,
      brand,
      model,
      referencePrice,
      marketPrice,
      marketPriceSource,
      marketPriceStatus,
      specificationsObject,
      selectedVariant,
      asin,
      rating,
      reviewCount,
      externalProductId,
      externalProductUrl,
    } = req.body;

    // Field validation
    if (!productName || !productName.trim()) {
      return errorResponse(res, 400, 'Product name is required');
    }

    if (!category || !category.trim()) {
      return errorResponse(res, 400, 'Product category is required');
    }

    if (price === undefined || isNaN(Number(price)) || Number(price) < 0) {
      return errorResponse(res, 400, 'Valid product price is required (>= 0)');
    }

    if (
      availableQuantity === undefined ||
      isNaN(Number(availableQuantity)) ||
      Number(availableQuantity) < 0
    ) {
      return errorResponse(res, 400, 'Valid available quantity is required (>= 0)');
    }

    // Determine vendor ownership
    let vendorId;
    if (req.user.role === UserRoles.VENDOR) {
      const vendor = await getAuthenticatedVendor(req.user);
      if (!vendor) {
        return errorResponse(
          res,
          400,
          'No vendor profile found for your account. Please complete company onboarding first.'
        );
      }
      vendorId = vendor._id;
    } else if (req.user.role === UserRoles.ADMIN) {
      if (!bodyVendorId) {
        return errorResponse(res, 400, 'vendorId is required when creating a product as Administrator');
      }
      const targetVendor = await Vendor.findById(bodyVendorId);
      if (!targetVendor) {
        return errorResponse(res, 404, 'Specified vendor not found');
      }
      vendorId = targetVendor._id;
    } else {
      return errorResponse(res, 403, 'Access denied. Only vendors and administrators can create products.');
    }

    // Format images if supplied
    let formattedImages = Array.isArray(images)
      ? images.map((img) => ({
          url: typeof img === 'string' ? img.trim() : img.url?.trim() || '',
          publicId: typeof img === 'object' ? img.publicId || '' : '',
        })).filter((img) => img.url)
      : [];

    let finalImageUrl = (imageUrl || '').trim();
    let finalImagePublicId = (imagePublicId || '').trim();

    if (finalImageUrl && formattedImages.length === 0) {
      formattedImages = [{ url: finalImageUrl, publicId: finalImagePublicId }];
    } else if (formattedImages.length > 0 && !finalImageUrl) {
      finalImageUrl = formattedImages[0].url;
      finalImagePublicId = formattedImages[0].publicId || '';
    }

    const product = await Product.create({
      vendor: vendorId,
      productName: productName.trim(),
      category: category.trim(),
      description: description?.trim() || '',
      specifications: specifications?.trim() || '',
      price: Number(price),
      availableQuantity: Number(availableQuantity),
      unit: unit?.trim() || 'Units',
      deliveryDays: deliveryDays ? Math.max(1, Number(deliveryDays)) : 3,
      isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : true,
      imageUrl: finalImageUrl,
      imagePublicId: finalImagePublicId,
      images: formattedImages,
      lastStockUpdate: new Date(),
      masterProduct: masterProduct || null,
      masterCatalogId: masterCatalogId || '',
      brand: brand || '',
      model: model || '',
      referencePrice: referencePrice ? Number(referencePrice) : 0,
      marketPrice: marketPrice ? Number(marketPrice) : (referencePrice ? Number(referencePrice) : 0),
      marketPriceSource: marketPriceSource || 'catalog',
      marketPriceUpdatedAt: marketPrice ? new Date() : null,
      marketPriceStatus: marketPriceStatus || 'REFERENCE',
      specificationsObject: specificationsObject || {},
      selectedVariant: selectedVariant || null,
    });

    await product.populate('vendor', 'companyName email contactPerson onboardingStatus city state phone shopImage shopImages');
    await product.populate('masterProduct', 'catalogId productName brand model category specifications variants referencePrice imageUrl');

    await auditService.log({
      user: req.user,
      action: 'PRODUCT_CREATED',
      entityType: 'Product',
      entityId: product._id,
      description: `Product '${product.productName}' created in catalog at price INR ${product.price} (stock: ${product.availableQuantity})`,
      metadata: {
        productName: product.productName,
        price: product.price,
        availableQuantity: product.availableQuantity,
        category: product.category,
      },
    });

    return successResponse(res, 201, 'Product created successfully', {
      product,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Products with role-based visibility and filters
 * - VENDOR: strictly returns own products
 * - PROCUREMENT_MANAGER: returns only products from APPROVED vendors
 * - ADMIN: returns all products with optional filters
 * @route GET /api/products
 */
const getProducts = async (req, res, next) => {
  try {
    const {
      search,
      category,
      vendorId,
      isAvailable,
      availability,
      minPrice,
      maxPrice,
      sortBy,
      sortOrder,
    } = req.query;

    const query = {};

    // 1. Role-based scoping
    if (req.user.role === UserRoles.VENDOR) {
      const vendor = await getAuthenticatedVendor(req.user);
      if (!vendor) {
        return successResponse(res, 200, 'No products found (vendor profile pending)', {
          count: 0,
          products: [],
        });
      }
      query.vendor = vendor._id;
    } else if (req.user.role === UserRoles.PROCUREMENT_MANAGER) {
      // Strictly only products from APPROVED vendors
      const approvedVendors = await Vendor.find({
        onboardingStatus: OnboardingStatus.APPROVED,
      }).select('_id');

      const approvedVendorIds = approvedVendors.map((v) => v._id);
      query.vendor = { $in: approvedVendorIds };

      // Optional vendor filter (must still be in approved list)
      if (vendorId) {
        query.vendor = {
          $in: approvedVendorIds.filter((id) => id.toString() === vendorId.toString()),
        };
      }
    } else if (req.user.role === UserRoles.ADMIN) {
      if (vendorId) {
        query.vendor = vendorId;
      }
    } else {
      return errorResponse(res, 403, 'Access denied. You do not have permission to access the product catalog.');
    }

    // 2. Category filter
    if (category && category !== 'ALL') {
      const escapedCat = escapeRegex(category.trim());
      if (escapedCat) {
        query.category = { $regex: new RegExp(`^${escapedCat}$`, 'i') };
      }
    }

    // 3. Availability filter
    const availParam = isAvailable !== undefined ? isAvailable : availability;
    if (availParam !== undefined && availParam !== 'ALL') {
      if (availParam === 'IN_STOCK' || availParam === 'AVAILABLE' || availParam === 'true' || availParam === true) {
        query.isAvailable = true;
        query.availableQuantity = { $gt: 0 };
      } else if (availParam === 'OUT_OF_STOCK' || availParam === 'UNAVAILABLE' || availParam === 'false' || availParam === false) {
        query.$or = [{ isAvailable: false }, { availableQuantity: { $lte: 0 } }];
      } else if (availParam === 'LOW_STOCK') {
        query.isAvailable = true;
        query.availableQuantity = { $gt: 0, $lte: 10 };
      }
    }

    // 4. Price range filter
    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {};
      if (minPrice !== undefined && !isNaN(Number(minPrice))) {
        query.price.$gte = Math.max(0, Number(minPrice));
      }
      if (maxPrice !== undefined && !isNaN(Number(maxPrice))) {
        query.price.$lte = Math.max(0, Number(maxPrice));
      }
    }

    // 5. Search query (escaped regex across productName, description, specifications, category)
    if (search && search.trim()) {
      const escapedSearch = escapeRegex(search.trim());
      if (escapedSearch) {
        const searchRegex = new RegExp(escapedSearch, 'i');
        query.$or = [
          { productName: searchRegex },
          { description: searchRegex },
          { specifications: searchRegex },
          { category: searchRegex },
        ];
      }
    }

    // 6. Sorting logic
    let sortOptions = { createdAt: -1 }; // default newest
    const order = (sortOrder || '').toLowerCase();
    if (sortBy === 'price_asc' || (sortBy === 'price' && order === 'asc')) {
      sortOptions = { price: 1 };
    } else if (sortBy === 'price_desc' || (sortBy === 'price' && order === 'desc')) {
      sortOptions = { price: -1 };
    } else if (sortBy === 'delivery_asc' || (sortBy === 'deliveryDays' && order === 'asc')) {
      sortOptions = { deliveryDays: 1 };
    } else if (sortBy === 'delivery_desc' || (sortBy === 'deliveryDays' && order === 'desc')) {
      sortOptions = { deliveryDays: -1 };
    } else if (sortBy === 'name_asc' || ((sortBy === 'productName' || sortBy === 'name') && order === 'asc')) {
      sortOptions = { productName: 1 };
    } else if (sortBy === 'name_desc' || ((sortBy === 'productName' || sortBy === 'name') && order === 'desc')) {
      sortOptions = { productName: -1 };
    } else if (sortBy === 'stock_desc' || ((sortBy === 'availableQuantity' || sortBy === 'stock') && order === 'desc')) {
      sortOptions = { availableQuantity: -1 };
    } else if (sortBy === 'stock_asc' || ((sortBy === 'availableQuantity' || sortBy === 'stock') && order === 'asc')) {
      sortOptions = { availableQuantity: 1 };
    } else if (sortBy === 'oldest' || (sortBy === 'createdAt' && order === 'asc')) {
      sortOptions = { createdAt: 1 };
    } else if (sortBy === 'newest' || (sortBy === 'createdAt' && order === 'desc')) {
      sortOptions = { createdAt: -1 };
    }

    // 7. Pagination parameters
    const isAll = req.query.all === 'true' || req.query.limit === 'all';
    const page = toSafeInteger(req.query.page, 1, 10000, 1);
    const limit = isAll ? 0 : toSafeInteger(req.query.limit, 1, 100, 10);
    const skip = isAll ? 0 : (page - 1) * limit;

    let findQuery = Product.find(query)
      .sort(sortOptions)
      .populate('vendor', 'companyName email contactPerson onboardingStatus city state phone shopImage shopImages')
      .populate('masterProduct', 'catalogId productName brand model category specifications specificationsObject variants referencePrice imageUrl');

    if (!isAll) {
      findQuery = findQuery.skip(skip).limit(limit);
    }

    const [total, products] = await Promise.all([
      Product.countDocuments(query),
      findQuery,
    ]);

    const totalPages = limit > 0 ? (Math.ceil(total / limit) || 1) : 1;
    const pagination = {
      page: isAll ? 1 : page,
      limit: isAll ? total : limit,
      total,
      totalPages,
      hasPrevPage: !isAll && page > 1,
      hasNextPage: !isAll && page < totalPages,
    };

    return successResponse(res, 200, 'Products retrieved successfully', {
      count: products.length,
      total,
      products,
      items: products,
      pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Product by ID
 * @route GET /api/products/:id
 */
const getProductById = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return errorResponse(res, 404, 'Product not found');
    }

    const product = await Product.findById(req.params.id)
      .populate(
        'vendor',
        'companyName email contactPerson onboardingStatus city state phone address shopImage shopImages'
      )
      .populate(
        'masterProduct',
        'catalogId productName brand model category specifications specificationsObject variants referencePrice imageUrl'
      );

    if (!product) {
      return errorResponse(res, 404, 'Product not found');
    }

    // Role checks
    if (req.user.role === UserRoles.VENDOR) {
      const vendor = await getAuthenticatedVendor(req.user);
      if (!vendor || product.vendor._id.toString() !== vendor._id.toString()) {
        return errorResponse(res, 403, 'Access denied. You can only view your own products.');
      }
    } else if (req.user.role === UserRoles.PROCUREMENT_MANAGER) {
      if (product.vendor.onboardingStatus !== OnboardingStatus.APPROVED) {
        return errorResponse(
          res,
          403,
          'Access denied. This product belongs to a vendor who is not yet approved.'
        );
      }
    } else if (req.user.role === UserRoles.EMPLOYEE) {
      return errorResponse(res, 403, 'Access denied. Employees cannot access the vendor product catalog directly.');
    }

    return successResponse(res, 200, 'Product details retrieved', {
      product,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Product
 * @access VENDOR (own products only), ADMIN
 * @route PUT /api/products/:id
 */
const updateProduct = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return errorResponse(res, 404, 'Product not found');
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return errorResponse(res, 404, 'Product not found');
    }

    // Ownership verification for VENDOR
    if (req.user.role === UserRoles.VENDOR) {
      const vendor = await getAuthenticatedVendor(req.user);
      if (!vendor || product.vendor.toString() !== vendor._id.toString()) {
        return errorResponse(res, 403, 'Access denied. You can only modify your own products.');
      }
    } else if (req.user.role !== UserRoles.ADMIN) {
      return errorResponse(res, 403, 'Access denied. Only the owning vendor or an administrator can modify products.');
    }

    const {
      productName,
      category,
      description,
      specifications,
      price,
      availableQuantity,
      unit,
      deliveryDays,
      isAvailable,
      images,
      imageUrl,
      imagePublicId,
    } = req.body;

    if (productName !== undefined) {
      if (!productName.trim()) return errorResponse(res, 400, 'Product name cannot be empty');
      product.productName = productName.trim();
    }

    if (category !== undefined) {
      if (!category.trim()) return errorResponse(res, 400, 'Product category cannot be empty');
      product.category = category.trim();
    }

    if (price !== undefined) {
      if (isNaN(Number(price)) || Number(price) < 0) {
        return errorResponse(res, 400, 'Price must be a non-negative number');
      }
      product.price = Number(price);
    }

    if (availableQuantity !== undefined) {
      if (isNaN(Number(availableQuantity)) || Number(availableQuantity) < 0) {
        return errorResponse(res, 400, 'Available quantity must be a non-negative number');
      }
      product.availableQuantity = Number(availableQuantity);
      product.lastStockUpdate = new Date();
      // If stock is reduced to 0, mark product out of stock (Part 15)
      if (product.availableQuantity === 0 && isAvailable === undefined) {
        product.isAvailable = false;
      } else if (product.availableQuantity > 0 && isAvailable === undefined && product.isAvailable === false) {
        product.isAvailable = true;
      }
    }

    if (description !== undefined) product.description = description.trim();
    if (specifications !== undefined) product.specifications = specifications.trim();
    if (unit !== undefined) product.unit = unit.trim() || 'Units';
    if (deliveryDays !== undefined) product.deliveryDays = Math.max(1, Number(deliveryDays) || 1);
    if (isAvailable !== undefined) {
      product.isAvailable = Boolean(isAvailable);
      product.lastStockUpdate = new Date();
    }
    if (req.body.isActive !== undefined) {
      product.isActive = Boolean(req.body.isActive);
    }

    if (req.body.masterProduct !== undefined) product.masterProduct = req.body.masterProduct || null;
    if (req.body.masterCatalogId !== undefined) product.masterCatalogId = req.body.masterCatalogId || '';
    if (req.body.brand !== undefined) product.brand = req.body.brand || '';
    if (req.body.model !== undefined) product.model = req.body.model || '';
    if (req.body.referencePrice !== undefined) product.referencePrice = Number(req.body.referencePrice) || 0;
    if (req.body.marketPrice !== undefined) {
      product.marketPrice = Number(req.body.marketPrice) || 0;
      product.marketPriceUpdatedAt = new Date();
    }
    if (req.body.marketPriceSource !== undefined) product.marketPriceSource = req.body.marketPriceSource;
    if (req.body.marketPriceStatus !== undefined) product.marketPriceStatus = req.body.marketPriceStatus;
    if (req.body.specificationsObject !== undefined) product.specificationsObject = req.body.specificationsObject;
    if (req.body.selectedVariant !== undefined) product.selectedVariant = req.body.selectedVariant;

    if (imageUrl !== undefined || images !== undefined) {
      const oldPublicId = product.imagePublicId || (product.images && product.images[0] && product.images[0].publicId);

      let newImageUrl = imageUrl !== undefined ? (imageUrl || '').trim() : (product.imageUrl || '');
      let newImagePublicId = imagePublicId !== undefined ? (imagePublicId || '').trim() : (product.imagePublicId || '');

      let formattedImages = [];
      if (images !== undefined) {
        formattedImages = Array.isArray(images)
          ? images.map((img) => ({
              url: typeof img === 'string' ? img.trim() : img.url?.trim() || '',
              publicId: typeof img === 'object' ? img.publicId || '' : '',
            })).filter((img) => img.url)
          : [];
      } else if (product.images) {
        formattedImages = [...product.images];
      }

      if (imageUrl !== undefined && formattedImages.length === 0 && newImageUrl) {
        formattedImages = [{ url: newImageUrl, publicId: newImagePublicId }];
      } else if (images !== undefined && formattedImages.length > 0 && imageUrl === undefined) {
        newImageUrl = formattedImages[0].url;
        newImagePublicId = formattedImages[0].publicId || '';
      }

      // If the old image public ID exists and is different from the new public ID, clean up old file
      if (oldPublicId && oldPublicId !== newImagePublicId) {
        try {
          await storageService.deleteProductImage(oldPublicId);
        } catch (cleanupErr) {
          console.warn('[storageService] Failed to clean up old image:', cleanupErr.message);
        }
      }

      product.imageUrl = newImageUrl;
      product.imagePublicId = newImagePublicId;
      product.images = formattedImages;
    }

    await product.save();
    await product.populate('vendor', 'companyName email contactPerson onboardingStatus city state phone shopImage shopImages');
    await product.populate('masterProduct', 'catalogId productName brand model category specifications specificationsObject variants referencePrice imageUrl');

    await auditService.log({
      user: req.user,
      action: 'PRODUCT_UPDATED',
      entityType: 'Product',
      entityId: product._id,
      description: `Product '${product.productName}' updated (price: INR ${product.price}, stock: ${product.availableQuantity})`,
      metadata: {
        productName: product.productName,
        price: product.price,
        availableQuantity: product.availableQuantity,
        isAvailable: product.isAvailable,
      },
    });

    return successResponse(res, 200, 'Product updated successfully', {
      product,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload a product image
 * @access VENDOR, ADMIN
 * @route POST /api/products/upload-image
 */
const uploadProductImageFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return errorResponse(res, 400, 'Please upload a valid image file');
    }

    const result = await storageService.uploadProductImage(req.file, req.user);

    return successResponse(res, 200, 'Image uploaded successfully', {
      url: result.url,
      publicId: result.publicId,
      originalName: result.originalName,
      size: result.size,
      storageProvider: result.storageProvider,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle Product Availability
 * @access VENDOR (own products only), ADMIN
 * @route PATCH /api/products/:id/availability
 */
const toggleProductAvailability = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return errorResponse(res, 404, 'Product not found');
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return errorResponse(res, 404, 'Product not found');
    }

    if (req.user.role === UserRoles.VENDOR) {
      const vendor = await getAuthenticatedVendor(req.user);
      if (!vendor || product.vendor.toString() !== vendor._id.toString()) {
        return errorResponse(res, 403, 'Access denied. You can only modify your own products.');
      }
    } else if (req.user.role !== UserRoles.ADMIN) {
      return errorResponse(res, 403, 'Access denied.');
    }

    if (req.body.isAvailable !== undefined) {
      product.isAvailable = Boolean(req.body.isAvailable);
    } else {
      product.isAvailable = !product.isAvailable;
    }

    await product.save();
    await product.populate('vendor', 'companyName email contactPerson onboardingStatus city state phone shopImage shopImages');

    await auditService.log({
      user: req.user,
      action: 'PRODUCT_AVAILABILITY_CHANGED',
      entityType: 'Product',
      entityId: product._id,
      description: `Product '${product.productName}' availability changed to ${product.isAvailable ? 'AVAILABLE' : 'UNAVAILABLE'}`,
      metadata: {
        productName: product.productName,
        isAvailable: product.isAvailable,
      },
    });

    return successResponse(res, 200, 'Product availability updated', {
      product,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a Product
 * @access VENDOR (own products only), ADMIN
 * @route DELETE /api/products/:id
 */
const deleteProduct = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return errorResponse(res, 404, 'Product not found');
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return errorResponse(res, 404, 'Product not found');
    }

    if (req.user.role === UserRoles.VENDOR) {
      const vendor = await getAuthenticatedVendor(req.user);
      if (!vendor || product.vendor.toString() !== vendor._id.toString()) {
        return errorResponse(res, 403, 'Access denied. You can only delete your own products.');
      }
    } else if (req.user.role !== UserRoles.ADMIN) {
      return errorResponse(res, 403, 'Access denied. Only the owning vendor or an administrator can delete products.');
    }

    // Check if product is referenced by historical purchase orders (Part 17)
    const historicalOrdersCount = await PurchaseOrder.countDocuments({
      'items.product': product._id,
    });

    if (historicalOrdersCount > 0) {
      product.isAvailable = false;
      product.isActive = false;
      await product.save();

      await auditService.log({
        user: req.user,
        action: 'PRODUCT_DEACTIVATED',
        entityType: 'Product',
        entityId: product._id,
        description: `Product '${product.productName}' deactivated from active catalog (referenced in ${historicalOrdersCount} purchase orders)`,
        metadata: {
          productName: product.productName,
          historicalOrdersCount,
        },
      });

      return successResponse(
        res,
        200,
        `Product is referenced in ${historicalOrdersCount} purchase order(s). It has been safely deactivated from the active catalog instead of deleted to protect historical order records.`,
        {
          productId: req.params.id,
          deactivated: true,
          product,
        }
      );
    }

    // Safely clean up associated image file if no historical orders exist
    const publicIdToDelete = product.imagePublicId || (product.images && product.images[0] && product.images[0].publicId);
    if (publicIdToDelete) {
      try {
        await storageService.deleteProductImage(publicIdToDelete);
      } catch (cleanupErr) {
        console.warn('[storageService] Failed to clean up product image upon deletion:', cleanupErr.message);
      }
    }

    await Product.findByIdAndDelete(req.params.id);

    await auditService.log({
      user: req.user,
      action: 'PRODUCT_DELETED',
      entityType: 'Product',
      entityId: product._id,
      description: `Product '${product.productName}' permanently deleted from catalog`,
      metadata: {
        productName: product.productName,
        category: product.category,
      },
    });

    return successResponse(res, 200, 'Product deleted successfully', {
      productId: req.params.id,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get distinct Product Categories
 * @route GET /api/products/categories
 */
const getCategories = async (req, res, next) => {
  try {
    const dbCategories = await Product.distinct('category');
    const combined = Array.from(
      new Set([...STANDARD_CATEGORIES, ...(dbCategories || [])])
    ).sort();

    return successResponse(res, 200, 'Categories retrieved successfully', combined);
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh live market price for a vendor product
 * @route POST /api/products/:id/refresh-market-price
 */
const refreshProductMarketPrice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) {
      return errorResponse(res, 404, 'Product not found');
    }

    const identifier = product.externalProductId || product.masterProduct || product.productName;
    const productApiService = require('../services/productApi');
    const priceResult = await productApiService.refreshLivePrice(identifier);

    if (priceResult.success && priceResult.price > 0) {
      product.marketPrice = priceResult.price;
      product.marketPriceSource = priceResult.source || product.marketPriceSource;
      product.marketPriceUpdatedAt = new Date();
      product.marketPriceStatus = priceResult.status || 'LIVE';

      if (!Array.isArray(product.priceHistory)) {
        product.priceHistory = [];
      }
      product.priceHistory.push({
        price: priceResult.price,
        currency: 'INR',
        source: priceResult.source,
        fetchedAt: new Date(),
      });

      await product.save();
    }

    return successResponse(res, 200, 'Product market price refreshed', {
      product,
      marketPrice: product.marketPrice,
      vendorSellingPrice: product.price, // Vendor selling price remains strictly separate and unchanged!
      source: product.marketPriceSource,
      updatedAt: product.marketPriceUpdatedAt,
      status: product.marketPriceStatus,
      priceHistory: product.priceHistory,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  toggleProductAvailability,
  deleteProduct,
  getCategories,
  uploadProductImageFile,
  refreshProductMarketPrice,
};
