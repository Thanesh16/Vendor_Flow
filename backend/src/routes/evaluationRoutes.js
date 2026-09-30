const express = require('express');
const evaluationController = require('../controllers/evaluationController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Require authentication for all evaluation routes
router.use(authenticate);

// Submit evaluation for delivered purchase order
router.post('/', evaluationController.createEvaluation);

// Get evaluation by purchase order ID
router.get('/order/:orderId', evaluationController.getEvaluationByOrderId);

// Get evaluations for a vendor
router.get('/vendor/:vendorId', evaluationController.getVendorEvaluations);

module.exports = router;
