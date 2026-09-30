const mongoose = require('mongoose');

const RequestStatus = Object.freeze({
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
});

const RequestPriority = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
});

const purchaseRequestItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
    },
    quantity: {
      type: Number,
      required: [true, 'Item quantity is required'],
      min: [1, 'Quantity must be at least 1'],
    },
    estimatedPrice: {
      type: Number,
      min: [0, 'Estimated price cannot be negative'],
      default: 0,
    },
    requesterRequestedPrice: {
      type: Number,
      min: [0, 'Requester requested price cannot be negative'],
      default: 0,
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      trim: true,
    },
    masterProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MasterProduct',
      default: null,
    },
    masterCatalogId: {
      type: String,
      trim: true,
      default: '',
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
    unit: {
      type: String,
      trim: true,
      default: 'Units',
    },
    imageUrl: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: false }
);

const purchaseRequestSchema = new mongoose.Schema(
  {
    requestNumber: {
      type: String,
      required: [true, 'Purchase request number is required'],
      unique: true,
      trim: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Requesting user reference is required'],
    },
    title: {
      type: String,
      required: [true, 'Request title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    items: {
      type: [purchaseRequestItemSchema],
      validate: {
        validator: function (items) {
          return items && items.length > 0;
        },
        message: 'Purchase request must contain at least one item',
      },
    },
    requiredDate: {
      type: Date,
    },
    priority: {
      type: String,
      enum: {
        values: Object.values(RequestPriority),
        message: '{VALUE} is not a valid priority',
      },
      default: RequestPriority.MEDIUM,
    },
    status: {
      type: String,
      enum: {
        values: Object.values(RequestStatus),
        message: '{VALUE} is not a valid request status',
      },
      default: RequestStatus.DRAFT,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    selectedVendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
    },
    selectedProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    },
    selectionDetails: {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
      productName: { type: String, trim: true },
      vendorName: { type: String, trim: true },
      quantity: { type: Number },
      unitPrice: { type: Number },
      vendorUnitPrice: { type: Number },
      requesterRequestedPrice: { type: Number },
      priceDifference: { type: Number },
      totalDifference: { type: Number },
      totalPrice: { type: Number },
      deliveryDays: { type: Number },
      matchScore: { type: Number },
      notes: { type: String, trim: true },
      selectedAt: { type: Date },
      selectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
  },
  {
    timestamps: true,
  }
);

const PurchaseRequest = mongoose.model('PurchaseRequest', purchaseRequestSchema);

module.exports = {
  PurchaseRequest,
  RequestStatus,
  RequestPriority,
};
