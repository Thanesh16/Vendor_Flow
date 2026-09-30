const config = require('../../../config/env');
const { normalizeProduct } = require('../normalizer');

/**
 * realtimeProductSearchAdapter.js
 * Calls RapidAPI Real-Time Product Search (Google Shopping India, Amazon India, Flipkart, etc.)
 */
class RealtimeProductSearchAdapter {
  constructor() {
    this.name = 'realtime_product_search';
    this.baseUrl = config.productApi.baseUrl || 'https://real-time-product-search.p.rapidapi.com';
    this.host = config.productApi.rapidApiHost || 'real-time-product-search.p.rapidapi.com';
  }

  getApiKey() {
    return config.productApi.apiKey;
  }

  isAvailable() {
    return Boolean(this.getApiKey());
  }

  async search(query, options = {}) {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return { success: false, error: 'API key not configured for Real-Time Product Search' };
    }

    try {
      const url = `${this.baseUrl}/search?q=${encodeURIComponent(query)}&country=in&language=en&limit=${options.limit || 15}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': this.host,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          status: response.status,
          error: `Real-Time Product Search returned ${response.status}: ${errorText}`,
        };
      }

      const json = await response.json();
      const rawItems = json.data || [];

      const normalized = rawItems.map((item) => {
        const title = item.product_title || '';
        const rawPrice = item.offer?.price || item.price || item.typical_price_range?.[0] || 0;
        const sourceName = item.offer?.store_name || item.store_name || 'Google Shopping India';
        const sourceUrl = item.offer?.offer_page_url || item.product_page_url || '';
        const image = Array.isArray(item.product_photos) ? item.product_photos[0] : item.product_photo || '';

        // Extract specifications attributes
        const specsObj = item.product_attributes || {};
        const specsStr = Object.entries(specsObj)
          .map(([k, v]) => `${k}: ${v}`)
          .join(' | ');

        // Check if multiple store offers exist
        const storeList = [];
        if (item.offer) {
          storeList.push({
            storeName: sourceName,
            price: item.offer.price,
            url: sourceUrl,
            inStock: item.offer.in_stock !== false,
          });
        }

        return normalizeProduct({
          rawTitle: title,
          rawBrand: item.product_brand || '',
          rawModel: '',
          rawPrice,
          rawMrp: item.typical_price_range?.[1] || 0,
          rawImage: image,
          rawDescription: item.product_description || '',
          rawSpecifications: specsStr,
          rawSpecificationsObject: specsObj,
          source: sourceName,
          sourceUrl,
          externalId: item.product_id || '',
          provider: 'rapidapi_realtime_search',
          storeList,
        });
      });

      return {
        success: true,
        provider: this.name,
        data: normalized,
      };
    } catch (err) {
      return {
        success: false,
        error: `Real-Time Product Search request failed: ${err.message}`,
      };
    }
  }

  async getPrice(productId, options = {}) {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return { success: false, error: 'API key not configured for Real-Time Product Search' };
    }

    try {
      const url = `${this.baseUrl}/product-details?product_id=${encodeURIComponent(productId)}&country=in&language=en`;
      const response = await fetch(url, {
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': this.host,
        },
      });

      if (!response.ok) {
        return { success: false, error: `Product details error: ${response.status}` };
      }

      const json = await response.json();
      const product = json.data;
      if (!product) return { success: false, error: 'Product not found' };

      const offer = product.offer || {};
      return {
        success: true,
        price: offer.price || product.price,
        source: offer.store_name || 'Marketplace',
        url: offer.offer_page_url || product.product_page_url,
        updatedAt: new Date(),
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = new RealtimeProductSearchAdapter();
