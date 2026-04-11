/**
 * @fileoverview API Middlewares
 * @description Common middleware functions for authentication and request processing
 */

import { Request, Response, NextFunction } from 'express';
import { Container } from 'typedi';
import TenantService from '../../services/tenant';
import logger from '../../utils/logger';
import { UnauthorizedError, ForbiddenError } from '../../utils/errors';

// Extend Express Request type to include claims
declare global {
  namespace Express {
    interface Request {
      claims?: {
        tid: string;
        tenantName: string;
        isActive: boolean;
      };
    }
  }
}

/**
 * Attach current user/tenant to request based on API key
 */
export const attachCurrentUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      throw new UnauthorizedError('API key is required');
    }

    const tenantService = Container.get(TenantService);
    const { data: tenant } = await tenantService.getTenantByApiKey(apiKey);
    
    // Attach tenant info to request claims
    req.claims = {
      tid: tenant.tenantId.toString(),
      tenantName: tenant.name,
      isActive: tenant.isActive,
    };
    
    logger.debug(`Attached tenant: ${tenant.name} (${tenant.tenantId})`);
    
    next();
  } catch (error) {
    logger.error('🔥 Error attaching current user: %o', error);
    next(error);
  }
};

/**
 * Validate that tenant is active
 */
export const requireActiveTenant = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.claims?.isActive) {
    throw new ForbiddenError('Tenant is not active');
  }
  next();
};

/**
 * Rate limiting placeholder (implement with Redis in production)
 */
export const rateLimiter = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // TODO: Implement proper rate limiting with Redis
  // For now, just pass through
  next();
};

/**
 * Request logging middleware
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(
      `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`
    );
  });
  
  next();
};

export default {
  attachCurrentUser,
  requireActiveTenant,
  rateLimiter,
  requestLogger,
};
