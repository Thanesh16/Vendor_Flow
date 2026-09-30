const { errorResponse } = require('../utils/apiResponse');

/**
 * Middleware to handle 404 - Route Not Found
 */
const notFound = (req, res, next) => {
  return errorResponse(res, 404, 'Route not found');
};

module.exports = notFound;
