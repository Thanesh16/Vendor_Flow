const { MasterProduct } = require('../models/MasterProduct');
const productApiService = require('../services/productApi');

/**
 * @desc    Get master catalog products with search, category filtering & pagination
 * @route   GET /api/master-products
 * @access  Private (Authenticated users: Admin, Procurement Manager, Vendor, Employee)
 */
const getMasterProducts = async (req, res) => {
  try {
    const {
      search,
      category,
      brand,
      page = 1,
      limit = 50,
      activeOnly = 'true',
    } = req.query;

    const query = {};

    if (activeOnly === 'true') {
      query.isActive = true;
    }

    if (category && category.trim()) {
      query.category = category.trim();
    }

    if (brand && brand.trim()) {
      query.brand = new RegExp(`^${brand.trim()}$`, 'i');
    }

    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');
      query.$or = [
        { productName: searchRegex },
        { brand: searchRegex },
        { model: searchRegex },
        { catalogId: searchRegex },
        { tags: searchRegex },
        { description: searchRegex },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    let [masterProducts, total] = await Promise.all([
      MasterProduct.find(query)
        .sort({ brand: 1, productName: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      MasterProduct.countDocuments(query),
    ]);

    // If search was specified but local catalog returned 0 items, dynamically query live external API!
    if (total === 0 && search && search.trim().length >= 2) {
      try {
        const liveRes = await productApiService.searchProducts(search.trim(), {
          category: category && category !== 'ALL' ? category : undefined,
          limit: limitNum,
        });
        if (liveRes.success && Array.isArray(liveRes.data) && liveRes.data.length > 0) {
          masterProducts = liveRes.data;
          total = liveRes.data.length;
        }
      } catch (liveErr) {
        console.warn('[MasterCatalogController] Dynamic live search note:', liveErr.message);
      }
    }

    const totalPages = Math.ceil(total / limitNum) || 1;

    res.status(200).json({
      success: true,
      data: masterProducts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasMore: pageNum < totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching master products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve master products',
      error: error.message,
    });
  }
};

/**
 * @desc    Get single master product by ID or catalogId
 * @route   GET /api/master-products/:id
 * @access  Private
 */
const getMasterProductById = async (req, res) => {
  try {
    const { id } = req.params;
    let masterProduct;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      masterProduct = await MasterProduct.findById(id);
    }

    if (!masterProduct) {
      masterProduct = await MasterProduct.findOne({ catalogId: id });
    }

    if (!masterProduct) {
      return res.status(404).json({
        success: false,
        message: 'Master product not found',
      });
    }

    res.status(200).json({
      success: true,
      data: masterProduct,
    });
  } catch (error) {
    console.error('Error fetching master product details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve master product',
      error: error.message,
    });
  }
};

/**
 * @desc    Get distinct categories and brands in master catalog
 * @route   GET /api/master-products/meta/categories-and-brands
 * @access  Private
 */
const getCategoriesAndBrands = async (req, res) => {
  try {
    const [categories, brands] = await Promise.all([
      MasterProduct.distinct('category', { isActive: true }),
      MasterProduct.distinct('brand', { isActive: true }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        categories: categories.sort(),
        brands: brands.sort(),
      },
    });
  } catch (error) {
    console.error('Error fetching master metadata:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve master metadata',
      error: error.message,
    });
  }
};

/**
 * @desc    Get market / reference price indicator for catalog product
 * @route   GET /api/master-products/:id/market-price
 * @access  Private
 */
const getMarketPrice = async (req, res) => {
  try {
    const { id } = req.params;
    let masterProduct;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      masterProduct = await MasterProduct.findById(id);
    }
    if (!masterProduct) {
      masterProduct = await MasterProduct.findOne({ catalogId: id });
    }

    if (!masterProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found for market price lookup',
      });
    }

    // Authoritative Master Catalog Reference / Live Market Price in INR
    const priceData = {
      catalogId: masterProduct.catalogId,
      productName: masterProduct.productName,
      referencePrice: masterProduct.referencePrice,
      marketPrice: masterProduct.marketPrice || masterProduct.referencePrice,
      currency: masterProduct.currency || 'INR',
      status: masterProduct.marketPriceStatus || 'REFERENCE',
      source: masterProduct.marketPriceSource || 'VENDORFLOW Master Catalog Baseline',
      lastUpdated: masterProduct.marketPriceUpdatedAt || masterProduct.updatedAt || masterProduct.createdAt || new Date(),
      priceHistory: masterProduct.priceHistory || [],
      variants: (masterProduct.variants || []).map((v) => ({
        name: v.name,
        color: v.color,
        storage: v.storage,
        ram: v.ram,
        referencePrice: v.referencePrice || masterProduct.referencePrice,
        sku: v.sku,
      })),
    };

    res.status(200).json({
      success: true,
      data: priceData,
    });
  } catch (error) {
    console.error('Error fetching market price:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch market price',
      error: error.message,
    });
  }
};

