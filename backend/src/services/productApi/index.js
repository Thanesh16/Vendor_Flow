const config = require('../../config/env');
const { MasterProduct } = require('../../models/MasterProduct');
const axessoAdapter = require('./adapters/axessoAdapter');

// In-memory short-term query cache (5-minute TTL) to respect rate limits & avoid redundant external calls
const queryCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

class ProductApiService {
  constructor() {
    this.primaryProvider = 'axesso';
  }

  /**
   * Search real products from Axesso (Amazon India) with fallback to local cached catalog
   */
  async searchProducts(query, options = {}) {
    const trimmed = (query || '').trim();
    if (!trimmed || trimmed.length < 2) {
      return { success: true, data: [], provider: 'none', total: 0 };
    }

    const cacheKey = `${trimmed.toLowerCase()}_${options.category || 'ALL'}_${options.limit || 15}`;
    const cached = queryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS && !options.skipCache) {
      return {
        success: true,
        data: cached.data,
        cached: true,
        provider: cached.provider,
        total: cached.data.length,
      };
    }

    let externalResults = [];
    let providerUsed = 'catalog';

    // 1. Primary & Only External Product Provider: RapidAPI -> Axesso Amazon Data Service
    if (axessoAdapter.isAvailable()) {
      try {
        const res = await axessoAdapter.search(trimmed, options);
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          externalResults = res.data;
          providerUsed = 'axesso';
        } else if (!res.success) {
          console.warn('[ProductAPI:Axesso] Search note:', res.error);
        }
      } catch (err) {
        console.warn('[ProductAPI:Axesso] External search exception:', err.message);
      }
    } else {
      console.log('[ProductAPI] Axesso API key not set or empty. Using local Master Catalog.');
    }

    // 2. Query Local Master Catalog in MongoDB
    let localResults = [];
    try {
      const searchRegex = new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const localQuery = {
        isActive: true,
        $or: [
          { productName: searchRegex },
          { brand: searchRegex },
          { model: searchRegex },
          { catalogId: searchRegex },
          { asin: searchRegex },
          { externalProductId: searchRegex },
          { tags: searchRegex },
          { description: searchRegex },
        ],
      };
      if (options.category && options.category !== 'ALL') {
        localQuery.category = options.category;
      }
      localResults = await MasterProduct.find(localQuery).limit(20).lean();
    } catch (err) {
      console.warn('[ProductAPI] Local catalog query note:', err.message);
    }

    // 3. Merge & Deduplicate: Real Axesso results first, then local catalog items
    const merged = [];
    const seenAsins = new Set();
    const seenTitles = new Set();

    for (const item of externalResults) {
      const asinKey = (item.asin || item.externalProductId || '').toUpperCase();
      const titleKey = item.productName.toLowerCase().replace(/[^a-z0-9]/g, '');

      if (asinKey) seenAsins.add(asinKey);
      seenTitles.add(titleKey);
      merged.push(item);
    }

    for (const localItem of localResults) {
      const localAsin = (localItem.asin || localItem.externalProductId || '').toUpperCase();
      const localTitle = localItem.productName.toLowerCase().replace(/[^a-z0-9]/g, '');

      // Avoid duplicating an item already presented from live search
      if ((localAsin && seenAsins.has(localAsin)) || seenTitles.has(localTitle)) {
        continue;
      }

      seenTitles.add(localTitle);
      if (localAsin) seenAsins.add(localAsin);

      merged.push({
        _id: localItem._id,
        catalogId: localItem.catalogId,
        productName: localItem.productName,
        asin: localItem.asin || localItem.externalProductId || '',
        brand: localItem.brand,
        manufacturer: localItem.manufacturer || localItem.brand || '',
        model: localItem.model,
        category: localItem.category,
        unit: localItem.unit,
        description: localItem.description,
        specifications: localItem.specifications,
        specificationsObject: localItem.specificationsObject,
        productDetails: localItem.productDetails || localItem.specificationsObject || {},
        referencePrice: localItem.referencePrice,
        marketPrice: localItem.marketPrice || localItem.referencePrice,
        mrp: localItem.mrp || 0,
        currency: localItem.currency || 'INR',
        imageUrl: localItem.imageUrl,
        images: localItem.images || (localItem.imageUrl ? [localItem.imageUrl] : []),
        rating: localItem.rating,
        reviewCount: localItem.reviewCount || 0,
        seller: localItem.seller || '',
        secondaryOffer: localItem.secondaryOffer || '',
        availability: localItem.availability || 'In stock',
        prime: Boolean(localItem.prime),
        deliveryMessage: localItem.deliveryMessage || '',
        salesVolume: localItem.salesVolume || '',
        source: localItem.marketPriceSource || 'VENDORFLOW Master Catalog',
        sourceUrl: localItem.externalProductUrl || '',
        variants: localItem.variants || [],
        marketPriceStatus: localItem.marketPriceStatus || 'REFERENCE',
        lastPriceFetchedAt: localItem.marketPriceUpdatedAt || localItem.updatedAt,
        fetchedAt: localItem.marketPriceUpdatedAt || localItem.updatedAt,
        externalProvider: localItem.externalProvider || 'catalog',
        externalProductId: localItem.externalProductId || localItem.asin || '',
        externalProductUrl: localItem.externalProductUrl || '',
        isExternal: Boolean(localItem.externalProvider && localItem.externalProvider !== 'catalog'),
      });
    }

    // Cache merged result set
    queryCache.set(cacheKey, {
      data: merged,
      timestamp: Date.now(),
      provider: providerUsed,
    });

    return {
      success: true,
      provider: providerUsed,
      total: merged.length,
      data: merged,
    };
  }

  /**
   * Refresh current live market price for a product using Axesso (Amazon India)
   * Only records new price in priceHistory if the price actually changed.
   * Transaction Price Safety: Historical POs, receipts, and PRs are NEVER touched.
   */
  async refreshLivePrice(identifier) {
    if (!identifier) {
      return { success: false, error: 'Product identifier is required' };
    }

    // Locate product in MongoDB MasterProduct
    let masterProd;
    if (identifier.toString().match(/^[0-9a-fA-F]{24}$/)) {
      masterProd = await MasterProduct.findById(identifier);
    }
    if (!masterProd) {
      masterProd = await MasterProduct.findOne({
        $or: [{ catalogId: identifier }, { asin: identifier }, { externalProductId: identifier }],
      });
    }

    if (!masterProd) {
      return { success: false, error: 'Product not found in Master Catalog' };
    }

    const asin = masterProd.asin || masterProd.externalProductId;
    const amazonUrl = masterProd.externalProductUrl || (asin ? `https://www.amazon.in/dp/${asin}` : '');

    let freshData = null;

    // Call Axesso if available
    if (axessoAdapter.isAvailable() && (asin || amazonUrl)) {
      try {
        const lookupRes = await axessoAdapter.getPrice(amazonUrl || asin);
        if (lookupRes.success && lookupRes.price && lookupRes.price > 0) {
          freshData = lookupRes;
        }
      } catch (err) {
        console.warn('[ProductAPI:Axesso] Price refresh error:', err.message);
      }
    }

    const now = new Date();

    if (freshData && freshData.price > 0) {
      const previousPrice = masterProd.marketPrice || masterProd.referencePrice || 0;
      const freshPrice = freshData.price;

      masterProd.marketPrice = freshPrice;
      if (freshData.referencePrice) masterProd.referencePrice = freshData.referencePrice;
      if (freshData.retailPrice) masterProd.mrp = freshData.retailPrice;
      masterProd.marketPriceSource = 'Amazon India (Axesso)';
      masterProd.marketPriceUpdatedAt = now;
      masterProd.marketPriceStatus = 'LIVE';

      if (freshData.rating !== undefined && freshData.rating !== null) {
        masterProd.rating = freshData.rating;
      }
      if (freshData.reviewCount !== undefined) {
        masterProd.reviewCount = freshData.reviewCount;
      }
      if (freshData.deliveryMessage) {
        masterProd.deliveryMessage = freshData.deliveryMessage;
      }
      if (freshData.availability) {
        masterProd.availability = freshData.availability;
      }
      if (freshData.imageUrl && !masterProd.imageUrl) {
        masterProd.imageUrl = freshData.imageUrl;
      }

      // Record in priceHistory ONLY if market price actually changed
      if (previousPrice !== freshPrice) {
        if (!Array.isArray(masterProd.priceHistory)) {
          masterProd.priceHistory = [];
        }
        masterProd.priceHistory.push({
          price: freshPrice,
          currency: 'INR',
          source: 'Amazon India (Axesso)',
          fetchedAt: now,
        });
      }

      await masterProd.save();

      return {
        success: true,
        status: 'LIVE',
        price: freshPrice,
        marketPrice: freshPrice,
        referencePrice: masterProd.referencePrice,
        mrp: masterProd.mrp,
        currency: 'INR',
        source: 'Amazon India (Axesso)',
        url: masterProd.externalProductUrl || amazonUrl,
        asin: masterProd.asin || asin,
        rating: masterProd.rating,
        reviewCount: masterProd.reviewCount,
        deliveryMessage: masterProd.deliveryMessage,
        availability: masterProd.availability,
        updatedAt: now.toISOString(),
        priceHistory: masterProd.priceHistory,
        priceChanged: previousPrice !== freshPrice,
        message: 'Live Amazon India market price refreshed successfully via Axesso',
      };
    }

    // Graceful fallback to existing catalog price
    const currentPrice = masterProd.marketPrice || masterProd.referencePrice || 0;
    return {
      success: true,
      status: masterProd.marketPriceStatus || 'REFERENCE',
      price: currentPrice > 0 ? currentPrice : null,
      marketPrice: currentPrice > 0 ? currentPrice : null,
      referencePrice: masterProd.referencePrice,
      mrp: masterProd.mrp,
      currency: 'INR',
      source: masterProd.marketPriceSource || 'Master Catalog Baseline',
      url: masterProd.externalProductUrl || '',
      asin: masterProd.asin || asin || '',
      rating: masterProd.rating,
      reviewCount: masterProd.reviewCount,
      deliveryMessage: masterProd.deliveryMessage,
      availability: masterProd.availability,
      updatedAt: (masterProd.marketPriceUpdatedAt || masterProd.updatedAt || now).toISOString(),
      priceHistory: masterProd.priceHistory || [],
      priceChanged: false,
      message: 'Axesso live refresh unavailable; showing existing verified catalog baseline',
    };
  }

  /**
   * Cache an external Axesso Amazon product into MongoDB MasterProduct
   * Prevents duplicates using (externalProvider + asin/externalProductId)
   */
  async cacheExternalProduct(productData) {
    if (!productData || !productData.productName) {
      throw new Error('Invalid product data to cache: productName is required');
    }

    const asin = (productData.asin || productData.externalProductId || '').trim();
    const cleanAsin = asin.replace(/[^A-Za-z0-9_-]/g, '').toUpperCase();
    const catalogId = productData.catalogId || (cleanAsin ? `AMZ-IN-${cleanAsin}` : `EXT-${Date.now().toString(36).toUpperCase()}`);

    const marketPrice = Number(productData.marketPrice) || Number(productData.price) || 0;
    const refPrice = Number(productData.referencePrice) || marketPrice || 0;
    const mrp = Number(productData.mrp) || Number(productData.retailPrice) || refPrice;
    const now = new Date();

    // Deduplication filter: match by (externalProvider + externalProductId) or asin or catalogId
    const filterConditions = [];
    if (asin) {
      filterConditions.push({ externalProvider: 'axesso', asin: asin });
      filterConditions.push({ externalProvider: 'axesso', externalProductId: asin });
    }
    filterConditions.push({ catalogId: catalogId });

    const filter = filterConditions.length > 1 ? { $or: filterConditions } : filterConditions[0];

    // Find existing to preserve priceHistory and prevent duplicates
    const existing = await MasterProduct.findOne(filter);

    const updateDoc = {
      catalogId: existing?.catalogId || catalogId,
      productName: productData.productName.trim(),
      brand: productData.brand || 'Generic',
      manufacturer: productData.manufacturer || productData.brand || '',
      model: productData.model || '',
      category: productData.category || 'IT Hardware',
      unit: productData.unit || 'Units',
      description: productData.description || '',
      specifications: productData.specifications || '',
      specificationsObject: productData.specificationsObject || productData.productDetails || {},
      productDetails: productData.productDetails || productData.specificationsObject || {},
      referencePrice: refPrice,
      marketPrice: marketPrice,
      mrp: mrp,
      currency: 'INR',
      imageUrl: productData.imageUrl || '',
      images: Array.isArray(productData.images) && productData.images.length > 0 ? productData.images : (productData.imageUrl ? [productData.imageUrl] : []),
      rating: productData.rating !== undefined ? productData.rating : null,
      reviewCount: Number(productData.reviewCount) || 0,
      seller: productData.seller || 'Amazon India',
      secondaryOffer: productData.secondaryOffer || '',
      availability: productData.availability || 'In stock',
      prime: Boolean(productData.prime),
      deliveryMessage: productData.deliveryMessage || '',
      salesVolume: productData.salesVolume || '',
      externalProvider: 'axesso',
      externalProductId: asin || catalogId,
      asin: asin,
      externalProductUrl: productData.productUrl || productData.externalProductUrl || productData.sourceUrl || (asin ? `https://www.amazon.in/dp/${asin}` : ''),
      marketPriceSource: 'Amazon India (Axesso)',
      marketPriceUpdatedAt: now,
      marketPriceStatus: marketPrice > 0 ? 'LIVE' : 'REFERENCE',
      isActive: true,
    };

    if (Array.isArray(productData.variants) && productData.variants.length > 0) {
      updateDoc.variants = productData.variants;
    }

    let priceHistoryUpdate = {};
    if (marketPrice > 0) {
      const prevPrice = existing?.marketPrice || 0;
      if (!existing || prevPrice !== marketPrice) {
        priceHistoryUpdate = {
          $push: {
            priceHistory: {
              price: marketPrice,
              currency: 'INR',
              source: 'Amazon India (Axesso)',
              fetchedAt: now,
            },
          },
        };
      }
    }

    const cached = await MasterProduct.findOneAndUpdate(
      filter,
      {
        $set: updateDoc,
        ...priceHistoryUpdate,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return cached;
  }
}

module.exports = new ProductApiService();
