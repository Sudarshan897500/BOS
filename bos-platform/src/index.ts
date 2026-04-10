/**
 * @fileoverview BOS Platform Main Entry Point
 * @author Senior Architect (60+ years experience)
 * @description Facade Pattern - Simple API for complex subsystem
 */

import { ConnectorRegistry, connectorRegistry } from './connectors/ConnectorRegistry';
import { MemoryConnector } from './connectors/MemoryConnector';
import { StepExecutor } from './engines/StepExecutor';
import { FlowExecutor, FlowDefinition } from './engines/FlowExecutor';
import { TenantConfigManager, tenantConfigManager, TenantConfig } from './config/TenantConfig';

export interface BOSPlatformConfig {
  connectors?: {
    [name: string]: {
      type: string;
      settings: Record<string, any>;
    };
  };
  tenants?: TenantConfig[];
}

export class BOSPlatform {
  private connectorRegistry: ConnectorRegistry;
  private stepExecutor: StepExecutor;
  private flowExecutor: FlowExecutor;
  private configManager: TenantConfigManager;
  private initialized: boolean = false;

  constructor() {
    this.connectorRegistry = new ConnectorRegistry();
    this.stepExecutor = new StepExecutor(this.connectorRegistry);
    this.flowExecutor = new FlowExecutor(this.stepExecutor);
    this.configManager = new TenantConfigManager();
  }

  /**
   * Initialize the platform with configuration
   */
  async initialize(config?: BOSPlatformConfig): Promise<void> {
    if (this.initialized) {
      console.warn('[BOS] Platform already initialized');
      return;
    }

    console.log('[BOS] Initializing platform...');

    // Register default connectors
    const memoryConnector = new MemoryConnector();
    this.connectorRegistry.register('memory', memoryConnector);
    await this.connectorRegistry.configure('memory', {
      type: 'memory',
      settings: config?.connectors?.['memory']?.settings || { defaultCollection: 'default' },
    });

    // Configure additional connectors
    if (config?.connectors) {
      for (const [name, connectorConfig] of Object.entries(config.connectors)) {
        if (name !== 'memory') {
          console.warn(`[BOS] Connector '${name}' not yet implemented, skipping`);
        }
      }
    }

    // Register tenant configurations
    if (config?.tenants) {
      for (const tenant of config.tenants) {
        this.configManager.register(tenant);
      }
    }

    this.initialized = true;
    console.log('[BOS] Platform initialized successfully');
    console.log('[BOS] Available connectors:', this.connectorRegistry.listConnectors());
  }

  /**
   * Execute a flow
   */
  async executeFlow(
    flow: FlowDefinition,
    input: Record<string, any>,
    tenantId: string
  ): Promise<any> {
    if (!this.initialized) {
      throw new Error('Platform not initialized. Call initialize() first.');
    }

    const config = this.configManager.getConfig(tenantId) || {
      tenantId,
      name: tenantId,
      flows: {},
      modules: {},
      globalSettings: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const result = await this.flowExecutor.execute(flow, input, tenantId, config);

    if (!result.success) {
      throw result.error;
    }

    return result.output;
  }

  /**
   * Register a custom connector
   */
  registerConnector(name: string, connector: any): void {
    this.connectorRegistry.register(name, connector);
  }

  /**
   * Configure a connector
   */
  async configureConnector(name: string, config: { type: string; settings: Record<string, any> }): Promise<void> {
    await this.connectorRegistry.configure(name, config);
  }

  /**
   * Register a tenant configuration
   */
  registerTenant(config: TenantConfig): void {
    this.configManager.register(config);
  }

  /**
   * Get platform status
   */
  getStatus(): {
    initialized: boolean;
    connectors: string[];
    version: string;
  } {
    return {
      initialized: this.initialized,
      connectors: this.connectorRegistry.listConnectors(),
      version: '1.0.0',
    };
  }

  /**
   * Shutdown the platform
   */
  async shutdown(): Promise<void> {
    console.log('[BOS] Shutting down platform...');
    await this.connectorRegistry.destroyAll();
    this.initialized = false;
    console.log('[BOS] Platform shutdown complete');
  }
}

// Export singleton instance for convenience
export const bos = new BOSPlatform();

// Export all public types
export * from './core/ExecutionContext';
export * from './config/TenantConfig';
export * from './engines/StepExecutor';
export * from './engines/FlowExecutor';
export * from './connectors/ConnectorInterface';
export * from './connectors/ConnectorRegistry';
export * from './connectors/MemoryConnector';
export * from './utils/ExpressionEvaluator';
