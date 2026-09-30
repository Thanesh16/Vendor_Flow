const express = require('express');
const {
  createPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrderById,
  acceptPurchaseOrder,
  confirmPurchaseOrder,
  requesterRejectPurchaseOrder,
  rejectPurchaseOrder,
  updateDeliveryDetails,
  updateFulfillmentStatus,
} = require('../controllers/purchaseOrderController');
const { authenticate, authorize } = require('../middleware/auth');
const { UserRoles } = require('../models/User');

const router = express.Router();

// All purchase order routes require authentication
router.use(authenticate);

// Create Purchase Order (Procurement Manager, Admin)
router.post(
  '/',
  authorize(UserRoles.PROCUREMENT_MANAGER, UserRoles.ADMIN),
  createPurchaseOrder
);

// Get Purchase Orders (Role-scoped: Vendor gets own, Employee gets requested, Procurement/Admin gets all)
router.get(
  '/',
  authorize(UserRoles.VENDOR, UserRoles.EMPLOYEE, UserRoles.PROCUREMENT_MANAGER, UserRoles.ADMIN),
  getPurchaseOrders
);

// Get single Purchase Order by ID
router.get(
  '/:id',
  authorize(UserRoles.VENDOR, UserRoles.EMPLOYEE, UserRoles.PROCUREMENT_MANAGER, UserRoles.ADMIN),
  getPurchaseOrderById
);

// Vendor accepts Purchase Order preliminary offer
router.patch(
  '/:id/accept',
  authorize(UserRoles.VENDOR),
  acceptPurchaseOrder
);

// Requester confirms and officially issues Purchase Order (atomic inventory deduction)
router.patch(
  '/:id/confirm',
  authorize(UserRoles.EMPLOYEE, UserRoles.ADMIN),
  confirmPurchaseOrder
);

// Requester declines/rejects Vendor Offer
router.patch(
  '/:id/requester-reject',
  authorize(UserRoles.EMPLOYEE, UserRoles.ADMIN),
  requesterRejectPurchaseOrder
);

// Vendor rejects Purchase Order (mandatory reason)
router.patch(
  '/:id/reject',
  authorize(UserRoles.VENDOR),
  rejectPurchaseOrder
);

// Employee submits delivery destination details
router.patch(
  '/:id/delivery-details',
  authorize(UserRoles.EMPLOYEE, UserRoles.ADMIN),
  updateDeliveryDetails
);

// Vendor or Procurement updates order fulfillment status (PROCESSING, SHIPPED, DELIVERED, COMPLETED)
router.patch(
  '/:id/fulfillment-status',
  authorize(UserRoles.VENDOR, UserRoles.PROCUREMENT_MANAGER, UserRoles.ADMIN),
  updateFulfillmentStatus
);

module.exports = router;
