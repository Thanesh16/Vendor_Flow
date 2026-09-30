const { AuditLog } = require('../models/AuditLog');
const { User } = require('../models/User');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { escapeRegex, isValidObjectId, toSafeInteger } = require('../utils/sanitize');

/**
 * Controller for Audit Logs
 * Exclusively accessible by ADMIN role
 */
const auditLogController = {
  /**
   * Get audit logs with pagination and filters
   * @access ADMIN
   * @route GET /api/audit-logs
   */
  async getAuditLogs(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        action,
        entityType,
        userId,
        dateFrom,
        dateTo,
        startDate,
        endDate,
        search,
      } = req.query;

      const effectiveStartDate = dateFrom || startDate;
      const effectiveEndDate = dateTo || endDate;

      const query = {};

      if (action && action !== 'ALL') {
        query.action = action.trim();
      }

      if (entityType && entityType !== 'ALL') {
        query.entityType = entityType.trim();
      }

      if (userId && userId !== 'ALL' && isValidObjectId(userId.trim())) {
        query.user = userId.trim();
      }

      if (effectiveStartDate || effectiveEndDate) {
        query.createdAt = {};
        if (effectiveStartDate) {
          const fromDate = new Date(effectiveStartDate);
          if (!isNaN(fromDate.getTime())) {
            query.createdAt.$gte = fromDate;
          }
        }
        if (effectiveEndDate) {
          const toDate = new Date(effectiveEndDate);
          if (!isNaN(toDate.getTime())) {
            toDate.setHours(23, 59, 59, 999);
            query.createdAt.$lte = toDate;
          }
        }
      }

      if (search && search.trim()) {
        const escaped = escapeRegex(search.trim());
        if (escaped) {
          const searchRegex = new RegExp(escaped, 'i');
          query.$or = [
            { action: searchRegex },
            { entityType: searchRegex },
            { description: searchRegex },
            { entityName: searchRegex },
          ];
        }
      }

      const parsedPage = toSafeInteger(page, 1, 10000, 1);
      const parsedLimit = toSafeInteger(limit, 1, 100, 20);
      const skip = (parsedPage - 1) * parsedLimit;

      const [total, logs] = await Promise.all([
        AuditLog.countDocuments(query),
        AuditLog.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parsedLimit)
          .populate('user', 'name email role'),
      ]);

      const totalPages = Math.ceil(total / parsedLimit) || 1;
      const pagination = {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages,
        hasPrevPage: parsedPage > 1,
        hasNextPage: parsedPage < totalPages,
      };

      return successResponse(res, 200, 'Audit logs retrieved successfully', {
        count: logs.length,
        total,
        logs,
        items: logs,
        pagination,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get distinct audit actions and entity types for filter dropdowns
   * @access ADMIN
   * @route GET /api/audit-logs/filters
   */
  async getAuditLogFilters(req, res, next) {
    try {
      const [actions, entityTypes, userIds] = await Promise.all([
        AuditLog.distinct('action'),
        AuditLog.distinct('entityType'),
        AuditLog.distinct('user'),
      ]);

      const validUserIds = (userIds || []).filter(Boolean);
      const users = await User.find({ _id: { $in: validUserIds } })
        .select('name email role')
        .sort({ name: 1 });

      return successResponse(res, 200, 'Audit filters retrieved successfully', {
        actions: (actions || []).sort(),
        entityTypes: (entityTypes || []).sort(),
        users,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = auditLogController;
