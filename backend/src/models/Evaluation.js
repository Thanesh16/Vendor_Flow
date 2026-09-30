const mongoose = require('mongoose');

const evaluationSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: [true, 'Vendor reference is required'],
    },
    evaluatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Evaluator reference is required'],
    },
    purchaseOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PurchaseOrder',
    },
    qualityScore: {
      type: Number,
      required: [true, 'Quality score is required'],
      min: [0, 'Score cannot be less than 0'],
      max: [100, 'Score cannot exceed 100'],
    },
    deliveryScore: {
      type: Number,
      required: [true, 'Delivery score is required'],
      min: [0, 'Score cannot be less than 0'],
      max: [100, 'Score cannot exceed 100'],
    },
    pricingScore: {
      type: Number,
      required: [true, 'Pricing score is required'],
      min: [0, 'Score cannot be less than 0'],
      max: [100, 'Score cannot exceed 100'],
    },
    supportScore: {
      type: Number,
      required: [true, 'Support score is required'],
      min: [0, 'Score cannot be less than 0'],
      max: [100, 'Score cannot exceed 100'],
    },
    overallScore: {
      type: Number,
      required: [true, 'Overall score is required'],
      min: [0, 'Score cannot be less than 0'],
      max: [100, 'Score cannot exceed 100'],
    },
    comments: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// High-performance search and unique constraint preventing duplicate evaluations
evaluationSchema.index({ purchaseOrder: 1 }, { unique: true, sparse: true });
evaluationSchema.index({ vendor: 1 });
evaluationSchema.index({ evaluatedBy: 1 });

const Evaluation = mongoose.model('Evaluation', evaluationSchema);

module.exports = {
  Evaluation,
};
