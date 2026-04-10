import { RedisClient } from './RedisClient';

/**
 * Idempotency Manager - Prevents duplicate request processing
 * Uses Redis to store request fingerprints with TTL
 */
export class IdempotencyManager {
  private redis: ReturnType<RedisClient['getClient']>;
  private readonly DEFAULT_TTL = 3600; // 1 hour
  private readonly IDEMPOTENCY_PREFIX = 'idempotency:';

  constructor() {
    this.redis = RedisClient.getInstance().getClient();
  }

  /**
   * Generate a unique key for a request
   */
  private generateKey(idempotencyKey: string, tenantId: number): string {
    return `${this.IDEMPOTENCY_PREFIX}${tenantId}:${idempotencyKey}`;
  }

  /**
   * Check if a request has already been processed
   * @returns null if new, or the cached response if already processed
   */
  public async check(idempotencyKey: string, tenantId: number): Promise<any | null> {
    const key = this.generateKey(idempotencyKey, tenantId);
    const cached = await this.redis.get(key);
    
    if (cached) {
      return JSON.parse(cached);
    }
    
    return null;
  }

  /**
   * Mark a request as processing (lock it)
   * @returns true if successfully locked, false if already being processed
   */
  public async tryLock(idempotencyKey: string, tenantId: number, ttlSeconds: number = 30): Promise<boolean> {
    const key = this.generateKey(idempotencyKey, tenantId);
    const lockKey = `${key}:lock`;
    
    // Use SETNX to atomically set the lock only if it doesn't exist
    const result = await this.redis.set(lockKey, 'processing', {
      NX: true,
      EX: ttlSeconds,
    });
    
    return result === 'OK';
  }

  /**
   * Cache the response for an idempotent request
   */
  public async cacheResponse(
    idempotencyKey: string,
    tenantId: number,
    response: any,
    ttlSeconds: number = this.DEFAULT_TTL
  ): Promise<void> {
    const key = this.generateKey(idempotencyKey, tenantId);
    const lockKey = `${key}:lock`;
    
    // Store the response
    await this.redis.set(key, JSON.stringify(response), {
      EX: ttlSeconds,
    });
    
    // Remove the lock
    await this.redis.del(lockKey);
  }

  /**
   * Execute a function with idempotency guarantees
   * @returns The cached response if exists, or the result of executing the function
   */
  public async executeWithIdempotency<T>(
    idempotencyKey: string,
    tenantId: number,
    fn: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    // Check if already processed
    const cached = await this.check(idempotencyKey, tenantId);
    if (cached !== null) {
      return cached as T;
    }

    // Try to acquire lock
    const locked = await this.tryLock(idempotencyKey, tenantId);
    if (!locked) {
      // Wait and retry (request is being processed by another instance)
      await new Promise(resolve => setTimeout(resolve, 100));
      return await this.executeWithIdempotency(idempotencyKey, tenantId, fn, ttlSeconds);
    }

    try {
      // Execute the function
      const result = await fn();
      
      // Cache the response
      await this.cacheResponse(idempotencyKey, tenantId, result, ttlSeconds);
      
      return result;
    } catch (error) {
      // Release the lock on error
      const key = this.generateKey(idempotencyKey, tenantId);
      const lockKey = `${key}:lock`;
      await this.redis.del(lockKey);
      throw error;
    }
  }
}
