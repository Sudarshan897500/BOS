/**
 * @fileoverview Dependency Injection Loader
 * @description Initializes and registers all models and services in the DI container
 */

import { Container } from 'typedi';
import mongoose from 'mongoose';
import logger from '../utils/logger';

// Import models
import TenantModel from '../models/tenant';

/**
 * Model registration interface
 */
interface ModelRegistration {
  name: string;
  model: any;
}

/**
 * Initialize dependency injection container
 */
export default async function dependencyInjectorLoader({
  mongoConnection,
  models,
}: {
  mongoConnection: typeof mongoose;
  models: ModelRegistration[];
}): Promise<void> {
  try {
    logger.debug('✌️ Loading dependency injector...');

    // Register logger
    Container.set('logger', logger);

    // Register mongoose connection
    Container.set('mongoConnection', mongoConnection);

    // Register all models
    const modelPromises = models.map(async (model) => {
      Container.set(model.name, model.model);
      logger.debug(`Registered model: ${model.name}`);
    });

    await Promise.all(modelPromises);

    logger.info('✌️ Dependency injector loaded successfully');
  } catch (error) {
    logger.error('🔥 Error loading dependency injector: %o', error);
    throw error;
  }
}