/**
 * @desc    Create new Master Product entry (Admin only)
 * @route   POST /api/master-products
 * @access  Private (Admin)
 */
const createMasterProduct = async (req, res) => {
  try {
    const {
      catalogId,
      productName,
      brand,
      model,
      category,
      unit,
      description,
      specifications,
      specificationsObject,
      variants,
      imageUrl,
      referencePrice,
      tags,
    } = req.body;

    if (!catalogId || !productName || !brand || !category || referencePrice === undefined) {
      return res.status(400).json({
        success: false,
        message: 'catalogId, productName, brand, category, and referencePrice are required',
      });
    }

    const existing = await MasterProduct.findOne({ catalogId: catalogId.trim() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Master product with catalogId "${catalogId}" already exists`,
      });
    }

    const newMaster = await MasterProduct.create({
      catalogId: catalogId.trim(),
      productName: productName.trim(),
      brand: brand.trim(),
      model: (model || '').trim(),
      category: category.trim(),
      unit: (unit || 'Units').trim(),
      description: (description || '').trim(),
      specifications: (specifications || '').trim(),
      specificationsObject: specificationsObject || {},
      variants: Array.isArray(variants) ? variants : [],
      imageUrl: (imageUrl || '').trim(),
      referencePrice: Number(referencePrice),
      currency: 'INR',
      tags: Array.isArray(tags) ? tags : [],
    });

    res.status(201).json({
      success: true,
      message: 'Master product created successfully',
      data: newMaster,
    });
  } catch (error) {
    console.error('Error creating master product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create master product',
      error: error.message,
    });
  }
};

/**
 * @desc    Update Master Product entry (Admin only)
 * @route   PUT /api/master-products/:id
 * @access  Private (Admin)
 */
const updateMasterProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = [
      'productName',
      'brand',
      'model',
      'category',
      'unit',
      'description',
      'specifications',
      'specificationsObject',
      'variants',
      'imageUrl',
      'referencePrice',
      'isActive',
      'tags',
    ];

    const updateData = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updateData[key] = req.body[key];
      }
    }

    const updated = await MasterProduct.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Master product not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Master product updated successfully',
      data: updated,
    });
  } catch (error) {
    console.error('Error updating master product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update master product',
      error: error.message,
    });
  }
};

/**
 * @desc    Search live external marketplace & local catalog products
 * @route   GET /api/master-products/search
 * @access  Private (All authenticated roles)
 */
const searchExternalProducts = async (req, res) => {
  try {
    const { q, search, query, category, limit = 15 } = req.query;
    const term = (q || search || query || '').trim();

    if (!term || term.length < 2) {
      return res.status(200).json({
        success: true,
        data: [],
        total: 0,
        provider: 'none',
      });
    }

    const result = await productApiService.searchProducts(term, {
      category: category && category !== 'ALL' ? category : undefined,
      limit: parseInt(limit, 10) || 15,
    });

    res.status(200).json({
      success: true,
      data: result.data || [],
      provider: result.provider,
      total: result.total || (result.data || []).length,
      cached: Boolean(result.cached),
    });
  } catch (error) {
    console.error('Error in searchExternalProducts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search live products',
      error: error.message,
    });
  }
};

/**
 * @desc    Cache external marketplace product into local Master Catalog when selected
 * @route   POST /api/master-products/cache-external
 * @access  Private (All authenticated roles)
 */
const cacheExternalProduct = async (req, res) => {
  try {
    const productData = req.body;
    if (!productData || !productData.productName) {
      return res.status(400).json({
        success: false,
        message: 'Product data with productName is required',
      });
    }

    const cached = await productApiService.cacheExternalProduct(productData);

    res.status(200).json({
      success: true,
      message: 'Product cached in Master Catalog successfully',
      data: cached,
    });
  } catch (error) {
    console.error('Error in cacheExternalProduct:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cache product in master catalog',
      error: error.message,
    });
  }
};

/**
 * @desc    Refresh live market price for a product
 * @route   POST /api/master-products/:id/refresh-price
 * @access  Private (All authenticated roles)
 */
const refreshLiveMarketPrice = async (req, res) => {
  try {
    const { id } = req.params;
    const priceResult = await productApiService.refreshLivePrice(id);

    if (!priceResult.success) {
      return res.status(404).json({
        success: false,
        message: priceResult.error || 'Failed to refresh live market price',
      });
    }

    res.status(200).json({
      success: true,
      data: priceResult,
    });
  } catch (error) {
    console.error('Error in refreshLiveMarketPrice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh live market price',
      error: error.message,
    });
  }
};

module.exports = {
  getMasterProducts,
  getMasterProductById,
  getCategoriesAndBrands,
  getMarketPrice,
  createMasterProduct,
  updateMasterProduct,
  searchExternalProducts,
  cacheExternalProduct,
  refreshLiveMarketPrice,
};
