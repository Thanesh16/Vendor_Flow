const { errorResponse } = require('../utils/apiResponse');

/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);
  let message = err.message || 'Internal Server Error';

  if (err.name === 'CastError') {
    statusCode = 404;
    message = 'Resource not found or invalid identifier format';
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors || {})
      .map((val) => val.message)
      .join(', ') || 'Validation error';
  } else if (err.code === 11000) {
    statusCode = 400;
    message = 'Duplicate field value entered. A record with this identifier already exists.';
  } else if (err.name === 'MulterError') {
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File size exceeds maximum allowed limit of 5MB';
    } else {
      message = `Upload error: ${err.message}`;
    }
  } else if (err.message && err.message.includes('Only image files')) {
    statusCode = 400;
  } else if (statusCode === 500 && process.env.NODE_ENV === 'production') {
    message = 'An unexpected server error occurred. Please try again later.';
  }

  // Include error details only in non-production mode
  const errors = process.env.NODE_ENV === 'development' ? { stack: err.stack } : null;

  return errorResponse(res, statusCode, message, errors);
};

module.exports = errorHandler;
