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

  // Redis Configuration (Critical for distributed state)
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

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

  // Security Configuration
  security: {
    apiKeySecret: process.env.API_KEY_SECRET || 'dev-secret-key-change-in-production',
    jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
  },

  // Rate Limiting Configuration
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // Circuit Breaker Configuration
  circuitBreaker: {
    failureThreshold: parseInt(process.env.CB_FAILURE_THRESHOLD || '5', 10),
    resetTimeout: parseInt(process.env.CB_RESET_TIMEOUT || '30000', 10),
    halfOpenMaxCalls: parseInt(process.env.CB_HALF_OPEN_MAX_CALLS || '3', 10),
  },

  // Environment Flags
  isProduction: NODE_ENV === 'production',
  isStaging: NODE_ENV === 'staging',
  isDevelopment: NODE_ENV === 'development',
};

export default config;
