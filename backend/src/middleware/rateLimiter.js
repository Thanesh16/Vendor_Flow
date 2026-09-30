const { errorResponse } = require('../utils/apiResponse');

/**
 * Creates an in-memory rate limiting middleware.
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds (default: 15 minutes)
 * @param {number} options.maxRequests - Max requests allowed per window per IP (default: 30)
 * @param {string} options.message - Error message when rate limit is exceeded
 */
const createRateLimiter = (options = {}) => {
  const windowMs = options.windowMs || 15 * 60 * 1000;
  const maxRequests = options.maxRequests || 30;
  const message =
    options.message || 'Too many attempts from this IP address. Please try again later.';

  const ipStore = new Map();

  // Periodic cleanup of stale entries every 5 minutes
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of ipStore.entries()) {
      if (now > data.resetTime) {
        ipStore.delete(ip);
      }
    }
  }, 5 * 60 * 1000);

  // Unref timer so it doesn't block graceful server shutdown
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return (req, res, next) => {
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      req.ip ||
      'unknown-ip';

    const now = Date.now();
    let record = ipStore.get(ip);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      ipStore.set(ip, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, maxRequests - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetSeconds);

    if (record.count > maxRequests) {
      res.setHeader('Retry-After', resetSeconds);
      return errorResponse(res, 429, message);
    }

    next();
  };
};

// Standard rate limiter for sensitive authentication endpoints
const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 30, // 30 requests per 15 min
  message: 'Too many authentication attempts. Please try again after a few minutes.',
});

module.exports = {
  createRateLimiter,
  authRateLimiter,
};
