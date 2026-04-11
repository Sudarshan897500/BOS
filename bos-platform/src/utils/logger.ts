/**
 * @fileoverview Centralized Logger using Winston
 * @description Provides consistent logging format across the application
 */

import winston from 'winston';
import config from '../config';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

// Create logger instance
const logger = winston.createLogger({
  level: config.logging.level,
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  defaultMeta: { service: 'bos-platform' },
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), logFormat),
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
    }),
  ],
  exitOnError: false,
});

// Add emoji icons for better visibility
const originalLog = logger.log.bind(logger);
logger.log = function(level: string, message: string, ...meta: any[]) {
  let prefixedMessage = message;
  
  switch (level) {
    case 'error':
      prefixedMessage = `🔥 ${message}`;
      break;
    case 'warn':
      prefixedMessage = `⚠️ ${message}`;
      break;
    case 'info':
      prefixedMessage = `ℹ️ ${message}`;
      break;
    case 'debug':
      prefixedMessage = `🐛 ${message}`;
      break;
    case 'verbose':
      prefixedMessage = `📝 ${message}`;
      break;
  }
  
  return originalLog(level, prefixedMessage, ...meta);
} as any;

export default logger;
