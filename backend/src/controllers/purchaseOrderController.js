const { PurchaseOrder, POStatus } = require('../models/PurchaseOrder');
const { PurchaseRequest, RequestStatus } = require('../models/PurchaseRequest');
const { Vendor, OnboardingStatus } = require('../models/Vendor');
const { Product } = require('../models/Product');
const { User, UserRoles } = require('../models/User');
const { Notification, NotificationType } = require('../models/Notification');
const { AuditLog } = require('../models/AuditLog');
const { Evaluation } = require('../models/Evaluation');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { escapeRegex, isValidObjectId, toSafeInteger } = require('../utils/sanitize');
const auditService = require('../services/auditService');
const receiptService = require('../services/receiptService');

/**
 * Helper to get vendor associated with authenticated user
 */
const getAuthenticatedVendor = async (user) => {
  return await Vendor.findOne({
    $or: [{ createdBy: user._id }, { email: user.email }],
  });
};

/**
 * Helper to record audit logs safely
 */
const recordAuditLog = async (userId, action, entityId, description) => {
  try {
    await AuditLog.create({
      user: userId,
      action,
      entityType: 'PurchaseOrder',
      entityId,
      description,
    });
  } catch {
    // Non-blocking
  }
};

/**
 * Helper to generate sequential and collision-safe PO number (PO-YYYY-XXXXX)
 */
const generatePoNumber = async () => {
  const year = new Date().getFullYear();
  const count = await PurchaseOrder.countDocuments();
  let candidate = `PO-${year}-${String(count + 1).padStart(5, '0')}`;

  let existing = await PurchaseOrder.findOne({ poNumber: candidate });
  let attempts = 1;
  while (existing && attempts < 20) {
    candidate = `PO-${year}-${String(count + 1 + attempts).padStart(5, '0')}`;
    existing = await PurchaseOrder.findOne({ poNumber: candidate });
    attempts++;
  }
  if (existing) {
    candidate = `PO-${year}-${Math.floor(10000 + Math.random() * 90000)}`;
  }
  return candidate;
};

/**
 * Create a new Purchase Order from an approved Purchase Request
 * @access PROCUREMENT_MANAGER, ADMIN
 * @route POST /api/purchase-orders
 */
