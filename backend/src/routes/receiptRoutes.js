const express = require('express');
const receiptController = require('../controllers/receiptController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Require authentication for all receipt routes
router.use(authenticate);

// Get receipt by order ID (generates on-demand if delivered/completed)
router.get('/order/:orderId', receiptController.getReceiptByOrderId);

// Stream / download receipt PDF directly by order ID
router.get('/order/:orderId/pdf', receiptController.downloadReceiptByOrderId);

// Get receipt by receipt ID
router.get('/:id', receiptController.getReceiptById);

// Stream / download receipt PDF by receipt ID
router.get('/:id/pdf', receiptController.downloadReceiptPdf);

module.exports = router;
