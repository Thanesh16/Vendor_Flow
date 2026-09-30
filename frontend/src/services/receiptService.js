import api from './api';

export const receiptService = {
  /**
   * Get receipt by purchase order ID (auto-generates if DELIVERED or COMPLETED)
   * @param {string} orderId
   */
  async getReceiptByOrderId(orderId) {
    const response = await api.get(`/receipts/order/${orderId}`);
    return response.data;
  },

  /**
   * Get receipt by receipt ID
   * @param {string} id
   */
  async getReceiptById(id) {
    const response = await api.get(`/receipts/${id}`);
    return response.data;
  },

  /**
   * Download receipt as PDF
   * @param {string} id
   * @param {string} [receiptNumber]
   */
  async downloadReceiptPdf(id, receiptNumber = 'receipt') {
    const response = await api.get(`/receipts/${id}/pdf`, {
      responseType: 'blob',
    });

    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${receiptNumber}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  /**
   * Download receipt PDF directly by purchase order ID
   * @param {string} orderId
   * @param {string} [poNumber]
   */
  async downloadReceiptForOrder(orderId, poNumber = 'receipt') {
    const response = await api.get(`/receipts/order/${orderId}/pdf`, {
      responseType: 'blob',
    });

    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Receipt-${poNumber}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};

export default receiptService;
