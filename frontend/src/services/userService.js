import api from './api';

/**
 * Service for administrative user management operations
 */
export const userService = {
  /**
   * Admin-only: Provision a new Procurement Manager account
   * @param {Object} data
   * @param {string} data.name - Manager full name
   * @param {string} data.email - Business email
   * @param {string} data.password - Initial password (min 6 chars)
   */
  async createProcurementManager(data) {
    const response = await api.post('/users/procurement-manager', data);
    return response.data;
  },

  /**
   * Admin-only: Query system users with filters and pagination
   * @param {Object} params
   * @param {number} [params.page=1]
   * @param {number} [params.limit=10]
   * @param {string} [params.role]
   * @param {string} [params.search]
   * @param {string} [params.sortBy]
   * @param {string} [params.sortOrder]
   */
  async getUsers(params = {}) {
    const response = await api.get('/users', { params });
    return response.data;
  },
};

export default userService;
