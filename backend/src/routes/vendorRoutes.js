const express = require('express');
const {
  getAllVendors,
  getMyVendorProfile,
  getVendorById,
  createVendor,
  updateVendor,
  updateVendorStatus,
  uploadShopImage,
  updateShopImage,
  removeShopImage,
} = require('../controllers/vendorController');
const { authenticate, authorize } = require('../middleware/auth');
const { uploadVendorImage } = require('../middleware/upload');
const { UserRoles } = require('../models/User');

const router = express.Router();

// Get all vendors (Admin and Procurement Manager only)
router.get('/', authenticate, authorize(UserRoles.ADMIN, UserRoles.PROCUREMENT_MANAGER), getAllVendors);

// Get current authenticated vendor's own profile
router.get('/profile/me', authenticate, getMyVendorProfile);

// Upload vendor shop image file (Vendor or Admin)
router.post(
  '/upload-shop-image',
  authenticate,
  authorize(UserRoles.VENDOR, UserRoles.ADMIN),
  uploadVendorImage.single('image'),
  uploadShopImage
);

// Update vendor shop image via URL or path (Vendor owner or Admin)
router.put(
  '/:id/shop-image',
  authenticate,
  authorize(UserRoles.VENDOR, UserRoles.ADMIN),
  updateShopImage
);

// Remove vendor shop image (Vendor owner or Admin)
router.delete(
  '/:id/shop-image',
  authenticate,
  authorize(UserRoles.VENDOR, UserRoles.ADMIN),
  removeShopImage
);

// Get specific vendor by ID (Admin, Procurement Manager, or owning Vendor)
router.get('/:id', authenticate, getVendorById);

// Submit new vendor onboarding profile
router.post('/', authenticate, createVendor);

// Update vendor profile
router.put('/:id', authenticate, updateVendor);

// Update onboarding status (Admin and Procurement Manager only)
router.patch(
  '/:id/status',
  authenticate,
  authorize(UserRoles.ADMIN, UserRoles.PROCUREMENT_MANAGER),
  updateVendorStatus
);

module.exports = router;
