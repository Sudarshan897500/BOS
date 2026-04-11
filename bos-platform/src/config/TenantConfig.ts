/**
 * @fileoverview Tenant Configuration - Multi-tenant behavior control
 * @author Senior Architect (60+ years experience)
 * @description Config-driven behavior without code duplication
 */

export interface FlowConfig {
  enabled: boolean;
  steps?: {
    [stepId: string]: {
      enabled?: boolean;
      override?: Record<string, any>;
      conditions?: ConditionConfig[];
    };
  };
}

export interface ConditionConfig {
  expression: string;
  action: 'skip' | 'modify' | 'replace';
  modification?: Record<string, any>;
}

export interface ModuleConfig {
  enabled: boolean;
  settings: Record<string, any>;
  overrides?: Record<string, any>;
}

export interface TenantConfig {
  tenantId: string;
  name: string;
  flows: {
    [flowId: string]: FlowConfig;
  };
  modules: {
    [moduleId: string]: ModuleConfig;
  };
  globalSettings: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export class TenantConfigManager {
  private configs: Map<string, TenantConfig> = new Map();
  private currentTenantId: string | null = null;

  /**
   * Register a tenant configuration
   */
  register(config: TenantConfig): void {
    this.configs.set(config.tenantId, config);
  }

  /**
   * Set the current active tenant
   */
  setCurrentTenant(tenantId: string): void {
    this.currentTenantId = tenantId;
  }

  /**
   * Get the current active tenant
   */
  getCurrentTenant(): string | null {
    return this.currentTenantId;
  }

  /**
   * Get configuration for a tenant
   */
  getConfig(tenantId: string): TenantConfig | undefined {
    return this.configs.get(tenantId);
  }

  /**
   * Check if a flow is enabled for a tenant
   */
  isFlowEnabled(tenantId: string, flowId: string): boolean {
    const config = this.configs.get(tenantId);
    if (!config) return false;
    
    const flowConfig = config.flows[flowId];
    return flowConfig?.enabled ?? false;
  }

  /**
   * Check if a module is enabled for a tenant
   */
  isModuleEnabled(tenantId: string, moduleId: string): boolean {
    const config = this.configs.get(tenantId);
    if (!config) return false;
    
    const moduleConfig = config.modules[moduleId];
    return moduleConfig?.enabled ?? false;
  }

  /**
   * Get step-specific configuration
   */
  getStepConfig(
    tenantId: string,
    flowId: string,
    stepId: string
  ): { enabled: boolean; override?: Record<string, any>; conditions?: ConditionConfig[] } {
    const config = this.configs.get(tenantId);
    if (!config) {
      return { enabled: true };
    }

    const flowConfig = config.flows[flowId];
    if (!flowConfig || !flowConfig.steps) {
      return { enabled: true };
    }

    const stepConfig = flowConfig.steps[stepId];
    return {
      enabled: stepConfig?.enabled ?? true,
      override: stepConfig?.override,
      conditions: stepConfig?.conditions,
    };
  }

  /**
   * Get module settings with overrides applied
   */
  getModuleSettings(tenantId: string, moduleId: string): Record<string, any> {
    const config = this.configs.get(tenantId);
    if (!config) {
      return {};
    }

    const moduleConfig = config.modules[moduleId];
    if (!moduleConfig) {
      return {};
    }

    return {
      ...moduleConfig.settings,
      ...moduleConfig.overrides,
    };
  }

  /**
   * Load configuration from external source (database, file, etc.)
   * This is a placeholder - implement based on your storage needs
   */
  async loadFromSource(tenantId: string, loader: () => Promise<TenantConfig>): Promise<TenantConfig> {
    const config = await loader();
    this.register(config);
    return config;
  }
}

// Singleton instance
export const tenantConfigManager = new TenantConfigManager();
