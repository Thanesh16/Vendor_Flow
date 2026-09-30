const mongoose = require('mongoose');
const { Receipt } = require('../models/Receipt');
const { PurchaseOrder } = require('../models/PurchaseOrder');
const { Vendor } = require('../models/Vendor');
const { UserRoles } = require('../models/User');
const receiptService = require('../services/receiptService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

/**
 * Helper to verify role-based receipt authorization and prevent IDOR
 */
const verifyReceiptOwnership = async (receipt, user) => {
  if (!receipt || !user) return false;

  if (user.role === UserRoles.ADMIN || user.role === UserRoles.PROCUREMENT_MANAGER) {
    return true;
  }

  if (user.role === UserRoles.EMPLOYEE) {
    return Boolean(receipt.employee && receipt.employee.toString() === user._id.toString());
  }

  if (user.role === UserRoles.VENDOR) {
    const vendor = await Vendor.findOne({
      $or: [{ createdBy: user._id }, { email: user.email }, { user: user._id }],
    });
    return Boolean(vendor && receipt.vendor && receipt.vendor.toString() === vendor._id.toString());
  }

  return false;
};

const receiptController = {
  /**
   * Get or generate receipt for a purchase order
   * @route GET /api/receipts/order/:orderId
   */
  async getReceiptByOrderId(req, res, next) {
    try {
      const { orderId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return errorResponse(res, 404, 'Purchase order not found');
      }

      const purchaseOrder = await PurchaseOrder.findById(orderId);
      if (!purchaseOrder) {
        return errorResponse(res, 404, 'Purchase order not found');
      }

      // Check PO access permission
      if (req.user.role === UserRoles.EMPLOYEE) {
        if (!purchaseOrder.requestedBy || purchaseOrder.requestedBy.toString() !== req.user._id.toString()) {
          return errorResponse(res, 403, 'Access denied. You can only access receipts for your own requisitions.');
        }
      } else if (req.user.role === UserRoles.VENDOR) {
        const vendor = await Vendor.findOne({
          $or: [{ createdBy: req.user._id }, { email: req.user.email }, { user: req.user._id }],
        });
        if (!vendor || purchaseOrder.vendor.toString() !== vendor._id.toString()) {
          return errorResponse(res, 403, 'Access denied. You can only access receipts for your own purchase orders.');
        }
      }

      const receipt = await receiptService.generateReceiptForPO(orderId, req.user);

      return successResponse(res, 200, 'Purchase receipt retrieved successfully', {
        receipt,
      });
    } catch (error) {
      if (error.statusCode) {
        return errorResponse(res, error.statusCode, error.message);
      }
      next(error);
    }
  },

  /**
   * Download Receipt PDF directly by Order ID
   * @route GET /api/receipts/order/:orderId/pdf
   */
  async downloadReceiptByOrderId(req, res, next) {
    try {
      const { orderId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return errorResponse(res, 404, 'Purchase order not found');
      }

      const purchaseOrder = await PurchaseOrder.findById(orderId);
      if (!purchaseOrder) {
        return errorResponse(res, 404, 'Purchase order not found');
      }

      // Check PO access permission
      if (req.user.role === UserRoles.EMPLOYEE) {
        if (!purchaseOrder.requestedBy || purchaseOrder.requestedBy.toString() !== req.user._id.toString()) {
          return errorResponse(res, 403, 'Access denied. You can only download receipts for your own requisitions.');
        }
      } else if (req.user.role === UserRoles.VENDOR) {
        const vendor = await Vendor.findOne({
          $or: [{ createdBy: req.user._id }, { email: req.user.email }, { user: req.user._id }],
        });
        if (!vendor || purchaseOrder.vendor.toString() !== vendor._id.toString()) {
          return errorResponse(res, 403, 'Access denied. You can only download receipts for your own purchase orders.');
        }
      }

      const receipt = await receiptService.generateReceiptForPO(orderId, req.user);
      receiptService.generateReceiptPDFStream(receipt, res);
    } catch (error) {
      if (error.statusCode) {
        return errorResponse(res, error.statusCode, error.message);
      }
      next(error);
    }
  },

  /**
   * Get receipt by receipt ID
   * @route GET /api/receipts/:id
   */
  async getReceiptById(req, res, next) {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return errorResponse(res, 404, 'Receipt not found');
      }

      const receipt = await Receipt.findById(req.params.id);
      if (!receipt) {
        return errorResponse(res, 404, 'Receipt not found');
      }

      const isAuthorized = await verifyReceiptOwnership(receipt, req.user);
      if (!isAuthorized) {
        return errorResponse(res, 403, 'Access denied. You do not have permission to view this receipt.');
      }

      return successResponse(res, 200, 'Receipt details retrieved', {
        receipt,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Download Receipt PDF by Receipt ID
   * @route GET /api/receipts/:id/pdf
   */
  async downloadReceiptPdf(req, res, next) {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return errorResponse(res, 404, 'Receipt not found');
      }

      const receipt = await Receipt.findById(req.params.id);
      if (!receipt) {
        return errorResponse(res, 404, 'Receipt not found');
      }

      const isAuthorized = await verifyReceiptOwnership(receipt, req.user);
      if (!isAuthorized) {
        return errorResponse(res, 403, 'Access denied. You do not have permission to download this receipt.');
      }

      receiptService.generateReceiptPDFStream(receipt, res);
    } catch (error) {
      next(error);
    }
  },
};

module.exports = receiptController;
