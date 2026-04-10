import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { RedisClient } from '../distributed/RedisClient';
import { RequestHandler } from 'express';

/**
 * Rate Limiter - Prevents DDoS and brute force attacks
 * Uses Redis for distributed rate limiting across instances
 */
export class RateLimiter {
  private static instance: RateLimiter;
  private limiter: RequestHandler;

  private constructor() {
    const redisClient = RedisClient.getInstance().getClient();

    // Create Redis-backed rate limiter
    this.limiter = rateLimit({
      store: new RedisStore({
        // @ts-ignore - RedisStore expects ioredis, but works with node-redis
        client: redisClient,
        prefix: 'ratelimit:',
      }),
      windowMs: 60 * 1000, // 1 minute window
      max: 100, // 100 requests per minute per IP
      standardHeaders: true, // Return rate limit info in headers
      legacyHeaders: false, // Disable X-RateLimit-* headers
      message: {
        error: 'Too many requests',
        message: 'You have exceeded the rate limit. Please try again later.',
        retryAfter: 60,
      },
      handler: (req, res) => {
        res.status(429).json({
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((res.getHeader('Retry-After') as number) || 60),
        });
      },
      keyGenerator: (req) => {
        // Use tenant ID if available, otherwise use IP
        const tenantId = req.headers['x-tenant-id'] as string;
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        return tenantId ? `tenant:${tenantId}:${ip}` : `ip:${ip}`;
      },
      skip: (req) => {
        // Skip rate limiting for health checks and internal requests
        const isHealthCheck = req.path.startsWith('/health');
        const isInternal = req.headers['x-internal-request'] === 'true';
        return isHealthCheck || isInternal;
      },
    });
  }

  public static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  /**
   * Get the rate limiter middleware
   */
  public getMiddleware(): RequestHandler {
    return this.limiter;
  }

  /**
   * Create a custom rate limiter with specific limits
   */
  public createCustomLimiter(options: {
    windowMs?: number;
    max?: number;
    message?: any;
    prefix?: string;
  }): RequestHandler {
    const redisClient = RedisClient.getInstance().getClient();
    const prefix = options.prefix || 'ratelimit:custom:';

    return rateLimit({
      store: new RedisStore({
        // @ts-ignore
        client: redisClient,
        prefix,
      }),
      windowMs: options.windowMs || 60 * 1000,
      max: options.max || 100,
      message: options.message || {
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.',
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
  }
}
