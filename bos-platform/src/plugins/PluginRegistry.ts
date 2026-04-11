import { Service, Inject } from 'typedi';
import logger from '../utils/logger';
import { BasePlugin, IPluginConfig, IPluginContext } from './BasePlugin';

export type Logger = typeof logger;

@Service()
export class PluginRegistry {
  private plugins: Map<string, BasePlugin> = new Map();
  private readonly logger: Logger;

  constructor(@Inject('logger') logger: Logger) {
    this.logger = logger;
  }

  public async register(plugin: BasePlugin): Promise<void> {
    const config = plugin.config;
    
    if (this.plugins.has(config.id)) {
      throw new Error(`Plugin ${config.id} is already registered`);
    }

    // Check dependencies
    if (config.dependencies) {
      for (const depId of config.dependencies) {
        if (!this.plugins.has(depId)) {
          throw new Error(`Plugin ${config.id} requires dependency ${depId}`);
        }
      }
    }

    this.plugins.set(config.id, plugin);
    this.logger.info(`✅ Plugin registered: ${config.name} v${config.version}`);
  }

  public async initializeAll(context: IPluginContext): Promise<void> {
    this.logger.info('🔌 Initializing all plugins...');
    
    // Topological sort for dependency order
    const sorted = this.topologicalSort();
    
    for (const pluginId of sorted) {
      const plugin = this.plugins.get(pluginId);
      if (plugin) {
        await plugin.initialize(context);
      }
    }
    
    this.logger.info(`✅ All ${sorted.length} plugins initialized`);
  }

  public getPlugin(id: string): BasePlugin | undefined {
    return this.plugins.get(id);
  }

  public getAllPlugins(): BasePlugin[] {
    return Array.from(this.plugins.values());
  }

  public async executeFlow(pluginId: string, flowName: string, input: any, context: IPluginContext): Promise<any> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }
    
    return await plugin.execute(flowName, input, context);
  }

  public async cleanupAll(): Promise<void> {
    this.logger.info('🧹 Cleaning up all plugins...');
    
    const sorted = this.topologicalSort().reverse();
    
    for (const pluginId of sorted) {
      const plugin = this.plugins.get(pluginId);
      if (plugin) {
        await plugin.cleanup();
      }
    }
    
    this.plugins.clear();
    this.logger.info('✅ All plugins cleaned up');
  }

  private topologicalSort(): string[] {
    const visited = new Set<string>();
    const result: string[] = [];
    
    const visit = (pluginId: string) => {
      if (visited.has(pluginId)) return;
      visited.add(pluginId);
      
      const plugin = this.plugins.get(pluginId);
      if (plugin && plugin.config.dependencies) {
        for (const depId of plugin.config.dependencies) {
          visit(depId);
        }
      }
      
      result.push(pluginId);
    };
    
    for (const pluginId of this.plugins.keys()) {
      visit(pluginId);
    }
    
    return result;
  }
}
