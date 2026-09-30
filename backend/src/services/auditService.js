const { AuditLog } = require('../models/AuditLog');

/**
 * Sanitizes metadata objects to guarantee sensitive credentials are never stored.
 */
const sanitizeMetadata = (obj) => {
  if (!obj || typeof obj !== 'object') return {};

  const sensitiveKeys = [
    'password',
    'newpassword',
    'oldpassword',
    'token',
    'jwt',
    'secret',
    'apikey',
    'api_key',
    'api_secret',
    'authorization',
  ];

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
      sanitized[key] = '[REDACTED]';
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeMetadata(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

/**
 * Centralized Audit Logging Service
 */
const auditService = {
  /**
   * Record a business/security audit log
   * @param {Object} options
   * @param {Object} [options.user] - Authenticated user document/object
   * @param {string} [options.userId] - User ID string or ObjectId
   * @param {string} options.action - Business action enum/string
   * @param {string} options.entityType - Target entity type (e.g. 'PurchaseOrder', 'Product', 'Vendor')
   * @param {string} [options.entityId] - Target entity ID
   * @param {string} options.description - Clear, human-readable description of the event
   * @param {Object} [options.metadata] - Optional safe before/after or contextual metadata
   * @returns {Promise<Object|null>}
   */
  async log({ user, userId, action, entityType, entityId, description, metadata = {} }) {
    try {
      const actorId = userId || (user ? user._id : null);

      const resolvedDescription =
        description && description.trim()
          ? description.trim()
          : `${(action || 'Action').replace(/_/g, ' ')} performed on ${entityType || 'system resource'}`;

      const auditRecord = await AuditLog.create({
        user: actorId,
        action: (action || 'ACTION').trim().toUpperCase(),
        entityType: (entityType || 'SYSTEM').trim(),
        entityId: entityId || null,
        description: resolvedDescription,
        metadata: sanitizeMetadata(metadata),
        createdAt: new Date(),
      });

      return auditRecord;
    } catch (err) {
      console.error('[auditService] Diagnostic warning - Audit log creation failed:', err.message);
      return null;
    }
  },
};

module.exports = auditService;
