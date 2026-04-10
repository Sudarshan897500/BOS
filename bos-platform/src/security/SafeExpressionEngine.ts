import { VM } from 'vm2';

/**
 * Safe Expression Engine - Securely evaluates expressions without RCE risk
 * Replaces unsafe eval() with sandboxed VM execution
 */
export class SafeExpressionEngine {
  private vm: VM;

  constructor() {
    // Create a secure VM with restricted access
    this.vm = new VM({
      timeout: 1000, // 1 second timeout to prevent infinite loops
      sandbox: {},
      compiler: 'javascript',
      eval: false,
      wasm: false,
      fixAsync: true,
    });
  }

  /**
   * Safely evaluate an expression with provided context
   * @param expression - The expression to evaluate (e.g., "{{input.value}} > 10")
   * @param context - The context object containing variables
   */
  public evaluate<T>(expression: string, context: Record<string, any>): T {
    try {
      // Remove {{ }} wrapper if present
      const cleanExpression = expression.replace(/^\{\{|\}\}$/g, '').trim();

      // Create a function with the context as parameters
      const contextKeys = Object.keys(context);
      const contextValues = Object.values(context);

      // Sanitize the expression to prevent prototype pollution
      const sanitizedExpression = this.sanitizeExpression(cleanExpression);

      // Execute in sandboxed VM
      const code = `
        (function(${contextKeys.join(', ')}) {
          return ${sanitizedExpression};
        })
      `;

      const fn = this.vm.run(code);
      return fn(...contextValues) as T;
    } catch (error) {
      throw new Error(`Expression evaluation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Sanitize expression to prevent security vulnerabilities
   */
  private sanitizeExpression(expression: string): string {
    // Block dangerous patterns
    const dangerousPatterns = [
      /\brequire\s*\(/i,
      /\bimport\s+/i,
      /\bprocess\./i,
      /\bglobal\./i,
      /\beval\s*\(/i,
      /\bFunction\s*\(/i,
      /\bconstructor\s*\./i,
      /\b__proto__/i,
      /\bprototype\b/i,
      /Buffer\./i,
      /\bsetTimeout\s*\(/i,
      /\bsetInterval\s*\(/i,
      /\bsetImmediate\s*\(/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(expression)) {
        throw new Error(`Dangerous pattern detected in expression: ${expression}`);
      }
    }

    return expression;
  }

  /**
   * Evaluate a condition expression (returns boolean)
   */
  public evaluateCondition(expression: string, context: Record<string, any>): boolean {
    const result = this.evaluate<boolean>(expression, context);
    return Boolean(result);
  }

  /**
   * Evaluate a transformation expression (returns transformed object)
   */
  public evaluateTransform(expression: string, context: Record<string, any>): any {
    return this.evaluate(expression, context);
  }
}
