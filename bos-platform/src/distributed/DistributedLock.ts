import { RedisClient } from './RedisClient';
import Redlock, { Lock } from 'redlock';

/**
 * Distributed Lock Implementation using Redlock Algorithm
 * Prevents race conditions in clustered environments
 */
export class DistributedLock {
  private redlock: Redlock;
  private readonly DEFAULT_TTL = 10000; // 10 seconds

  constructor() {
    const redisClient = RedisClient.getInstance().getClient();
    this.redlock = new Redlock([redisClient as any], {
      driftFactor: 0.01,
      retryCount: 3,
      retryDelay: 200,
      retryJitter: 50,
    });
  }

  /**
   * Acquire a distributed lock
   * @param resource - Unique resource identifier
   * @param ttl - Time to live in milliseconds
   */
  public async acquire(resource: string, ttl: number = this.DEFAULT_TTL): Promise<string> {
    try {
      const lock = await this.redlock.acquire([`lock:${resource}`], ttl);
      return (lock as any).token as string;
    } catch (error) {
      throw new Error(`Failed to acquire lock for resource: ${resource}`);
    }
  }

  /**
   * Release a distributed lock
   * @param resource - Unique resource identifier
   * @param token - Lock token returned by acquire
   */
  public async release(resource: string, token: string): Promise<void> {
    try {
      const lock: Lock = {
        token: token,
        expiration: Date.now() + this.DEFAULT_TTL,
        attempts: 1,
        startTime: Date.now(),
      } as any;
      await this.redlock.release(lock as any);
    } catch (error) {
      console.error('🔥 Failed to release lock:', error);
    }
  }

  /**
   * Execute a function with a distributed lock
   * @param resource - Unique resource identifier
   * @param fn - Function to execute while holding the lock
   * @param ttl - Time to live in milliseconds
   */
  public async withLock<T>(resource: string, fn: () => Promise<T>, ttl?: number): Promise<T> {
    const token = await this.acquire(resource, ttl);
    try {
      return await fn();
    } finally {
      await this.release(resource, token);
    }
  }
}
