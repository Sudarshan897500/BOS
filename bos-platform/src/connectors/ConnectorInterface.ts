/**
 * @fileoverview Connector Interface - Base interface for all connectors
 * @author Senior Architect (60+ years experience)
 * @description Strategy Pattern - Consistent interface for diverse backends
 */

import { ExecutionContext } from '../core/ExecutionContext';

export interface ConnectorMetadata {
  name: string;
  version: string;
  description: string;
  supportedActions: string[];
}

export interface ConnectorConfig {
  type: string;
  settings: Record<string, any>;
}

/**
 * Base interface that all connectors must implement
 */
export interface IConnector {
  /**
   * Get connector metadata
   */
  getMetadata(): ConnectorMetadata;

  /**
   * Initialize the connector with configuration
   */
  initialize(config: ConnectorConfig): Promise<void>;

  /**
   * Execute an action
   * @param action - The action to execute
   * @param input - Input parameters
   * @param context - Execution context
   */
  execute(action: string, input: Record<string, any>, context: ExecutionContext): Promise<any>;

  /**
   * Validate that the connector is properly configured
   */
  validate(): boolean;

  /**
   * Cleanup resources
   */
  destroy?(): Promise<void>;
}

/**
 * Abstract base class providing common functionality
 */
export abstract class BaseConnector implements IConnector {
  protected config?: ConnectorConfig;
  protected initialized: boolean = false;

  abstract getMetadata(): ConnectorMetadata;
  abstract execute(action: string, input: Record<string, any>, context: ExecutionContext): Promise<any>;

  async initialize(config: ConnectorConfig): Promise<void> {
    this.config = config;
    await this.validateConfig();
    this.initialized = true;
  }

  protected async validateConfig(): Promise<void> {
    if (!this.config) {
      throw new Error('Connector not configured');
    }
    
    // Override in subclasses for specific validation
  }

  validate(): boolean {
    return this.initialized && !!this.config;
  }

  /**
   * Helper to get a config setting
   */
  protected getConfigSetting<T = any>(key: string, defaultValue?: T): T {
    return this.config?.settings?.[key] ?? defaultValue;
  }

  /**
   * Helper to log with context
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, context: ExecutionContext): void {
    const metadata = context.getMetadata();
    const traceId = metadata?.traceId || 'unknown';
    const tenantId = context.getTenantId();
    console.log(`[${level.toUpperCase()}][${traceId}][tenant:${tenantId}] ${message}`);
  }
}

/**
 * Error type for connector failures
 */
export class ConnectorError extends Error {
  constructor(
    public connectorType: string,
    public action: string,
    message: string,
    public cause?: Error
  ) {
    super(`Connector[${connectorType}].${action}: ${message}`);
    this.name = 'ConnectorError';
  }
}

/**
 * Error type for configuration issues
 */
export class ConnectorConfigError extends Error {
  constructor(connectorType: string, message: string) {
    super(`Connector[${connectorType}] Configuration Error: ${message}`);
    this.name = 'ConnectorConfigError';
  }
}
