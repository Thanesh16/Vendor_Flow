import api from './api';

export const purchaseOrderService = {
  /**
   * Get purchase orders (role-filtered by backend)
   */
  async getPurchaseOrders(params = {}) {
    const response = await api.get('/purchase-orders', { params });
    return response.data;
  },

  /**
   * Get single purchase order by ID
   */
  async getPurchaseOrderById(id) {
    const response = await api.get(`/purchase-orders/${id}`);
    return response.data;
  },

  /**
   * Create a new purchase order
   */
  async createPurchaseOrder(poData) {
    const response = await api.post('/purchase-orders', poData);
    return response.data;
  },

  /**
   * Vendor accepts purchase order preliminary offer
   */
  async acceptPurchaseOrder(id, notes = '') {
    const response = await api.patch(`/purchase-orders/${id}/accept`, { notes });
    return response.data;
  },

  /**
   * Requester confirms and officially issues purchase order
   */
  async confirmPurchaseOrder(id, notes = '') {
    const response = await api.patch(`/purchase-orders/${id}/confirm`, { notes });
    return response.data;
  },

  /**
   * Requester rejects / declines vendor offer
   */
  async requesterRejectPurchaseOrder(id, rejectionReason = '') {
    const response = await api.patch(`/purchase-orders/${id}/requester-reject`, { rejectionReason });
    return response.data;
  },

  /**
   * Vendor rejects purchase order with reason
   */
  async rejectPurchaseOrder(id, rejectionReason) {
    const response = await api.patch(`/purchase-orders/${id}/reject`, { rejectionReason });
    return response.data;
  },

  /**
   * Employee submits delivery destination details
   */
  async updateDeliveryDetails(id, deliveryDetails) {
    const response = await api.patch(`/purchase-orders/${id}/delivery-details`, deliveryDetails);
    return response.data;
  },

  /**
   * Update order fulfillment status
   */
  async updateFulfillmentStatus(id, status, notes = '') {
    const response = await api.patch(`/purchase-orders/${id}/fulfillment-status`, { status, notes });
    return response.data;
  },
};

export default purchaseOrderService;
