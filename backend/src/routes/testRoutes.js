const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { UserRoles } = require('../models/User');
const { successResponse } = require('../utils/apiResponse');

const router = express.Router();

/**
 * Public test endpoint
 * @route GET /api/test/public
 */
router.get('/public', (req, res) => {
  return successResponse(res, 200, 'Public test endpoint accessible without authentication');
});

/**
 * Protected test endpoint (any authenticated user)
 * @route GET /api/test/protected
 */
router.get('/protected', authenticate, (req, res) => {
  return successResponse(res, 200, `Protected endpoint accessed by ${req.user.name} (${req.user.role})`, {
    user: req.user,
  });
});

/**
 * Admin-only test endpoint
 * @route GET /api/test/admin-only
 */
router.get('/admin-only', authenticate, authorize(UserRoles.ADMIN), (req, res) => {
  return successResponse(res, 200, 'Admin-only endpoint accessed successfully', {
    user: req.user,
  });
});

/**
 * Procurement Manager test endpoint (Procurement or Admin)
 * @route GET /api/test/procurement-only
 */
router.get(
  '/procurement-only',
  authenticate,
  authorize(UserRoles.PROCUREMENT_MANAGER, UserRoles.ADMIN),
  (req, res) => {
    return successResponse(res, 200, 'Procurement-level endpoint accessed successfully', {
      user: req.user,
    });
  }
);

/**
 * Vendor-only test endpoint
 * @route GET /api/test/vendor-only
 */
router.get('/vendor-only', authenticate, authorize(UserRoles.VENDOR), (req, res) => {
  return successResponse(res, 200, 'Vendor-only endpoint accessed successfully', {
    user: req.user,
  });
});

module.exports = router;
