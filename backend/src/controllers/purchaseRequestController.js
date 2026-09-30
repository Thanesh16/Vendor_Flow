const { PurchaseRequest, RequestStatus, RequestPriority } = require('../models/PurchaseRequest');
const { AuditLog } = require('../models/AuditLog');
const { User, UserRoles } = require('../models/User');
const { Notification, NotificationType } = require('../models/Notification');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { escapeRegex, isValidObjectId, toSafeInteger } = require('../utils/sanitize');
const auditService = require('../services/auditService');

/**
 * Generate a unique, human-readable Purchase Request Number
 * Format: PR-YYYY-XXXXX
 */
const generateRequestNumber = async () => {
  const year = new Date().getFullYear();
  const randomSuffix = Math.floor(10000 + Math.random() * 90000);
  const candidate = `PR-${year}-${randomSuffix}`;

  // Ensure uniqueness
  const existing = await PurchaseRequest.findOne({ requestNumber: candidate });
  if (existing) {
    return `PR-${year}-${Date.now().toString().slice(-5)}`;
  }
  return candidate;
};

/**
 * Create a new Purchase Request
 * @access EMPLOYEE, ADMIN, PROCUREMENT_MANAGER (Denied: VENDOR)
 * @route POST /api/purchase-requests
 */
const createPurchaseRequest = async (req, res, next) => {
  try {
    const { title, description, items, priority, requiredDate, status } = req.body;

    if (!title || !title.trim()) {
      return errorResponse(res, 400, 'Request title is required');
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return errorResponse(res, 400, 'Purchase request must contain at least one item');
    }

    // Validate item attributes
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.name || !item.name.trim()) {
        return errorResponse(res, 400, `Item #${i + 1} name is required`);
      }
      if (!item.quantity || Number(item.quantity) < 1) {
        return errorResponse(res, 400, `Item #${i + 1} quantity must be at least 1`);
      }
    }

    // Determine initial status: either DRAFT or SUBMITTED (default is SUBMITTED)
    let initialStatus = RequestStatus.SUBMITTED;
    if (status && status.toUpperCase() === RequestStatus.DRAFT) {
      initialStatus = RequestStatus.DRAFT;
    }

    // Validate priority
    let selectedPriority = RequestPriority.MEDIUM;
    if (priority && Object.values(RequestPriority).includes(priority.toUpperCase())) {
      selectedPriority = priority.toUpperCase();
    }

    const requestNumber = await generateRequestNumber();

    const formattedItems = items.map((it) => {
      const priceVal = Number(it.requesterRequestedPrice) || Number(it.estimatedPrice) || 0;
      return {
        name: it.name.trim(),
        quantity: Number(it.quantity),
        estimatedPrice: priceVal,
        requesterRequestedPrice: priceVal,
        description: it.description?.trim() || '',
        category: it.category?.trim() || '',
        masterProductId: it.masterProductId || null,
        masterCatalogId: it.masterCatalogId?.trim() || '',
        brand: it.brand?.trim() || '',
        model: it.model?.trim() || '',
        referencePrice: Number(it.referencePrice) || 0,
        unit: it.unit?.trim() || 'Units',
        imageUrl: it.imageUrl?.trim() || '',
      };
    });

    const purchaseRequest = await PurchaseRequest.create({
      requestNumber,
      requestedBy: req.user._id,
      title: title.trim(),
      description: description?.trim() || '',
      items: formattedItems,
      priority: selectedPriority,
      requiredDate: requiredDate ? new Date(requiredDate) : undefined,
      status: initialStatus,
    });

    await purchaseRequest.populate('requestedBy', 'name email role');

    // Notify Procurement & Admin when PR is created directly in SUBMITTED status
    if (initialStatus === RequestStatus.SUBMITTED) {
      const reviewers = await User.find({
        role: { $in: [UserRoles.PROCUREMENT_MANAGER, UserRoles.ADMIN] },
      });
      for (const reviewer of reviewers) {
        await Notification.create({
          recipient: reviewer._id,
          title: `New Purchase Request: ${requestNumber}`,
          message: `Requisition '${purchaseRequest.title}' (${requestNumber}) submitted by ${purchaseRequest.requestedBy?.name || 'Employee'} requires review.`,
          type: NotificationType.WARNING,
          link: '/purchase-requests',
          metadata: {
            purchaseRequestId: purchaseRequest._id,
            requestNumber,
            status: 'SUBMITTED',
            type: 'PR_SUBMITTED',
          },
        });
      }
    }

    await auditService.log({
      user: req.user,
      action: 'PURCHASE_REQUEST_CREATED',
      entityType: 'PurchaseRequest',
      entityId: purchaseRequest._id,
      description: `Purchase request ${purchaseRequest.requestNumber} ('${purchaseRequest.title}') created`,
      metadata: {
        requestNumber: purchaseRequest.requestNumber,
        totalEstimatedCost: purchaseRequest.totalEstimatedCost,
        status: purchaseRequest.status,
      },
    });

    return successResponse(res, 201, 'Purchase request created successfully', {
      purchaseRequest,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all Purchase Requests (Role-scoped)
 * - EMPLOYEE: strictly returns own requests
 * - ADMIN / PROCUREMENT_MANAGER: returns all company requests
 * - VENDOR: denied
 * @route GET /api/purchase-requests
 */
const getAllPurchaseRequests = async (req, res, next) => {
  try {
    const { status, priority, search, sortBy, sortOrder, all, requestedBy } = req.query;
    const query = {};

    // Strict role scoping for EMPLOYEE (cannot be overridden by query parameters)
    if (req.user.role === UserRoles.EMPLOYEE) {
      query.requestedBy = req.user._id;
    } else if (
      (req.user.role === UserRoles.ADMIN || req.user.role === UserRoles.PROCUREMENT_MANAGER) &&
      requestedBy
    ) {
      if (!isValidObjectId(requestedBy)) {
        return errorResponse(res, 400, 'Invalid requestedBy user ID');
      }
      query.requestedBy = requestedBy;
    }

    // Filter by status if specified
    if (status && status !== 'ALL') {
      const normalizedStatus = status.toUpperCase();
      if (Object.values(RequestStatus).includes(normalizedStatus)) {
        query.status = normalizedStatus;
      }
    }

    // Filter by priority if specified
    if (priority && priority !== 'ALL') {
      const normalizedPriority = priority.toUpperCase();
      if (Object.values(RequestPriority).includes(normalizedPriority)) {
        query.priority = normalizedPriority;
      }
    }

    // Search filter across requestNumber, title, description, department, and item names
    if (search && search.trim()) {
      const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
      query.$or = [
        { requestNumber: searchRegex },
        { title: searchRegex },
        { description: searchRegex },
        { department: searchRegex },
        { 'items.name': searchRegex },
      ];
    }

    // Safe sorting whitelist
    const allowedSortFields = ['createdAt', 'requiredDate', 'status', 'priority', 'requestNumber', 'title'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortDirection = sortOrder === 'asc' || sortOrder === '1' ? 1 : -1;
    const sortOptions = { [sortField]: sortDirection };

    // Pagination parameters
    const isAll = all === 'true' || req.query.limit === 'all';
    const page = toSafeInteger(req.query.page, 1, 1);
    const limit = isAll ? 0 : toSafeInteger(req.query.limit, 10, 1, 100);
    const skip = isAll ? 0 : (page - 1) * limit;

    let findQuery = PurchaseRequest.find(query)
      .sort(sortOptions)
      .populate('requestedBy', 'name email role')
      .populate('reviewedBy', 'name email');

    if (!isAll) {
      findQuery = findQuery.skip(skip).limit(limit);
    }

    const [total, purchaseRequests] = await Promise.all([
      PurchaseRequest.countDocuments(query),
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

    return successResponse(res, 200, 'Purchase requests retrieved successfully', {
      count: purchaseRequests.length,
      total,
      purchaseRequests,
      items: purchaseRequests,
      pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get specific Purchase Request by ID
 * - EMPLOYEE: strictly forbidden from accessing another employee's request
 * @route GET /api/purchase-requests/:id
 */
const getPurchaseRequestById = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return errorResponse(res, 404, 'Purchase request not found');
    }

    const purchaseRequest = await PurchaseRequest.findById(req.params.id)
      .populate('requestedBy', 'name email role')
      .populate('reviewedBy', 'name email');

    if (!purchaseRequest) {
      return errorResponse(res, 404, 'Purchase request not found');
    }

    // Enforce ownership for EMPLOYEE role
    if (req.user.role === UserRoles.EMPLOYEE) {
      const isOwner =
        purchaseRequest.requestedBy &&
        purchaseRequest.requestedBy._id.toString() === req.user._id.toString();

      if (!isOwner) {
        return errorResponse(
          res,
          403,
          'Access denied. You can only view your own purchase requests.'
        );
      }
    }

    return successResponse(res, 200, 'Purchase request retrieved successfully', {
      purchaseRequest,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Purchase Request (Allowed for draft requests by owner)
 * @route PUT /api/purchase-requests/:id
 */
const updatePurchaseRequest = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return errorResponse(res, 404, 'Purchase request not found');
    }

    const purchaseRequest = await PurchaseRequest.findById(req.params.id);

    if (!purchaseRequest) {
      return errorResponse(res, 404, 'Purchase request not found');
    }

    // Enforce ownership for EMPLOYEE role
    if (req.user.role === UserRoles.EMPLOYEE) {
      if (purchaseRequest.requestedBy.toString() !== req.user._id.toString()) {
        return errorResponse(res, 403, 'Access denied. You can only edit your own purchase requests.');
      }
    }

    // Only DRAFT requests can be edited
    if (purchaseRequest.status !== RequestStatus.DRAFT) {
      return errorResponse(
        res,
        400,
        `Cannot edit request in '${purchaseRequest.status}' status. Only DRAFT requests can be edited.`
      );
    }

    const { title, description, items, priority, requiredDate } = req.body;

    if (title !== undefined) purchaseRequest.title = title.trim();
    if (description !== undefined) purchaseRequest.description = description.trim();
    if (requiredDate !== undefined) purchaseRequest.requiredDate = requiredDate ? new Date(requiredDate) : undefined;
    if (priority && Object.values(RequestPriority).includes(priority.toUpperCase())) {
      purchaseRequest.priority = priority.toUpperCase();
    }

    if (items && Array.isArray(items) && items.length > 0) {
      purchaseRequest.items = items.map((it) => ({
        name: it.name.trim(),
        quantity: Number(it.quantity) || 1,
        estimatedPrice: Number(it.estimatedPrice) || 0,
        description: it.description?.trim() || '',
        category: it.category?.trim() || '',
        masterProductId: it.masterProductId || null,
        masterCatalogId: it.masterCatalogId?.trim() || '',
        brand: it.brand?.trim() || '',
        model: it.model?.trim() || '',
        referencePrice: Number(it.referencePrice) || 0,
        unit: it.unit?.trim() || 'Units',
        imageUrl: it.imageUrl?.trim() || '',
      }));
    }

    await purchaseRequest.save();
    await purchaseRequest.populate('requestedBy', 'name email role');

    return successResponse(res, 200, 'Purchase request updated successfully', {
      purchaseRequest,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Submit a DRAFT purchase request for review
 * @route PATCH /api/purchase-requests/:id/submit
 */
const submitPurchaseRequest = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return errorResponse(res, 404, 'Purchase request not found');
    }

    const purchaseRequest = await PurchaseRequest.findById(req.params.id);

    if (!purchaseRequest) {
      return errorResponse(res, 404, 'Purchase request not found');
    }

    // Ownership check for EMPLOYEE
    if (req.user.role === UserRoles.EMPLOYEE) {
      if (purchaseRequest.requestedBy.toString() !== req.user._id.toString()) {
        return errorResponse(res, 403, 'Access denied. You can only submit your own purchase requests.');
      }
    }

    if (purchaseRequest.status !== RequestStatus.DRAFT) {
      return errorResponse(
        res,
        400,
        `Only DRAFT requests can be submitted. Current status: ${purchaseRequest.status}`
      );
    }

    purchaseRequest.status = RequestStatus.SUBMITTED;
    await purchaseRequest.save();
    await purchaseRequest.populate('requestedBy', 'name email role');

    // Notify Procurement & Admin of submission
    const reviewers = await User.find({
      role: { $in: [UserRoles.PROCUREMENT_MANAGER, UserRoles.ADMIN] },
    });
    for (const reviewer of reviewers) {
      await Notification.create({
        recipient: reviewer._id,
        title: `Purchase Request Submitted: ${purchaseRequest.requestNumber}`,
        message: `Requisition '${purchaseRequest.title}' (${purchaseRequest.requestNumber}) submitted by ${purchaseRequest.requestedBy?.name || 'Employee'} requires review.`,
        type: NotificationType.WARNING,
        link: '/purchase-requests',
        metadata: {
          purchaseRequestId: purchaseRequest._id,
          requestNumber: purchaseRequest.requestNumber,
          status: 'SUBMITTED',
          type: 'PR_SUBMITTED',
        },
      });
    }

    await auditService.log({
      user: req.user,
      action: 'PURCHASE_REQUEST_SUBMITTED',
      entityType: 'PurchaseRequest',
      entityId: purchaseRequest._id,
      description: `Purchase request ${purchaseRequest.requestNumber} submitted for approval`,
      metadata: {
        requestNumber: purchaseRequest.requestNumber,
        title: purchaseRequest.title,
      },
    });

    return successResponse(res, 200, 'Purchase request submitted for procurement review', {
      purchaseRequest,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Approve Purchase Request
 * @access PROCUREMENT_MANAGER, ADMIN only
 * @route PATCH /api/purchase-requests/:id/approve
 */
const approvePurchaseRequest = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return errorResponse(res, 404, 'Purchase request not found');
    }

    const purchaseRequest = await PurchaseRequest.findById(req.params.id);

    if (!purchaseRequest) {
      return errorResponse(res, 404, 'Purchase request not found');
    }

    // Can only approve requests that are in SUBMITTED status
    if (purchaseRequest.status !== RequestStatus.SUBMITTED) {
      return errorResponse(
        res,
        400,
        `Invalid status transition. Only SUBMITTED requests can be approved. Current status: ${purchaseRequest.status}`
      );
    }

    purchaseRequest.status = RequestStatus.APPROVED;
    purchaseRequest.reviewedBy = req.user._id;
    purchaseRequest.reviewedAt = new Date();
    await purchaseRequest.save();

    await purchaseRequest.populate('requestedBy', 'name email role');
    await purchaseRequest.populate('reviewedBy', 'name email');

    // Notify requesting Employee
    if (purchaseRequest.requestedBy) {
      await Notification.create({
        recipient: purchaseRequest.requestedBy._id || purchaseRequest.requestedBy,
        title: `Purchase Request Approved: ${purchaseRequest.requestNumber}`,
        message: `Your purchase request ${purchaseRequest.requestNumber} ('${purchaseRequest.title}') has been approved by procurement.`,
        type: NotificationType.SUCCESS,
        link: '/purchase-requests',
        metadata: {
          purchaseRequestId: purchaseRequest._id,
          requestNumber: purchaseRequest.requestNumber,
          status: 'APPROVED',
          type: 'PR_APPROVED',
        },
      });
    }

    await auditService.log({
      user: req.user,
      action: 'PURCHASE_REQUEST_APPROVED',
      entityType: 'PurchaseRequest',
      entityId: purchaseRequest._id,
      description: `Purchase request ${purchaseRequest.requestNumber} approved by ${req.user.name}`,
      metadata: {
        requestNumber: purchaseRequest.requestNumber,
        title: purchaseRequest.title,
      },
    });

    return successResponse(res, 200, 'Purchase request approved successfully', {
      purchaseRequest,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reject Purchase Request
 * @access PROCUREMENT_MANAGER, ADMIN only
 * @route PATCH /api/purchase-requests/:id/reject
 */
const rejectPurchaseRequest = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return errorResponse(res, 404, 'Purchase request not found');
    }

    const { reason } = req.body;
    const purchaseRequest = await PurchaseRequest.findById(req.params.id);

    if (!purchaseRequest) {
      return errorResponse(res, 404, 'Purchase request not found');
    }

    // Can only reject requests that are in SUBMITTED status
    if (purchaseRequest.status !== RequestStatus.SUBMITTED) {
      return errorResponse(
        res,
        400,
        `Invalid status transition. Only SUBMITTED requests can be rejected. Current status: ${purchaseRequest.status}`
      );
    }

    purchaseRequest.status = RequestStatus.REJECTED;
    purchaseRequest.reviewedBy = req.user._id;
    purchaseRequest.reviewedAt = new Date();
    if (reason && reason.trim()) {
      purchaseRequest.rejectionReason = reason.trim();
    }

    await purchaseRequest.save();
    await purchaseRequest.populate('requestedBy', 'name email role');
    await purchaseRequest.populate('reviewedBy', 'name email');

    // Notify requesting Employee of rejection
    if (purchaseRequest.requestedBy) {
      const reasonText = purchaseRequest.rejectionReason ? ` Reason: ${purchaseRequest.rejectionReason}` : '';
      await Notification.create({
        recipient: purchaseRequest.requestedBy._id || purchaseRequest.requestedBy,
        title: `Purchase Request Rejected: ${purchaseRequest.requestNumber}`,
        message: `Your purchase request ${purchaseRequest.requestNumber} ('${purchaseRequest.title}') was declined by procurement.${reasonText}`,
        type: NotificationType.ALERT,
        link: '/purchase-requests',
        metadata: {
          purchaseRequestId: purchaseRequest._id,
          requestNumber: purchaseRequest.requestNumber,
          status: 'REJECTED',
          rejectionReason: purchaseRequest.rejectionReason,
          type: 'PR_REJECTED',
        },
      });
    }

    await auditService.log({
      user: req.user,
      action: 'PURCHASE_REQUEST_REJECTED',
      entityType: 'PurchaseRequest',
      entityId: purchaseRequest._id,
      entityName: purchaseRequest.requestNumber,
      metadata: {
        rejectionReason: purchaseRequest.rejectionReason,
        requestedBy: purchaseRequest.requestedBy?._id || purchaseRequest.requestedBy,
      },
      req,
    });

    return successResponse(res, 200, 'Purchase request rejected', {
      purchaseRequest,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel Purchase Request
 * @access EMPLOYEE (owner), ADMIN
 * @route PATCH /api/purchase-requests/:id/cancel
 */
const cancelPurchaseRequest = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return errorResponse(res, 404, 'Purchase request not found');
    }

    const purchaseRequest = await PurchaseRequest.findById(req.params.id);

    if (!purchaseRequest) {
      return errorResponse(res, 404, 'Purchase request not found');
    }

    // Ownership check for EMPLOYEE
    if (req.user.role === UserRoles.EMPLOYEE) {
      if (purchaseRequest.requestedBy.toString() !== req.user._id.toString()) {
        return errorResponse(res, 403, 'Access denied. You can only cancel your own purchase requests.');
      }
    }

    // Only DRAFT or SUBMITTED requests can be cancelled
    if (![RequestStatus.DRAFT, RequestStatus.SUBMITTED].includes(purchaseRequest.status)) {
      return errorResponse(
        res,
        400,
        `Cannot cancel request with status '${purchaseRequest.status}'. Only DRAFT or SUBMITTED requests can be cancelled.`
      );
    }

    const wasSubmitted = purchaseRequest.status === RequestStatus.SUBMITTED;

    purchaseRequest.status = RequestStatus.CANCELLED;
    await purchaseRequest.save();
    await purchaseRequest.populate('requestedBy', 'name email role');

    // If it was submitted, notify Procurement & Admin of cancellation
    if (wasSubmitted) {
      const reviewers = await User.find({
        role: { $in: [UserRoles.PROCUREMENT_MANAGER, UserRoles.ADMIN] },
      });
      for (const reviewer of reviewers) {
        await Notification.create({
          recipient: reviewer._id,
          title: `Purchase Request Cancelled: ${purchaseRequest.requestNumber}`,
          message: `Requisition '${purchaseRequest.title}' (${purchaseRequest.requestNumber}) was cancelled by ${purchaseRequest.requestedBy?.name || 'requester'}.`,
          type: NotificationType.INFO,
          link: '/purchase-requests',
          metadata: {
            purchaseRequestId: purchaseRequest._id,
            requestNumber: purchaseRequest.requestNumber,
            status: 'CANCELLED',
            type: 'PR_CANCELLED',
          },
        });
      }
    }

    await auditService.log({
      user: req.user,
      action: 'PURCHASE_REQUEST_CANCELLED',
      entityType: 'PurchaseRequest',
      entityId: purchaseRequest._id,
      entityName: purchaseRequest.requestNumber,
      metadata: {
        wasSubmitted,
      },
      req,
    });

    return successResponse(res, 200, 'Purchase request cancelled successfully', {
      purchaseRequest,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Normalization helper for specifications and technical terms
 */
const normalizeTokens = (text) => {
  if (!text) return [];
  const cleaned = text
    .toLowerCase()
    .replace(/(\d+)\s*(gb|tb|mb)/gi, '$1 $2')
    .replace(/[^a-z0-9\s]/gi, ' ');

  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'a', 'an', 'in', 'on', 'at', 'to', 'of', 'by', 'is', 'it', 'or', 'as',
  ]);

  return cleaned
    .split(/\s+/)
    .filter((t) => t.length > 1 && !stopWords.has(t));
};

/**
 * Check product availability and compute deterministic match scores for an approved purchase request
 * @access PROCUREMENT_MANAGER, ADMIN
 * @route GET /api/purchase-requests/:id/availability
 * @route POST /api/purchase-requests/:id/check-availability
 */
const checkPurchaseRequestAvailability = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return errorResponse(res, 404, 'Purchase request not found');
    }

    const { Product } = require('../models/Product');
    const { Vendor, OnboardingStatus } = require('../models/Vendor');
    const { AuditLog } = require('../models/AuditLog');

    const purchaseRequest = await PurchaseRequest.findById(req.params.id)
      .populate('requestedBy', 'name email role')
      .populate('selectedVendor', 'companyName email phone city')
      .populate('selectedProduct');

    if (!purchaseRequest) {
      return errorResponse(res, 404, 'Purchase request not found');
    }

    // Verify request is eligible for availability checking (APPROVED or SUBMITTED)
    if (![RequestStatus.APPROVED, RequestStatus.SUBMITTED].includes(purchaseRequest.status)) {
      return errorResponse(
        res,
        400,
        `Cannot check availability for purchase request with status '${purchaseRequest.status}'. Must be SUBMITTED or APPROVED.`
      );
    }

    // Retrieve approved vendors only (Strict DB filter: excludes PENDING, UNDER_REVIEW, REJECTED)
    const approvedVendors = await Vendor.find({
      onboardingStatus: OnboardingStatus.APPROVED,
    }).select('_id companyName email phone city state onboardingStatus');

    const approvedVendorIds = approvedVendors.map((v) => v._id);

    // Retrieve all products from approved vendors (including inactive or 0 stock to show UNAVAILABLE)
    const products = await Product.find({
      vendor: { $in: approvedVendorIds },
    }).populate('vendor', 'companyName email phone city state onboardingStatus shopImage shopImages');

    const checkedAt = new Date().toISOString();

    // Days remaining until requiredDate (backend calculation)
    let daysRemaining = null;
    if (purchaseRequest.requiredDate) {
      const now = new Date();
      const reqDate = new Date(purchaseRequest.requiredDate);
      daysRemaining = Math.max(0, Math.ceil((reqDate - now) / (1000 * 60 * 60 * 24)));
    }

    let allItemsFullyAvailable = true;
    let anyItemAvailable = false;

    const matchedItems = (purchaseRequest.items || []).map((reqItem) => {
      const requestedQty = Number(reqItem.quantity) || 1;
      const requestedName = (reqItem.name || '').toLowerCase().trim();
      const requestedCategory = (reqItem.category || '').toLowerCase().trim();

      // Tokenize requested name, description, and request context
      const requestedNameTokens = normalizeTokens(reqItem.name);
      const requestedSpecTokens = normalizeTokens(
        `${reqItem.name} ${reqItem.description || ''} ${purchaseRequest.description || ''}`
      );

      const candidateMatches = products
        .map((product) => {
          const prodName = (product.productName || '').toLowerCase();
          const prodDesc = (product.description || '').toLowerCase();
          const prodSpec = (product.specifications || '').toLowerCase();
          const prodCategory = (product.category || '').toLowerCase();

          const prodTokens = normalizeTokens(
            `${product.productName} ${product.description || ''} ${product.specifications || ''} ${product.category || ''}`
          );
          const prodTokensSet = new Set(prodTokens);

          // Check for Master Catalog Exact Match
          const isCatalogExactMatch = Boolean(
            (reqItem.masterCatalogId && product.masterCatalogId && reqItem.masterCatalogId.trim() === product.masterCatalogId.trim()) ||
            (reqItem.masterProductId && product.masterProduct && reqItem.masterProductId.toString() === product.masterProduct.toString())
          );

          // 1. Category Similarity (up to 15 pts)
          let categoryScore = 0;
          if (isCatalogExactMatch) {
            categoryScore = 15;
          } else if (requestedCategory && prodCategory === requestedCategory) {
            categoryScore = 15;
          } else if (
            requestedCategory &&
            (prodCategory.includes(requestedCategory) || requestedCategory.includes(prodCategory))
          ) {
            categoryScore = 10;
          } else if (prodCategory.includes(requestedName) || requestedName.includes(prodCategory)) {
            categoryScore = 8;
          } else if (!requestedCategory) {
            categoryScore = 15; // Neutral if no category requested
          } else {
            categoryScore = 0;
          }

          // 2. Product Name Similarity (up to 20 pts)
          let nameScore = 0;
          if (isCatalogExactMatch) {
            nameScore = 20;
          } else if (prodName.includes(requestedName) || requestedName.includes(prodName)) {
            nameScore = 20;
          } else {
            let matchedNameTokens = 0;
            requestedNameTokens.forEach((t) => {
              if (prodName.includes(t)) matchedNameTokens++;
            });
            if (requestedNameTokens.length > 0) {
              nameScore = Math.min(20, Math.round((matchedNameTokens / requestedNameTokens.length) * 20));
            }
          }

          // 3. Specification & Keyword Similarity (up to 15 pts)
          let specScore = 0;
          if (isCatalogExactMatch) {
            specScore = 15;
          } else {
            let matchedSpecTokens = 0;
            requestedSpecTokens.forEach((t) => {
              if (prodTokensSet.has(t) || prodSpec.includes(t) || prodDesc.includes(t)) {
                matchedSpecTokens++;
              }
            });
            if (requestedSpecTokens.length > 0) {
              const specRatio = matchedSpecTokens / requestedSpecTokens.length;
              specScore = Math.min(15, Math.round(specRatio * 15));
            } else {
              specScore = 10; // Neutral if no specifications specified
            }
          }

          // 4. Quantity & Stock Availability Classification (up to 20 pts)
          let availability = 'UNAVAILABLE';
          let availabilityScore = 0;
          if (!product.isAvailable || product.availableQuantity === 0) {
            availability = 'UNAVAILABLE';
            availabilityScore = 0;
          } else if (product.availableQuantity >= requestedQty) {
            availability = 'AVAILABLE';
            availabilityScore = 20;
          } else {
            availability = 'PARTIAL';
            availabilityScore = 10;
          }

          // 5. Price Suitability (up to 15 pts)
          let priceStatus = 'NO_BUDGET_SPECIFIED';
          let priceScore = 15;
          if (reqItem.estimatedPrice && reqItem.estimatedPrice > 0) {
            if (product.price <= reqItem.estimatedPrice) {
              priceStatus = 'WITHIN_BUDGET';
              priceScore = 15;
            } else if (product.price <= reqItem.estimatedPrice * 1.25) {
              priceStatus = 'ABOVE_BUDGET';
              priceScore = 8;
            } else {
              priceStatus = 'ABOVE_BUDGET';
              priceScore = 3;
            }
          }

          // 6. Delivery Suitability (up to 15 pts)
          let deliveryStatus = 'STANDARD_SLA';
          let deliveryScore = 10;
          if (daysRemaining !== null) {
            if (product.deliveryDays <= daysRemaining) {
              deliveryStatus = 'MEETS_REQUIREMENT';
              deliveryScore = 15;
            } else {
              deliveryStatus = 'EXCEEDS_REQUESTED_DATE';
              deliveryScore = 5;
            }
          } else {
            if (product.deliveryDays <= 3) {
              deliveryStatus = 'MEETS_REQUIREMENT';
              deliveryScore = 15;
            } else if (product.deliveryDays <= 7) {
              deliveryStatus = 'MEETS_REQUIREMENT';
              deliveryScore = 10;
            } else {
              deliveryStatus = 'EXTENDED_SLA';
              deliveryScore = 5;
            }
          }

          // Total match score (0 - 100%)
          const totalScore = Math.min(
            100,
            Math.max(
              0,
              categoryScore + nameScore + specScore + availabilityScore + priceScore + deliveryScore
            )
          );

          return {
            product,
            vendor: product.vendor,
            requestedQuantity: requestedQty,
            availableQuantity: product.availableQuantity,
            availability,
            availabilityStatus: availability,
            matchScore: totalScore,
            unitPrice: product.price,
            totalCalculatedPrice: product.price * requestedQty,
            estimatedPrice: reqItem.estimatedPrice || 0,
            referencePrice: product.referencePrice || 0,
            marketPrice: product.marketPrice || product.referencePrice || 0,
            marketPriceStatus: product.marketPriceStatus || 'REFERENCE',
            masterCatalogId: product.masterCatalogId || '',
            isCatalogMatch: isCatalogExactMatch,
            priceStatus,
            deliveryDays: product.deliveryDays,
            daysRemaining,
            deliveryStatus,
            lastInventoryUpdate: product.lastStockUpdate || product.updatedAt,
            scoreBreakdown: {
              categoryScore,
              nameScore,
              specScore,
              availabilityScore,
              priceScore,
              deliveryScore,
            },
          };
        })
        // Filter out completely unrelated products (score must be at least 15%)
        .filter((c) => c.matchScore >= 15)
        .sort((a, b) => {
          // Sort by match score desc, then availability desc, then price asc
          if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
          if (a.availability === 'AVAILABLE' && b.availability !== 'AVAILABLE') return -1;
          if (b.availability === 'AVAILABLE' && a.availability !== 'AVAILABLE') return 1;
          return a.unitPrice - b.unitPrice;
        });

      const hasFullAvailable = candidateMatches.some((c) => c.availability === 'AVAILABLE');
      const hasPartialAvailable = candidateMatches.some((c) => c.availability === 'PARTIAL');

      if (!hasFullAvailable) allItemsFullyAvailable = false;
      if (hasPartialAvailable || hasFullAvailable) anyItemAvailable = true;

      // Identify Best Match (top suitable candidate with available or partial stock)
      const bestMatch =
        candidateMatches.find((c) => c.availability === 'AVAILABLE') ||
        candidateMatches.find((c) => c.availability === 'PARTIAL') ||
        candidateMatches[0] ||
        null;

      return {
        item: reqItem,
        itemName: reqItem.name,
        specifications: reqItem.specifications,
        description: reqItem.description,
        estimatedPrice: reqItem.estimatedPrice,
        estimatedBudget: (reqItem.estimatedPrice || 0) * (reqItem.quantity || 1),
        requestedQuantity: requestedQty,
        matchCount: candidateMatches.length,
        hasSufficientStock: hasFullAvailable,
        bestMatch,
        candidates: candidateMatches,
      };
    });

    let overallAvailability = 'NOT AVAILABLE';
    if (allItemsFullyAvailable && matchedItems.length > 0) {
      overallAvailability = 'AVAILABLE';
    } else if (anyItemAvailable) {
      overallAvailability = 'PARTIALLY AVAILABLE';
    }

    // Identify Overall Recommended Option across all items
    const recommendedOption = matchedItems[0]?.bestMatch || null;

    // Optional audit log for procurement check
    try {
      await AuditLog.create({
        user: req.user._id,
        action: 'AVAILABILITY_CHECKED',
        entityType: 'PurchaseRequest',
        entityId: purchaseRequest._id,
        description: `Procurement checked availability for request ${purchaseRequest.requestNumber} (${matchedItems.length} items checked)`,
      });
    } catch {
      // Non-blocking audit log
    }

    return successResponse(res, 200, 'Availability check and product matching completed', {
      purchaseRequest,
      checkedAt,
      daysRemaining,
      overallAvailability,
      recommendedOption,
      items: matchedItems,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Procurement selects product & vendor for an approved purchase request
 * Does NOT deduct availableQuantity prematurely.
 * @access PROCUREMENT_MANAGER, ADMIN
 * @route POST /api/purchase-requests/:id/select-product
 */
const selectProductForPurchaseRequest = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return errorResponse(res, 404, 'Purchase request not found');
    }

    const { Product } = require('../models/Product');
    const { Vendor, OnboardingStatus } = require('../models/Vendor');
    const { AuditLog } = require('../models/AuditLog');

    const { productId, vendorId, quantity, unitPrice, notes, matchScore } = req.body;

    if (!productId || !isValidObjectId(productId)) return errorResponse(res, 400, 'Valid productId is required');
    if (!vendorId || !isValidObjectId(vendorId)) return errorResponse(res, 400, 'Valid vendorId is required');

    const purchaseRequest = await PurchaseRequest.findById(req.params.id);
    if (!purchaseRequest) {
      return errorResponse(res, 404, 'Purchase request not found');
    }

    // Verify status is APPROVED
    if (purchaseRequest.status !== RequestStatus.APPROVED) {
      return errorResponse(
        res,
        400,
        `Cannot select product for request with status '${purchaseRequest.status}'. Requisition must be APPROVED.`
      );
    }

    // Verify Vendor is APPROVED
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return errorResponse(res, 404, 'Selected supplier not found');
    }
    if (vendor.onboardingStatus !== OnboardingStatus.APPROVED) {
      return errorResponse(res, 400, `Supplier '${vendor.companyName}' is not approved for procurement.`);
    }

    // Verify Product exists and belongs to Vendor
    const product = await Product.findById(productId);
    if (!product) {
      return errorResponse(res, 404, 'Selected product not found');
    }
    if (product.vendor.toString() !== vendor._id.toString()) {
      return errorResponse(res, 400, 'Selected product does not belong to the specified vendor.');
    }

    const requesterPrice = Number(purchaseRequest.items?.[0]?.requesterRequestedPrice ?? purchaseRequest.items?.[0]?.estimatedPrice) || 0;
    const selectedQty = Number(quantity) || purchaseRequest.items?.[0]?.quantity || 1;
    const finalUnitPrice = Number(unitPrice) !== undefined && !isNaN(Number(unitPrice)) ? Number(unitPrice) : product.price;
    const totalPrice = selectedQty * finalUnitPrice;
    const priceDiff = finalUnitPrice - requesterPrice;
    const totalDiff = priceDiff * selectedQty;

    // Associate selection with the PurchaseRequest document without overwriting requester price
    purchaseRequest.selectedVendor = vendor._id;
    purchaseRequest.selectedProduct = product._id;
    purchaseRequest.selectionDetails = {
      productId: product._id,
      vendorId: vendor._id,
      productName: product.productName,
      vendorName: vendor.companyName,
      quantity: selectedQty,
      unitPrice: finalUnitPrice,
      vendorUnitPrice: finalUnitPrice,
      requesterRequestedPrice: requesterPrice,
      priceDifference: priceDiff,
      totalDifference: totalDiff,
      totalPrice,
      deliveryDays: product.deliveryDays,
      matchScore: Number(matchScore) || 95,
      notes: notes || `Product selected by procurement for fulfillment`,
      selectedAt: new Date(),
      selectedBy: req.user._id,
    };

    await purchaseRequest.save();

    await purchaseRequest.populate([
      { path: 'requestedBy', select: 'name email role' },
      { path: 'selectedVendor', select: 'companyName email phone city state' },
      { path: 'selectedProduct', select: 'productName price availableQuantity deliveryDays specifications' },
    ]);

    // Record audit log
    try {
      await AuditLog.create({
        user: req.user._id,
        action: 'PRODUCT_SELECTED',
        entityType: 'PurchaseRequest',
        entityId: purchaseRequest._id,
        description: `Procurement selected '${product.productName}' from '${vendor.companyName}' for requisition ${purchaseRequest.requestNumber}`,
      });
    } catch {
      // Non-blocking
    }

    return successResponse(res, 200, 'Product and vendor selected successfully for purchase request', {
      purchaseRequest,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPurchaseRequest,
  getAllPurchaseRequests,
  getPurchaseRequestById,
  updatePurchaseRequest,
  submitPurchaseRequest,
  approvePurchaseRequest,
  rejectPurchaseRequest,
  cancelPurchaseRequest,
  checkPurchaseRequestAvailability,
  selectProductForPurchaseRequest,
};
