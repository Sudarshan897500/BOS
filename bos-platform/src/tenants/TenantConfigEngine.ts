import { Service, Inject, Container } from 'typedi';
import logger from '../utils/logger';
import { RedisClient } from '../distributed/RedisClient';

export type Logger = typeof logger;

export interface ITenantConfig {
  tenantId: string;
  name: string;
  subdomain: string;
  plan: 'free' | 'pro' | 'enterprise';
  enabledPlugins: string[];
  pluginConfigs: Record<string, any>;
  featureFlags: Record<string, boolean>;
  theme: Record<string, any>;
  customDomains?: string[];
  settings: Record<string, any>;
}

@Service()
export class TenantConfigEngine {
  private readonly logger: Logger;
  private redis: RedisClient;
  private configCache: Map<string, ITenantConfig> = new Map();
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(@Inject('logger') logger: Logger) {
    this.logger = logger;
    this.redis = Container.get(RedisClient);
  }

  public async loadConfig(tenantId: string): Promise<ITenantConfig> {
    // Check memory cache first
    if (this.configCache.has(tenantId)) {
      const cached = this.configCache.get(tenantId);
      if (cached) return cached;
    }

    // Check Redis cache
    const redisKey = `tenant:config:${tenantId}`;
    const cachedJson = await this.redis.get(redisKey);
    
    if (cachedJson) {
      const config = JSON.parse(cachedJson) as ITenantConfig;
      this.configCache.set(tenantId, config);
      return config;
    }

    // Load from database (placeholder - would use actual DB connector)
    const config = await this.loadFromDatabase(tenantId);
    
    // Cache in Redis
    await this.redis.setex(redisKey, this.CACHE_TTL, JSON.stringify(config));
    this.configCache.set(tenantId, config);
    
    return config;
  }

  public async updateConfig(tenantId: string, updates: Partial<ITenantConfig>): Promise<ITenantConfig> {
    const currentConfig = await this.loadConfig(tenantId);
    const newConfig = { ...currentConfig, ...updates };
    
    // Save to database
    await this.saveToDatabase(tenantId, newConfig);
    
    // Invalidate caches
    await this.invalidateCache(tenantId);
    
    this.logger.info(`🔄 Config updated for tenant ${tenantId}`);
    
    return newConfig;
  }

  public async getPluginConfig(tenantId: string, pluginId: string): Promise<any> {
    const config = await this.loadConfig(tenantId);
    return config.pluginConfigs?.[pluginId] || {};
  }

  public async isFeatureEnabled(tenantId: string, featureFlag: string): Promise<boolean> {
    const config = await this.loadConfig(tenantId);
    return config.featureFlags?.[featureFlag] || false;
  }

  public async isPluginEnabled(tenantId: string, pluginId: string): Promise<boolean> {
    const config = await this.loadConfig(tenantId);
    return config.enabledPlugins.includes(pluginId);
  }

  public async invalidateCache(tenantId: string): Promise<void> {
    this.configCache.delete(tenantId);
    
    const redisKey = `tenant:config:${tenantId}`;
    await this.redis.del(redisKey);
    
    this.logger.debug(`🗑️ Cache invalidated for tenant ${tenantId}`);
  }

  public async preloadConfigs(tenantIds: string[]): Promise<void> {
    for (const tenantId of tenantIds) {
      await this.loadConfig(tenantId);
    }
    this.logger.info(`⚡ Preloaded configs for ${tenantIds.length} tenants`);
  }

  private async loadFromDatabase(tenantId: string): Promise<ITenantConfig> {
    // Placeholder - in production this would query the actual database
    // For now, return a default config
    return {
      tenantId,
      name: 'Default Tenant',
      subdomain: tenantId.toLowerCase(),
      plan: 'free',
      enabledPlugins: ['saas'],
      pluginConfigs: {},
      featureFlags: {},
      theme: { primaryColor: '#007bff', logoUrl: '' },
      settings: {}
    };
  }

  private async saveToDatabase(tenantId: string, config: ITenantConfig): Promise<void> {
    // Placeholder - in production this would save to the actual database
    this.logger.debug(`💾 Saving config for tenant ${tenantId}`);
  }
}
