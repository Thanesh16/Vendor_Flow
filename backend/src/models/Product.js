const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: [true, 'Vendor reference is required'],
      index: true,
    },
    productName: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [200, 'Product name cannot exceed 200 characters'],
    },
    category: {
      type: String,
      required: [true, 'Product category is required'],
      trim: true,
      index: true,
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
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    availableQuantity: {
      type: Number,
      required: [true, 'Available quantity is required'],
      min: [0, 'Available quantity cannot be negative'],
      default: 0,
    },
    unit: {
      type: String,
      trim: true,
      default: 'Units',
    },
    deliveryDays: {
      type: Number,
      min: [1, 'Delivery SLA must be at least 1 day'],
      default: 3,
    },
    isAvailable: {
      type: Boolean,
      default: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    imageUrl: {
      type: String,
      trim: true,
      default: '',
    },
    imagePublicId: {
      type: String,
      trim: true,
      default: '',
    },
    images: [
      {
        url: {
          type: String,
          trim: true,
        },
        publicId: {
          type: String,
          trim: true,
        },
      },
    ],
    lastStockUpdate: {
      type: Date,
      default: Date.now,
    },
    masterProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MasterProduct',
      default: null,
      index: true,
    },
    masterCatalogId: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    brand: {
      type: String,
      trim: true,
      default: '',
    },
    model: {
      type: String,
      trim: true,
      default: '',
    },
    referencePrice: {
      type: Number,
      min: [0, 'Reference price cannot be negative'],
      default: 0,
    },
    marketPrice: {
      type: Number,
      min: [0, 'Market price cannot be negative'],
      default: 0,
    },
    marketPriceSource: {
      type: String,
      trim: true,
      default: 'catalog',
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
    specificationsObject: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    selectedVariant: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    externalProductId: {
      type: String,
      trim: true,
      default: '',
    },
    externalProductUrl: {
      type: String,
      trim: true,
      default: '',
    },
    asin: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    rating: {
      type: Number,
      default: null,
    },
    reviewCount: {
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
  },
  {
    timestamps: true,
  }
);

// Compound text index for robust keyword searching
productSchema.index({ productName: 'text', description: 'text', category: 'text' });

const Product = mongoose.model('Product', productSchema);

module.exports = {
  Product,
};
