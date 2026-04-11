/**
 * @fileoverview Main Application Loader
 * @description Orchestrates the initialization of all application components
 */

import express from 'express';
import mongoose from 'mongoose';
import { Container } from 'typedi';
import config from '../config';
import logger from '../utils/logger';
import dependencyInjectorLoader from './dependencyInjector';

// Import loaders
import TenantModel from '../models/tenant';

/**
 * Initialize Express app with middleware and routes
 */
async function expressLoader(app: express.Application): Promise<void> {
  logger.debug('✌️ Loading Express...');

  // Basic middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  const { requestLogger } = await import('../api/middlewares');
  app.use(requestLogger);

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Load routes
  const tenantRoutes = (await import('../api/routes/tenant')).default;
  tenantRoutes(app);

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('🔥 Global error handler: %o', err);
    
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal server error';
    
    res.status(statusCode).json({
      error: {
        message,
        statusCode,
        ...(config.isDevelopment && { stack: err.stack }),
      },
    });
  });

  logger.info('✌️ Express loaded successfully');
}

/**
 * Initialize MongoDB connection
 */
async function mongoLoader(): Promise<typeof mongoose> {
  logger.debug('✌️ Loading MongoDB...');

  const connection = await mongoose.connect(config.database.uri, {
    dbName: config.database.name,
    ...config.database.options,
  });

  logger.info(`✌️ MongoDB connected to ${config.database.name}`);
  
  return connection;
}

/**
 * Main loader function - orchestrates all initialization
 */
export default async function loaders(app: express.Application): Promise<void> {
  try {
    logger.info('🚀 Starting BOS Platform initialization...');

    // 1. Connect to MongoDB
    const mongoConnection = await mongoLoader();

    // 2. Initialize dependency injection
    await dependencyInjectorLoader({
      mongoConnection,
      models: [
        {
          name: 'tenantModel',
          model: TenantModel,
        },
      ],
    });

    // 3. Initialize Express
    await expressLoader(app);

    logger.info('🎉 BOS Platform initialized successfully!');
  } catch (error) {
    logger.error('🔥 Error during initialization: %o', error);
    throw error;
  }
}
