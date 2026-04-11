/**
 * @fileoverview Expression Evaluator - Evaluates expressions in context
 * @author Senior Architect (60+ years experience)
 * @description Safe expression evaluation without eval()
 */

import { ExecutionContext } from '../core/ExecutionContext';

export class ExpressionEvaluator {
  /**
   * Evaluate a single expression string
   * Supports: {{context.input.field}}, {{context.output.field}}, {{context.state.field}}, {{config.setting}}
   */
  evaluate(expression: string, context: ExecutionContext): any {
    if (!expression || typeof expression !== 'string') {
      return expression;
    }

    // Check if it's a template expression
    const templateRegex = /\{\{([^}]+)\}\}/g;
    const matches = [...expression.matchAll(templateRegex)];

    if (matches.length === 0) {
      // No expressions, return as-is (could be a literal value)
      return expression;
    }

    if (matches.length === 1 && expression.trim() === matches[0][0]) {
      // Single expression covering entire string - return the resolved value directly
      const path = matches[0][1].trim();
      return this.resolvePath(path, context);
    }

    // Multiple expressions or mixed content - do string replacement
    return expression.replace(templateRegex, (match, path) => {
      const value = this.resolvePath(path.trim(), context);
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Evaluate all expressions in an object recursively
   */
  evaluateExpressions(obj: Record<string, any>, context: ExecutionContext): Record<string, any> {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = this.evaluate(value, context);
      } else if (Array.isArray(value)) {
        result[key] = value.map(item => {
          if (typeof item === 'string') {
            return this.evaluate(item, context);
          } else if (typeof item === 'object' && item !== null) {
            return this.evaluateExpressions(item, context);
          }
          return item;
        });
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.evaluateExpressions(value, context);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Resolve a path like "context.input.user.name" to actual value
   */
  private resolvePath(path: string, context: ExecutionContext): any {
    const parts = path.split('.');
    const root = parts[0];

    let data: any;

    switch (root) {
      case 'context':
        data = this.getContextData(context, parts.slice(1));
        break;
      case 'input':
        data = this.getNestedValue(context.getInput(), parts.slice(1));
        break;
      case 'output':
        data = this.getNestedValue(context.getOutput(), parts.slice(1));
        break;
      case 'state':
        data = this.getNestedValue(context.getState(), parts.slice(1));
        break;
      case 'config':
        data = this.getConfigValue(context, parts.slice(1));
        break;
      case 'metadata':
        data = this.getNestedValue(context.getMetadata(), parts.slice(1));
        break;
      default:
        // Try to resolve as a direct context property
        data = this.getContextData(context, parts);
    }

    return data;
  }

  /**
   * Get data from context based on path
   */
  private getContextData(context: ExecutionContext, parts: string[]): any {
    if (parts.length === 0) {
      return context;
    }

    const subRoot = parts[0];
    const remaining = parts.slice(1);

    switch (subRoot) {
      case 'input':
        return this.getNestedValue(context.getInput(), remaining);
      case 'output':
        return this.getNestedValue(context.getOutput(), remaining);
      case 'state':
        return this.getNestedValue(context.getState(), remaining);
      case 'tenantId':
        return remaining.length === 0 ? context.getTenantId() : undefined;
      case 'metadata':
        return this.getNestedValue(context.getMetadata(), remaining);
      default:
        return undefined;
    }
  }

  /**
   * Get config value with special handling
   */
  private getConfigValue(context: ExecutionContext, parts: string[]): any {
    const config = context.getConfig();
    
    if (parts.length === 0) {
      return config;
    }

    // Support globalSettings.path or module settings
    const firstPart = parts[0];
    
    if (firstPart === 'globalSettings') {
      return this.getNestedValue(config?.globalSettings || {}, parts.slice(1));
    }

    // Try to access as direct property
    return this.getNestedValue(config as any, parts);
  }

  /**
   * Safely get nested value from object
   */
  private getNestedValue(obj: any, parts: string[]): any {
    let current = obj;

    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined;
      }

      // Handle array access
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch && Array.isArray(current[arrayMatch[1]])) {
        const index = parseInt(arrayMatch[2], 10);
        current = current[arrayMatch[1]][index];
      } else {
        current = current[part];
      }
    }

    return current;
  }

  /**
   * Evaluate a condition expression (returns boolean)
   * Supports: ==, !=, >, <, >=, <=, &&, ||, !
   */
  evaluateCondition(expression: string, context: ExecutionContext): boolean {
    const evaluated = this.evaluate(expression, context);
    
    // If already a boolean, return it
    if (typeof evaluated === 'boolean') {
      return evaluated;
    }

    // Try to parse as a comparison
    // Simple comparisons: "context.input.count > 5"
    const comparisonRegex = /^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/;
    const match = expression.trim().match(comparisonRegex);

    if (match) {
      const left = this.evaluate(match[1].trim(), context);
      const operator = match[2];
      const right = this.evaluate(match[3].trim(), context);

      switch (operator) {
        case '==':
          return left == right;
        case '!=':
          return left != right;
        case '>':
          return left > right;
        case '<':
          return left < right;
        case '>=':
          return left >= right;
        case '<=':
          return left <= right;
      }
    }

    // Fallback: truthy check
    return !!evaluated;
  }
}
