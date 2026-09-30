const config = require('../../../config/env');
const { normalizeProduct, parseInrPrice, inferCategory, extractBrand } = require('../normalizer');

/**
 * axessoAdapter.js
 * External product integration for RapidAPI -> Axesso – Amazon Data Service (Amazon India)
 *
 * Host: axesso-axesso-amazon-data-service-v1.p.rapidapi.com
 * Search Endpoint: /amz/amazon-search-by-keyword-asin?keyword=...&domainCode=in&page=1
 * Product Lookup: /amz/amazon-lookup-product?url=https://www.amazon.in/dp/{asin}
 */
class AxessoAdapter {
  constructor() {
    this.name = 'axesso';
    this.displayName = 'Amazon India (Axesso)';
    this.domainCode = 'in'; // Strict Amazon India focus
  }

  getHost() {
    return (
      process.env.RAPIDAPI_HOST ||
      process.env.AXESSO_HOST ||
      config.productApi?.rapidApiHost ||
      'axesso-axesso-amazon-data-service-v1.p.rapidapi.com'
    );
  }

  getBaseUrl() {
    return `https://${this.getHost()}`;
  }

  getApiKey() {
    return process.env.RAPIDAPI_KEY || process.env.PRODUCT_API_KEY || config.productApi?.apiKey || '';
  }

  isAvailable() {
    return Boolean(this.getApiKey() && this.getApiKey().trim().length > 0);
  }

  getHeaders() {
    const apiKey = this.getApiKey();
    return {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': this.getHost(),
      Accept: 'application/json',
    };
  }

  /**
   * Search Amazon India products via Axesso by keyword
   * @param {string} keyword
   * @param {object} options - { page: 1, limit: 15, category: '' }
   */
  async search(keyword, options = {}) {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return {
        success: false,
        error: 'RapidAPI key not configured in backend/.env (RAPIDAPI_KEY)',
        code: 'MISSING_API_KEY',
      };
    }

    const trimmed = (keyword || '').trim();
    if (!trimmed) {
      return { success: true, data: [], provider: this.name };
    }

    const page = options.page || 1;
    const host = this.getHost();
    const primaryUrl = `https://${host}/amz/amazon-search-by-keyword-asin?keyword=${encodeURIComponent(
      trimmed
    )}&domainCode=${this.domainCode}&page=${page}`;

