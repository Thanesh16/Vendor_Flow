const path = require('path');
const { Vendor, OnboardingStatus } = require('../models/Vendor');
const { User, UserRoles } = require('../models/User');
const { Notification, NotificationType } = require('../models/Notification');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { escapeRegex, isValidObjectId, toSafeInteger } = require('../utils/sanitize');
const auditService = require('../services/auditService');
const storageService = require('../services/storageService');

/**
 * Get all vendors with search and status filtering
 * @access ADMIN, PROCUREMENT_MANAGER
 * @route GET /api/vendors
 */
const getAllVendors = async (req, res, next) => {
  try {
    const { search, status, onboardingStatus, sortBy, sortOrder, all } = req.query;
    const query = {};

    // Filter by onboarding status if specified and not 'ALL'
    const filterStatus = status || onboardingStatus;
    if (filterStatus && filterStatus !== 'ALL') {
      const normalizedStatus = filterStatus.toUpperCase();
      if (Object.values(OnboardingStatus).includes(normalizedStatus)) {
        query.onboardingStatus = normalizedStatus;
      }
    }

    // Search across companyName, contactPerson, email, city, state, phone, or taxId
    if (search && search.trim()) {
      const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
      query.$or = [
        { companyName: searchRegex },
        { contactPerson: searchRegex },
        { email: searchRegex },
        { city: searchRegex },
        { state: searchRegex },
        { phone: searchRegex },
        { taxId: searchRegex },
      ];
    }

    // Safe sorting whitelist
    const allowedSortFields = ['createdAt', 'companyName', 'email', 'city', 'onboardingStatus'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortDirection = sortOrder === 'asc' || sortOrder === '1' ? 1 : -1;
    const sortOptions = { [sortField]: sortDirection };

    // Pagination parameters
    const isAll = all === 'true' || req.query.limit === 'all';
    const page = toSafeInteger(req.query.page, 1, 1);
    const limit = isAll ? 0 : toSafeInteger(req.query.limit, 10, 1, 100);
    const skip = isAll ? 0 : (page - 1) * limit;

    let findQuery = Vendor.find(query)
      .sort(sortOptions)
      .populate('createdBy', 'name email role');

    if (!isAll) {
      findQuery = findQuery.skip(skip).limit(limit);
    }

    const [total, vendors] = await Promise.all([
      Vendor.countDocuments(query),
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

    return successResponse(res, 200, 'Vendors retrieved successfully', {
      count: vendors.length,
      total,
      vendors,
      items: vendors,
      pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get currently authenticated vendor's profile
 * @access VENDOR
 * @route GET /api/vendors/profile/me
 */
const getMyVendorProfile = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({
      $or: [{ createdBy: req.user._id }, { email: req.user.email }],
    }).populate('createdBy', 'name email');

    if (!vendor) {
      return successResponse(res, 200, 'Vendor profile not yet created', {
        hasProfile: false,
        vendor: null,
      });
    }

    return successResponse(res, 200, 'Vendor profile retrieved successfully', {
      hasProfile: true,
      vendor,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get vendor by ID with strict role & ownership checking
 * @access ADMIN, PROCUREMENT_MANAGER, or owning VENDOR
 * @route GET /api/vendors/:id
 */
const getVendorById = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return errorResponse(res, 404, 'Vendor not found');
    }

    const vendor = await Vendor.findById(req.params.id).populate('createdBy', 'name email');

    if (!vendor) {
      return errorResponse(res, 404, 'Vendor not found');
    }

    // If requester is a VENDOR, ensure they own this vendor profile
    if (req.user.role === UserRoles.VENDOR) {
      const isOwner =
        (vendor.createdBy && vendor.createdBy._id.toString() === req.user._id.toString()) ||
        vendor.email === req.user.email;

      if (!isOwner) {
        return errorResponse(res, 403, 'Access denied. You can only view your own vendor profile.');
      }
    }

    return successResponse(res, 200, 'Vendor details retrieved successfully', { vendor });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new vendor profile (Onboarding submission)
 * @access VENDOR (or ADMIN / PROCUREMENT_MANAGER on behalf of vendor)
 * @route POST /api/vendors
 */
const createVendor = async (req, res, next) => {
  try {
    const {
      companyName,
      contactPerson,
      email,
      phone,
      address,
      city,
      state,
      country,
      taxId,
      businessDescription,
    } = req.body;

    // Validate required fields
    if (
      !companyName ||
      !contactPerson ||
      !email ||
      !phone ||
      !address ||
      !city ||
      !state ||
      !country ||
      !taxId
    ) {
      return errorResponse(res, 400, 'Please provide all required vendor profile fields');
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check for duplicate profile for this user account or email
    const existingVendor = await Vendor.findOne({
      $or: [{ createdBy: req.user._id }, { email: normalizedEmail }, { taxId: taxId.trim() }],
    });

    if (existingVendor) {
      return errorResponse(
        res,
        400,
        'A vendor profile already exists for this account, email, or tax identification number'
      );
    }

    // Force PENDING status for initial onboarding submission
    const vendor = await Vendor.create({
      companyName: companyName.trim(),
      contactPerson: contactPerson.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      country: country.trim(),
      taxId: taxId.trim(),
      businessDescription: businessDescription?.trim() || '',
      onboardingStatus: OnboardingStatus.PENDING,
      createdBy: req.user._id,
    });

    await auditService.log({
      user: req.user,
      action: 'VENDOR_ONBOARDING_SUBMITTED',
      entityType: 'Vendor',
      entityId: vendor._id,
      description: `Vendor profile '${vendor.companyName}' submitted onboarding information`,
      metadata: { companyName: vendor.companyName },
    });

    return successResponse(res, 201, 'Vendor onboarding profile submitted successfully', {
      vendor,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update vendor profile
 * @access ADMIN, PROCUREMENT_MANAGER, or owning VENDOR
 * @route PUT /api/vendors/:id
 */
const updateVendor = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return errorResponse(res, 404, 'Vendor not found');
    }

    const vendor = await Vendor.findById(req.params.id);

    if (!vendor) {
      return errorResponse(res, 404, 'Vendor not found');
    }

    // Ownership check for VENDOR role
    if (req.user.role === UserRoles.VENDOR) {
      const isOwner =
        (vendor.createdBy && vendor.createdBy.toString() === req.user._id.toString()) ||
        vendor.email === req.user.email;

      if (!isOwner) {
        return errorResponse(res, 403, 'Access denied. You can only update your own vendor profile.');
      }

      // Prevent vendor from self-approving or altering onboarding status
      if (req.body.onboardingStatus && req.body.onboardingStatus !== vendor.onboardingStatus) {
        delete req.body.onboardingStatus;
      }
    }

    const allowedFields = [
      'companyName',
      'contactPerson',
      'email',
      'phone',
      'address',
      'city',
      'state',
      'country',
      'taxId',
      'businessDescription',
      'shopImage',
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        vendor[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
      }
    });

    if (Array.isArray(req.body.shopImages)) {
      vendor.shopImages = req.body.shopImages;
    } else if (vendor.shopImage && (!vendor.shopImages || vendor.shopImages.length === 0)) {
      vendor.shopImages = [{ url: vendor.shopImage, isPrimary: true, createdAt: new Date() }];
    }

    // If Admin/Procurement updates status via PUT
    if (
      req.user.role !== UserRoles.VENDOR &&
      req.body.onboardingStatus &&
      Object.values(OnboardingStatus).includes(req.body.onboardingStatus)
    ) {
      vendor.onboardingStatus = req.body.onboardingStatus;
    }

    await vendor.save();

    await auditService.log({
      user: req.user,
      action: 'VENDOR_UPDATED',
      entityType: 'Vendor',
      entityId: vendor._id,
      description: `Vendor profile '${vendor.companyName}' was updated`,
      metadata: { companyName: vendor.companyName },
    });

    return successResponse(res, 200, 'Vendor profile updated successfully', { vendor });
  } catch (error) {
    next(error);
  }
};

/**
 * Update vendor onboarding status (Review workflow)
 * @access ADMIN, PROCUREMENT_MANAGER only
 * @route PATCH /api/vendors/:id/status
 */
const updateVendorStatus = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return errorResponse(res, 404, 'Vendor not found');
    }

    const { status } = req.body;

    if (!status || !Object.values(OnboardingStatus).includes(status)) {
      return errorResponse(
        res,
        400,
        `Invalid status. Must be one of: ${Object.values(OnboardingStatus).join(', ')}`
      );
    }

    const vendor = await Vendor.findById(req.params.id);

    if (!vendor) {
      return errorResponse(res, 404, 'Vendor not found');
    }

    // Enforce valid status transition lifecycle
    const current = vendor.onboardingStatus;

    if (current === status) {
      return successResponse(res, 200, `Vendor status is already ${status}`, { vendor });
    }

    // Allowed transition lifecycle:
    // PENDING -> UNDER_REVIEW, REJECTED
    // UNDER_REVIEW -> APPROVED, REJECTED
    // APPROVED -> UNDER_REVIEW (re-evaluation / compliance audit)
    // REJECTED -> UNDER_REVIEW (re-evaluation / appeal)
    const allowedTransitions = {
      [OnboardingStatus.PENDING]: [OnboardingStatus.UNDER_REVIEW, OnboardingStatus.REJECTED],
      [OnboardingStatus.UNDER_REVIEW]: [OnboardingStatus.APPROVED, OnboardingStatus.REJECTED],
      [OnboardingStatus.APPROVED]: [OnboardingStatus.UNDER_REVIEW],
      [OnboardingStatus.REJECTED]: [OnboardingStatus.UNDER_REVIEW],
    };

    const permitted = allowedTransitions[current] || [];
    if (!permitted.includes(status)) {
      return errorResponse(
        res,
        400,
        `Invalid status transition from ${current} to ${status}. Allowed next status: ${permitted.join(', ')}`
      );
    }

    vendor.onboardingStatus = status;
    await vendor.save();

    // Notify vendor account of onboarding outcome
    try {
      const vendorUser = await User.findOne({
        $or: [{ vendor: vendor._id }, { email: vendor.email }, { _id: vendor.createdBy }],
      });
      if (vendorUser) {
        if (status === OnboardingStatus.APPROVED) {
          await Notification.create({
            recipient: vendorUser._id,
            title: 'Vendor Profile Approved',
            message: `Congratulations! Your supplier account for '${vendor.companyName}' has been approved by procurement. You can now publish products to the catalog.`,
            type: NotificationType.SUCCESS,
            link: '/profile',
            metadata: {
              vendorId: vendor._id,
              status: 'APPROVED',
              type: 'VENDOR_APPROVED',
            },
          });
        } else if (status === OnboardingStatus.REJECTED) {
          const reasonMsg = req.body.rejectionReason || req.body.reason ? ` Reason: ${req.body.rejectionReason || req.body.reason}` : '';
          await Notification.create({
            recipient: vendorUser._id,
            title: 'Vendor Profile Declined',
            message: `Your vendor onboarding application for '${vendor.companyName}' was declined by procurement.${reasonMsg}`,
            type: NotificationType.ALERT,
            link: '/profile',
            metadata: {
              vendorId: vendor._id,
              status: 'REJECTED',
              type: 'VENDOR_REJECTED',
            },
          });
        }
      }
    } catch {
      // Non-blocking notification
    }

    const vendorAction =
      status === OnboardingStatus.APPROVED
        ? 'VENDOR_APPROVED'
        : status === OnboardingStatus.REJECTED
        ? 'VENDOR_REJECTED'
        : 'VENDOR_STATUS_UPDATED';

    await auditService.log({
      user: req.user,
      action: vendorAction,
      entityType: 'Vendor',
      entityId: vendor._id,
      description: `Vendor '${vendor.companyName}' onboarding status updated from ${current} to ${status}`,
      metadata: {
        companyName: vendor.companyName,
        before: current,
        after: status,
      },
    });

    return successResponse(res, 200, `Vendor onboarding status updated to ${status}`, {
      vendor,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload vendor shop image
 * @access VENDOR (own profile), ADMIN
 * @route POST /api/vendors/upload-shop-image
 */
const uploadShopImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return errorResponse(
        res,
        400,
        'Please select a valid image file (JPG, JPEG, PNG, or WebP) under 5MB.'
      );
    }

    // Role check: Only VENDOR or ADMIN
    if (req.user.role !== UserRoles.VENDOR && req.user.role !== UserRoles.ADMIN) {
      return errorResponse(
        res,
        403,
        'Access denied. Only vendors and administrators can upload shop photos.'
      );
    }

    const uploadResult = await storageService.uploadVendorImage(req.file, req.user);

    // If vendorId is provided in body or query, or for VENDOR user automatically link to their profile
    let vendor = null;
    if (req.user.role === UserRoles.VENDOR) {
      vendor = await Vendor.findOne({
        $or: [{ createdBy: req.user._id }, { email: req.user.email }],
      });
    } else if (req.body?.vendorId && isValidObjectId(req.body.vendorId)) {
      vendor = await Vendor.findById(req.body.vendorId);
    }

    if (vendor) {
      // Clean up old local image if replacing
      if (vendor.shopImage && vendor.shopImage.startsWith('/uploads/vendors/') && vendor.shopImage !== uploadResult.url) {
        const oldFilename = path.basename(vendor.shopImage);
        await storageService.deleteVendorImage(`local:${oldFilename}`);
      }

      vendor.shopImage = uploadResult.url;
      vendor.shopImages = [
        {
          url: uploadResult.url,
          publicId: uploadResult.publicId || '',
          isPrimary: true,
          createdAt: new Date(),
        },
      ];
      await vendor.save();

      await auditService.log({
        user: req.user,
        action: 'VENDOR_UPDATED',
        entityType: 'Vendor',
        entityId: vendor._id,
        description: `Shop photo updated for vendor '${vendor.companyName}'`,
        metadata: { companyName: vendor.companyName, url: uploadResult.url },
      });
    }

    return successResponse(res, 200, 'Shop photo uploaded successfully', {
      ...uploadResult,
      vendor,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update vendor shop image via URL
 * @access VENDOR (own profile), ADMIN
 * @route PUT /api/vendors/:id/shop-image
 */
const updateShopImage = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return errorResponse(res, 404, 'Vendor not found');
    }

    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      return errorResponse(res, 404, 'Vendor not found');
    }

    // Role and ownership check
    if (req.user.role === UserRoles.VENDOR) {
      const isOwner =
        (vendor.createdBy && vendor.createdBy.toString() === req.user._id.toString()) ||
        vendor.email === req.user.email;
      if (!isOwner) {
        return errorResponse(res, 403, 'Access denied. You can only update your own shop photo.');
      }
    } else if (req.user.role !== UserRoles.ADMIN) {
      return errorResponse(res, 403, 'Access denied. Only vendors and administrators can update shop photos.');
    }

    const { shopImage } = req.body;

    // If removing or empty
    if (!shopImage || typeof shopImage !== 'string' || !shopImage.trim()) {
      if (vendor.shopImage && vendor.shopImage.startsWith('/uploads/vendors/')) {
        const oldFilename = path.basename(vendor.shopImage);
        await storageService.deleteVendorImage(`local:${oldFilename}`);
      }
      vendor.shopImage = '';
      vendor.shopImages = [];
      await vendor.save();
      return successResponse(res, 200, 'Shop photo removed successfully', { vendor });
    }

    const trimmedUrl = shopImage.trim();
    const lower = trimmedUrl.toLowerCase();
    if (
      lower.startsWith('javascript:') ||
      lower.startsWith('data:') ||
      lower.startsWith('vbscript:') ||
      lower.startsWith('file:')
    ) {
      return errorResponse(res, 400, 'Please enter a valid image URL.');
    }

    let isValid = false;
    if (trimmedUrl.startsWith('/uploads/vendors/')) {
      isValid = true;
    } else {
      try {
        const parsed = new URL(trimmedUrl);
        isValid = parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch (e) {
        isValid = false;
      }
    }

    if (!isValid) {
      return errorResponse(res, 400, 'Please enter a valid image URL.');
    }

    // Clean up old local image if replacing with external URL or different local file
    if (vendor.shopImage && vendor.shopImage.startsWith('/uploads/vendors/') && vendor.shopImage !== trimmedUrl) {
      const oldFilename = path.basename(vendor.shopImage);
      await storageService.deleteVendorImage(`local:${oldFilename}`);
    }

    vendor.shopImage = trimmedUrl;
    vendor.shopImages = [
      {
        url: trimmedUrl,
        publicId: '',
        isPrimary: true,
        createdAt: new Date(),
      },
    ];
    await vendor.save();

    await auditService.log({
      user: req.user,
      action: 'VENDOR_UPDATED',
      entityType: 'Vendor',
      entityId: vendor._id,
      description: `Shop photo updated for vendor '${vendor.companyName}'`,
      metadata: { companyName: vendor.companyName, url: trimmedUrl },
    });

    return successResponse(res, 200, 'Shop photo updated successfully', { vendor });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove vendor shop photo
 * @access VENDOR (own profile), ADMIN
 * @route DELETE /api/vendors/:id/shop-image
 */
const removeShopImage = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return errorResponse(res, 404, 'Vendor not found');
    }

    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      return errorResponse(res, 404, 'Vendor not found');
    }

    // Role and ownership check
    if (req.user.role === UserRoles.VENDOR) {
      const isOwner =
        (vendor.createdBy && vendor.createdBy.toString() === req.user._id.toString()) ||
        vendor.email === req.user.email;
      if (!isOwner) {
        return errorResponse(res, 403, 'Access denied. You can only remove your own shop photo.');
      }
    } else if (req.user.role !== UserRoles.ADMIN) {
      return errorResponse(res, 403, 'Access denied. Only vendors and administrators can remove shop photos.');
    }

    // Delete existing file from storage if local
    if (vendor.shopImage && vendor.shopImage.startsWith('/uploads/vendors/')) {
      const filename = path.basename(vendor.shopImage);
      await storageService.deleteVendorImage(`local:${filename}`);
    }

    vendor.shopImage = '';
    vendor.shopImages = [];
    await vendor.save();

    await auditService.log({
      user: req.user,
      action: 'VENDOR_UPDATED',
      entityType: 'Vendor',
      entityId: vendor._id,
      description: `Shop photo removed for vendor '${vendor.companyName}'`,
      metadata: { companyName: vendor.companyName },
    });

    return successResponse(res, 200, 'Shop photo removed successfully', { vendor });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllVendors,
  getMyVendorProfile,
  getVendorById,
  createVendor,
  updateVendor,
  updateVendorStatus,
  uploadShopImage,
  updateShopImage,
  removeShopImage,
};
