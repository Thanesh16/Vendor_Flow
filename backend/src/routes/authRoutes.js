const express = require('express');
const { register, login, getMe } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { authRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Public routes with rate limiting protection against credential stuffing
router.post('/register', authRateLimiter, register);
router.post('/login', authRateLimiter, login);

// Protected route
router.get('/me', authenticate, getMe);

module.exports = router;
