const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const userController = require('../controllers/userController');

const router = express.Router();

// Enforce authentication on all user management routes
router.use(authenticate);

// Provision new Procurement Manager (Admin only)
router.post(
  '/procurement-manager',
  authorize('ADMIN'),
  userController.createProcurementManager
);

// List users with role filtering and pagination (Admin only)
router.get(
  '/',
  authorize('ADMIN'),
  userController.getUsers
);

module.exports = router;
