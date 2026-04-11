/**
 * @fileoverview In-Memory Connector - For testing and simple data storage
 * @author Senior Architect (60+ years experience)
 * @description Simple connector for demonstration and testing
 */

import { BaseConnector, ConnectorMetadata, ConnectorConfigError } from './ConnectorInterface';
import { ExecutionContext } from '../core/ExecutionContext';

interface MemoryStore {
  [collection: string]: Array<Record<string, any>>;
}

export class MemoryConnector extends BaseConnector {
  private store: MemoryStore = {};

  getMetadata(): ConnectorMetadata {
    return {
      name: 'memory',
      version: '1.0.0',
      description: 'In-memory data storage connector for testing',
      supportedActions: ['create', 'read', 'update', 'delete', 'list', 'find'],
    };
  }

  protected async validateConfig(): Promise<void> {
    if (!this.config) {
      throw new ConnectorConfigError('memory', 'Configuration is required');
    }

    // Optional: validate default collection setting
    const defaultCollection = this.getConfigSetting<string>('defaultCollection');
    if (defaultCollection && typeof defaultCollection !== 'string') {
      throw new ConnectorConfigError('memory', 'defaultCollection must be a string');
    }
  }

  async execute(
    action: string,
    input: Record<string, any>,
    context: ExecutionContext
  ): Promise<any> {
    switch (action) {
      case 'create':
        return this.create(input, context);
      case 'read':
        return this.read(input, context);
      case 'update':
        return this.update(input, context);
      case 'delete':
        return this.delete(input, context);
      case 'list':
        return this.list(input, context);
      case 'find':
        return this.find(input, context);
      default:
        throw new Error(`Unknown action: ${action}. Supported: create, read, update, delete, list, find`);
    }
  }

  private create(input: Record<string, any>, context: ExecutionContext): any {
    const { collection, data } = input;
    const collectionName = collection || this.getConfigSetting('defaultCollection', 'default');

    if (!this.store[collectionName]) {
      this.store[collectionName] = [];
    }

    const record = {
      id: this.generateId(),
      ...data,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.store[collectionName].push(record);
    this.log('info', `Created record in ${collectionName}`, context);

    return record;
  }

  private read(input: Record<string, any>, context: ExecutionContext): any {
    const { collection, id } = input;
    const collectionName = collection || this.getConfigSetting('defaultCollection', 'default');

    if (!this.store[collectionName]) {
      return null;
    }

    const record = this.store[collectionName].find(r => r.id === id);
    return record || null;
  }

  private update(input: Record<string, any>, context: ExecutionContext): any {
    const { collection, id, data } = input;
    const collectionName = collection || this.getConfigSetting('defaultCollection', 'default');

    if (!this.store[collectionName]) {
      throw new Error(`Collection '${collectionName}' does not exist`);
    }

    const index = this.store[collectionName].findIndex(r => r.id === id);
    if (index === -1) {
      throw new Error(`Record with id '${id}' not found`);
    }

    this.store[collectionName][index] = {
      ...this.store[collectionName][index],
      ...data,
      updatedAt: Date.now(),
    };

    this.log('info', `Updated record in ${collectionName}`, context);
    return this.store[collectionName][index];
  }

  private delete(input: Record<string, any>, context: ExecutionContext): any {
    const { collection, id } = input;
    const collectionName = collection || this.getConfigSetting('defaultCollection', 'default');

    if (!this.store[collectionName]) {
      return { deleted: false, reason: 'Collection not found' };
    }

    const index = this.store[collectionName].findIndex(r => r.id === id);
    if (index === -1) {
      return { deleted: false, reason: 'Record not found' };
    }

    const deleted = this.store[collectionName].splice(index, 1)[0];
    this.log('info', `Deleted record from ${collectionName}`, context);

    return { deleted: true, record: deleted };
  }

  private list(input: Record<string, any>, context: ExecutionContext): any {
    const { collection, limit, offset } = input;
    const collectionName = collection || this.getConfigSetting('defaultCollection', 'default');

    if (!this.store[collectionName]) {
      return [];
    }

    const start = offset || 0;
    const end = limit ? start + limit : this.store[collectionName].length;

    return this.store[collectionName].slice(start, end);
  }

  private find(input: Record<string, any>, context: ExecutionContext): any {
    const { collection, query } = input;
    const collectionName = collection || this.getConfigSetting('defaultCollection', 'default');

    if (!this.store[collectionName]) {
      return [];
    }

    return this.store[collectionName].filter(record => {
      return Object.entries(query || {}).every(([key, value]) => {
        return record[key] === value;
      });
    });
  }

  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.store = {};
  }

  /**
   * Get raw store access (for testing)
   */
  getStore(): MemoryStore {
    return { ...this.store };
  }
}
