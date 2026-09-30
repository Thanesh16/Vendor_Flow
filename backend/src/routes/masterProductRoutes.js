const express = require('express');
const {
  getMasterProducts,
  getMasterProductById,
  getCategoriesAndBrands,
  getMarketPrice,
  createMasterProduct,
  updateMasterProduct,
  searchExternalProducts,
  cacheExternalProduct,
  refreshLiveMarketPrice,
} = require('../controllers/masterProductController');
const { authenticate, authorize } = require('../middleware/auth');
const { UserRoles } = require('../models/User');

const router = express.Router();

// Require authentication for all master product routes
router.use(authenticate);

// Live product search across external APIs and catalog (all authenticated roles)
router.get('/search', searchExternalProducts);

// Cache an external product into the Master Catalog when selected
router.post('/cache-external', cacheExternalProduct);

// Get distinct categories and brands
router.get('/meta/categories-and-brands', getCategoriesAndBrands);

// Search/browse master catalog (all authenticated roles can browse)
router.get('/', getMasterProducts);

// Refresh live market price from external API
router.post('/:id/refresh-price', refreshLiveMarketPrice);

// Get market price info for a master product
router.get('/:id/market-price', getMarketPrice);

// Get single master product details
router.get('/:id', getMasterProductById);

// Create master catalog entry (Admin only)
router.post('/', authorize(UserRoles.ADMIN), createMasterProduct);

// Update master catalog entry (Admin only)
router.put('/:id', authorize(UserRoles.ADMIN), updateMasterProduct);

module.exports = router;
