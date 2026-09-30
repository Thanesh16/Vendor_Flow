const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    originalName: {
      type: String,
      trim: true,
    },
    fileName: {
      type: String,
      trim: true,
    },
    url: {
      type: String,
      required: [true, 'File URL is required'],
      trim: true,
    },
    publicId: {
      type: String,
      trim: true,
      default: '',
    },
    mimeType: {
      type: String,
      trim: true,
      default: '',
    },
    size: {
      type: Number,
      default: 0,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Uploader reference is required'],
      index: true,
    },
    relatedEntity: {
      type: String,
      enum: ['Product', 'Vendor', 'PurchaseOrder', 'PurchaseRequest', 'Receipt', 'Other'],
      default: 'Product',
      index: true,
    },
    relatedEntityId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    storageProvider: {
      type: String,
      enum: ['cloudinary', 'local'],
      default: 'local',
    },
  },
  {
    timestamps: true,
  }
);

const Document = mongoose.model('Document', documentSchema);

module.exports = {
  Document,
};
