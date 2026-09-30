const { User } = require('../models/User');
const { Vendor, OnboardingStatus } = require('../models/Vendor');
const { PurchaseRequest } = require('../models/PurchaseRequest');
const { PurchaseOrder } = require('../models/PurchaseOrder');
const { Evaluation } = require('../models/Evaluation');
const { Product } = require('../models/Product');
const { successResponse } = require('../utils/apiResponse');

/**
 * Controller for Admin Dashboard metrics
 * @route GET /api/dashboard/admin
 */
const getAdminDashboard = async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalVendors,
      pendingApprovals,
      approvedVendors,
      underReviewVendors,
      rejectedVendors,
      totalPurchaseRequests,
      totalProducts,
      availableProducts,
      recentVendors,
      recentRequests,
    ] = await Promise.all([
      User.countDocuments(),
      Vendor.countDocuments(),
      Vendor.countDocuments({ onboardingStatus: 'PENDING' }),
      Vendor.countDocuments({ onboardingStatus: 'APPROVED' }),
      Vendor.countDocuments({ onboardingStatus: 'UNDER_REVIEW' }),
      Vendor.countDocuments({ onboardingStatus: 'REJECTED' }),
      PurchaseRequest.countDocuments(),
      Product.countDocuments(),
      Product.countDocuments({ isAvailable: true }),
      Vendor.find().sort({ createdAt: -1 }).limit(5).select('companyName contactPerson email onboardingStatus createdAt'),
      PurchaseRequest.find().sort({ createdAt: -1 }).limit(5).select('requestNumber title priority status createdAt'),
    ]);

    return successResponse(res, 200, 'Admin dashboard metrics retrieved', {
      metrics: {
        totalUsers,
        totalVendors,
        pendingApprovals,
        approvedVendors,
        underReviewVendors,
        rejectedVendors,
        totalPurchaseRequests,
        totalProducts,
        availableProducts,
      },
      recentVendors,
      recentRequests,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller for Procurement Manager Dashboard metrics
 * @route GET /api/dashboard/procurement
 */
const getProcurementDashboard = async (req, res, next) => {
  try {
    const approvedVendorsList = await Vendor.find({ onboardingStatus: OnboardingStatus.APPROVED }).select('_id');
    const approvedVendorIds = approvedVendorsList.map((v) => v._id);

    const [
      totalVendors,
      pendingReviews,
      approvedVendors,
      totalPurchaseRequests,
      pendingRequests,
      availableProducts,
      recentRequests,
      recentProducts,
    ] = await Promise.all([
      Vendor.countDocuments(),
      Vendor.countDocuments({ onboardingStatus: { $in: ['PENDING', 'UNDER_REVIEW'] } }),
      Vendor.countDocuments({ onboardingStatus: 'APPROVED' }),
      PurchaseRequest.countDocuments(),
      PurchaseRequest.countDocuments({ status: 'SUBMITTED' }),
      Product.countDocuments({ vendor: { $in: approvedVendorIds }, isAvailable: true }),
      PurchaseRequest.find().sort({ createdAt: -1 }).limit(5).select('requestNumber title priority status createdAt'),
      Product.find({ vendor: { $in: approvedVendorIds } }).sort({ createdAt: -1 }).limit(5).populate('vendor', 'companyName'),
    ]);

    return successResponse(res, 200, 'Procurement dashboard metrics retrieved', {
      metrics: {
        totalVendors,
        pendingReviews,
        approvedVendors,
        totalPurchaseRequests,
        pendingRequests,
        availableProducts,
      },
      recentRequests,
      recentProducts,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller for Vendor Dashboard metrics (strictly scoped to authenticated vendor)
 * @route GET /api/dashboard/vendor
 */
const getVendorDashboard = async (req, res, next) => {
  try {
    // Look up vendor record associated with authenticated user
    const vendor = await Vendor.findOne({
      $or: [{ createdBy: req.user._id }, { email: req.user.email }],
    });

    if (!vendor) {
      // Clean empty state for newly registered vendor before onboarding profile creation
      return successResponse(res, 200, 'Vendor dashboard retrieved (profile pending)', {
        hasProfile: false,
        vendor: null,
        metrics: {
          totalProducts: 0,
          availableProducts: 0,
          lowStockProducts: 0,
        },
        recentProducts: [],
      });
    }

    const [totalProducts, availableProducts, lowStockProducts, recentProducts] = await Promise.all([
      Product.countDocuments({ vendor: vendor._id }),
      Product.countDocuments({ vendor: vendor._id, isAvailable: true }),
      Product.countDocuments({ vendor: vendor._id, availableQuantity: { $lte: 5 } }),
      Product.find({ vendor: vendor._id }).sort({ createdAt: -1 }).limit(5),
    ]);

    return successResponse(res, 200, 'Vendor dashboard metrics retrieved', {
      hasProfile: true,
      vendor: {
        id: vendor._id,
        companyName: vendor.companyName,
        onboardingStatus: vendor.onboardingStatus,
      },
      metrics: {
        totalProducts,
        availableProducts,
        lowStockProducts,
      },
      recentProducts,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller for Employee Dashboard metrics (strictly scoped to authenticated employee)
 * @route GET /api/dashboard/employee
 */
const getEmployeeDashboard = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [
      totalRequests,
      draftRequests,
      pendingRequests,
      approvedRequests,
      rejectedRequests,
      cancelledRequests,
      recentRequests,
    ] = await Promise.all([
      PurchaseRequest.countDocuments({ requestedBy: userId }),
      PurchaseRequest.countDocuments({ requestedBy: userId, status: 'DRAFT' }),
      PurchaseRequest.countDocuments({ requestedBy: userId, status: 'SUBMITTED' }),
      PurchaseRequest.countDocuments({ requestedBy: userId, status: 'APPROVED' }),
      PurchaseRequest.countDocuments({ requestedBy: userId, status: 'REJECTED' }),
      PurchaseRequest.countDocuments({ requestedBy: userId, status: 'CANCELLED' }),
      PurchaseRequest.find({ requestedBy: userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('requestNumber title priority status requiredDate items createdAt'),
    ]);

    return successResponse(res, 200, 'Employee dashboard metrics retrieved', {
      metrics: {
        totalRequests,
        draftRequests,
        pendingRequests,
        approvedRequests,
        rejectedRequests,
        cancelledRequests,
      },
      recentRequests,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdminDashboard,
  getProcurementDashboard,
  getVendorDashboard,
  getEmployeeDashboard,
};
