import api from './api';

export const masterProductService = {
  /**
   * Search and browse master products
   * @param {Object} [params] - { search, category, brand, page, limit }
   */
  async getAll(params = {}) {
    const response = await api.get('/master-products', { params });
    return response.data;
  },

  /**
   * Get master product by ID or catalogId
   * @param {string} id
   */
  async getById(id) {
    const response = await api.get(`/master-products/${id}`);
    return response.data;
  },

  /**
   * Get distinct categories and brands
   */
  async getCategoriesAndBrands() {
    const response = await api.get('/master-products/meta/categories-and-brands');
    return response.data;
  },

  /**
   * Get reference/market price for master product
   * @param {string} id
   */
  async getMarketPrice(id) {
    const response = await api.get(`/master-products/${id}/market-price`);
    return response.data;
  },

  /**
   * Create new master product entry (Admin only)
   * @param {Object} data
   */
  async create(data) {
    const response = await api.post('/master-products', data);
    return response.data;
  },

  /**
   * Update master product entry (Admin only)
   * @param {string} id
   * @param {Object} data
   */
  async update(id, data) {
    const response = await api.put(`/master-products/${id}`, data);
    return response.data;
  },

  /**
   * Search live external marketplace APIs + local catalog
   * @param {string} query - search term (min 2 chars)
   * @param {Object} [params] - { category, limit }
   */
  async searchExternal(query, params = {}) {
    const response = await api.get('/master-products/search', {
      params: { q: query, ...params },
    });
    return response.data;
  },

  /**
   * Cache an externally discovered product into Master Catalog
   * @param {Object} productData - normalised product object from external API
   */
  async cacheExternal(productData) {
    const response = await api.post('/master-products/cache-external', productData);
    return response.data;
  },

  /**
   * Refresh live market price for a master catalog product
   * @param {string} id - MongoDB _id of the MasterProduct
   */
  async refreshPrice(id) {
    const response = await api.post(`/master-products/${id}/refresh-price`);
    return response.data;
  },
};

export default masterProductService;
