import api from './api';

/**
 * Service handling vendor management and onboarding API calls
 */
export const vendorService = {
  /**
   * Get all vendors with search and status filtering (Admin & Procurement Manager only)
   * @param {Object} [params] - { search, status }
   */
  async getAllVendors(params = {}) {
    const response = await api.get('/vendors', { params });
    return response.data;
  },

  /**
   * Get current authenticated vendor's own profile
   */
  async getMyProfile() {
    const response = await api.get('/vendors/profile/me');
    return response.data;
  },

  /**
   * Get specific vendor details by ID
   * @param {string} id
   */
  async getVendorById(id) {
    const response = await api.get(`/vendors/${id}`);
    return response.data;
  },

  /**
   * Submit new vendor onboarding profile
   * @param {Object} vendorData
   */
  async createVendor(vendorData) {
    const response = await api.post('/vendors', vendorData);
    return response.data;
  },

  /**
   * Update vendor profile
   * @param {string} id
   * @param {Object} vendorData
   */
  async updateVendor(id, vendorData) {
    const response = await api.put(`/vendors/${id}`, vendorData);
    return response.data;
  },

  /**
   * Update vendor onboarding status (Review workflow)
   * @param {string} id
   * @param {string} status - 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED'
   */
  async updateStatus(id, status) {
    const response = await api.patch(`/vendors/${id}/status`, { status });
    return response.data;
  },

  /**
   * Upload vendor shop photo
   * @param {File} file
   * @param {string} [vendorId]
   */
  async uploadShopImage(file, vendorId = '') {
    const formData = new FormData();
    formData.append('image', file);
    if (vendorId) {
      formData.append('vendorId', vendorId);
    }
    const response = await api.post('/vendors/upload-shop-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Update vendor shop image via URL
   * @param {string} vendorId
   * @param {string} shopImage
   */
  async updateShopImageUrl(vendorId, shopImage) {
    const response = await api.put(`/vendors/${vendorId}/shop-image`, { shopImage });
    return response.data;
  },

  /**
   * Remove vendor shop photo
   * @param {string} vendorId
   */
  async removeShopImage(vendorId) {
    const response = await api.delete(`/vendors/${vendorId}/shop-image`);
    return response.data;
  },
};

export default vendorService;
