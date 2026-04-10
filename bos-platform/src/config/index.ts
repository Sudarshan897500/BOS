/**
 * @fileoverview Central Configuration Manager
 * @description Manages environment-specific variables and prevents direct process.env access
 */

export const NODE_ENV = process.env.NODE_ENV || 'development';

export const config = {
  nodeEnv: NODE_ENV,
  
  // Database Configuration
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/bos-platform',
    name: process.env.DB_NAME || `bos-${NODE_ENV}`,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },

  // Server Configuration
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || 'localhost',
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
    format: process.env.LOG_FORMAT || 'combined',
  },

  // Multi-tenant Configuration
  tenant: {
    pingPrefix: process.env.TENANT_PING_PREFIX || 'tenant_',
    defaultTenantId: process.env.DEFAULT_TENANT_ID || 'default',
  },

  // Environment Flags
  isProduction: NODE_ENV === 'production',
  isStaging: NODE_ENV === 'staging',
  isDevelopment: NODE_ENV === 'development',
};

export default config;
