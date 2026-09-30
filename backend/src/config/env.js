const dotenv = require('dotenv');

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

// Production safety checks: require mandatory production environment variables
if (isProduction && !process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable must be defined in production.');
}

if (isProduction && !process.env.MONGODB_URI) {
  throw new Error('FATAL: MONGODB_URI environment variable must be defined in production.');
}

const config = {
  port: process.env.PORT || 5000,
  nodeEnv,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vendor_management',
  jwtSecret: process.env.JWT_SECRET || (isProduction ? '' : 'dev_insecure_jwt_secret_for_local_dev_only'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  productApi: {
    provider: 'axesso',
    primaryProvider: 'axesso',
    apiKey: process.env.RAPIDAPI_KEY || process.env.PRODUCT_API_KEY || '',
    baseUrl: process.env.AXESSO_BASE_URL || 'https://axesso-axesso-amazon-data-service-v1.p.rapidapi.com',
    rapidApiHost: process.env.RAPIDAPI_HOST || process.env.AXESSO_HOST || 'axesso-axesso-amazon-data-service-v1.p.rapidapi.com',
  },
};

module.exports = config;