    try {
      let response = await fetch(primaryUrl, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      // If 404 on keyword-asin, try alternative Axesso search path
      if (response.status === 404) {
        const altUrl = `https://${host}/amz/amazon-search-by-keyword?keyword=${encodeURIComponent(
          trimmed
        )}&domainCode=${this.domainCode}&page=${page}`;
        response = await fetch(altUrl, {
          method: 'GET',
          headers: this.getHeaders(),
        });
      }

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        let parsedMessage = `Axesso API returned HTTP ${response.status}`;
        try {
          const parsed = JSON.parse(errBody);
          if (parsed.message) parsedMessage = parsed.message;
        } catch (_) {}

        return {
          success: false,
          status: response.status,
          error: parsedMessage,
          provider: this.name,
        };
      }

      const json = await response.json();
      const rawProducts = json.foundProducts || json.products || json.searchResults || [];

      if (!Array.isArray(rawProducts) || rawProducts.length === 0) {
        return {
          success: true,
          provider: this.name,
          data: [],
          total: 0,
        };
      }

      // Map complete Axesso product dataset
      const normalized = rawProducts
        .map((item) => this.mapAxessoItem(item, trimmed))
        .filter(Boolean);

      return {
        success: true,
        provider: this.name,
        data: normalized,
        total: normalized.length,
        responseStatus: json.responseStatus || 'OK',
      };
    } catch (err) {
      return {
        success: false,
        error: `Axesso search request failed: ${err.message}`,
        provider: this.name,
      };
    }
  }

  /**
   * Lookup complete product details from Amazon India via Axesso
   * Used for Live Price Refresh & comprehensive technical detail retrieval
   */
  async getProductDetails(asinOrUrl) {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return { success: false, error: 'RapidAPI key not configured' };
    }

    let asin = asinOrUrl;
    let amazonUrl = asinOrUrl;

    if (asinOrUrl.includes('amazon.')) {
      const match = asinOrUrl.match(/\/dp\/([A-Z0-9]{10})/i);
      if (match) asin = match[1];
    } else {
      asin = asinOrUrl.trim();
      amazonUrl = `https://www.amazon.in/dp/${asin}`;
    }

    const host = this.getHost();
    const endpoint = `https://${host}/amz/amazon-lookup-product?url=${encodeURIComponent(
      amazonUrl
    )}&asin=${encodeURIComponent(asin)}&domainCode=${this.domainCode}`;

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        return {
          success: false,
          status: response.status,
          error: `Axesso lookup failed (${response.status}): ${errText}`,
        };
      }

      const json = await response.json();
      const mapped = this.mapAxessoItem(json, '', asin);

      return {
        success: true,
        data: mapped,
        raw: json,
      };
    } catch (err) {
      return {
        success: false,
        error: `Axesso product lookup failed: ${err.message}`,
      };
    }
  }

  /**
   * Retrieve live price for a specific product ASIN or URL
   */
  async getPrice(asinOrUrl) {
    const detailsRes = await this.getProductDetails(asinOrUrl);
    if (!detailsRes.success || !detailsRes.data) {
      return detailsRes;
    }

    const prod = detailsRes.data;
    return {
      success: true,
      price: prod.marketPrice > 0 ? prod.marketPrice : null,
      marketPrice: prod.marketPrice > 0 ? prod.marketPrice : null,
      referencePrice: prod.referencePrice > 0 ? prod.referencePrice : null,
      retailPrice: prod.mrp > 0 ? prod.mrp : null,
      currency: 'INR',
      source: 'Amazon India',
      url: prod.externalProductUrl,
      asin: prod.asin,
      rating: prod.rating,
      reviewCount: prod.reviewCount,
      deliveryMessage: prod.deliveryMessage,
      availability: prod.availability,
      imageUrl: prod.imageUrl,
      updatedAt: new Date(),
    };
  }

  /**
   * Helper to map Axesso raw JSON product item into full VENDORFLOW normalized structure
   */
  mapAxessoItem(item, searchQuery = '', fallbackAsin = '') {
    if (!item || typeof item !== 'object') return null;

    // 1. ASIN identifier
    const asin = (
      item.asin ||
      item.productAsin ||
      fallbackAsin ||
      item.dpUrl?.match(/\/dp\/([A-Z0-9]{10})/i)?.[1] ||
      item.url?.match(/\/dp\/([A-Z0-9]{10})/i)?.[1] ||
      ''
    ).trim();

    // 2. Product Name / Title
    const title = (
      item.productTitle ||
      item.title ||
      item.name ||
      item.productDescription ||
      searchQuery ||
      'Amazon Product'
    ).trim();

    // 3. Price parsing (must be INR, 0 is treated as unavailable/null)
    const rawPrice = item.price ?? item.currentPrice ?? item.priceValue ?? item.offerPrice ?? null;
    const marketPrice = parseInrPrice(rawPrice);

    const rawRetail =
      item.retailPrice ??
      item.originalPrice ??
      item.strikethroughPrice ??
      item.mrp ??
      item.listPrice ??
      null;
    const mrp = parseInrPrice(rawRetail);
    const referencePrice = marketPrice > 0 ? marketPrice : mrp > 0 ? mrp : 0;

    // 4. Image URL and Images list
    const primaryImage = (
      item.imageUrl ||
      item.mainImageUrl ||
      item.imgUrl ||
      item.image ||
      (Array.isArray(item.images) ? item.images[0] : '') ||
      ''
    ).trim();

    const imagesList = Array.isArray(item.images)
      ? item.images.filter((img) => typeof img === 'string' && img.startsWith('http'))
      : primaryImage
      ? [primaryImage]
      : [];

    // 5. Rating & Reviews
    let rating = null;
    const rawRating = item.productRating || item.rating || item.stars;
    if (typeof rawRating === 'number') {
      rating = Math.round(rawRating * 10) / 10;
    } else if (typeof rawRating === 'string') {
      const match = rawRating.match(/([0-9]+(?:\.[0-9]+)?)/);
      if (match) rating = parseFloat(match[1]);
    }

    let reviewCount = 0;
    const rawReviews = item.countReview ?? item.reviewCount ?? item.totalReviews ?? item.reviews;
    if (typeof rawReviews === 'number') {
      reviewCount = rawReviews;
    } else if (typeof rawReviews === 'string') {
      const cleanReviews = rawReviews.replace(/[^0-9]/g, '');
      if (cleanReviews) reviewCount = parseInt(cleanReviews, 10);
    }

    // 6. Brand & Manufacturer
    const rawBrand = item.brand || item.manufacturer || '';
    const brand = extractBrand(title, rawBrand);
    const manufacturer = (item.manufacturer || brand || '').trim();

    // 7. Amazon Product URL
    const productUrl = (
      item.dpUrl ||
      item.productUrl ||
      item.url ||
      (asin ? `https://www.amazon.in/dp/${asin}` : '')
    ).trim();

    // 8. Delivery message & Prime
    const deliveryMessage = (
      item.shippingMessage ||
      item.deliveryMessage ||
      item.delivery ||
      item.deliveryInformation ||
      ''
    ).trim();
    const isPrime = Boolean(item.isPrime || item.prime);

    // 9. Availability & Stock
    const availability = (
      item.warehouseAvailability ||
      item.availabilityMessage ||
      item.availability ||
      (item.inStock !== false ? 'In stock' : 'Out of stock')
    ).trim();

    // 10. Sales volume
    const salesVolume = (item.salesVolume || item.boughtInLastMonth || '').trim();

    // 11. Seller & Secondary Offers
    const seller = (item.soldBy || item.seller || item.merchantName || 'Amazon India').trim();
    const secondaryOffer = (item.secondaryOffer || '').trim();

    // 12. Description & Specifications
    let description = (
      item.productDescription ||
      item.description ||
      (Array.isArray(item.features) ? item.features.join('. ') : '') ||
      ''
    ).trim();

    const specsObj = {};
    if (item.productOverview && typeof item.productOverview === 'object') {
      Object.assign(specsObj, item.productOverview);
    }
    if (item.productDetails && typeof item.productDetails === 'object') {
      Object.assign(specsObj, item.productDetails);
    }
    if (item.specifications && typeof item.specifications === 'object') {
      Object.assign(specsObj, item.specifications);
    }

    let specsStr = Object.entries(specsObj)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' | ');

    if (!specsStr && Array.isArray(item.features) && item.features.length > 0) {
      specsStr = item.features.join(' | ');
    }

    // Infer category
    const category = inferCategory(title, description, item.category || '');

    // Model name
    const model = (specsObj['Model Name'] || specsObj['Item model number'] || item.model || '').trim();

    // Catalog ID
    const cleanAsin = (asin || Math.random().toString(36).substring(2, 10)).toUpperCase();
    const catalogId = `AMZ-IN-${cleanAsin}`.substring(0, 30);

    const now = new Date();

    return {
      catalogId,
      productName: title,
      asin,
      brand,
      manufacturer,
      model,
      category,
      unit: 'Units',
      description,
      specifications: specsStr,
      specificationsObject: specsObj,
      productDetails: specsObj,
      referencePrice,
      marketPrice, // Note: 0 if not returned by API
      mrp,
      currency: 'INR',
      imageUrl: primaryImage,
      images: imagesList,
      rating,
      reviewCount,
      seller,
      secondaryOffer,
      availability,
      prime: isPrime,
      deliveryMessage,
      salesVolume,
      productUrl,
      source: 'Amazon India',
      sourceUrl: productUrl,
      externalProvider: 'axesso',
      externalProductId: asin,
      externalProductUrl: productUrl,
      marketPriceSource: 'Amazon India (Axesso)',
      marketPriceUpdatedAt: now,
      marketPriceStatus: marketPrice > 0 ? 'LIVE' : 'UNAVAILABLE',
      lastPriceFetchedAt: now.toISOString(),
      fetchedAt: now.toISOString(),
      priceFreshness: 'LIVE',
      variants: Array.isArray(item.variations) ? item.variations : [],
      storeList: [
        {
          storeName: 'Amazon India',
          price: marketPrice > 0 ? marketPrice : referencePrice,
          url: productUrl,
          inStock: availability.toLowerCase().includes('stock'),
        },
      ],
      priceHistory:
        marketPrice > 0
          ? [{ price: marketPrice, currency: 'INR', source: 'Amazon India (Axesso)', fetchedAt: now }]
          : [],
      isExternal: true,
    };
  }
}

module.exports = new AxessoAdapter();
