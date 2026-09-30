const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    color: {
      type: String,
      trim: true,
      default: '',
    },
    storage: {
      type: String,
      trim: true,
      default: '',
    },
    ram: {
      type: String,
      trim: true,
      default: '',
    },
    referencePrice: {
      type: Number,
      min: [0, 'Reference price cannot be negative'],
      default: 0,
    },
    sku: {
      type: String,
      trim: true,
      default: '',
    },
    imageUrl: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: true }
);

const masterProductSchema = new mongoose.Schema(
  {
    catalogId: {
      type: String,
      required: [true, 'Catalog ID is required'],
      unique: true,
      trim: true,
      index: true,
    },
    productName: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      index: true,
    },
    brand: {
      type: String,
      required: [true, 'Brand is required'],
      trim: true,
      index: true,
    },
    model: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      index: true,
    },
    unit: {
      type: String,
      trim: true,
      default: 'Units',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    specifications: {
      type: String,
      trim: true,
      default: '',
    },
    specificationsObject: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    variants: [variantSchema],
    imageUrl: {
      type: String,
      trim: true,
      default: '',
    },
    imageSource: {
      type: String,
      trim: true,
      default: 'catalog',
    },
    referencePrice: {
      type: Number,
      required: [true, 'Reference price is required'],
      min: [0, 'Reference price cannot be negative'],
      default: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    // External Marketplace API tracking & Live Price
    externalProvider: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    externalProductId: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    asin: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    manufacturer: {
      type: String,
      trim: true,
      default: '',
    },
    productDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    images: [
      {
        type: String,
        trim: true,
      },
    ],
    rating: {
      type: Number,
      default: null,
    },
    reviewCount: {
      type: Number,
      default: 0,
    },
    seller: {
      type: String,
      trim: true,
      default: '',
    },
    secondaryOffer: {
      type: String,
      trim: true,
      default: '',
    },
    availability: {
      type: String,
      trim: true,
      default: '',
    },
    prime: {
      type: Boolean,
      default: false,
    },
    deliveryMessage: {
      type: String,
      trim: true,
      default: '',
    },
    salesVolume: {
      type: String,
      trim: true,
      default: '',
    },
    externalProductUrl: {
      type: String,
      trim: true,
      default: '',
    },
    marketPrice: {
      type: Number,
      min: [0, 'Market price cannot be negative'],
      default: 0,
    },
    marketPriceSource: {
      type: String,
      trim: true,
      default: '',
    },
    marketPriceUpdatedAt: {
      type: Date,
      default: null,
    },
    marketPriceStatus: {
      type: String,
      enum: ['LIVE', 'REFERENCE', 'CUSTOM', 'UNAVAILABLE'],
      default: 'REFERENCE',
    },
    mrp: {
      type: Number,
      default: 0,
    },
    priceHistory: [
      {
        price: { type: Number, required: true },
        currency: { type: String, default: 'INR' },
        source: { type: String, default: '' },
        fetchedAt: { type: Date, default: Date.now },
      },
    ],
    storeList: [
      {
        storeName: { type: String, trim: true },
        price: { type: Number },
        url: { type: String, trim: true },
        inStock: { type: Boolean, default: true },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Compound index on externalProvider + externalProductId to prevent duplicate imports
masterProductSchema.index({ externalProvider: 1, externalProductId: 1 });
masterProductSchema.index({ externalProvider: 1, asin: 1 });

// Compound text index for fast search queries
masterProductSchema.index({
  productName: 'text',
  brand: 'text',
  model: 'text',
  description: 'text',
  tags: 'text',
});

const MasterProduct = mongoose.model('MasterProduct', masterProductSchema);

module.exports = {
  MasterProduct,
};
