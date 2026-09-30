const mongoose = require('mongoose');
const { Vendor, OnboardingStatus } = require('../models/Vendor');
const { Product } = require('../models/Product');
const { PurchaseRequest, RequestStatus, RequestPriority } = require('../models/PurchaseRequest');
const { PurchaseOrder, POStatus } = require('../models/PurchaseOrder');
const { Evaluation } = require('../models/Evaluation');
const { successResponse, errorResponse } = require('../utils/apiResponse');

/**
 * Helper to construct MongoDB date filter based on range or explicit dates
 */
const parseDateFilter = (query) => {
  const { range, startDate, endDate } = query;
  const now = new Date();
  let start = null;
  let end = null;

  if (startDate) {
    const s = new Date(startDate);
    if (!isNaN(s.getTime())) start = s;
  }
  if (endDate) {
    const e = new Date(endDate);
    if (!isNaN(e.getTime())) {
      e.setHours(23, 59, 59, 999);
      end = e;
    }
  }

  if (!start && range) {
    switch (range) {
      case '7d':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '3m':
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '6m':
        start = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      case 'all':
      default:
        start = null;
        break;
    }
  }

  const filter = {};
  if (start || end) {
    filter.createdAt = {};
    if (start) filter.createdAt.$gte = start;
    if (end) filter.createdAt.$lte = end;
  }
  return filter;
};

/**
 * Overview Executive KPIs & Highlights
 * @route GET /api/reports/overview
 */
