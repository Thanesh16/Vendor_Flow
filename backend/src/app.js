const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config/env');
const apiRoutes = require('./routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Enable Cross-Origin Resource Sharing
app.use(
  cors({
    origin: config.clientUrl || 'http://localhost:5173',
    credentials: true,
  })
);

// Body parser middleware with safe payload size limit
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Serve static product and vendor shop image assets (receipts require authenticated download)
app.use('/uploads/products', express.static(path.join(__dirname, '../uploads/products')));
app.use('/uploads/vendors', express.static(path.join(__dirname, '../uploads/vendors')));

// API Routes
app.use('/api', apiRoutes);

// Root route basic info
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'Vendor Management System API',
    version: '1.0.0',
    status: 'online',
    docs: '/api/health',
  });
});

// 404 Route Not Found Middleware
app.use(notFound);

// Centralized Error Handling Middleware
app.use(errorHandler);

module.exports = app;
