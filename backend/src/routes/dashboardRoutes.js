const express = require('express');
const {
  getAdminDashboard,
  getProcurementDashboard,
  getVendorDashboard,
  getEmployeeDashboard,
} = require('../controllers/dashboardController');
const { authenticate, authorize } = require('../middleware/auth');
const { UserRoles } = require('../models/User');

const router = express.Router();

// Admin Dashboard: Requires ADMIN role
router.get('/admin', authenticate, authorize(UserRoles.ADMIN), getAdminDashboard);

// Procurement Dashboard: Requires PROCUREMENT_MANAGER role
router.get(
  '/procurement',
  authenticate,
  authorize(UserRoles.PROCUREMENT_MANAGER),
  getProcurementDashboard
);

// Vendor Dashboard: Requires VENDOR role
router.get('/vendor', authenticate, authorize(UserRoles.VENDOR), getVendorDashboard);

// Employee Dashboard: Requires EMPLOYEE role
router.get('/employee', authenticate, authorize(UserRoles.EMPLOYEE), getEmployeeDashboard);

module.exports = router;
