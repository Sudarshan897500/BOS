import { Service } from 'typedi';
import { BaseError } from './errors';

export interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number | null;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  nextAttempt: number | null;
}

export interface CircuitBreakerOptions {
  threshold?: number;
  timeout?: number;
  halfOpenMax?: number;
}

@Service()
export class CircuitBreakerError extends BaseError {
  constructor(message: string = 'Circuit breaker is open') {
    super(message, 503, true);
  }
}

@Service()
export class CircuitBreaker {
  private name: string;
  private options: Required<CircuitBreakerOptions>;
  private state: CircuitBreakerState;
  private halfOpenSuccesses: number;

  constructor(name: string, options: CircuitBreakerOptions = {}) {
    this.name = name;
    this.options = {
      threshold: options.threshold ?? 5,
      timeout: options.timeout ?? 30000,
      halfOpenMax: options.halfOpenMax ?? 3,
    };
    this.state = {
      failures: 0,
      lastFailureTime: null,
      state: 'CLOSED',
      nextAttempt: null,
    };
    this.halfOpenSuccesses = 0;
  }

  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  isOpen(): boolean {
    if (this.state.state === 'CLOSED') {
      return false;
    }

    if (this.state.state === 'OPEN') {
      const now = Date.now();
      if (this.state.nextAttempt && now >= this.state.nextAttempt) {
        this.state.state = 'HALF_OPEN';
        this.halfOpenSuccesses = 0;
        return false;
      }
      return true;
    }

    return false;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new CircuitBreakerError(`Circuit breaker '${this.name}' is open`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state.state === 'HALF_OPEN') {
      this.halfOpenSuccesses++;
      if (this.halfOpenSuccesses >= this.options.halfOpenMax) {
        this.reset();
      }
    } else if (this.state.state === 'CLOSED') {
      this.state.failures = 0;
    }
  }

  private onFailure(): void {
    const now = Date.now();
    this.state.failures++;
    this.state.lastFailureTime = now;

    if (this.state.failures >= this.options.threshold || this.state.state === 'HALF_OPEN') {
      this.state.state = 'OPEN';
      this.state.nextAttempt = now + this.options.timeout;
    }
  }

  private reset(): void {
    this.state = {
      failures: 0,
      lastFailureTime: null,
      state: 'CLOSED',
      nextAttempt: null,
    };
  }

  forceOpen(): void {
    this.state.state = 'OPEN';
    this.state.nextAttempt = Date.now() + this.options.timeout;
  }

  forceClose(): void {
    this.reset();
  }
}
