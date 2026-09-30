import api from './api';

export const evaluationService = {
  /**
   * Submit post-delivery evaluation for a purchase order
   * @param {Object} data - { purchaseOrderId, qualityRating, deliveryRating, pricingRating, supportRating, overallRating, comments }
   */
  async submitEvaluation(data) {
    const response = await api.post('/evaluations', data);
    return response.data;
  },

  /**
   * Get evaluation for a purchase order
   * @param {string} orderId
   */
  async getEvaluationByOrderId(orderId) {
    const response = await api.get(`/evaluations/order/${orderId}`);
    return response.data;
  },

  /**
   * Get evaluations for a vendor
   * @param {string} vendorId
   */
  async getVendorEvaluations(vendorId) {
    const response = await api.get(`/evaluations/vendor/${vendorId}`);
    return response.data;
  },
};

export default evaluationService;
