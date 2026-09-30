const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  action: {
    type: String,
    required: [true, 'Audit action is required'],
    trim: true,
  },
  entityType: {
    type: String,
    required: [true, 'Entity type is required'],
    trim: true,
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  description: {
    type: String,
    required: [true, 'Audit description is required'],
    trim: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for high-performance querying and filtering
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ user: 1 });
auditLogSchema.index({ entityType: 1 });
auditLogSchema.index({ entityId: 1 });
auditLogSchema.index({ action: 1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = {
  AuditLog,
};
