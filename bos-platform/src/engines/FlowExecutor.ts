/**
 * @fileoverview Flow Executor - Orchestrates flow execution
 * @author Senior Architect (60+ years experience)
 * @description Composite Pattern - Executes sequences of steps with control flow
 */

import { ExecutionContext } from '../core/ExecutionContext';
import { StepExecutor, StepDefinition, StepResult } from '../engines/StepExecutor';
import { TenantConfig } from '../config/TenantConfig';

export interface FlowDefinition {
  id: string;
  name: string;
  description?: string;
  version: string;
  steps: StepDefinition[];
  metadata?: {
    author?: string;
    createdAt?: number;
    tags?: string[];
  };
}

export interface FlowExecutionResult {
  success: boolean;
  output: Record<string, any>;
  error?: Error;
  executedSteps: number;
  skippedSteps: number;
  duration: number;
  traceId: string;
}

export class FlowExecutor {
  private stepExecutor: StepExecutor;

  constructor(stepExecutor: StepExecutor) {
    this.stepExecutor = stepExecutor;
  }

  /**
   * Execute a complete flow
   */
  async execute(
    flow: FlowDefinition,
    input: Record<string, any>,
    tenantId?: string,
    config?: TenantConfig
  ): Promise<FlowExecutionResult> {
    const startTime = Date.now();

    // Create execution context
    let context = new ExecutionContext({
      input,
      tenantId: tenantId || '',
      config: config as any,
      metadata: {
        flowId: flow.id,
        stepIndex: 0,
        timestamp: startTime,
        traceId: `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      },
    });

    const metadata = context.getMetadata();
    const traceId = metadata?.traceId || 'unknown';
    console.log(`[FLOW] Starting flow '${flow.name}' (${flow.id}) - Trace: ${traceId}`);

    let executedSteps = 0;
    let skippedSteps = 0;
    let stepResults: Record<string, StepResult> = {};

    try {
      // Execute steps sequentially
      for (let i = 0; i < flow.steps.length; i++) {
        const step = flow.steps[i];
        context = context.setStepIndex(i);

        console.log(`[STEP] Executing step ${i + 1}/${flow.steps.length}: ${step.id} (${step.type})`);

        const result = await this.stepExecutor.execute(step, context);

        stepResults[step.id] = result;

        if (result.skipped) {
          skippedSteps++;
          console.log(`[STEP] Skipped: ${step.id}`);
        } else {
          executedSteps++;
          
          // Merge output into context
          if (result.success && result.output) {
            context = context.mergeOutput({
              [step.id]: result.output,
              lastStep: step.id,
              lastResult: result.output,
            });
          }
        }

        // Handle condition-based branching
        if (step.condition && result.output?.conditionMet === false && result.output?.hasElse) {
          // Skip to next step (else branch handling would require more complex logic)
          continue;
        }

        // Handle explicit next pointer
        if (step.next) {
          const nextIndex = flow.steps.findIndex(s => s.id === step.next);
          if (nextIndex !== -1) {
            i = nextIndex - 1; // -1 because loop will increment
          }
        }
      }

      const duration = Date.now() - startTime;
      console.log(`[FLOW] Completed flow '${flow.name}' in ${duration}ms`);

      return {
        success: true,
        output: context.getOutput(),
        executedSteps,
        skippedSteps,
        duration,
        traceId,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[FLOW] Failed flow '${flow.name}' after ${duration}ms:`, error);

      return {
        success: false,
        output: context.getOutput(),
        error: error instanceof Error ? error : new Error(String(error)),
        executedSteps,
        skippedSteps,
        duration,
        traceId,
      };
    }
  }

  /**
   * Execute a flow with parallel step groups
   */
  async executeWithParallel(
    flow: FlowDefinition,
    input: Record<string, any>,
    tenantId: string,
    config: TenantConfig
  ): Promise<FlowExecutionResult> {
    // For now, delegate to standard execute
    // Parallel execution will be enhanced in later phases
    return this.execute(flow, input, tenantId, config);
  }
}