const getOverviewReport = async (req, res, next) => {
  try {
    const dateFilter = parseDateFilter(req.query);

    // 1. Vendor status counts
    const [
      totalVendors,
      approvedVendors,
      pendingVendors,
      underReviewVendors,
      rejectedVendors,
    ] = await Promise.all([
      Vendor.countDocuments(),
      Vendor.countDocuments({ onboardingStatus: OnboardingStatus.APPROVED }),
      Vendor.countDocuments({ onboardingStatus: OnboardingStatus.PENDING }),
      Vendor.countDocuments({ onboardingStatus: OnboardingStatus.UNDER_REVIEW }),
      Vendor.countDocuments({ onboardingStatus: OnboardingStatus.REJECTED }),
    ]);

    // 2. Product / Catalog inventory counts
    const [
      totalProducts,
      availableProducts,
      lowStockProducts,
      outOfStockProducts,
    ] = await Promise.all([
      Product.countDocuments({ isActive: true }),
      Product.countDocuments({ isAvailable: true, isActive: true, availableQuantity: { $gt: 0 } }),
      Product.countDocuments({ availableQuantity: { $gt: 0, $lte: 5 }, isActive: true }),
      Product.countDocuments({ $or: [{ availableQuantity: 0 }, { isAvailable: false }], isActive: true }),
    ]);

    // 3. Purchase Request counts (filtered by date if applicable)
    const prQuery = { ...dateFilter };
    const [
      totalPurchaseRequests,
      submittedRequests,
      approvedRequests,
      rejectedRequests,
      cancelledRequests,
      draftRequests,
    ] = await Promise.all([
      PurchaseRequest.countDocuments(prQuery),
      PurchaseRequest.countDocuments({ ...prQuery, status: RequestStatus.SUBMITTED }),
      PurchaseRequest.countDocuments({ ...prQuery, status: RequestStatus.APPROVED }),
      PurchaseRequest.countDocuments({ ...prQuery, status: RequestStatus.REJECTED }),
      PurchaseRequest.countDocuments({ ...prQuery, status: RequestStatus.CANCELLED }),
      PurchaseRequest.countDocuments({ ...prQuery, status: RequestStatus.DRAFT }),
    ]);

    // 4. Purchase Order counts & Financial metrics (filtered by date if applicable)
    const poQuery = { ...dateFilter };
    const [
      totalPurchaseOrders,
      completedOrders,
      processingOrders,
      shippedOrders,
      deliveredOrders,
      acceptedOrders,
      sentOrders,
      rejectedOrders,
      cancelledOrders,
    ] = await Promise.all([
      PurchaseOrder.countDocuments(poQuery),
      PurchaseOrder.countDocuments({ ...poQuery, status: POStatus.COMPLETED }),
      PurchaseOrder.countDocuments({ ...poQuery, status: POStatus.PROCESSING }),
      PurchaseOrder.countDocuments({ ...poQuery, status: POStatus.SHIPPED }),
      PurchaseOrder.countDocuments({ ...poQuery, status: POStatus.DELIVERED }),
      PurchaseOrder.countDocuments({ ...poQuery, status: POStatus.ACCEPTED }),
      PurchaseOrder.countDocuments({ ...poQuery, status: POStatus.SENT_TO_VENDOR }),
      PurchaseOrder.countDocuments({ ...poQuery, status: POStatus.REJECTED }),
      PurchaseOrder.countDocuments({ ...poQuery, status: POStatus.CANCELLED }),
    ]);

    // Calculate real procurement spend values
    const financialAgg = await PurchaseOrder.aggregate([
      { $match: poQuery },
      {
        $group: {
          _id: null,
          totalProcurementValue: {
            $sum: {
              $cond: [{ $in: ['$status', [POStatus.REJECTED, POStatus.CANCELLED]] }, 0, '$totalAmount'],
            },
          },
          completedSpend: {
            $sum: {
              $cond: [{ $eq: ['$status', POStatus.COMPLETED] }, '$totalAmount', 0],
            },
          },
          committedSpend: {
            $sum: {
              $cond: [
                { $in: ['$status', [POStatus.ACCEPTED, POStatus.PROCESSING, POStatus.SHIPPED, POStatus.DELIVERED]] },
                '$totalAmount',
                0,
              ],
            },
          },
          validOrderCount: {
            $sum: {
              $cond: [{ $in: ['$status', [POStatus.REJECTED, POStatus.CANCELLED]] }, 0, 1],
            },
          },
        },
      },
    ]);

    const totalProcurementValue = financialAgg[0]?.totalProcurementValue || 0;
    const completedSpend = financialAgg[0]?.completedSpend || 0;
    const committedSpend = financialAgg[0]?.committedSpend || 0;
    const validOrderCount = financialAgg[0]?.validOrderCount || 0;
    const averageOrderValue = validOrderCount > 0 ? Math.round(totalProcurementValue / validOrderCount) : 0;

    // 5. Intelligent Procurement Insights derived from real data
    const activeDeliveries = shippedOrders + deliveredOrders;

    // Top active vendor calculation
    const topVendorAgg = await PurchaseOrder.aggregate([
      { $match: { ...poQuery, status: { $nin: [POStatus.REJECTED, POStatus.CANCELLED] } } },
      { $group: { _id: '$vendor', orderCount: { $sum: 1 }, totalSpend: { $sum: '$totalAmount' } } },
      { $sort: { orderCount: -1 } },
      { $limit: 1 },
      {
        $lookup: {
          from: 'vendors',
          localField: '_id',
          foreignField: '_id',
          as: 'vendorDoc',
        },
      },
    ]);

    const mostActiveVendor = topVendorAgg[0]?.vendorDoc?.[0]?.companyName || (topVendorAgg[0]?.vendorDoc?.[0]?.name) || null;

    // Top ordered product category
    const topCategoryAgg = await PurchaseOrder.aggregate([
      { $match: { ...poQuery, status: { $nin: [POStatus.REJECTED, POStatus.CANCELLED] } } },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productDoc',
        },
      },
      {
        $group: {
          _id: { $ifNull: [{ $arrayElemAt: ['$productDoc.category', 0] }, 'General Supplies'] },
          count: { $sum: '$items.quantity' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ]);

    const topCategory = topCategoryAgg[0]?._id || null;

    return successResponse(res, 200, 'Overview report retrieved successfully', {
      timeframe: req.query.range || 'all',
      kpis: {
        totalVendors,
        approvedVendors,
        pendingVendors,
        underReviewVendors,
        rejectedVendors,
        totalProducts,
        availableProducts,
        lowStockProducts,
        outOfStockProducts,
        totalPurchaseRequests,
        submittedRequests,
        approvedRequests,
        rejectedRequests,
        cancelledRequests,
        draftRequests,
        totalPurchaseOrders,
        completedOrders,
        processingOrders,
        shippedOrders,
        deliveredOrders,
        acceptedOrders,
        sentOrders,
        rejectedOrders,
        cancelledOrders,
        totalProcurementValue,
        completedSpend,
        committedSpend,
        averageOrderValue,
      },
      insights: {
        mostActiveVendor: mostActiveVendor || 'No orders yet',
        topCategory: topCategory || 'N/A',
        activeDeliveries,
        pendingRequests: submittedRequests,
        completedOrdersCount: completedOrders,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Purchase Request Analytics & Lifecycle Breakdown
 * @route GET /api/reports/purchase-requests
 */
const getPurchaseRequestReport = async (req, res, next) => {
  try {
    const dateFilter = parseDateFilter(req.query);

    const [
      total,
      submitted,
      approved,
      rejected,
      cancelled,
      draft,
      lowPriority,
      mediumPriority,
      highPriority,
      urgentPriority,
    ] = await Promise.all([
      PurchaseRequest.countDocuments(dateFilter),
      PurchaseRequest.countDocuments({ ...dateFilter, status: RequestStatus.SUBMITTED }),
      PurchaseRequest.countDocuments({ ...dateFilter, status: RequestStatus.APPROVED }),
      PurchaseRequest.countDocuments({ ...dateFilter, status: RequestStatus.REJECTED }),
      PurchaseRequest.countDocuments({ ...dateFilter, status: RequestStatus.CANCELLED }),
      PurchaseRequest.countDocuments({ ...dateFilter, status: RequestStatus.DRAFT }),
      PurchaseRequest.countDocuments({ ...dateFilter, priority: RequestPriority.LOW }),
      PurchaseRequest.countDocuments({ ...dateFilter, priority: RequestPriority.MEDIUM }),
      PurchaseRequest.countDocuments({ ...dateFilter, priority: RequestPriority.HIGH }),
      PurchaseRequest.countDocuments({ ...dateFilter, priority: RequestPriority.URGENT }),
    ]);

    // Monthly Creation Trend
    const monthlyTrendAgg = await PurchaseRequest.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const trend = monthlyTrendAgg.map((m) => ({
      year: m._id.year,
      month: m._id.month,
      label: `${monthNames[m._id.month - 1]} ${m._id.year}`,
      count: m.count,
    }));

    return successResponse(res, 200, 'Purchase request analytics retrieved successfully', {
      total,
      statusBreakdown: {
        SUBMITTED: { count: submitted, percentage: total > 0 ? Math.round((submitted / total) * 100) : 0 },
        APPROVED: { count: approved, percentage: total > 0 ? Math.round((approved / total) * 100) : 0 },
        REJECTED: { count: rejected, percentage: total > 0 ? Math.round((rejected / total) * 100) : 0 },
        CANCELLED: { count: cancelled, percentage: total > 0 ? Math.round((cancelled / total) * 100) : 0 },
        DRAFT: { count: draft, percentage: total > 0 ? Math.round((draft / total) * 100) : 0 },
      },
      priorityBreakdown: {
        LOW: lowPriority,
        MEDIUM: mediumPriority,
        HIGH: highPriority,
        URGENT: urgentPriority,
      },
      trend,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Purchase Order Analytics & Spend Trend
 * @route GET /api/reports/purchase-orders
 */
const getPurchaseOrderReport = async (req, res, next) => {
  try {
    const dateFilter = parseDateFilter(req.query);
    const query = { ...dateFilter };

    if (req.query.vendorId && mongoose.Types.ObjectId.isValid(req.query.vendorId)) {
      query.vendor = new mongoose.Types.ObjectId(req.query.vendorId);
    }

    if (req.query.status && Object.values(POStatus).includes(req.query.status)) {
      query.status = req.query.status;
    }

    // Status counts
    const statusCountsAgg = await PurchaseOrder.aggregate([
      { $match: query },
      { $group: { _id: '$status', count: { $sum: 1 }, totalValue: { $sum: '$totalAmount' } } },
    ]);

    const statusMap = {};
    Object.values(POStatus).forEach((st) => {
      statusMap[st] = { count: 0, totalValue: 0 };
    });
    statusCountsAgg.forEach((item) => {
      statusMap[item._id] = {
        count: item.count,
        totalValue: item.totalValue,
      };
    });

    const totalOrders = Object.values(statusMap).reduce((acc, s) => acc + s.count, 0);

    // Spend Aggregation
    const spendAgg = await PurchaseOrder.aggregate([
      { $match: { ...query, status: { $nin: [POStatus.REJECTED, POStatus.CANCELLED] } } },
      {
        $group: {
          _id: null,
          totalSpend: { $sum: '$totalAmount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const totalSpend = spendAgg[0]?.totalSpend || 0;
    const activeOrderCount = spendAgg[0]?.count || 0;
    const avgSpendPerOrder = activeOrderCount > 0 ? Math.round(totalSpend / activeOrderCount) : 0;

    // Monthly Spend Trend
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlySpendAgg = await PurchaseOrder.aggregate([
      { $match: { ...query, status: { $nin: [POStatus.REJECTED, POStatus.CANCELLED] } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          totalSpend: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const monthlyTrend = monthlySpendAgg.map((m) => ({
      year: m._id.year,
      month: m._id.month,
      label: `${monthNames[m._id.month - 1]} ${m._id.year}`,
      totalSpend: m.totalSpend,
      orderCount: m.orderCount,
    }));

    // Recent 10 Orders for concise table
    const recentOrders = await PurchaseOrder.find(query)
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('vendor', 'companyName email')
      .populate('requestedBy', 'name email')
      .select('poNumber vendor requestedBy totalAmount status createdAt expectedDeliveryDate');

    return successResponse(res, 200, 'Purchase order analytics retrieved successfully', {
      totalOrders,
      totalSpend,
      avgSpendPerOrder,
      statusBreakdown: statusMap,
      monthlyTrend,
      recentOrders,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Vendor Analytics & Performance Ratings
 * @route GET /api/reports/vendors
 */
const getVendorAnalyticsReport = async (req, res, next) => {
  try {
    const [
      totalVendors,
      approvedCount,
      underReviewCount,
      pendingCount,
      rejectedCount,
    ] = await Promise.all([
      Vendor.countDocuments(),
      Vendor.countDocuments({ onboardingStatus: OnboardingStatus.APPROVED }),
      Vendor.countDocuments({ onboardingStatus: OnboardingStatus.UNDER_REVIEW }),
      Vendor.countDocuments({ onboardingStatus: OnboardingStatus.PENDING }),
      Vendor.countDocuments({ onboardingStatus: OnboardingStatus.REJECTED }),
    ]);

    // Top Vendors by Completed Orders and Spend
    const vendorOrderAgg = await PurchaseOrder.aggregate([
      { $match: { status: { $nin: [POStatus.REJECTED, POStatus.CANCELLED] } } },
      {
        $group: {
          _id: '$vendor',
          totalOrders: { $sum: 1 },
          completedOrders: { $sum: { $cond: [{ $eq: ['$status', POStatus.COMPLETED] }, 1, 0] } },
          totalSpend: { $sum: '$totalAmount' },
        },
      },
      { $sort: { totalSpend: -1, totalOrders: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'vendors',
          localField: '_id',
          foreignField: '_id',
          as: 'vendorDoc',
        },
      },
    ]);

    // Look up evaluations for each vendor
    const topVendorsWithPerformance = await Promise.all(
      vendorOrderAgg.map(async (v, index) => {
        const vendorDoc = v.vendorDoc?.[0] || {};
        const evaluations = await Evaluation.find({ vendor: v._id });

        let performance = {
          isEvaluated: false,
          ratingLabel: 'Not evaluated',
          overallScore: null,
          qualityScore: null,
          deliveryScore: null,
          pricingScore: null,
          supportScore: null,
          evaluationCount: 0,
        };

        if (evaluations.length > 0) {
          const totalOverall = evaluations.reduce((sum, e) => sum + e.overallScore, 0);
          const totalQuality = evaluations.reduce((sum, e) => sum + e.qualityScore, 0);
          const totalDelivery = evaluations.reduce((sum, e) => sum + e.deliveryScore, 0);
          const totalPricing = evaluations.reduce((sum, e) => sum + e.pricingScore, 0);
          const totalSupport = evaluations.reduce((sum, e) => sum + e.supportScore, 0);
          const count = evaluations.length;

          performance = {
            isEvaluated: true,
            ratingLabel: `${Math.round(totalOverall / count)}/100`,
            overallScore: Math.round(totalOverall / count),
            qualityScore: Math.round(totalQuality / count),
            deliveryScore: Math.round(totalDelivery / count),
            pricingScore: Math.round(totalPricing / count),
            supportScore: Math.round(totalSupport / count),
            evaluationCount: count,
          };
        }

        return {
          rank: index + 1,
          vendorId: v._id,
          companyName: vendorDoc.companyName || vendorDoc.name || 'Unnamed Vendor',
          contactPerson: vendorDoc.contactPerson || 'N/A',
          city: vendorDoc.city || '',
          state: vendorDoc.state || '',
          onboardingStatus: vendorDoc.onboardingStatus || 'PENDING',
          totalOrders: v.totalOrders,
          completedOrders: v.completedOrders,
          totalSpend: v.totalSpend,
          performance,
        };
      })
    );

    // Organization-wide Evaluation Performance Summary
    const allEvaluations = await Evaluation.find();
    let orgPerformance = null;
    if (allEvaluations.length > 0) {
      const count = allEvaluations.length;
      orgPerformance = {
        totalEvaluations: count,
        avgOverall: Math.round(allEvaluations.reduce((sum, e) => sum + e.overallScore, 0) / count),
        avgQuality: Math.round(allEvaluations.reduce((sum, e) => sum + e.qualityScore, 0) / count),
        avgDelivery: Math.round(allEvaluations.reduce((sum, e) => sum + e.deliveryScore, 0) / count),
        avgPricing: Math.round(allEvaluations.reduce((sum, e) => sum + e.pricingScore, 0) / count),
        avgSupport: Math.round(allEvaluations.reduce((sum, e) => sum + e.supportScore, 0) / count),
      };
    }

    return successResponse(res, 200, 'Vendor analytics retrieved successfully', {
      statusBreakdown: {
        total: totalVendors,
        APPROVED: approvedCount,
        UNDER_REVIEW: underReviewCount,
        PENDING: pendingCount,
        REJECTED: rejectedCount,
      },
      topVendors: topVendorsWithPerformance,
      orgPerformance,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Inventory Insights & Catalog Analytics
 * @route GET /api/reports/inventory
 */
const getInventoryReport = async (req, res, next) => {
  try {
    const [
      totalProducts,
      availableProducts,
      lowStockCount,
      outOfStockCount,
    ] = await Promise.all([
      Product.countDocuments({ isActive: true }),
      Product.countDocuments({ isAvailable: true, isActive: true, availableQuantity: { $gt: 0 } }),
      Product.countDocuments({ availableQuantity: { $gt: 0, $lte: 5 }, isActive: true }),
      Product.countDocuments({ $or: [{ availableQuantity: 0 }, { isAvailable: false }], isActive: true }),
    ]);

    // Categories Distribution Aggregation
    const categoryAgg = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalUnits: { $sum: '$availableQuantity' },
          avgPrice: { $avg: '$price' },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const categories = categoryAgg.map((cat) => ({
      categoryName: cat._id || 'Uncategorized',
      productCount: cat.count,
      totalUnits: cat.totalUnits,
      avgPrice: Math.round(cat.avgPrice || 0),
    }));

    // Low Stock Alert Table (availableQuantity <= 5)
    const lowStockAlerts = await Product.find({
      availableQuantity: { $lte: 5 },
      isActive: true,
    })
      .sort({ availableQuantity: 1 })
      .limit(15)
      .populate('vendor', 'companyName contactPerson phone')
      .select('productName category price availableQuantity isAvailable vendor lastStockUpdate');

    return successResponse(res, 200, 'Inventory analytics retrieved successfully', {
      summary: {
        totalProducts,
        availableProducts,
        lowStockCount,
        outOfStockCount,
        lowStockThreshold: 5,
      },
      categories,
      lowStockAlerts,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Export Analytical Data to CSV
 * @route GET /api/reports/export
 * @query type: 'orders' | 'requests' | 'vendors'
 */
const exportReportCSV = async (req, res, next) => {
  try {
    const { type = 'orders' } = req.query;
    const dateFilter = parseDateFilter(req.query);

    let filename = `vendorflow-${type}-report.csv`;
    let csvRows = [];

    if (type === 'orders') {
      const orders = await PurchaseOrder.find(dateFilter)
        .sort({ createdAt: -1 })
        .populate('vendor', 'companyName')
        .populate('requestedBy', 'name email');

      csvRows.push(['PO Number', 'Vendor', 'Requester', 'Subtotal', 'Tax', 'Total Amount', 'Status', 'Date', 'Delivery Contact']);

      orders.forEach((o) => {
        csvRows.push([
          o.poNumber || '',
          `"${(o.vendor?.companyName || 'N/A').replace(/"/g, '""')}"`,
          `"${(o.requestedBy?.name || 'N/A').replace(/"/g, '""')}"`,
          o.subtotal || 0,
          o.tax || 0,
          o.totalAmount || 0,
          o.status || '',
          o.createdAt ? new Date(o.createdAt).toISOString().split('T')[0] : '',
          `"${(o.deliveryDetails?.contactName || '').replace(/"/g, '""')}"`,
        ]);
      });
    } else if (type === 'requests') {
      const requests = await PurchaseRequest.find(dateFilter)
        .sort({ createdAt: -1 })
        .populate('requestedBy', 'name email');

      csvRows.push(['Request Number', 'Title', 'Priority', 'Status', 'Requester', 'Item Count', 'Date']);

      requests.forEach((r) => {
        csvRows.push([
          r.requestNumber || '',
          `"${(r.title || '').replace(/"/g, '""')}"`,
          r.priority || '',
          r.status || '',
          `"${(r.requestedBy?.name || 'N/A').replace(/"/g, '""')}"`,
          r.items?.length || 0,
          r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : '',
        ]);
      });
    } else if (type === 'vendors') {
      const vendors = await Vendor.find().sort({ createdAt: -1 });

      csvRows.push(['Company Name', 'Contact Person', 'Email', 'Phone', 'City', 'State', 'Status', 'Created Date']);

      vendors.forEach((v) => {
        csvRows.push([
          `"${(v.companyName || '').replace(/"/g, '""')}"`,
          `"${(v.contactPerson || '').replace(/"/g, '""')}"`,
          v.email || '',
          v.phone || '',
          `"${(v.city || '').replace(/"/g, '""')}"`,
          `"${(v.state || '').replace(/"/g, '""')}"`,
          v.onboardingStatus || '',
          v.createdAt ? new Date(v.createdAt).toISOString().split('T')[0] : '',
        ]);
      });
    } else {
      return errorResponse(res, 400, "Invalid export type. Supported: 'orders', 'requests', 'vendors'");
    }

    const csvContent = csvRows.map((row) => row.join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOverviewReport,
  getPurchaseRequestReport,
  getPurchaseOrderReport,
  getVendorAnalyticsReport,
  getInventoryReport,
  exportReportCSV,
};
