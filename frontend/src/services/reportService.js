import api from './api';

export const reportService = {
  /**
   * Get Executive Overview KPIs & Highlights
   * @param {Object} params - { range, startDate, endDate }
   */
  async getOverview(params = {}) {
    const response = await api.get('/reports/overview', { params });
    return response.data;
  },

  /**
   * Get Purchase Request Analytics & Lifecycle Breakdown
   * @param {Object} params - { range, startDate, endDate }
   */
  async getPurchaseRequests(params = {}) {
    const response = await api.get('/reports/purchase-requests', { params });
    return response.data;
  },

  /**
   * Get Purchase Order Analytics, Status Breakdown & Spend Trends
   * @param {Object} params - { range, startDate, endDate, vendorId, status }
   */
  async getPurchaseOrders(params = {}) {
    const response = await api.get('/reports/purchase-orders', { params });
    return response.data;
  },

  /**
   * Get Vendor Performance & Directory Analytics
   */
  async getVendors() {
    const response = await api.get('/reports/vendors');
    return response.data;
  },

  /**
   * Get Catalog Inventory Insights & Low-Stock Alerts
   */
  async getInventory() {
    const response = await api.get('/reports/inventory');
    return response.data;
  },

  /**
   * Export Report Data as CSV
   * @param {string} type - 'orders' | 'requests' | 'vendors'
   * @param {Object} params - { range, startDate, endDate }
   */
  async exportCSV(type = 'orders', params = {}) {
    const response = await api.get('/reports/export', {
      params: { type, ...params },
      responseType: 'blob',
    });
    return response.data;
  },
};

export default reportService;
