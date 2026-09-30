import api from './api';

/**
 * Service handling authentication API calls
 */
export const authService = {
  /**
   * Log in user
   * @param {string} email
   * @param {string} password
   */
  async login(email, password) {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  /**
   * Register new user (Vendor) with optional company profile details
   * @param {Object|string} dataOrName - Registration data object or user name
   * @param {string} [email] - User email (if string passed)
   * @param {string} [password] - User password (if string passed)
   */
   async register(dataOrName, email, password) {
     const payload =
       typeof dataOrName === 'object' && dataOrName !== null
         ? dataOrName
         : { name: dataOrName, email, password };
     const response = await api.post('/auth/register', payload);
     return response.data;
   },

  /**
   * Get current authenticated user profile
   */
  async getMe() {
    const response = await api.get('/auth/me');
    return response.data;
  },

  /**
   * Test RBAC endpoint access
   * @param {string} endpoint - 'admin-only' | 'procurement-only' | 'vendor-only' | 'protected'
   */
  async testRbac(endpoint) {
    const response = await api.get(`/test/${endpoint}`);
    return response.data;
  },
};

export default authService;
