/**
 * normalizer.js
 * Normalizes varied external product and marketplace API responses into VENDORFLOW's standard schema.
 */

const CATEGORY_KEYWORDS = {
  'IT Hardware': [
    'laptop', 'notebook', 'desktop', 'pc', 'server', 'monitor', 'keyboard', 'mouse',
    'ssd', 'hard drive', 'ram', 'processor', 'cpu', 'gpu', 'motherboard', 'router',
    'switch', 'cisco', 'thinkpad', 'latitude', 'elitebook', 'macbook', 'inspiron',
    'pavilion', 'vivobook', 'aspire', 'logitech', 'webcam', 'headset', 'pendrive',
  ],
  'Electronics': [
    'iphone', 'smartphone', 'mobile', 'phone', 'galaxy', 'oneplus', 'pixel', 'tablet',
    'ipad', 'earbuds', 'airpods', 'headphones', 'smartwatch', 'watch', 'television',
    'tv', 'oled', 'camera', 'dslr', 'gopro', 'speaker', 'bluetooth speaker',
  ],
  'Office Equipment': [
    'printer', 'scanner', 'copier', 'projector', 'shredder', 'laminator', 'binding machine',
    'epson', 'canon', 'xerox', 'brother', 'toner', 'ink cartridge', 'interactive flat panel',
  ],
  'Furniture': [
    'chair', 'desk', 'table', 'filing cabinet', 'cabinet', 'bookshelf', 'workstation',
    'ergonomic chair', 'mesh chair', 'standing desk', 'steelcase', 'featherlite', 'godrej',
  ],
  'Industrial Equipment': [
    'drill', 'rotary hammer', 'power tool', 'saw', 'grinder', 'compressor', 'generator',
    'pressure washer', 'bosch', 'makita', 'stanley', 'dewalt', 'karcher', 'welding',
    'tool kit', 'wrench', 'multimeter',
  ],
  'Safety Equipment': [
    'helmet', 'hard hat', 'safety shoes', 'gloves', 'respirator', 'mask', 'n95',
    'safety jacket', 'reflective jacket', 'goggles', 'earmuffs', 'harness', 'fall arrest',
    'first aid', 'fire extinguisher', '3m', 'karam',
  ],
  'Stationery': [
    'paper', 'a4', 'pen', 'pencil', 'notebook', 'diary', 'stapler', 'punch', 'marker',
    'whiteboard', 'sticky note', 'post-it', 'file folder', 'binder', 'calculator',
  ],
  'Software': [
    'software', 'license', 'subscription', 'microsoft 365', 'office 365', 'windows',
    'antivirus', 'cloud', 'saas', 'adobe', 'jetbrains', 'quickheal', 'autodesk',
  ],
};

/**
 * Infer the best matching VENDORFLOW category from title, description, or raw category string.
 */
function inferCategory(title = '', description = '', rawCategory = '') {
  const text = `${title} ${description} ${rawCategory}`.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) {
        return category;
      }
    }
  }

  return 'IT Hardware'; // Standard default
}

/**
 * Clean and parse price strings into strict non-negative INR numbers.
 * Examples: "₹79,900", "79,900.00", "₹ 58,499", 79900 -> 79900
 */
function parseInrPrice(rawPrice) {
  if (typeof rawPrice === 'number' && !isNaN(rawPrice) && rawPrice >= 0) {
    return Math.round(rawPrice);
  }

  if (typeof rawPrice === 'string') {
    // Remove currency symbols, commas, whitespace
    const cleanStr = rawPrice.replace(/[₹$,A-Za-z\s]/g, '');
    const num = parseFloat(cleanStr);
    if (!isNaN(num) && num >= 0) {
      return Math.round(num);
    }
  }

  return 0;
}

/**
 * Extract brand name from title or raw brand field
 */
function extractBrand(title = '', rawBrand = '') {
  if (rawBrand && rawBrand.trim()) {
    return rawBrand.trim();
  }

  const commonBrands = [
    'Apple', 'Samsung', 'Dell', 'HP', 'Lenovo', 'Asus', 'Acer', 'Sony', 'Logitech',
    'Microsoft', 'Canon', 'Epson', 'Bosch', 'Makita', 'Stanley', '3M', 'Karam',
    'Steelcase', 'Featherlite', 'Godrej', 'OnePlus', 'Google', 'JBL', 'Bose',
    'Cisco', 'TP-Link', 'SanDisk', 'Seagate', 'Western Digital', 'Kingston',
  ];

  const lowerTitle = title.toLowerCase();
  for (const b of commonBrands) {
    if (lowerTitle.startsWith(b.toLowerCase()) || lowerTitle.includes(` ${b.toLowerCase()} `)) {
      return b;
    }
  }

  return 'Generic';
}

/**
 * Standardize external product into VENDORFLOW format
 */
function normalizeProduct({
  rawTitle,
  rawBrand,
  rawModel,
  rawCategory,
  rawPrice,
  rawMrp,
  rawImage,
  rawDescription,
  rawSpecifications,
  rawSpecificationsObject,
  source = 'Marketplace',
  sourceUrl = '',
  externalId = '',
  provider = 'external',
  variants = [],
  storeList = [],
}) {
  const productName = (rawTitle || 'Unnamed Product').trim();
  const brand = extractBrand(productName, rawBrand);
  const category = inferCategory(productName, rawDescription, rawCategory);
  const marketPrice = parseInrPrice(rawPrice);
  const mrp = parseInrPrice(rawMrp) || marketPrice;
  const referencePrice = marketPrice > 0 ? marketPrice : mrp;

  // Build clean catalog ID
  const cleanId = (externalId || Math.random().toString(36).substring(2, 10)).replace(/[^A-Za-z0-9_-]/g, '');
  const catalogId = `EXT-${brand.substring(0, 4).toUpperCase()}-${cleanId.toUpperCase()}`.substring(0, 30);

  // Specifications
  let specificationsStr = typeof rawSpecifications === 'string' ? rawSpecifications.trim() : '';
  let specificationsObj = rawSpecificationsObject && typeof rawSpecificationsObject === 'object' ? rawSpecificationsObject : {};

  if (!specificationsStr && Object.keys(specificationsObj).length > 0) {
    specificationsStr = Object.entries(specificationsObj)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' | ');
  }

  const now = new Date();

  return {
    catalogId,
    productName,
    brand,
    model: rawModel || '',
    category,
    unit: 'Units',
    description: (rawDescription || '').trim(),
    specifications: specificationsStr,
    specificationsObject: specificationsObj,
    referencePrice,
    marketPrice,
    mrp,
    currency: 'INR',
    imageUrl: (rawImage || '').trim(),
    source,
    sourceUrl,
    externalProvider: provider,
    externalProductId: externalId,
    externalProductUrl: sourceUrl,
    marketPriceSource: source,
    marketPriceUpdatedAt: now,
    marketPriceStatus: marketPrice > 0 ? 'LIVE' : 'REFERENCE',
    lastPriceFetchedAt: now.toISOString(),
    priceFreshness: 'LIVE',
    variants: Array.isArray(variants) ? variants : [],
    storeList: Array.isArray(storeList) ? storeList : [],
    priceHistory: marketPrice > 0 ? [{ price: marketPrice, currency: 'INR', source, fetchedAt: now }] : [],
    isExternal: true,
  };
}

module.exports = {
  normalizeProduct,
  parseInrPrice,
  inferCategory,
  extractBrand,
};
