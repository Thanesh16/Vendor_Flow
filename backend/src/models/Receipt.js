const mongoose = require('mongoose');

const receiptItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      trim: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    },
  },
  { _id: false }
);

const receiptSchema = new mongoose.Schema(
  {
    receiptNumber: {
      type: String,
      required: [true, 'Receipt number is required'],
      unique: true,
      trim: true,
      index: true,
    },
    purchaseOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PurchaseOrder',
      required: [true, 'Purchase order reference is required'],
      unique: true,
      index: true,
    },
    poNumber: {
      type: String,
      required: [true, 'PO number snapshot is required'],
      trim: true,
    },
    purchaseRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PurchaseRequest',
    },
    prNumber: {
      type: String,
      trim: true,
      default: '',
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: [true, 'Vendor reference is required'],
      index: true,
    },
    vendorSnapshot: {
      companyName: { type: String, required: true },
      contactPerson: { type: String },
      email: { type: String },
      phone: { type: String },
      address: { type: String },
      city: { type: String },
      state: { type: String },
      country: { type: String },
      taxId: { type: String },
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Employee requester reference is required'],
      index: true,
    },
    employeeSnapshot: {
      name: { type: String, required: true },
      email: { type: String },
      role: { type: String },
    },
    deliverySnapshot: {
      address: { type: String },
      city: { type: String },
      state: { type: String },
      postalCode: { type: String },
      contactName: { type: String },
      contactPhone: { type: String },
      deliveryInstructions: { type: String },
      deliveredAt: { type: Date },
    },
    items: {
      type: [receiptItemSchema],
      required: true,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    shippingFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      trim: true,
    },
    orderDate: {
      type: Date,
      required: true,
    },
    deliveredAt: {
      type: Date,
    },
    issuedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['ISSUED', 'DELIVERED'],
      default: 'ISSUED',
    },
    pdfUrl: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// High-performance search & lookup indexes
receiptSchema.index({ issuedAt: -1 });
receiptSchema.index({ poNumber: 1 });

const Receipt = mongoose.model('Receipt', receiptSchema);

module.exports = {
  Receipt,
};
