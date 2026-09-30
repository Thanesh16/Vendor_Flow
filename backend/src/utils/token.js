const jwt = require('jsonwebtoken');
const config = require('../config/env');

/**
 * Generate a signed JWT for a user
 * @param {Object} user - User document or identity payload
 * @returns {string} Signed JWT string
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id || user.id,
      email: user.email,
      role: user.role,
    },
    config.jwtSecret,
    {
      expiresIn: config.jwtExpiresIn,
    }
  );
};

/**
 * Verify a JWT string
 * @param {string} token
 * @returns {Object} Decoded payload
 */
const verifyToken = (token) => {
  return jwt.verify(token, config.jwtSecret);
};

module.exports = {
  generateToken,
  verifyToken,
};
