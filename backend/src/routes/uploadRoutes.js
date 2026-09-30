const express = require('express');
const uploadController = require('../controllers/uploadController');
const { authenticate, authorize } = require('../middleware/auth');
const { uploadProductImage } = require('../middleware/upload');
const { UserRoles } = require('../models/User');

const router = express.Router();

// Require authentication for all upload routes
router.use(authenticate);

// POST /api/uploads/product-image
router.post(
  '/product-image',
  authorize(UserRoles.VENDOR, UserRoles.ADMIN),
  uploadProductImage.single('image'),
  uploadController.uploadProductImage
);

module.exports = router;
