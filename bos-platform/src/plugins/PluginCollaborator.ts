import { Service, Inject, Container } from 'typedi';
import logger from '../utils/logger';
import { EventBus } from '../events/EventBus';

export type Logger = typeof logger;

export interface IPluginEvent {
  sourcePlugin: string;
  targetPlugin?: string;
  eventType: string;
  payload: any;
  tenantId: string;
}

@Service()
export class PluginCollaborator {
  private readonly logger: Logger;
  private eventBus: EventBus;

  constructor(@Inject('logger') logger: Logger) {
    this.logger = logger;
    this.eventBus = Container.get(EventBus);
    this.setupEventBridge();
  }

  private setupEventBridge(): void {
    // Listen to all plugin events and route them
    this.eventBus.subscribe('plugin.*', async (event: any) => {
      await this.handlePluginEvent(event);
    });
  }

  private async handlePluginEvent(event: IPluginEvent): Promise<void> {
    const { sourcePlugin, targetPlugin, eventType, payload, tenantId } = event;
    
    this.logger.debug(`🔌 Plugin Event: ${sourcePlugin} → ${targetPlugin || 'all'} [${eventType}]`);
    
    // If target is specified, emit to specific plugin
    if (targetPlugin) {
      this.eventBus.publish({
        type: `plugin.${targetPlugin}.${eventType}`,
        source: sourcePlugin,
        payload,
        tenantId
      });
    } else {
      // Broadcast to all plugins
      this.eventBus.publish({
        type: `plugin.broadcast.${eventType}`,
        source: sourcePlugin,
        payload,
        tenantId
      });
    }
  }

  public async emitEvent(event: IPluginEvent): Promise<void> {
    this.eventBus.publish({
      type: `plugin.${event.sourcePlugin}.${event.eventType}`,
      source: event.sourcePlugin,
      tenantId: event.tenantId,
      payload: event.payload
    });
    
    this.logger.info(`📤 Plugin event emitted: ${event.sourcePlugin}.${event.eventType}`);
  }

  public async requestResponse(
    sourcePlugin: string,
    targetPlugin: string,
    eventType: string,
    payload: any,
    tenantId: string,
    timeoutMs: number = 5000
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const correlationId = `${sourcePlugin}-${Date.now()}-${Math.random()}`;
      
      const handler = (response: any) => {
        if (response.correlationId === correlationId) {
          this.eventBus.unsubscribe(`plugin.response.${targetPlugin}.${correlationId}`);
          resolve(response.data);
        }
      };
      
      this.eventBus.subscribe(`plugin.response.${targetPlugin}.${correlationId}`, handler);
      
      // Emit request
      this.eventBus.publish({
        type: `plugin.request.${targetPlugin}.${eventType}`,
        source: sourcePlugin,
        tenantId,
        payload: { correlationId, payload }
      });
      
      // Timeout
      setTimeout(() => {
        this.eventBus.unsubscribe(`plugin.response.${targetPlugin}.${correlationId}`);
        reject(new Error(`Request to ${targetPlugin} timed out`));
      }, timeoutMs);
    });
  }
}
