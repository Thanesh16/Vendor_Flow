import api from './api';

/**
 * Service handling Purchase Request API calls
 */
export const purchaseRequestService = {
  /**
   * Get all purchase requests (Role-scoped on backend)
   * @param {Object} [params] - { status, priority, search }
   */
  async getAll(params = {}) {
    const response = await api.get('/purchase-requests', { params });
    return response.data;
  },

  /**
   * Get specific purchase request by ID
   * @param {string} id
   */
  async getById(id) {
    const response = await api.get(`/purchase-requests/${id}`);
    return response.data;
  },

  /**
   * Create new purchase request
   * @param {Object} requestData
   */
  async create(requestData) {
    const response = await api.post('/purchase-requests', requestData);
    return response.data;
  },

  /**
   * Update draft purchase request
   * @param {string} id
   * @param {Object} requestData
   */
  async update(id, requestData) {
    const response = await api.put(`/purchase-requests/${id}`, requestData);
    return response.data;
  },

  /**
   * Submit draft purchase request for review
   * @param {string} id
   */
  async submit(id) {
    const response = await api.patch(`/purchase-requests/${id}/submit`);
    return response.data;
  },

  /**
   * Approve purchase request (Admin / Procurement Manager only)
   * @param {string} id
   */
  async approve(id) {
    const response = await api.patch(`/purchase-requests/${id}/approve`);
    return response.data;
  },

  /**
   * Reject purchase request (Admin / Procurement Manager only)
   * @param {string} id
   * @param {string} [reason]
   */
  async reject(id, reason = '') {
    const response = await api.patch(`/purchase-requests/${id}/reject`, { reason });
    return response.data;
  },

  /**
   * Cancel purchase request (Owner / Admin only)
   * @param {string} id
   */
  async cancel(id) {
    const response = await api.patch(`/purchase-requests/${id}/cancel`);
    return response.data;
  },

  /**
   * Check live product availability and match scores for approved purchase request
   * @param {string} id
   */
  async checkAvailability(id) {
    const response = await api.get(`/purchase-requests/${id}/availability`);
    return response.data;
  },

  /**
   * Select product and vendor for approved purchase request
   * @param {string} id
   * @param {Object} selectionData - { productId, vendorId, productName, vendorName, quantity, unitPrice, totalPrice, deliveryDays, matchScore, notes }
   */
  async selectProduct(id, selectionData) {
    const response = await api.post(`/purchase-requests/${id}/select-product`, selectionData);
    return response.data;
  },
};

export default purchaseRequestService;
