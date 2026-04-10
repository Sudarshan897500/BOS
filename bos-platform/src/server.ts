/**
 * @fileoverview Application Entry Point
 * @description Main server file with graceful shutdown handling
 */

import 'reflect-metadata'; // Required for typedi decorators
import express from 'express';
import config from './config';
import logger from './utils/logger';
import loaders from './loaders';

async function startServer() {
  const app = express();

  try {
    // Initialize all loaders
    await loaders(app);

    // Start HTTP server
    const server = app.listen(config.server.port, () => {
      logger.info(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 BOS Platform Server Running                          ║
║                                                           ║
║   Environment: ${config.nodeEnv.padEnd(45)}║
║   Port: ${config.server.port.toString().padEnd(50)}║
║   Host: ${config.server.host.padEnd(50)}║
║   Database: ${config.database.name.padEnd(46)}║
║                                                           ║
║   ✌️ Ready to accept connections                          ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
      `);
    });

    // Graceful shutdown handler
    const gracefulShutdown = (signal: string) => {
      logger.warn(`⚠️ ${signal} received. Starting graceful shutdown...`);
      
      server.close(async () => {
        logger.info('✌️ HTTP server closed');
        
        try {
          // Close MongoDB connection
          await import('mongoose').then(m => m.connection.close());
          logger.info('✌️ MongoDB connection closed');
          
          process.exit(0);
        } catch (error) {
          logger.error('🔥 Error during shutdown: %o', error);
          process.exit(1);
        }
      });

      // Force shutdown after timeout
      setTimeout(() => {
        logger.error('🔥 Forced shutdown due to timeout');
        process.exit(1);
      }, 30000);
    };

    // Register shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('🔥 Uncaught Exception: %o', error);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('🔥 Unhandled Rejection at: %o, reason: %o', promise, reason);
      process.exit(1);
    });

  } catch (error) {
    logger.error('🔥 Failed to start server: %o', error);
    process.exit(1);
  }
}

// Start the server
startServer();