const createPurchaseOrder = async (req, res, next) => {
  try {
    const {
      purchaseRequestId,
      vendorId,
      productId,
      items,
      expectedDeliveryDate,
      tax = 0,
      notes,
    } = req.body;

    if (!purchaseRequestId || !isValidObjectId(purchaseRequestId)) {
      return errorResponse(res, 400, 'Valid purchaseRequestId is required');
    }

    if (!vendorId || !isValidObjectId(vendorId)) {
      return errorResponse(res, 400, 'Valid vendorId is required');
    }

    // 1. Verify Purchase Request exists and is approved
    const purchaseRequest = await PurchaseRequest.findById(purchaseRequestId);
    if (!purchaseRequest) {
      return errorResponse(res, 404, 'Referenced purchase request not found');
    }

    if (purchaseRequest.status !== RequestStatus.APPROVED) {
      return errorResponse(
        res,
        400,
        `Cannot issue purchase order for a purchase request with status '${purchaseRequest.status}'. It must be APPROVED.`
      );
    }

    // 2. Verify Vendor exists and is approved
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return errorResponse(res, 404, 'Selected vendor not found');
    }

    if (vendor.onboardingStatus !== OnboardingStatus.APPROVED) {
      return errorResponse(
        res,
        400,
        `Selected vendor '${vendor.companyName}' is not approved for procurement orders.`
      );
    }

    // Extract requester requested price from referenced Purchase Request items
    const reqItem = purchaseRequest.items?.[0] || {};
    const requesterRequestedPrice = Number(reqItem.requesterRequestedPrice ?? reqItem.estimatedPrice) || 0;

    // 3. Construct line items & snapshot catalog data
    let poItems = [];

    if (Array.isArray(items) && items.length > 0) {
      for (const it of items) {
        const qty = Number(it.quantity) || 1;
        const targetProdId = it.product || it.productId;

        if (targetProdId) {
          const productDoc = await Product.findById(targetProdId);
          if (!productDoc) {
            return errorResponse(res, 404, `Selected catalog product '${it.name || targetProdId}' was not found`);
          }

          // Part 7: Final Live Availability Validation
          if (productDoc.availableQuantity < qty) {
            return errorResponse(
              res,
              400,
              `Current inventory is no longer sufficient. Please refresh availability. (${productDoc.productName} has ${productDoc.availableQuantity} available, but ${qty} were requested).`
            );
          }

          if (productDoc.isAvailable === false || productDoc.isActive === false) {
            return errorResponse(
              res,
              400,
              `Product '${productDoc.productName}' is currently marked unavailable by the supplier.`
            );
          }

          poItems.push({
            name: productDoc.productName,
            quantity: qty,
            unitPrice: productDoc.price,
            requesterRequestedPrice,
            vendorUnitPrice: productDoc.price,
            totalPrice: qty * productDoc.price,
            description: productDoc.description || productDoc.specifications || it.description || '',
            product: productDoc._id,
          });
        } else {
          // Non-catalog item fallback
          const uPrice = Number(it.unitPrice) || 0;
          poItems.push({
            name: it.name?.trim() || 'Purchased Item',
            quantity: qty,
            unitPrice: uPrice,
            requesterRequestedPrice,
            vendorUnitPrice: uPrice,
            totalPrice: qty * uPrice,
            description: it.description?.trim() || '',
            product: null,
          });
        }
      }
    } else if (productId) {
      const productDoc = await Product.findById(productId);
      if (!productDoc) {
        return errorResponse(res, 404, 'Selected product not found');
      }

      const defaultQty = purchaseRequest.items?.[0]?.quantity || 1;

      // Part 7: Final Live Availability Validation
      if (productDoc.availableQuantity < defaultQty) {
        return errorResponse(
          res,
          400,
          `Current inventory is no longer sufficient. Please refresh availability. (${productDoc.productName} has ${productDoc.availableQuantity} available, but ${defaultQty} were requested).`
        );
      }

      if (productDoc.isAvailable === false || productDoc.isActive === false) {
        return errorResponse(
          res,
          400,
          `Product '${productDoc.productName}' is currently marked unavailable by the supplier.`
        );
      }

      poItems = [
        {
          name: productDoc.productName,
          quantity: defaultQty,
          unitPrice: productDoc.price,
          requesterRequestedPrice,
          vendorUnitPrice: productDoc.price,
          totalPrice: defaultQty * productDoc.price,
          description: productDoc.description || productDoc.specifications || '',
          product: productDoc._id,
        },
      ];
    } else {
      // Fallback from Purchase Request items
      for (const it of purchaseRequest.items || []) {
        const qty = Number(it.quantity) || 1;
        const uPrice = Number(it.estimatedPrice) || 0;
        poItems.push({
          name: it.name,
          quantity: qty,
          unitPrice: uPrice,
          requesterRequestedPrice: uPrice,
          vendorUnitPrice: uPrice,
          totalPrice: qty * uPrice,
          description: it.description || '',
          product: null,
        });
      }
    }

    if (poItems.length === 0) {
      return errorResponse(res, 400, 'Purchase order must contain at least one line item');
    }

    const subtotal = poItems.reduce((acc, it) => acc + it.totalPrice, 0);
    const taxAmount = Number(tax) || 0;
    const totalAmount = subtotal + taxAmount;

    // Price comparison metrics (strictly preserved separately)
    const primaryVendorPrice = poItems[0]?.vendorUnitPrice || poItems[0]?.unitPrice || 0;
    const primaryQty = poItems[0]?.quantity || 1;
    const priceDiff = primaryVendorPrice - requesterRequestedPrice;
    const totalDiff = priceDiff * primaryQty;

    // Generate unique sequential PO number
    const poNumber = await generatePoNumber();

    const purchaseOrder = await PurchaseOrder.create({
      poNumber,
      vendor: vendor._id,
      purchaseRequest: purchaseRequest._id,
      requestedBy: purchaseRequest.requestedBy,
      createdBy: req.user._id,
      items: poItems,
      subtotal,
      tax: taxAmount,
      totalAmount,
      requesterRequestedPrice,
      vendorUnitPrice: primaryVendorPrice,
      priceDifference: priceDiff,
      totalDifference: totalDiff,
      inventoryDeducted: false,
      requesterApprovalStatus: 'PENDING',
      status: POStatus.SENT_TO_VENDOR,
      expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : undefined,
      statusHistory: [
        {
          status: POStatus.SENT_TO_VENDOR,
          changedBy: req.user._id,
          changedAt: new Date(),
          notes: notes || 'Purchase order generated and sent to vendor for fulfillment',
        },
      ],
    });

    // Record Audit Logs
    await auditService.log({
      user: req.user,
      action: 'PURCHASE_ORDER_CREATED',
      entityType: 'PurchaseOrder',
      entityId: purchaseOrder._id,
      entityName: poNumber,
      metadata: {
        vendorId: vendor._id,
        vendorName: vendor.companyName,
        purchaseRequestId: purchaseRequest._id,
        requestNumber: purchaseRequest.requestNumber,
        totalAmount,
        itemsCount: poItems.length,
      },
      req,
    });
    await recordAuditLog(
      req.user._id,
      'PO_SENT_TO_VENDOR',
      purchaseOrder._id,
      `Purchase Order ${poNumber} dispatched to vendor '${vendor.companyName}'`
    );

    // Notify vendor users
    const vendorUsers = await User.find({
      $or: [{ vendor: vendor._id }, { email: vendor.email }],
    });
    for (const vUser of vendorUsers) {
      await Notification.create({
        recipient: vUser._id,
        title: `New Purchase Order: ${poNumber}`,
        message: `You have received a new Purchase Order ${poNumber} for ₹${totalAmount.toLocaleString()}. Please accept or decline the order.`,
        type: NotificationType.INFO,
        link: '/vendor/orders',
        metadata: {
          purchaseOrderId: purchaseOrder._id,
          poNumber,
          status: POStatus.SENT_TO_VENDOR,
          type: 'PO_SENT_TO_VENDOR',
        },
      });
    }

    // Notify requesting employee that PO was issued
    if (purchaseOrder.requestedBy) {
      await Notification.create({
        recipient: purchaseOrder.requestedBy,
        title: `Purchase Order Issued: ${poNumber}`,
        message: `Purchase Order ${poNumber} for ₹${totalAmount.toLocaleString()} has been issued to supplier '${vendor.companyName}' for your requisition ${purchaseRequest.requestNumber}.`,
        type: NotificationType.INFO,
        link: '/employee/orders',
        metadata: {
          purchaseOrderId: purchaseOrder._id,
          poNumber,
          purchaseRequestId: purchaseRequest._id,
          requestNumber: purchaseRequest.requestNumber,
          status: POStatus.SENT_TO_VENDOR,
          type: 'PO_ISSUED',
        },
      });
    }

    await purchaseOrder.populate([
      { path: 'vendor', select: 'companyName email contactPerson phone city state shopImage shopImages' },
      { path: 'requestedBy', select: 'name email role' },
      { path: 'createdBy', select: 'name email role' },
      { path: 'purchaseRequest', select: 'requestNumber title priority' },
    ]);

    return successResponse(res, 201, 'Purchase order created and sent to vendor', {
      purchaseOrder,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Purchase Orders with role-based visibility
 * - VENDOR: only orders assigned to their vendor
 * - EMPLOYEE: only orders requested by the employee
 * - PROCUREMENT_MANAGER / ADMIN: all orders
 * @route GET /api/purchase-orders
 */
const getPurchaseOrders = async (req, res, next) => {
  try {
    const { status, vendorId, search, sortBy, sortOrder, all } = req.query;
    const query = {};

    if (req.user.role === UserRoles.VENDOR) {
      const vendor = await getAuthenticatedVendor(req.user);
      if (!vendor) {
        return successResponse(res, 200, 'No purchase orders found', {
          count: 0,
          total: 0,
          purchaseOrders: [],
          items: [],
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 1,
            hasPrevPage: false,
            hasNextPage: false,
          },
        });
      }
      query.vendor = vendor._id;
    } else if (req.user.role === UserRoles.EMPLOYEE) {
      query.requestedBy = req.user._id;
    } else if (
      req.user.role === UserRoles.PROCUREMENT_MANAGER ||
      req.user.role === UserRoles.ADMIN
    ) {
      if (vendorId) {
        if (!isValidObjectId(vendorId)) {
          return errorResponse(res, 400, 'Invalid vendorId');
        }
        query.vendor = vendorId;
      }
    } else {
      return errorResponse(res, 403, 'Access denied');
    }

    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
      query.$or = [
        { poNumber: searchRegex },
        { 'items.name': searchRegex },
      ];
    }

    // Safe sorting whitelist
    const allowedSortFields = ['createdAt', 'totalAmount', 'expectedDeliveryDate', 'poNumber', 'status'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortDirection = sortOrder === 'asc' || sortOrder === '1' ? 1 : -1;
    const sortOptions = { [sortField]: sortDirection };

    // Pagination parameters
    const isAll = all === 'true' || req.query.limit === 'all';
    const page = toSafeInteger(req.query.page, 1, 1);
    const limit = isAll ? 0 : toSafeInteger(req.query.limit, 10, 1, 100);
    const skip = isAll ? 0 : (page - 1) * limit;

    let findQuery = PurchaseOrder.find(query)
      .sort(sortOptions)
      .populate([
        { path: 'vendor', select: 'companyName email contactPerson phone city state shopImage shopImages' },
        { path: 'requestedBy', select: 'name email role' },
        { path: 'createdBy', select: 'name email role' },
        { path: 'purchaseRequest', select: 'requestNumber title priority' },
        { path: 'items.product', select: 'productName price availableQuantity isAvailable isActive deliveryDays' },
      ]);

    if (!isAll) {
      findQuery = findQuery.skip(skip).limit(limit);
    }

    const [total, purchaseOrders] = await Promise.all([
      PurchaseOrder.countDocuments(query),
      findQuery,
    ]);

    // Lookup evaluations for these purchase orders
    const poIds = purchaseOrders.map((p) => p._id);
    const evaluations = await Evaluation.find({ purchaseOrder: { $in: poIds } })
      .select('purchaseOrder qualityScore deliveryScore pricingScore supportScore overallScore comments createdAt');

    const evalMap = {};
    for (const ev of evaluations) {
      if (ev.purchaseOrder) {
        evalMap[ev.purchaseOrder.toString()] = {
          _id: ev._id,
          qualityScore: ev.qualityScore,
          deliveryScore: ev.deliveryScore,
          pricingScore: ev.pricingScore,
          supportScore: ev.supportScore,
          overallScore: ev.overallScore,
          comments: ev.comments,
          createdAt: ev.createdAt,
        };
      }
    }

    const enhancedOrders = purchaseOrders.map((p) => {
      const pObj = p.toObject ? p.toObject() : { ...p };
      pObj.evaluation = evalMap[p._id.toString()] || null;
      pObj.isEvaluated = Boolean(evalMap[p._id.toString()]);

      // Protect requester target price from vendor visibility (Part 1, 4, 8)
      if (req.user.role === UserRoles.VENDOR) {
        delete pObj.requesterRequestedPrice;
        delete pObj.priceDifference;
        delete pObj.totalDifference;
        if (pObj.items) {
          pObj.items = pObj.items.map((it) => {
            const itObj = it.toObject ? it.toObject() : { ...it };
            delete itObj.requesterRequestedPrice;
            return itObj;
          });
        }
      }

      return pObj;
    });

    const totalPages = limit > 0 ? (Math.ceil(total / limit) || 1) : 1;
    const pagination = {
      page: isAll ? 1 : page,
      limit: isAll ? total : limit,
      total,
      totalPages,
      hasPrevPage: !isAll && page > 1,
      hasNextPage: !isAll && page < totalPages,
    };

    return successResponse(res, 200, 'Purchase orders retrieved', {
      count: enhancedOrders.length,
      total,
      purchaseOrders: enhancedOrders,
      items: enhancedOrders,
      pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Purchase Order by ID
 * @route GET /api/purchase-orders/:id
 */
const getPurchaseOrderById = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return errorResponse(res, 404, 'Purchase order not found');
    }

    const purchaseOrder = await PurchaseOrder.findById(req.params.id).populate([
      { path: 'vendor', select: 'companyName email contactPerson phone city state address shopImage shopImages' },
      { path: 'requestedBy', select: 'name email role' },
      { path: 'createdBy', select: 'name email role' },
      { path: 'purchaseRequest', select: 'requestNumber title priority description requiredDate' },
      { path: 'items.product', select: 'productName price availableQuantity isAvailable isActive deliveryDays' },
      { path: 'statusHistory.changedBy', select: 'name email role' },
    ]);

    if (!purchaseOrder) {
      return errorResponse(res, 404, 'Purchase order not found');
    }

    // Role-based authorization
    if (req.user.role === UserRoles.VENDOR) {
      const vendor = await getAuthenticatedVendor(req.user);
      if (!vendor || purchaseOrder.vendor._id.toString() !== vendor._id.toString()) {
        return errorResponse(res, 403, 'Access denied. You can only view orders assigned to your vendor.');
      }
    } else if (req.user.role === UserRoles.EMPLOYEE) {
      if (
        !purchaseOrder.requestedBy ||
        purchaseOrder.requestedBy._id.toString() !== req.user._id.toString()
      ) {
        return errorResponse(res, 403, 'Access denied. You can only view orders requested by you.');
      }
    }

    const evaluation = await Evaluation.findOne({ purchaseOrder: purchaseOrder._id })
      .select('qualityScore deliveryScore pricingScore supportScore overallScore comments createdAt');

    const poObj = purchaseOrder.toObject();
    poObj.evaluation = evaluation || null;
    poObj.isEvaluated = Boolean(evaluation);

    // Protect requester target price from vendor visibility (Part 1, 4, 8)
    if (req.user.role === UserRoles.VENDOR) {
      delete poObj.requesterRequestedPrice;
      delete poObj.priceDifference;
      delete poObj.totalDifference;
      if (poObj.items) {
        poObj.items = poObj.items.map((it) => {
          const itObj = { ...it };
          delete itObj.requesterRequestedPrice;
          return itObj;
        });
      }
    }

    return successResponse(res, 200, 'Purchase order details retrieved', {
      purchaseOrder: poObj,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Vendor accepts Purchase Order preliminary offer (Smart Availability Check passed)
 * NOTE: Stock is NOT deducted here; inventory is deducted only after requester confirmation.
 * @access VENDOR
 * @route PATCH /api/purchase-orders/:id/accept
 */
const acceptPurchaseOrder = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return errorResponse(res, 404, 'Purchase order not found');
    }

    const purchaseOrder = await PurchaseOrder.findById(req.params.id).populate('vendor');
    if (!purchaseOrder) {
      return errorResponse(res, 404, 'Purchase order not found');
    }

    const vendor = await getAuthenticatedVendor(req.user);
    if (!vendor || purchaseOrder.vendor._id.toString() !== vendor._id.toString()) {
      return errorResponse(res, 403, 'Access denied. You can only accept orders assigned to your company.');
    }

    if (purchaseOrder.status === POStatus.ACCEPTED || purchaseOrder.status === POStatus.PENDING_CONFIRMATION) {
      return errorResponse(res, 400, 'Order has already been accepted by your company.');
    }

    if (purchaseOrder.status !== POStatus.SENT_TO_VENDOR) {
      return errorResponse(
        res,
        400,
        `Cannot accept order with status '${purchaseOrder.status}'. Order must be in '${POStatus.SENT_TO_VENDOR}' status.`
      );
    }

    // Smart Availability Check: Verify stock across all items BEFORE allowing acceptance
    for (const item of purchaseOrder.items || []) {
      if (!item.product) continue;
      const product = await Product.findById(item.product);
      if (!product) {
        return errorResponse(res, 404, `Product '${item.name}' is no longer found in catalog.`);
      }
      if (product.availableQuantity < item.quantity) {
        return errorResponse(
          res,
          400,
          `Insufficient inventory. Current available quantity: ${product.availableQuantity}. (Requested: ${item.quantity})`
        );
      }
      if (product.isAvailable === false || product.isActive === false) {
        return errorResponse(
          res,
          400,
          `Product '${item.name}' is currently marked unavailable.`
        );
      }
    }

    // Transition to PENDING_CONFIRMATION (Awaiting Requester Price & Terms Confirmation)
    // NOTE: Inventory is NOT deducted at this stage
    purchaseOrder.status = POStatus.PENDING_CONFIRMATION;
    purchaseOrder.vendorAcceptedAt = new Date();
    purchaseOrder.statusHistory.push({
      status: POStatus.PENDING_CONFIRMATION,
      changedBy: req.user._id,
      changedAt: new Date(),
      notes: req.body.notes || 'Vendor confirmed availability and accepted preliminary order. Awaiting requester confirmation.',
    });

    await purchaseOrder.save();

    // Record Audit Log
    await auditService.log({
      user: req.user,
      action: 'PURCHASE_ORDER_VENDOR_ACCEPTED',
      entityType: 'PurchaseOrder',
      entityId: purchaseOrder._id,
      entityName: purchaseOrder.poNumber,
      metadata: {
        vendorId: vendor._id,
        vendorName: vendor.companyName,
        status: POStatus.PENDING_CONFIRMATION,
      },
      req,
    });

    // Notify Requesting Employee with tailored price variation details
    if (purchaseOrder.requestedBy) {
      const reqPrice = purchaseOrder.requesterRequestedPrice || purchaseOrder.items?.[0]?.requesterRequestedPrice || 0;
      const vPrice = purchaseOrder.vendorUnitPrice || purchaseOrder.items?.[0]?.unitPrice || 0;
      const qty = purchaseOrder.items?.[0]?.quantity || 1;
      const diff = vPrice - reqPrice;
      const totalDiff = diff * qty;

      let title = `Vendor Accepted Order: ${purchaseOrder.poNumber}`;
      let message = `Supplier ${vendor.companyName} accepted Purchase Order ${purchaseOrder.poNumber}. Please review and confirm to officially issue the order.`;

      if (diff > 0) {
        title = `Price Variation Approval Required: ${purchaseOrder.poNumber}`;
        message = `Vendor price is higher than your requested price. Vendor price: ₹${vPrice.toLocaleString('en-IN')}, Requested: ₹${reqPrice.toLocaleString('en-IN')}, Additional amount: +₹${diff.toLocaleString('en-IN')}/unit (Total additional: +₹${totalDiff.toLocaleString('en-IN')}). Please approve or decline.`;
      } else if (diff < 0) {
        title = `Vendor Offer Ready (Savings!): ${purchaseOrder.poNumber}`;
        message = `Good news! The vendor price is lower than your requested price. Vendor price: ₹${vPrice.toLocaleString('en-IN')}, Requested: ₹${reqPrice.toLocaleString('en-IN')}. You save: ₹${Math.abs(diff).toLocaleString('en-IN')}/unit (Total savings: ₹${Math.abs(totalDiff).toLocaleString('en-IN')}). Please confirm the order.`;
      }

      await Notification.create({
        recipient: purchaseOrder.requestedBy,
        title,
        message,
        type: diff > 0 ? NotificationType.WARNING : NotificationType.SUCCESS,
        link: '/employee/orders',
        metadata: {
          purchaseOrderId: purchaseOrder._id,
          poNumber: purchaseOrder.poNumber,
          status: POStatus.PENDING_CONFIRMATION,
          requesterPrice: reqPrice,
          vendorPrice: vPrice,
          priceDifference: diff,
          totalDifference: totalDiff,
        },
      });
    }

    // Notify Procurement Manager
    if (purchaseOrder.createdBy) {
      await Notification.create({
        recipient: purchaseOrder.createdBy,
        title: `Vendor Accepted: ${purchaseOrder.poNumber}`,
        message: `Supplier ${vendor.companyName} accepted Purchase Order ${purchaseOrder.poNumber}. Awaiting requester confirmation.`,
        type: NotificationType.INFO,
        link: '/procurement/orders',
        metadata: {
          purchaseOrderId: purchaseOrder._id,
          poNumber: purchaseOrder.poNumber,
          status: POStatus.PENDING_CONFIRMATION,
        },
      });
    }

    await purchaseOrder.populate([
      { path: 'vendor', select: 'companyName email contactPerson phone' },
      { path: 'requestedBy', select: 'name email role' },
    ]);

    return successResponse(res, 200, 'Order accepted by supplier. Awaiting requester confirmation.', {
      purchaseOrder,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Requester confirms and officially issues Purchase Order (Triggers Atomic Inventory Deduction)
 * @access EMPLOYEE, ADMIN
 * @route PATCH /api/purchase-orders/:id/confirm
 */
const confirmPurchaseOrder = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return errorResponse(res, 404, 'Purchase order not found');
    }

    const purchaseOrder = await PurchaseOrder.findById(req.params.id).populate('vendor');
    if (!purchaseOrder) {
      return errorResponse(res, 404, 'Purchase order not found');
    }

    // Requester authorization check
    if (req.user.role === UserRoles.EMPLOYEE) {
      if (!purchaseOrder.requestedBy || purchaseOrder.requestedBy.toString() !== req.user._id.toString()) {
        return errorResponse(res, 403, 'Access denied. You can only confirm orders requested by you.');
      }
    }

    // Check status is eligible for confirmation
    if (purchaseOrder.status === POStatus.ACCEPTED && purchaseOrder.inventoryDeducted) {
      return successResponse(res, 200, 'Order has already been confirmed and officially issued.', {
        purchaseOrder,
      });
    }

    if (purchaseOrder.status !== POStatus.PENDING_CONFIRMATION && purchaseOrder.status !== POStatus.SENT_TO_VENDOR) {
      return errorResponse(
        res,
        400,
        `Cannot confirm order with status '${purchaseOrder.status}'. Order must be in '${POStatus.PENDING_CONFIRMATION}' status.`
      );
    }

    // Part 9, 12, 13: Final Server-Side Stock Validation Immediately Before Issuance
    for (const item of purchaseOrder.items || []) {
      if (!item.product) continue;
      const product = await Product.findById(item.product);
      if (!product) {
        return errorResponse(res, 404, `Product '${item.name}' is no longer found in catalog.`);
      }
      if (product.availableQuantity < item.quantity) {
        return errorResponse(
          res,
          400,
          `Cannot issue order: Insufficient stock. Only ${product.availableQuantity} units are currently available (Requested: ${item.quantity}). Stock changed after vendor acceptance.`
        );
      }
      if (product.isAvailable === false || product.isActive === false) {
        return errorResponse(
          res,
          400,
          `Cannot issue order: Product '${item.name}' is currently unavailable.`
        );
      }
    }

    // Part 11, 12: Atomic Inventory Deduction with Rollback Protection (Executed Exactly Once)
    const deductedRecords = [];
    if (!purchaseOrder.inventoryDeducted) {
      for (const item of purchaseOrder.items || []) {
        if (!item.product) continue;

        const updatedProduct = await Product.findOneAndUpdate(
          {
            _id: item.product,
            availableQuantity: { $gte: item.quantity },
          },
          {
            $inc: { availableQuantity: -item.quantity },
            $set: { lastStockUpdate: new Date() },
          },
          { new: true }
        );

        if (!updatedProduct) {
          // Concurrency race: rollback previously deducted records in this transaction
          for (const prev of deductedRecords) {
            await Product.findByIdAndUpdate(prev.productId, {
              $inc: { availableQuantity: prev.quantity },
            });
          }
          return errorResponse(
            res,
            400,
            `Cannot issue order: Insufficient stock. Stock for '${item.name}' was claimed by another concurrent order.`
          );
        }

        if (updatedProduct.availableQuantity <= 0) {
          updatedProduct.isAvailable = false;
          await updatedProduct.save();
        }

        deductedRecords.push({
          productId: item.product,
          productName: item.name,
          quantity: item.quantity,
          remainingStock: updatedProduct.availableQuantity,
        });
      }

      purchaseOrder.inventoryDeducted = true;
    }

    // Officially Issue the Purchase Order
    purchaseOrder.status = POStatus.ACCEPTED;
    purchaseOrder.requesterApprovalStatus = 'APPROVED';
    purchaseOrder.requesterApprovedAt = new Date();
    purchaseOrder.statusHistory.push({
      status: POStatus.ACCEPTED,
      changedBy: req.user._id,
      changedAt: new Date(),
      notes: req.body.notes || 'Order confirmed and officially issued by requester. Inventory committed.',
    });

    await purchaseOrder.save();

    // Record Audit Logs
    await auditService.log({
      user: req.user,
      action: 'PURCHASE_ORDER_CONFIRMED',
      entityType: 'PurchaseOrder',
      entityId: purchaseOrder._id,
      entityName: purchaseOrder.poNumber,
      metadata: {
        vendorId: purchaseOrder.vendor?._id,
        deductedRecords,
      },
      req,
    });

    if (deductedRecords.length > 0) {
      await auditService.log({
        user: req.user,
        action: 'INVENTORY_UPDATED',
        entityType: 'Product',
        entityId: purchaseOrder._id,
        entityName: purchaseOrder.poNumber,
        metadata: {
          deductedRecords,
          description: 'Inventory deducted after requester confirmed and officially issued purchase order',
        },
        req,
      });
    }

    // Notify Vendor that Order is Confirmed & Ready for Fulfillment
    const vendorUsers = await User.find({
      $or: [{ vendor: purchaseOrder.vendor?._id }, { email: purchaseOrder.vendor?.email }],
    });
    for (const vUser of vendorUsers) {
      await Notification.create({
        recipient: vUser._id,
        title: `Order Confirmed & Issued: ${purchaseOrder.poNumber}`,
        message: `Customer confirmed Purchase Order ${purchaseOrder.poNumber}. Inventory has been committed. You may now begin processing and shipping.`,
        type: NotificationType.SUCCESS,
        link: '/vendor/orders',
        metadata: {
          purchaseOrderId: purchaseOrder._id,
          poNumber: purchaseOrder.poNumber,
          status: POStatus.ACCEPTED,
        },
      });
    }

    // Notify Procurement Manager
    if (purchaseOrder.createdBy) {
      await Notification.create({
        recipient: purchaseOrder.createdBy,
        title: `Order Issued: ${purchaseOrder.poNumber}`,
        message: `Requester approved and officially issued Purchase Order ${purchaseOrder.poNumber}. Inventory has been deducted.`,
        type: NotificationType.SUCCESS,
        link: '/procurement/orders',
        metadata: {
          purchaseOrderId: purchaseOrder._id,
          poNumber: purchaseOrder.poNumber,
          status: POStatus.ACCEPTED,
        },
      });
    }

    await purchaseOrder.populate([
      { path: 'vendor', select: 'companyName email contactPerson phone' },
      { path: 'requestedBy', select: 'name email role' },
    ]);

    return successResponse(res, 200, 'Order successfully confirmed and officially issued. Inventory deducted.', {
      purchaseOrder,
      inventoryDeducted: deductedRecords,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Requester rejects / declines Vendor Offer
 * @access EMPLOYEE, ADMIN
 * @route PATCH /api/purchase-orders/:id/requester-reject
 */
const requesterRejectPurchaseOrder = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return errorResponse(res, 404, 'Purchase order not found');
    }

    const { rejectionReason, reason } = req.body;
    const finalReason = (rejectionReason || reason || 'Declined by requester due to price/terms').trim();

    const purchaseOrder = await PurchaseOrder.findById(req.params.id).populate('vendor');
    if (!purchaseOrder) {
      return errorResponse(res, 404, 'Purchase order not found');
    }

    // Requester authorization check
    if (req.user.role === UserRoles.EMPLOYEE) {
      if (!purchaseOrder.requestedBy || purchaseOrder.requestedBy.toString() !== req.user._id.toString()) {
        return errorResponse(res, 403, 'Access denied. You can only decline offers for your own requisitions.');
      }
    }

    if (purchaseOrder.status === POStatus.REJECTED) {
      return errorResponse(res, 400, 'Order has already been declined.');
    }

    // Reject the order without any stock deduction or fulfillment
    purchaseOrder.status = POStatus.REJECTED;
    purchaseOrder.requesterApprovalStatus = 'REJECTED';
    purchaseOrder.rejectionReason = finalReason;
    purchaseOrder.rejectedAt = new Date();
    purchaseOrder.rejectedBy = req.user._id;
    purchaseOrder.statusHistory.push({
      status: POStatus.REJECTED,
      changedBy: req.user._id,
      changedAt: new Date(),
      notes: `Declined by requester: ${finalReason}`,
    });

    await purchaseOrder.save();

    // Record Audit Log
    await auditService.log({
      user: req.user,
      action: 'PURCHASE_ORDER_REQUESTER_REJECTED',
      entityType: 'PurchaseOrder',
      entityId: purchaseOrder._id,
      entityName: purchaseOrder.poNumber,
      metadata: {
        vendorId: purchaseOrder.vendor?._id,
        rejectionReason: finalReason,
      },
      req,
    });

    // Notify Vendor
    const vendorUsers = await User.find({
      $or: [{ vendor: purchaseOrder.vendor?._id }, { email: purchaseOrder.vendor?.email }],
    });
    for (const vUser of vendorUsers) {
      await Notification.create({
        recipient: vUser._id,
        title: `Order Offer Declined: ${purchaseOrder.poNumber}`,
        message: `Customer declined Purchase Order ${purchaseOrder.poNumber}. Reason: ${finalReason}.`,
        type: NotificationType.ALERT,
        link: '/vendor/orders',
        metadata: {
          purchaseOrderId: purchaseOrder._id,
          poNumber: purchaseOrder.poNumber,
          status: POStatus.REJECTED,
        },
      });
    }

    // Notify Procurement Manager
    if (purchaseOrder.createdBy) {
      await Notification.create({
        recipient: purchaseOrder.createdBy,
        title: `Offer Declined by Requester: ${purchaseOrder.poNumber}`,
        message: `Requester declined Purchase Order ${purchaseOrder.poNumber}. Reason: ${finalReason}.`,
        type: NotificationType.ALERT,
        link: '/procurement/orders',
        metadata: {
          purchaseOrderId: purchaseOrder._id,
          poNumber: purchaseOrder.poNumber,
          status: POStatus.REJECTED,
        },
      });
    }

    await purchaseOrder.populate([
      { path: 'vendor', select: 'companyName email contactPerson phone' },
      { path: 'requestedBy', select: 'name email role' },
    ]);

    return successResponse(res, 200, 'Order offer successfully declined.', {
      purchaseOrder,
    });
  } catch (error) {
    next(error);
  }
};



/**
 * Vendor rejects Purchase Order with mandatory reason
 * @access VENDOR
 * @route PATCH /api/purchase-orders/:id/reject
 */
const rejectPurchaseOrder = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return errorResponse(res, 404, 'Purchase order not found');
    }

    const { rejectionReason } = req.body;

    if (!rejectionReason || !rejectionReason.trim()) {
      return errorResponse(res, 400, 'Rejection reason is required when declining a purchase order');
    }

    const purchaseOrder = await PurchaseOrder.findById(req.params.id).populate('vendor');
    if (!purchaseOrder) {
      return errorResponse(res, 404, 'Purchase order not found');
    }

    const vendor = await getAuthenticatedVendor(req.user);
    if (!vendor || purchaseOrder.vendor._id.toString() !== vendor._id.toString()) {
      return errorResponse(res, 403, 'Access denied. You can only reject orders assigned to your company.');
    }

    // Part 35: Prevent duplicate rejection
    if (purchaseOrder.status === POStatus.REJECTED) {
      return errorResponse(res, 400, 'Order has already been rejected.');
    }

    if (purchaseOrder.status !== POStatus.SENT_TO_VENDOR) {
      return errorResponse(
        res,
        400,
        `Cannot reject order with status '${purchaseOrder.status}'. Order must be in '${POStatus.SENT_TO_VENDOR}' status.`
      );
    }

    // Update PO Status to REJECTED (Zero stock deduction)
    purchaseOrder.status = POStatus.REJECTED;
    purchaseOrder.rejectionReason = rejectionReason.trim();
    purchaseOrder.rejectedAt = new Date();
    purchaseOrder.rejectedBy = req.user._id;

    purchaseOrder.statusHistory.push({
      status: POStatus.REJECTED,
      changedBy: req.user._id,
      changedAt: new Date(),
      notes: `Rejected by supplier: ${rejectionReason.trim()}`,
    });

    await purchaseOrder.save();

    // Record Audit Log
    await auditService.log({
      user: req.user,
      action: 'PURCHASE_ORDER_REJECTED',
      entityType: 'PurchaseOrder',
      entityId: purchaseOrder._id,
      entityName: purchaseOrder.poNumber,
      metadata: {
        vendorId: vendor._id,
        vendorName: vendor.companyName,
        rejectionReason: purchaseOrder.rejectionReason,
      },
      req,
    });

    // Notify requesting Employee
    if (purchaseOrder.requestedBy) {
      await Notification.create({
        recipient: purchaseOrder.requestedBy,
        title: `Your purchase order ${purchaseOrder.poNumber} was rejected by the vendor`,
        message: `Supplier ${vendor.companyName} declined Purchase Order ${purchaseOrder.poNumber}. Reason: ${rejectionReason.trim()}`,
        type: NotificationType.ALERT,
        link: '/employee/orders',
        metadata: {
          purchaseOrderId: purchaseOrder._id,
          poNumber: purchaseOrder.poNumber,
          status: POStatus.REJECTED,
          rejectionReason: rejectionReason.trim(),
        },
      });
    }

    // Notify Procurement Manager
    if (purchaseOrder.createdBy) {
      await Notification.create({
        recipient: purchaseOrder.createdBy,
        title: `PO Declined: ${purchaseOrder.poNumber}`,
        message: `Supplier ${vendor.companyName} declined Purchase Order ${purchaseOrder.poNumber}. Reason: ${rejectionReason.trim()}`,
        type: NotificationType.ALERT,
        link: '/procurement/orders',
        metadata: {
          purchaseOrderId: purchaseOrder._id,
          poNumber: purchaseOrder.poNumber,
          status: POStatus.REJECTED,
          rejectionReason: rejectionReason.trim(),
        },
      });
    }

    await purchaseOrder.populate([
      { path: 'vendor', select: 'companyName email contactPerson phone' },
      { path: 'requestedBy', select: 'name email role' },
    ]);

    return successResponse(res, 200, 'Purchase order rejected successfully', {
      purchaseOrder,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Employee submits delivery destination information
 * @access EMPLOYEE, ADMIN
 * @route PATCH /api/purchase-orders/:id/delivery-details
 */
const updateDeliveryDetails = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return errorResponse(res, 404, 'Purchase order not found');
    }

    const {
      address,
      city,
      state,
      postalCode,
      contactName,
      contactPhone,
      deliveryInstructions,
      deliveryAddress,
      contactPerson,
      phone,
      shippingMethod,
    } = req.body;

    const finalAddress = (address || deliveryAddress || '').trim();
    const finalContactName = (contactName || contactPerson || '').trim();
    const finalContactPhone = (contactPhone || phone || '').trim();
    const finalInstructions = (deliveryInstructions || shippingMethod || '').trim();

    if (!finalAddress) {
      return errorResponse(res, 400, 'Delivery street address is required');
    }

    if (!finalContactName) {
      return errorResponse(res, 400, 'Recipient contact name is required');
    }

    if (!finalContactPhone) {
      return errorResponse(res, 400, 'Recipient contact phone number is required');
    }

    const purchaseOrder = await PurchaseOrder.findById(req.params.id);
    if (!purchaseOrder) {
      return errorResponse(res, 404, 'Purchase order not found');
    }

    // Restrict modification once delivered or completed
    if (
      purchaseOrder.status === POStatus.DELIVERED ||
      purchaseOrder.status === POStatus.COMPLETED
    ) {
      return errorResponse(
        res,
        400,
        'Cannot modify delivery details for an order that is already delivered or completed.'
      );
    }

    // Ownership check for Employee
    if (req.user.role === UserRoles.EMPLOYEE) {
      if (
        !purchaseOrder.requestedBy ||
        purchaseOrder.requestedBy.toString() !== req.user._id.toString()
      ) {
        return errorResponse(res, 403, 'Access denied. You can only provide delivery details for your own requisitions.');
      }
    }

    purchaseOrder.deliveryDetails = {
      address: finalAddress,
      city: city?.trim() || '',
      state: state?.trim() || '',
      postalCode: postalCode?.trim() || '',
      contactName: finalContactName,
      contactPhone: finalContactPhone,
      deliveryInstructions: finalInstructions,
      submittedAt: new Date(),
    };

    purchaseOrder.statusHistory.push({
      status: purchaseOrder.status,
      changedBy: req.user._id,
      changedAt: new Date(),
      notes: `Delivery details submitted for destination: ${finalContactName}, ${finalAddress}`,
    });

    await purchaseOrder.save();

    // Record Audit Log
    await auditService.log({
      user: req.user,
      action: 'PURCHASE_ORDER_DELIVERY_UPDATED',
      entityType: 'PurchaseOrder',
      entityId: purchaseOrder._id,
      entityName: purchaseOrder.poNumber,
      metadata: {
        destination: `${finalContactName}, ${finalAddress}`,
        contactPhone: finalContactPhone,
      },
      req,
    });

    // Notify vendor users of destination details
    const vendorDoc = await Vendor.findById(purchaseOrder.vendor);
    if (vendorDoc) {
      const vendorUsers = await User.find({
        $or: [{ vendor: vendorDoc._id }, { email: vendorDoc.email }],
      });
      for (const vUser of vendorUsers) {
        await Notification.create({
          recipient: vUser._id,
          title: `Delivery Details Provided: ${purchaseOrder.poNumber}`,
          message: `Delivery destination details provided for ${purchaseOrder.poNumber}: ${finalContactName}, ${finalAddress}.`,
          type: NotificationType.INFO,
          link: '/vendor/orders',
          metadata: {
            purchaseOrderId: purchaseOrder._id,
            poNumber: purchaseOrder.poNumber,
            type: 'DELIVERY_DETAILS_SUBMITTED',
          },
        });
      }
    }

    await purchaseOrder.populate([
      { path: 'vendor', select: 'companyName email contactPerson phone' },
      { path: 'requestedBy', select: 'name email role' },
    ]);

    return successResponse(res, 200, 'Delivery details submitted successfully', {
      purchaseOrder,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Fulfillment Status (PROCESSING -> SHIPPED -> DELIVERED -> COMPLETED)
 * @access VENDOR, PROCUREMENT_MANAGER, ADMIN
 * @route PATCH /api/purchase-orders/:id/fulfillment-status
 */
const updateFulfillmentStatus = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return errorResponse(res, 404, 'Purchase order not found');
    }

    const { status, notes } = req.body;

    const allowedStatuses = [
      POStatus.PROCESSING,
      POStatus.SHIPPED,
      POStatus.DELIVERED,
      POStatus.COMPLETED,
    ];

    if (!allowedStatuses.includes(status)) {
      return errorResponse(
        res,
        400,
        `Invalid fulfillment status '${status}'. Must be one of: ${allowedStatuses.join(', ')}`
      );
    }

    const purchaseOrder = await PurchaseOrder.findById(req.params.id).populate('vendor');
    if (!purchaseOrder) {
      return errorResponse(res, 404, 'Purchase order not found');
    }

    // Ownership check for Vendor
    if (req.user.role === UserRoles.VENDOR) {
      const vendor = await getAuthenticatedVendor(req.user);
      if (!vendor || purchaseOrder.vendor._id.toString() !== vendor._id.toString()) {
        return errorResponse(res, 403, 'Access denied. You can only update fulfillment for your own orders.');
      }
    }

    // Enforce proper status progression
    const validProgression = {
      [POStatus.ACCEPTED]: [POStatus.PROCESSING],
      [POStatus.PROCESSING]: [POStatus.SHIPPED],
      [POStatus.SHIPPED]: [POStatus.DELIVERED],
      [POStatus.DELIVERED]: [POStatus.COMPLETED],
    };

    const allowedNext = validProgression[purchaseOrder.status] || [];
    if (!allowedNext.includes(status) && req.user.role !== UserRoles.ADMIN) {
      return errorResponse(
        res,
        400,
        `Cannot transition order from status '${purchaseOrder.status}' to '${status}'. Allowed next status: ${allowedNext.join(', ') || 'None'}`
      );
    }

    const previousStatus = purchaseOrder.status;

    purchaseOrder.status = status;
    purchaseOrder.statusHistory.push({
      status,
      changedBy: req.user._id,
      changedAt: new Date(),
      notes: notes || `Order status transitioned to ${status}`,
    });

    await purchaseOrder.save();

    let specificAction = 'PURCHASE_ORDER_STATUS_UPDATED';
    if (status === POStatus.PROCESSING) specificAction = 'PURCHASE_ORDER_PROCESSING';
    else if (status === POStatus.SHIPPED) specificAction = 'PURCHASE_ORDER_SHIPPED';
    else if (status === POStatus.DELIVERED) specificAction = 'PURCHASE_ORDER_DELIVERED';
    else if (status === POStatus.COMPLETED) specificAction = 'PURCHASE_ORDER_COMPLETED';

    // Record Audit Log
    await auditService.log({
      user: req.user,
      action: specificAction,
      entityType: 'PurchaseOrder',
      entityId: purchaseOrder._id,
      entityName: purchaseOrder.poNumber,
      description: `Purchase order ${purchaseOrder.poNumber} status updated to ${status}`,
      metadata: {
        before: { status: previousStatus },
        after: { status },
        notes: notes || undefined,
      },
      req,
    });

    // Auto-generate Purchase Receipt if DELIVERED or COMPLETED
    if (status === POStatus.DELIVERED || status === POStatus.COMPLETED) {
      try {
        await receiptService.generateReceiptForPO(purchaseOrder._id, req.user);
      } catch (receiptErr) {
        console.error('Error auto-generating receipt on order fulfillment:', receiptErr);
      }
    }

    // Notify employee when order progresses
    if (purchaseOrder.requestedBy && [POStatus.PROCESSING, POStatus.SHIPPED, POStatus.DELIVERED, POStatus.COMPLETED].includes(status)) {
      const vendorName = purchaseOrder.vendor?.companyName || 'Supplier';
      await Notification.create({
        recipient: purchaseOrder.requestedBy,
        title: `Order ${status}: ${purchaseOrder.poNumber}`,
        message: `Your order ${purchaseOrder.poNumber} from ${vendorName} is now ${status}.`,
        type: [POStatus.COMPLETED, POStatus.DELIVERED].includes(status) ? NotificationType.SUCCESS : NotificationType.INFO,
        link: '/employee/orders',
        metadata: {
          purchaseOrderId: purchaseOrder._id,
          poNumber: purchaseOrder.poNumber,
          status,
          type: `ORDER_${status}`,
        },
      });
    }

    // Also notify procurement manager on completion
    if (purchaseOrder.createdBy && status === POStatus.COMPLETED) {
      await Notification.create({
        recipient: purchaseOrder.createdBy,
        title: `Order Completed: ${purchaseOrder.poNumber}`,
        message: `Purchase Order ${purchaseOrder.poNumber} has been fulfilled and completed.`,
        type: NotificationType.SUCCESS,
        link: '/procurement/orders',
        metadata: {
          purchaseOrderId: purchaseOrder._id,
          poNumber: purchaseOrder.poNumber,
          status,
          type: 'ORDER_COMPLETED',
        },
      });
    }

    await purchaseOrder.populate([
      { path: 'vendor', select: 'companyName email contactPerson phone' },
      { path: 'requestedBy', select: 'name email role' },
    ]);

    return successResponse(res, 200, `Order fulfillment status updated to ${status}`, {
      purchaseOrder,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrderById,
  acceptPurchaseOrder,
  confirmPurchaseOrder,
  requesterRejectPurchaseOrder,
  rejectPurchaseOrder,
  updateDeliveryDetails,
  updateFulfillmentStatus,
};
