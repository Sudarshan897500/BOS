/**
 * BOS Platform - Unified Facade
 * 
 * Main entry point that combines all subsystems:
 * Flow Engine, Events, Workflows, Jobs, Batch Processing
 */

import { ExecutionContext } from './core/ExecutionContext';
import { TenantConfigManager } from './config/TenantConfig';
import { StepExecutor } from './engines/StepExecutor';
import { FlowExecutor } from './engines/FlowExecutor';
import { ConnectorRegistry } from './connectors/ConnectorRegistry';
import { MemoryConnector } from './connectors/MemoryConnector';
import { ExpressionEvaluator } from './utils/ExpressionEvaluator';
import { EventBus } from './events/EventBus';
import { WorkflowEngine, InMemoryWorkflowStore, WorkflowDefinition } from './workflows/WorkflowEngine';
import { JobClient, InMemoryJobStore, Worker } from './jobs/JobSystem';
import { BatchEngine } from './batch/BatchEngine';

export interface BOSPlatformOptions {
  tenantId: string;
  connectors?: any[];
}

export class BOSPlatform {
  // Core
  private tenantConfig: TenantConfigManager;
  private connectorRegistry: ConnectorRegistry;
  
  // Engines
  private stepExecutor: StepExecutor;
  private flowExecutor: FlowExecutor;
  
  // Advanced Systems
  private eventBus: EventBus;
  private workflowEngine: WorkflowEngine;
  private jobClient: JobClient;
  private worker: Worker;
  private batchEngine: BatchEngine;

  constructor(options: BOSPlatformOptions) {
    // Initialize core components
    this.tenantConfig = new TenantConfigManager();
    this.connectorRegistry = new ConnectorRegistry();

    // Register default memory connector
    const memoryConnector = new MemoryConnector();
    this.connectorRegistry.register('memory', memoryConnector);

    // Register custom connectors if provided
    if (options.connectors) {
      for (const connector of options.connectors) {
        this.connectorRegistry.register(connector.name, connector);
      }
    }

    // Initialize executors
    this.stepExecutor = new StepExecutor(this.connectorRegistry);
    this.flowExecutor = new FlowExecutor(this.stepExecutor);

    // Initialize event system
    this.eventBus = new EventBus();

    // Initialize workflow engine
    const workflowStore = new InMemoryWorkflowStore();
    this.workflowEngine = new WorkflowEngine(workflowStore, this.eventBus, this.flowExecutor);

    // Initialize job system
    const jobStore = new InMemoryJobStore();
    this.jobClient = new JobClient(jobStore);
    this.worker = new Worker(jobStore);

    // Initialize batch engine
    this.batchEngine = new BatchEngine();

    // Set tenant context
    this.tenantConfig.setCurrentTenant(options.tenantId);
  }

  /**
   * Execute a flow definition
   */
  async executeFlow(flowDefinition: any, input: any): Promise<any> {
    const context = new ExecutionContext({
      input,
      output: {},
      state: {},
      tenantId: this.tenantConfig.getCurrentTenant()!,
      metadata: {
        traceId: `flow_${Date.now()}`
      }
    });

    return await this.flowExecutor.execute(flowDefinition, input, this.tenantConfig.getCurrentTenant()!);
  }

  /**
   * Register a workflow definition
   */
  registerWorkflow(def: WorkflowDefinition): void {
    this.workflowEngine.register(def);
  }

  /**
   * Start a workflow instance
   */
  async startWorkflow(workflowType: string, initialContext: any): Promise<string> {
    const tenantId = this.tenantConfig.getCurrentTenant()!;
    return await this.workflowEngine.start(workflowType, initialContext, tenantId);
  }

  /**
   * Subscribe to an event
   */
  subscribe(eventPattern: string, handler: (event: any) => void): string {
    const tenantId = this.tenantConfig.getCurrentTenant()!;
    return this.eventBus.subscribe(eventPattern, handler, tenantId);
  }

  /**
   * Publish an event
   */
  async publishEvent(type: string, payload: any, source: string = 'api'): Promise<void> {
    const tenantId = this.tenantConfig.getCurrentTenant()!;
    await this.eventBus.publish({
      type,
      source,
      tenantId,
      payload
    });
  }

  /**
   * Enqueue a background job
   */
  async enqueueJob(type: string, payload: any, options?: {
    priority?: number;
    delayMs?: number;
  }): Promise<string> {
    const tenantId = this.tenantConfig.getCurrentTenant()!;
    return await this.jobClient.enqueue(type, payload, {
      tenantId,
      priority: options?.priority || 5,
      delayMs: options?.delayMs,
      maxAttempts: 3
    });
  }

  /**
   * Register a job handler
   */
  registerJobHandler(type: string, handler: (job: any) => Promise<void>): void {
    this.worker.register(type, handler);
  }

  /**
   * Start the job worker
   */
  startWorker(): void {
    this.worker.start();
  }

  /**
   * Stop the job worker
   */
  stopWorker(): void {
    this.worker.stop();
  }

  /**
   * Create a batch processing job
   */
  async createBatch(type: string, items: any[], options?: {
    chunkSize?: number;
    concurrency?: number;
  }): Promise<string> {
    const tenantId = this.tenantConfig.getCurrentTenant()!;
    return await this.batchEngine.createBatch(type, items, tenantId, options);
  }

  /**
   * Register a batch processor
   */
  registerBatchProcessor(type: string, processor: (item: any, index: number) => Promise<any>): void {
    this.batchEngine.register(type, processor);
  }

  /**
   * Get batch status
   */
  getBatchStatus(batchId: string): any {
    return this.batchEngine.getBatchStatus(batchId);
  }

  /**
   * Start workflow scheduler
   */
  startWorkflowScheduler(intervalMs: number = 5000): void {
    this.workflowEngine.startScheduler(intervalMs);
  }

  /**
   * Stop workflow scheduler
   */
  stopWorkflowScheduler(): void {
    this.workflowEngine.stopScheduler();
  }

  /**
   * Get the event bus (for advanced usage)
   */
  getEventBus(): EventBus {
    return this.eventBus;
  }

  /**
   * Get the workflow engine (for advanced usage)
   */
  getWorkflowEngine(): WorkflowEngine {
    return this.workflowEngine;
  }

  /**
   * Get the batch engine (for advanced usage)
   */
  getBatchEngine(): BatchEngine {
    return this.batchEngine;
  }
}
