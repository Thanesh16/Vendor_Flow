const express = require('express');
const {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  toggleProductAvailability,
  deleteProduct,
  getCategories,
  refreshProductMarketPrice,
} = require('../controllers/productController');
const uploadController = require('../controllers/uploadController');
const { authenticate, authorize } = require('../middleware/auth');
const { uploadProductImage } = require('../middleware/upload');
const { UserRoles } = require('../models/User');

const router = express.Router();

// Require authentication for all product routes
router.use(authenticate);

// Upload product image (Vendor, Admin)
router.post(
  '/upload-image',
  authorize(UserRoles.VENDOR, UserRoles.ADMIN),
  uploadProductImage.single('image'),
  uploadController.uploadProductImage
);

// Get product categories (Available for authenticated users)
router.get('/categories', getCategories);

// Vendor products endpoint alias
router.get(
  '/vendor/my-products',
  authorize(UserRoles.VENDOR, UserRoles.ADMIN),
  getProducts
);

// List products (Vendor: own products, Procurement: approved vendors' products, Admin: all)
router.get(
  '/',
  authorize(UserRoles.VENDOR, UserRoles.PROCUREMENT_MANAGER, UserRoles.ADMIN),
  getProducts
);

// Create product (Vendor, Admin)
router.post(
  '/',
  authorize(UserRoles.VENDOR, UserRoles.ADMIN),
  createProduct
);

// Get single product details
router.get(
  '/:id',
  authorize(UserRoles.VENDOR, UserRoles.PROCUREMENT_MANAGER, UserRoles.ADMIN),
  getProductById
);

// Update product (Vendor [own only], Admin)
router.put(
  '/:id',
  authorize(UserRoles.VENDOR, UserRoles.ADMIN),
  updateProduct
);

// Toggle availability
router.patch(
  '/:id/availability',
  authorize(UserRoles.VENDOR, UserRoles.ADMIN),
  toggleProductAvailability
);

// Delete product (Vendor [own only], Admin)
router.delete(
  '/:id',
  authorize(UserRoles.VENDOR, UserRoles.ADMIN),
  deleteProduct
);

// Refresh live market price for a product
router.post(
  '/:id/refresh-market-price',
  authorize(UserRoles.VENDOR, UserRoles.ADMIN, UserRoles.PROCUREMENT_MANAGER),
  refreshProductMarketPrice
);

module.exports = router;
