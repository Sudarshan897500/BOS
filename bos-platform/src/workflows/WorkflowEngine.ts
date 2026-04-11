/**
 * Workflow Engine - Phase 7
 * 
 * Long-running, stateful processes with persistence support.
 * Supports retries, delays, and state transitions.
 */

import { ExecutionContext } from '../core/ExecutionContext';
import { FlowExecutor } from '../engines/FlowExecutor';
import { EventBus } from '../events/EventBus';

export type WorkflowStatus = 'pending' | 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled';

export interface WorkflowState {
  id: string;
  workflowType: string;
  tenantId: string;
  status: WorkflowStatus;
  currentStep: number;
  context: any;
  createdAt: number;
  updatedAt: number;
  waitUntil?: number; // For delay steps
  retryCount: number;
  error?: string;
}

export interface WorkflowDefinition {
  type: string;
  version: string;
  steps: any[];
  config?: {
    maxRetries?: number;
    timeoutMs?: number;
  };
}

export interface WorkflowStore {
  save(state: WorkflowState): Promise<void>;
  findById(id: string): Promise<WorkflowState | null>;
  findByStatus(status: WorkflowStatus): Promise<WorkflowState[]>;
  delete(id: string): Promise<void>;
}

/**
 * In-memory store for demo purposes.
 * In production, use Redis/Database.
 */
export class InMemoryWorkflowStore implements WorkflowStore {
  private store: Map<string, WorkflowState> = new Map();

  async save(state: WorkflowState): Promise<void> {
    state.updatedAt = Date.now();
    this.store.set(state.id, state);
  }

  async findById(id: string): Promise<WorkflowState | null> {
    return this.store.get(id) || null;
  }

  async findByStatus(status: WorkflowStatus): Promise<WorkflowState[]> {
    return Array.from(this.store.values()).filter(w => w.status === status);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}

export class WorkflowEngine {
  private store: WorkflowStore;
  private eventBus: EventBus;
  private flowExecutor: FlowExecutor;
  private definitions: Map<string, WorkflowDefinition> = new Map();
  private runningInterval: NodeJS.Timeout | null = null;

  constructor(store: WorkflowStore, eventBus: EventBus, flowExecutor: FlowExecutor) {
    this.store = store;
    this.eventBus = eventBus;
    this.flowExecutor = flowExecutor;
  }

  /**
   * Register a workflow definition
   */
  register(def: WorkflowDefinition): void {
    const key = `${def.type}@${def.version}`;
    this.definitions.set(key, def);
  }

  /**
   * Start a new workflow instance
   */
  async start(workflowType: string, initialContext: any, tenantId: string): Promise<string> {
    const def = Array.from(this.definitions.values()).find(d => d.type === workflowType);
    if (!def) throw new Error(`Workflow ${workflowType} not found`);

    const state: WorkflowState = {
      id: `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      workflowType,
      tenantId,
      status: 'pending',
      currentStep: 0,
      context: initialContext,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      retryCount: 0
    };

    await this.store.save(state);
    
    // Start processing
    this.processWorkflow(state.id).catch(console.error);

    return state.id;
  }

  /**
   * Process a workflow (called internally or by scheduler)
   */
  async processWorkflow(workflowId: string): Promise<void> {
    const state = await this.store.findById(workflowId);
    if (!state) throw new Error(`Workflow ${workflowId} not found`);

    if (state.status === 'waiting') {
      // Check if wait time has passed
      if (state.waitUntil && Date.now() < state.waitUntil) {
        return; // Still waiting
      }
      state.status = 'running';
    }

    if (state.status !== 'running' && state.status !== 'pending') {
      return; // Already completed or failed
    }

    const def = Array.from(this.definitions.values()).find(d => d.type === state.workflowType);
    if (!def) {
      await this.fail(state, 'Workflow definition not found');
      return;
    }

    try {
      state.status = 'running';
      
      // Execute remaining steps
      while (state.currentStep < def.steps.length) {
        const step = def.steps[state.currentStep];
        
        // Handle delay steps specially
        if (step.type === 'delay' && step.durationMs) {
          state.waitUntil = Date.now() + step.durationMs;
          state.status = 'waiting';
          await this.store.save(state);
          return; // Pause here, scheduler will resume
        }

        // Create execution context
        const ctx = new ExecutionContext({
          input: state.context,
          output: {},
          state: {},
          tenantId: state.tenantId,
          metadata: {
            traceId: workflowId
          }
        });

        // Execute step using the StepExecutor directly
        const result = await this.flowExecutor['stepExecutor'].execute(step, ctx);
        
        // Update context with output
        state.context = { ...state.context, ...result.output };
        state.currentStep++;
      }

      // All steps completed
      state.status = 'completed';
      await this.store.save(state);

      // Emit completion event
      await this.eventBus.publish({
        type: 'workflow.completed',
        source: 'workflow-engine',
        tenantId: state.tenantId,
        payload: { workflowId, workflowType: state.workflowType }
      });

    } catch (error: any) {
      await this.handleError(state, def, error);
    }
  }

  private async handleError(state: WorkflowState, def: WorkflowDefinition, error: any): Promise<void> {
    const maxRetries = def.config?.maxRetries || 3;
    
    if (state.retryCount < maxRetries) {
      state.retryCount++;
      state.status = 'pending'; // Retry later
      state.error = error.message;
      await this.store.save(state);
      
      // Schedule retry immediately for simplicity (could add backoff)
      setTimeout(() => this.processWorkflow(state.id), 1000);
    } else {
      await this.fail(state, error.message);
    }
  }

  private async fail(state: WorkflowState, error: string): Promise<void> {
    state.status = 'failed';
    state.error = error;
    await this.store.save(state);

    await this.eventBus.publish({
      type: 'workflow.failed',
      source: 'workflow-engine',
      tenantId: state.tenantId,
      payload: { workflowId: state.id, error }
    });
  }

  /**
   * Start background scheduler to process waiting workflows
   */
  startScheduler(intervalMs: number = 5000): void {
    if (this.runningInterval) clearInterval(this.runningInterval);
    
    this.runningInterval = setInterval(async () => {
      const waiting = await this.store.findByStatus('waiting');
      for (const wf of waiting) {
        this.processWorkflow(wf.id).catch(console.error);
      }
      
      const pending = await this.store.findByStatus('pending');
      for (const wf of pending) {
        this.processWorkflow(wf.id).catch(console.error);
      }
    }, intervalMs);
  }

  stopScheduler(): void {
    if (this.runningInterval) {
      clearInterval(this.runningInterval);
      this.runningInterval = null;
    }
  }
}
