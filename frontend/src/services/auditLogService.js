import api from './api';

export const auditLogService = {
  /**
   * Get paginated audit logs with search and filters (Admin only)
   * @param {Object} params - { page, limit, action, entityType, user, startDate, endDate, search }
   */
  async getAuditLogs(params = {}) {
    const response = await api.get('/audit-logs', { params });
    return response.data;
  },

  /**
   * Get available filter choices (actions, entity types, active users)
   */
  async getFilterOptions() {
    const response = await api.get('/audit-logs/filters');
    return response.data;
  },
};

export default auditLogService;
