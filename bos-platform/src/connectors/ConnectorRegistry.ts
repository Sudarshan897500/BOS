/**
 * @fileoverview Connector Registry - Manages all registered connectors
 * @author Senior Architect (60+ years experience)
 * @description Registry Pattern - Central hub for connector discovery and execution
 */

import { IConnector, ConnectorConfig, ConnectorError } from './ConnectorInterface';
import { ExecutionContext } from '../core/ExecutionContext';

export class ConnectorRegistry {
  private connectors: Map<string, IConnector> = new Map();
  private connectionConfigs: Map<string, ConnectorConfig> = new Map();

  /**
   * Register a connector instance
   */
  register(name: string, connector: IConnector): void {
    if (this.connectors.has(name)) {
      console.warn(`Connector '${name}' is already registered. Overwriting.`);
    }
    this.connectors.set(name, connector);
  }

  /**
   * Get a connector by name
   */
  get(name: string): IConnector | undefined {
    return this.connectors.get(name);
  }

  /**
   * Check if a connector is registered
   */
  has(name: string): boolean {
    return this.connectors.has(name);
  }

  /**
   * Configure a connector
   */
  async configure(name: string, config: ConnectorConfig): Promise<void> {
    const connector = this.connectors.get(name);
    
    if (!connector) {
      throw new Error(`Connector '${name}' not found`);
    }

    await connector.initialize(config);
    this.connectionConfigs.set(name, config);
  }

  /**
   * Execute an action on a connector
   */
  async execute(
    serviceName: string,
    action: string,
    input: Record<string, any>,
    context: ExecutionContext
  ): Promise<any> {
    const connector = this.connectors.get(serviceName);

    if (!connector) {
      throw new ConnectorError(
        serviceName,
        action,
        `Connector '${serviceName}' not found. Available: ${Array.from(this.connectors.keys()).join(', ')}`
      );
    }

    if (!connector.validate()) {
      throw new ConnectorError(
        serviceName,
        action,
        `Connector '${serviceName}' is not properly initialized`
      );
    }

    try {
      const result = await connector.execute(action, input, context);
      return result;
    } catch (error) {
      if (error instanceof ConnectorError) {
        throw error;
      }
      
      throw new ConnectorError(
        serviceName,
        action,
        error instanceof Error ? error.message : 'Unknown error',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get all registered connector names
   */
  listConnectors(): string[] {
    return Array.from(this.connectors.keys());
  }

  /**
   * Get metadata for all connectors
   */
  getMetadata(): Record<string, any> {
    const metadata: Record<string, any> = {};

    for (const [name, connector] of this.connectors.entries()) {
      metadata[name] = connector.getMetadata();
    }

    return metadata;
  }

  /**
   * Destroy all connectors (cleanup)
   */
  async destroyAll(): Promise<void> {
    const destroyPromises = Array.from(this.connectors.values())
      .filter(connector => typeof connector.destroy === 'function')
      .map(connector => (connector as any).destroy());

    await Promise.all(destroyPromises);
    this.connectors.clear();
    this.connectionConfigs.clear();
  }
}

// Singleton instance
export const connectorRegistry = new ConnectorRegistry();
