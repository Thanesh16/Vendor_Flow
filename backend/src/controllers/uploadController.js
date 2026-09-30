const storageService = require('../services/storageService');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { UserRoles } = require('../models/User');

/**
 * Controller for file upload operations
 */
const uploadController = {
  /**
   * Upload a product image
   * @access VENDOR, ADMIN
   * @route POST /api/uploads/product-image OR POST /api/products/upload-image
   */
  async uploadProductImage(req, res, next) {
    try {
      if (!req.file) {
        return errorResponse(
          res,
          400,
          'Please select a valid image file (JPG, JPEG, PNG, or WebP) under 5MB.'
        );
      }

      // Check permitted roles (VENDOR or ADMIN)
      if (req.user.role !== UserRoles.VENDOR && req.user.role !== UserRoles.ADMIN) {
        return errorResponse(
          res,
          403,
          'Access denied. Only vendors and administrators can upload product images.'
        );
      }

      const uploadResult = await storageService.uploadProductImage(req.file, req.user);

      return successResponse(res, 200, 'Image uploaded successfully', uploadResult);
    } catch (error) {
      next(error);
    }
  },
};

module.exports = uploadController;
