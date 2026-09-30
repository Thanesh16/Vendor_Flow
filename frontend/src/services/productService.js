import api from './api';

/**
 * Service for Vendor Product Catalog operations
 */
export const productService = {
  /**
   * Get products with optional search, category, vendor, and sorting filters
   * @param {Object} [params] - { search, category, vendorId, isAvailable, minPrice, maxPrice, sortBy }
   */
  async getAll(params = {}) {
    const response = await api.get('/products', { params });
    return response.data;
  },

  /**
   * Get single product details by ID
   * @param {string} id
   */
  async getById(id) {
    const response = await api.get(`/products/${id}`);
    return response.data;
  },

  /**
   * Get distinct categories
   */
  async getCategories() {
    const response = await api.get('/products/categories');
    return response.data;
  },

  /**
   * Create a new product (Vendor, Admin)
   * @param {Object} productData
   */
  async create(productData) {
    const response = await api.post('/products', productData);
    return response.data;
  },

  /**
   * Update an existing product (Vendor [own only], Admin)
   * @param {string} id
   * @param {Object} productData
   */
  async update(id, productData) {
    const response = await api.put(`/products/${id}`, productData);
    return response.data;
  },

  /**
   * Toggle product availability status
   * @param {string} id
   * @param {boolean} [isAvailable]
   */
  async toggleAvailability(id, isAvailable) {
    const response = await api.patch(`/products/${id}/availability`, { isAvailable });
    return response.data;
  },

  /**
   * Delete a product
   * @param {string} id
   */
  async deleteProduct(id) {
    const response = await api.delete(`/products/${id}`);
    return response.data;
  },

  /**
   * Upload a product image file
   * @param {File} file
   */
  async uploadImage(file) {
    const formData = new FormData();
    formData.append('image', file);
    const response = await api.post('/products/upload-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Refresh live market price for a product
   * @param {string} id
   */
  async refreshMarketPrice(id) {
    const response = await api.post(`/products/${id}/refresh-market-price`);
    return response.data;
  },
};

export default productService;
