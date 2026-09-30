const mongoose = require('mongoose');
const { successResponse } = require('../utils/apiResponse');

/**
 * Controller to handle API health check
 * @route GET /api/health
 */
const getHealth = (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;

  return successResponse(res, 200, 'Vendor Management System API is running', {
    status: 'healthy',
    database: isDbConnected ? 'connected' : 'disconnected',
    databaseHost: isDbConnected ? mongoose.connection.host : null,
    databaseName: isDbConnected ? mongoose.connection.name : null,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
};

module.exports = {
  getHealth,
};
