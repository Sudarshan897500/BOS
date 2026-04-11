/**
 * @fileoverview Step Executor - Executes individual steps in a flow
 * @author Senior Architect (60+ years experience)
 * @description Single Responsibility Principle - One class, one purpose
 */

import { ExecutionContext } from '../core/ExecutionContext';
import { ConnectorRegistry } from '../connectors/ConnectorRegistry';
import { ExpressionEvaluator } from '../utils/ExpressionEvaluator';

export interface StepDefinition {
  id: string;
  type: 'action' | 'condition' | 'transform' | 'loop' | 'parallel' | 'delay' | 'event';
  service?: string;
  action?: string;
  input?: Record<string, any>;
  condition?: {
    if: string;
    else?: StepDefinition[];
  };
  transform?: Record<string, any>;
  parallel?: StepDefinition[];
  delay?: number;
  event?: {
    name: string;
    payload?: Record<string, any>;
  };
  next?: string;
  onError?: {
    retry?: {
      attempts: number;
      delay: number;
    };
    fallback?: StepDefinition[];
  };
}

export interface StepResult {
  success: boolean;
  output: Record<string, any>;
  error?: Error;
  skipped?: boolean;
}

export class StepExecutor {
  private connectorRegistry: ConnectorRegistry;
  private expressionEvaluator: ExpressionEvaluator;

  constructor(connectorRegistry: ConnectorRegistry) {
    this.connectorRegistry = connectorRegistry;
    this.expressionEvaluator = new ExpressionEvaluator();
  }

  /**
   * Execute a single step
   */
  async execute(step: StepDefinition, context: ExecutionContext): Promise<StepResult> {
    try {
      // Check if step is disabled via tenant config
      const config = context.getConfig();
      const metadata = context.getMetadata();
      const flowId = metadata?.flowId || '';
      const stepConfig = config?.flows?.[flowId]?.steps?.[step.id];
      if (stepConfig && stepConfig.enabled === false) {
        return {
          success: true,
          output: {},
          skipped: true,
        };
      }

      // Evaluate conditions if present
      if (step.condition) {
        return await this.executeCondition(step, context);
      }

      // Execute based on step type
      switch (step.type) {
        case 'action':
          return await this.executeAction(step, context);
        case 'transform':
          return await this.executeTransform(step, context);
        case 'delay':
          return await this.executeDelay(step, context);
        case 'event':
          return await this.executeEvent(step, context);
        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }
    } catch (error) {
      // Handle errors with retry logic if configured
      if (step.onError?.retry) {
        return await this.executeWithRetry(step, context, step.onError.retry.attempts);
      }
      
      return {
        success: false,
        output: {},
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Execute an action step (calls a service/connector)
   */
  private async executeAction(step: StepDefinition, context: ExecutionContext): Promise<StepResult> {
    if (!step.service || !step.action) {
      throw new Error('Action step requires service and action');
    }

    // Evaluate input expressions
    const evaluatedInput = this.expressionEvaluator.evaluateExpressions(
      step.input || {},
      context
    );

    // Apply tenant-specific overrides
    const config = context.getConfig();
    const metadata = context.getMetadata();
    const flowId = metadata?.flowId || '';
    const stepConfig = config?.flows?.[flowId]?.steps?.[step.id];
    const finalInput = stepConfig?.override
      ? { ...evaluatedInput, ...stepConfig.override }
      : evaluatedInput;

    // Execute via connector registry
    const result = await this.connectorRegistry.execute(
      step.service,
      step.action,
      finalInput,
      context
    );

    return {
      success: true,
      output: result,
    };
  }

  /**
   * Execute a condition step
   */
  private async executeCondition(step: StepDefinition, context: ExecutionContext): Promise<StepResult> {
    if (!step.condition) {
      throw new Error('Condition step requires condition definition');
    }

    const conditionResult = this.expressionEvaluator.evaluate(
      step.condition.if,
      context
    );

    if (conditionResult) {
      // Condition met - continue with next steps (handled by flow executor)
      return {
        success: true,
        output: { conditionMet: true },
      };
    } else {
      // Condition not met - execute else branch if exists
      if (step.condition.else) {
        // Else branch will be handled by flow executor
        return {
          success: true,
          output: { conditionMet: false, hasElse: true },
        };
      }
      
      return {
        success: true,
        output: { conditionMet: false },
        skipped: true,
      };
    }
  }

  /**
   * Execute a transform step
   */
  private async executeTransform(step: StepDefinition, context: ExecutionContext): Promise<StepResult> {
    if (!step.transform) {
      throw new Error('Transform step requires transform definition');
    }

    const transformed = this.expressionEvaluator.evaluateExpressions(
      step.transform,
      context
    );

    return {
      success: true,
      output: transformed,
    };
  }

  /**
   * Execute a delay step
   */
  private async executeDelay(step: StepDefinition, context: ExecutionContext): Promise<StepResult> {
    const delayMs = step.delay || 0;
    
    await new Promise(resolve => setTimeout(resolve, delayMs));

    return {
      success: true,
      output: { delayed: true, duration: delayMs },
    };
  }

  /**
   * Execute an event emission step
   */
  private async executeEvent(step: StepDefinition, context: ExecutionContext): Promise<StepResult> {
    if (!step.event) {
      throw new Error('Event step requires event definition');
    }

    const eventName = step.event.name;
    const payload = this.expressionEvaluator.evaluateExpressions(
      step.event.payload || {},
      context
    );

    // Event emission will be handled by event system (Phase 6)
    // For now, just return the event data
    return {
      success: true,
      output: {
        emitted: true,
        eventName,
        payload,
      },
    };
  }

  /**
   * Execute with retry logic
   */
  private async executeWithRetry(
    step: StepDefinition,
    context: ExecutionContext,
    attempts: number
  ): Promise<StepResult> {
    let lastError: Error | undefined;

    for (let i = 0; i < attempts; i++) {
      try {
        return await this.execute(step, context);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (i < attempts - 1 && step.onError?.retry?.delay) {
          const delay = step.onError.retry.delay;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return {
      success: false,
      output: {},
      error: lastError,
    };
  }
}
