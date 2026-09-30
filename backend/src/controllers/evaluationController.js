const mongoose = require('mongoose');
const { Evaluation } = require('../models/Evaluation');
const { PurchaseOrder, POStatus } = require('../models/PurchaseOrder');
const { Vendor } = require('../models/Vendor');
const { UserRoles } = require('../models/User');
const auditService = require('../services/auditService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

/**
 * Normalizes a 1-5 star rating or 0-100 numerical score into a 0-100 representation
 */
const normalizeScore = (rating, directScore) => {
  if (typeof directScore === 'number' && !isNaN(directScore) && directScore >= 0 && directScore <= 100) {
    return Math.round(directScore);
  }
  const r = Number(rating);
  if (!isNaN(r) && r >= 1 && r <= 5) {
    return Math.round(r * 20);
  }
  return 60; // fallback neutral
};

const evaluationController = {
  /**
   * Submit post-delivery evaluation for a completed purchase order
   * @route POST /api/evaluations
   */
  async createEvaluation(req, res, next) {
    try {
      const {
        purchaseOrderId,
        orderId,
        qualityRating,
        deliveryRating,
        pricingRating,
        supportRating,
        overallRating,
        qualityScore: directQuality,
        deliveryScore: directDelivery,
        pricingScore: directPricing,
        supportScore: directSupport,
        overallScore: directOverall,
        comments,
      } = req.body;

      const targetOrderId = purchaseOrderId || orderId;
      if (!targetOrderId || !mongoose.Types.ObjectId.isValid(targetOrderId)) {
        return errorResponse(res, 400, 'Valid purchaseOrderId is required');
      }

      // 1. Fetch target Purchase Order
      const purchaseOrder = await PurchaseOrder.findById(targetOrderId)
        .populate('vendor', 'companyName contactPerson email')
        .populate('requestedBy', 'name email role');

      if (!purchaseOrder) {
        return errorResponse(res, 404, 'Purchase order not found');
      }

      // 2. Strict Delivery status verification
      const eligibleStatuses = [POStatus.DELIVERED, POStatus.COMPLETED];
      if (!eligibleStatuses.includes(purchaseOrder.status)) {
        return errorResponse(
          res,
          400,
          `Cannot evaluate order. Order must be DELIVERED or COMPLETED (current status: ${purchaseOrder.status}).`
        );
      }

      // 3. Strict Ownership verification
      if (req.user.role === UserRoles.EMPLOYEE) {
        const poRequesterId = purchaseOrder.requestedBy?._id
          ? purchaseOrder.requestedBy._id.toString()
          : purchaseOrder.requestedBy?.toString();

        if (poRequesterId !== req.user._id.toString()) {
          return errorResponse(
            res,
            403,
            'Access denied. You can only evaluate purchase orders for your own requisitions.'
          );
        }
      } else if (req.user.role === UserRoles.VENDOR) {
        return errorResponse(
          res,
          403,
          'Access denied. Vendors cannot submit evaluations for their own delivered orders.'
        );
      }

      // 4. Duplicate prevention at application level
      const existingEvaluation = await Evaluation.findOne({ purchaseOrder: purchaseOrder._id });
      if (existingEvaluation) {
        return errorResponse(
          res,
          400,
          'An evaluation has already been submitted for this purchase order.'
        );
      }

      // 5. Convert 1-5 star criteria to 0-100 scores
      const qualityScore = normalizeScore(qualityRating, directQuality);
      const deliveryScore = normalizeScore(deliveryRating, directDelivery);
      const pricingScore = normalizeScore(pricingRating, directPricing);
      const supportScore = normalizeScore(supportRating, directSupport);
      const overallScore = normalizeScore(overallRating, directOverall);

      // 6. Persist evaluation in MongoDB
      const vendorId = purchaseOrder.vendor?._id || purchaseOrder.vendor;
      const cleanComments = (comments || '').trim().slice(0, 1000);

      const evaluation = await Evaluation.create({
        vendor: vendorId,
        evaluatedBy: req.user._id,
        purchaseOrder: purchaseOrder._id,
        qualityScore,
        deliveryScore,
        pricingScore,
        supportScore,
        overallScore,
        comments: cleanComments,
      });

      // 7. Record Immutable Audit Log
      await auditService.log({
        user: req.user,
        action: 'EVALUATION_SUBMITTED',
        entityType: 'Evaluation',
        entityId: evaluation._id,
        description: `Evaluation submitted for PO ${purchaseOrder.poNumber} with overall rating ${Math.round(overallScore / 20)}/5 (${overallScore}/100)`,
        metadata: {
          purchaseOrderId: purchaseOrder._id,
          poNumber: purchaseOrder.poNumber,
          vendorId,
          vendorName: purchaseOrder.vendor?.companyName || 'Supplier',
          qualityScore,
          deliveryScore,
          pricingScore,
          supportScore,
          overallScore,
        },
      });

      return successResponse(res, 201, 'Thank you! Your purchase evaluation has been submitted successfully.', {
        evaluation,
      });
    } catch (error) {
      // Handle MongoDB duplicate key collision defensively
      if (error.code === 11000) {
        return errorResponse(res, 400, 'An evaluation has already been submitted for this purchase order.');
      }
      next(error);
    }
  },

  /**
   * Get evaluation for a specific purchase order
   * @route GET /api/evaluations/order/:orderId
   */
  async getEvaluationByOrderId(req, res, next) {
    try {
      const { orderId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return errorResponse(res, 404, 'Purchase order not found');
      }

      const purchaseOrder = await PurchaseOrder.findById(orderId);
      if (!purchaseOrder) {
        return errorResponse(res, 404, 'Purchase order not found');
      }

      // Authorization check
      if (req.user.role === UserRoles.EMPLOYEE) {
        const poRequesterId = purchaseOrder.requestedBy?.toString();
        if (poRequesterId !== req.user._id.toString()) {
          return errorResponse(res, 403, 'Access denied. You can only view evaluations for your own orders.');
        }
      } else if (req.user.role === UserRoles.VENDOR) {
        const vendor = await Vendor.findOne({
          $or: [{ createdBy: req.user._id }, { email: req.user.email }, { user: req.user._id }],
        });
        if (!vendor || purchaseOrder.vendor.toString() !== vendor._id.toString()) {
          return errorResponse(res, 403, 'Access denied. You can only view evaluations for your own orders.');
        }
      }

      const evaluation = await Evaluation.findOne({ purchaseOrder: purchaseOrder._id })
        .populate('evaluatedBy', 'name email role')
        .populate('vendor', 'companyName');

      return successResponse(res, 200, 'Evaluation retrieved', {
        isEvaluated: Boolean(evaluation),
        evaluation: evaluation || null,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get evaluations for a vendor
   * @route GET /api/evaluations/vendor/:vendorId
   */
  async getVendorEvaluations(req, res, next) {
    try {
      const { vendorId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(vendorId)) {
        return errorResponse(res, 404, 'Vendor not found');
      }

      // Check vendor authorization
      if (req.user.role === UserRoles.VENDOR) {
        const vendor = await Vendor.findOne({
          $or: [{ createdBy: req.user._id }, { email: req.user.email }, { user: req.user._id }],
        });
        if (!vendor || vendor._id.toString() !== vendorId) {
          return errorResponse(res, 403, 'Access denied. You can only view your own company evaluations.');
        }
      }

      const evaluations = await Evaluation.find({ vendor: vendorId })
        .sort({ createdAt: -1 })
        .populate('evaluatedBy', 'name')
        .populate('purchaseOrder', 'poNumber totalAmount createdAt');

      return successResponse(res, 200, 'Vendor evaluations retrieved', {
        count: evaluations.length,
        evaluations,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = evaluationController;
