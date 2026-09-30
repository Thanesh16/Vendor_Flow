const express = require('express');
const {
  getOverviewReport,
  getPurchaseRequestReport,
  getPurchaseOrderReport,
  getVendorAnalyticsReport,
  getInventoryReport,
  exportReportCSV,
} = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');
const { UserRoles } = require('../models/User');

const router = express.Router();

// All reporting routes strictly require authentication and ADMIN or PROCUREMENT_MANAGER role
router.use(authenticate);
router.use(authorize(UserRoles.ADMIN, UserRoles.PROCUREMENT_MANAGER));

// Overview executive metrics & KPIs
router.get('/overview', getOverviewReport);

// Purchase request lifecycle metrics
router.get('/purchase-requests', getPurchaseRequestReport);

// Purchase order lifecycle & financial spend trend
router.get('/purchase-orders', getPurchaseOrderReport);

// Vendor analytics & evaluations
router.get('/vendors', getVendorAnalyticsReport);

// Inventory & catalog analytics
router.get('/inventory', getInventoryReport);

// Export CSV data
router.get('/export', exportReportCSV);

module.exports = router;
