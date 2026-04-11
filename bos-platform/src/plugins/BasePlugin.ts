import { Service, Inject } from 'typedi';
import logger from '../utils/logger';

export type Logger = typeof logger;

export interface IPluginConfig {
  id: string;
  name: string;
  version: string;
  dependencies?: string[];
  configSchema?: Record<string, any>;
  flows?: Record<string, any>;
  models?: Record<string, any>;
  routes?: Record<string, any>;
}

export interface IPluginContext {
  tenantId: string;
  config: Record<string, any>;
  services: Record<string, any>;
  events: any;
}

@Service()
export class BasePlugin {
  protected readonly logger: Logger;
  
  constructor(@Inject('logger') logger: Logger) {
    this.logger = logger;
  }

  public config: IPluginConfig = {
    id: 'base',
    name: 'Base Plugin',
    version: '1.0.0'
  };

  public async initialize(context: IPluginContext): Promise<void> {
    this.logger.info(`[${this.config.name}] Initializing plugin...`);
  }

  public async execute(flowName: string, input: any, context: IPluginContext): Promise<any> {
    throw new Error(`Flow ${flowName} not implemented in plugin ${this.config.name}`);
  }

  public async cleanup(): Promise<void> {
    this.logger.info(`[${this.config.name}] Cleaning up...`);
  }
}
