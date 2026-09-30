const express = require('express');
const healthRoutes = require('./healthRoutes');
const authRoutes = require('./authRoutes');
const testRoutes = require('./testRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const vendorRoutes = require('./vendorRoutes');
const purchaseRequestRoutes = require('./purchaseRequestRoutes');
const productRoutes = require('./productRoutes');
const purchaseOrderRoutes = require('./purchaseOrderRoutes');
const notificationRoutes = require('./notificationRoutes');
const reportRoutes = require('./reportRoutes');
const uploadRoutes = require('./uploadRoutes');
const auditLogRoutes = require('./auditLogRoutes');
const receiptRoutes = require('./receiptRoutes');
const evaluationRoutes = require('./evaluationRoutes');
const masterProductRoutes = require('./masterProductRoutes');

const router = express.Router();

// Mount health routes at /api/health
router.use('/health', healthRoutes);

// Mount authentication routes at /api/auth
router.use('/auth', authRoutes);

// Mount authorization testing routes at /api/test (Restricted outside development)
if (process.env.NODE_ENV !== 'production') {
  router.use('/test', testRoutes);
}

// Mount dashboard routes at /api/dashboard
router.use('/dashboard', dashboardRoutes);

// Mount vendor management routes at /api/vendors
router.use('/vendors', vendorRoutes);

// Mount purchase request routes at /api/purchase-requests
router.use('/purchase-requests', purchaseRequestRoutes);

// Mount product catalog routes at /api/products
router.use('/products', productRoutes);

// Mount purchase order routes at /api/purchase-orders
router.use('/purchase-orders', purchaseOrderRoutes);

// Mount notification routes at /api/notifications
router.use('/notifications', notificationRoutes);

// Mount reports and analytics routes at /api/reports
router.use('/reports', reportRoutes);

// Mount file upload routes at /api/uploads
router.use('/uploads', uploadRoutes);

// Mount audit log routes at /api/audit-logs
router.use('/audit-logs', auditLogRoutes);

// Mount purchase receipt routes at /api/receipts
router.use('/receipts', receiptRoutes);

// Mount evaluation routes at /api/evaluations
router.use('/evaluations', evaluationRoutes);

// Mount master product catalog routes at /api/master-products
router.use('/master-products', masterProductRoutes);

// Mount user management routes at /api/users (Admin only)
const userRoutes = require('./userRoutes');
router.use('/users', userRoutes);

module.exports = router;
