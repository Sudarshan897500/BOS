import { Service } from 'typedi';
import { createClient, RedisClientType } from 'redis';
import { config } from '../config';

/**
 * Singleton Redis Client with Connection Pooling
 * Provides distributed state management for the BOS Platform
 */
@Service()
export class RedisClient {
  private client: RedisClientType;
  private isConnected: boolean = false;

  constructor() {
    this.client = createClient({
      url: config.redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            return new Error('Redis max retries reached');
          }
          return Math.min(retries * 50, 3000);
        },
      },
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('error', (err) => {
      console.error('🔥 Redis Client Error:', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      console.log('✌️ Redis Connected');
      this.isConnected = true;
    });

    this.client.on('end', () => {
      console.log('⚠️ Redis Connection Ended');
      this.isConnected = false;
    });
  }

  public async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.client.connect();
    }
  }

  public async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
    }
  }

  public async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  public async set(key: string, value: string): Promise<void> {
    await this.client.set(key, value);
  }

  public async setex(key: string, ttl: number, value: string): Promise<void> {
    await this.client.setEx(key, ttl, value);
  }

  public async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  public getClient(): RedisClientType {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }
    return this.client;
  }

  public isReady(): boolean {
    return this.isConnected && this.client.isOpen;
  }
}
