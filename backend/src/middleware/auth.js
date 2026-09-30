const { verifyToken } = require('../utils/token');
const { errorResponse } = require('../utils/apiResponse');
const { User } = require('../models/User');

/**
 * Middleware to authenticate requests using Bearer JWT
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 401, 'Authentication token missing or malformed');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return errorResponse(res, 401, 'Authentication token missing');
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return errorResponse(res, 401, 'Authentication token has expired. Please log in again.');
      }
      return errorResponse(res, 401, 'Invalid authentication token');
    }

    // Look up user from database to verify status
    const user = await User.findById(decoded.id);

    if (!user) {
      return errorResponse(res, 401, 'Authenticated user account no longer exists');
    }

    if (!user.isActive) {
      return errorResponse(res, 401, 'User account has been deactivated. Please contact an administrator.');
    }

    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    return errorResponse(res, 500, `Authentication error: ${error.message}`);
  }
};

/**
 * Middleware to authorize requests based on user roles
 * @param  {...string} allowedRoles - List of permitted roles
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 401, 'Authentication required');
    }

    if (!allowedRoles.includes(req.user.role)) {
      return errorResponse(
        res,
        403,
        `Access denied. Role '${req.user.role}' is not authorized to access this resource.`
      );
    }

    next();
  };
};

module.exports = {
  authenticate,
  authorize,
};
