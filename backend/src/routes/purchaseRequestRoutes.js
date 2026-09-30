const express = require('express');
const {
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
} = require('../controllers/purchaseRequestController');
const { authenticate, authorize } = require('../middleware/auth');
const { UserRoles } = require('../models/User');

const router = express.Router();

// Create new purchase request (Employee, Admin, Procurement Manager; Denied: Vendor)
router.post(
  '/',
  authenticate,
  authorize(UserRoles.EMPLOYEE, UserRoles.ADMIN, UserRoles.PROCUREMENT_MANAGER),
  createPurchaseRequest
);

// Get all purchase requests (Employee gets own, Procurement/Admin gets all; Denied: Vendor)
router.get(
  '/',
  authenticate,
  authorize(UserRoles.EMPLOYEE, UserRoles.ADMIN, UserRoles.PROCUREMENT_MANAGER),
  getAllPurchaseRequests
);

// Check availability & match scores for approved purchase request (Admin, Procurement Manager)
router.get(
  '/:id/availability',
  authenticate,
  authorize(UserRoles.ADMIN, UserRoles.PROCUREMENT_MANAGER),
  checkPurchaseRequestAvailability
);

router.post(
  '/:id/check-availability',
  authenticate,
  authorize(UserRoles.ADMIN, UserRoles.PROCUREMENT_MANAGER),
  checkPurchaseRequestAvailability
);

// Select product and vendor for approved purchase request (Admin, Procurement Manager)
router.post(
  '/:id/select-product',
  authenticate,
  authorize(UserRoles.ADMIN, UserRoles.PROCUREMENT_MANAGER),
  selectProductForPurchaseRequest
);

// Get purchase request by ID (Ownership verified for Employee; Denied: Vendor)
router.get(
  '/:id',
  authenticate,
  authorize(UserRoles.EMPLOYEE, UserRoles.ADMIN, UserRoles.PROCUREMENT_MANAGER),
  getPurchaseRequestById
);

// Update draft purchase request
router.put(
  '/:id',
  authenticate,
  authorize(UserRoles.EMPLOYEE, UserRoles.ADMIN),
  updatePurchaseRequest
);

// Submit draft purchase request
router.patch(
  '/:id/submit',
  authenticate,
  authorize(UserRoles.EMPLOYEE, UserRoles.ADMIN),
  submitPurchaseRequest
);

// Approve purchase request (Admin and Procurement Manager only; Denied: Employee, Vendor)
router.patch(
  '/:id/approve',
  authenticate,
  authorize(UserRoles.ADMIN, UserRoles.PROCUREMENT_MANAGER),
  approvePurchaseRequest
);

// Reject purchase request (Admin and Procurement Manager only; Denied: Employee, Vendor)
router.patch(
  '/:id/reject',
  authenticate,
  authorize(UserRoles.ADMIN, UserRoles.PROCUREMENT_MANAGER),
  rejectPurchaseRequest
);

// Cancel purchase request (Employee owner, Admin; Denied: Vendor)
router.patch(
  '/:id/cancel',
  authenticate,
  authorize(UserRoles.EMPLOYEE, UserRoles.ADMIN),
  cancelPurchaseRequest
);

module.exports = router;
