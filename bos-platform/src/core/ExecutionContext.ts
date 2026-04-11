/**
 * @fileoverview Execution Context - Carries state through flow execution
 * @author Senior Architect (60+ years experience)
 * @description Immutable context pattern with controlled mutations
 */

import { TenantConfig } from '../config/TenantConfig';

export interface ContextState {
  input: Record<string, any>;
  output: Record<string, any>;
  state: Record<string, any>;
  tenantId: string;
  config?: TenantConfig;
  metadata?: {
    flowId?: string;
    stepIndex?: number;
    timestamp?: number;
    traceId?: string;
  };
}

export class ExecutionContext {
  private state: ContextState;

  constructor(initialState: Partial<ContextState>) {
    this.state = {
      input: initialState.input || {},
      output: initialState.output || {},
      state: initialState.state || {},
      tenantId: initialState.tenantId || '',
      config: initialState.config || {} as TenantConfig,
      metadata: {
        flowId: initialState.metadata?.flowId || '',
        stepIndex: initialState.metadata?.stepIndex || 0,
        timestamp: initialState.metadata?.timestamp || Date.now(),
        traceId: initialState.metadata?.traceId || this.generateTraceId(),
      },
    };
  }

  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Immutable getters
  getInput<T = any>(key?: string): T | any {
    if (key) {
      return this.state.input[key];
    }
    return this.state.input;
  }

  getOutput<T = any>(key?: string): T | any {
    if (key) {
      return this.state.output[key];
    }
    return this.state.output;
  }

  getState<T = any>(key?: string): T | any {
    if (key) {
      return this.state.state[key];
    }
    return this.state.state;
  }

  getTenantId(): string {
    return this.state.tenantId;
  }

  getConfig(): TenantConfig | undefined {
    return this.state.config;
  }

  getMetadata(): ContextState['metadata'] {
    return this.state.metadata;
  }

  // Controlled mutations - returns new context (immutable pattern)
  setInput(input: Record<string, any>): ExecutionContext {
    return this.clone({ input });
  }

  setOutput(output: Record<string, any>): ExecutionContext {
    return this.clone({ output });
  }

  setState(state: Record<string, any>): ExecutionContext {
    return this.clone({ state: { ...this.state.state, ...state } });
  }

  setStepIndex(index: number): ExecutionContext {
    return this.clone({
      metadata: { ...this.state.metadata, stepIndex: index },
    });
  }

  // Merge result into output
  mergeOutput(result: Record<string, any>): ExecutionContext {
    return this.setOutput({ ...this.state.output, ...result });
  }

  // Clone with modifications (immutable pattern)
  private clone(overrides: Partial<ContextState>): ExecutionContext {
    const newState = { ...this.state, ...overrides };
    return new ExecutionContext(newState);
  }

  // Serialize for logging/debugging
  toJSON(): ContextState {
    return { ...this.state };
  }
}
