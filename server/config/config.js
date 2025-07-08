/**
 * Server Configuration
 * Centralizes all configuration values and environment variables
 */
require('dotenv').config();

// Server configuration
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const IS_DEVELOPMENT = NODE_ENV === 'development';

// PostgreSQL Database Configuration
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'quizgame',
  dialect: 'postgres',
  logging: IS_DEVELOPMENT ? console.log : false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
};

// Database sync options (for development)
const DB_SYNC = process.env.DB_SYNC === 'true';
const MOCK_DB = process.env.MOCK_DB === 'true';

// Client URL for CORS and redirects
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret_for_development';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

// Logging
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// CORS configuration
const CORS_ORIGINS = [
  CLIENT_URL,
  // Add additional origins as needed
  // These will be used in addition to the CLIENT_URL
  'http://localhost:5173',
  'http://localhost:5174',
  'http://192.168.0.87:5173',
  'http://192.168.0.87:5000'
];

// If in development mode, allow all origins
if (IS_DEVELOPMENT) {
  console.log('Development mode: CORS will accept requests from any origin');
}

// Export the configuration
module.exports = {
  PORT,
  NODE_ENV,
  IS_PRODUCTION,
  IS_DEVELOPMENT,
  DB_CONFIG,
  DB_SYNC,
  MOCK_DB,
  CLIENT_URL,
  JWT_SECRET,
  JWT_EXPIRY,
  LOG_LEVEL,
  CORS_ORIGINS
};
