import api from './api';

/**
 * Service to fetch role-specific dashboard metrics
 */
export const dashboardService = {
  /**
   * Fetch Admin dashboard metrics
   */
  async getAdminDashboard() {
    const response = await api.get('/dashboard/admin');
    return response.data;
  },

  /**
   * Fetch Procurement Manager dashboard metrics
   */
  async getProcurementDashboard() {
    const response = await api.get('/dashboard/procurement');
    return response.data;
  },

  /**
   * Fetch Vendor dashboard metrics
   */
  async getVendorDashboard() {
    const response = await api.get('/dashboard/vendor');
    return response.data;
  },

  /**
   * Fetch Employee dashboard metrics
   */
  async getEmployeeDashboard() {
    const response = await api.get('/dashboard/employee');
    return response.data;
  },
};

export default dashboardService;
