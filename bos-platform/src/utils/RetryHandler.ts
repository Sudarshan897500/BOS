import { Service } from 'typedi';

export interface RetryOptions {
  maxAttempts?: number;
  delay?: number;
  maxDelay?: number;
  jitter?: boolean;
  retryableErrors?: string[];
}

@Service()
export class RetryHandler {
  private options: Required<RetryOptions>;

  constructor(options: RetryOptions = {}) {
    this.options = {
      maxAttempts: options.maxAttempts ?? 5,
      delay: options.delay ?? 1000,
      maxDelay: options.maxDelay ?? 30000,
      jitter: options.jitter ?? true,
      retryableErrors: options.retryableErrors ?? [],
    };
  }

  async execute<T>(fn: () => Promise<T>, context: string = 'operation'): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        if (!this.shouldRetry(lastError, attempt)) {
          throw lastError;
        }

        if (attempt < this.options.maxAttempts) {
          const delay = this.calculateDelay(attempt);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error(`Failed after ${this.options.maxAttempts} attempts`);
  }

  private shouldRetry(error: Error, attempt: number): boolean {
    if (attempt >= this.options.maxAttempts) {
      return false;
    }

    if (this.options.retryableErrors.length > 0) {
      const isRetryable = this.options.retryableErrors.some(
        errType => error.name === errType || error.message.includes(errType)
      );
      return isRetryable;
    }

    return true;
  }

  private calculateDelay(attempt: number): number {
    const exponentialDelay = this.options.delay * Math.pow(2, attempt - 1);
    const delay = Math.min(exponentialDelay, this.options.maxDelay);
    
    if (this.options.jitter) {
      const jitterAmount = delay * 0.2;
      return delay + (Math.random() * jitterAmount * 2 - jitterAmount);
    }
    
    return delay;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
