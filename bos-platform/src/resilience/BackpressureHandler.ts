import { Request, Response, NextFunction } from 'express';

/**
 * Backpressure Handler - Prevents system overload by rejecting requests gracefully
 * Implements load shedding when system resources are constrained
 */
export class BackpressureHandler {
  private static instance: BackpressureHandler;
  
  private maxConcurrentRequests: number = 1000;
  private maxQueueDepth: number = 500;
  private currentRequests: number = 0;
  private queueDepth: number = 0;
  private isOverloaded: boolean = false;
  private readonly MEMORY_THRESHOLD = 0.8; // 80% heap usage

  private constructor() {
    this.startHealthMonitoring();
  }

  public static getInstance(): BackpressureHandler {
    if (!BackpressureHandler.instance) {
      BackpressureHandler.instance = new BackpressureHandler();
    }
    return BackpressureHandler.instance;
  }

  /**
   * Middleware to apply backpressure handling
   */
  public middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Check if system is overloaded
      if (this.isOverloaded || this.shouldReject()) {
        // Increment rejected requests counter
        this.queueDepth++;
        
        // Return 503 Service Unavailable with retry-after header
        const retryAfter = this.calculateRetryAfter();
        
        res.set('Retry-After', retryAfter.toString());
        res.set('X-RateLimit-Limit', this.maxConcurrentRequests.toString());
        res.set('X-RateLimit-Remaining', Math.max(0, this.maxConcurrentRequests - this.currentRequests).toString());
        
        return res.status(503).json({
          error: 'Service Unavailable',
          message: 'System is temporarily overloaded. Please try again later.',
          retryAfter,
          reason: this.getRejectionReason(),
        });
      }

      // Track active request
      this.currentRequests++;
      
      // Decrement on response finish
      res.on('finish', () => {
        this.currentRequests--;
      });

      next();
    };
  }

  /**
   * Determine if a request should be rejected
   */
  private shouldReject(): boolean {
    // Check concurrent request limit
    if (this.currentRequests >= this.maxConcurrentRequests) {
      return true;
    }

    // Check memory pressure
    const heapUsed = process.memoryUsage().heapUsed;
    const heapTotal = process.memoryUsage().heapTotal;
    const memoryPressure = heapUsed / heapTotal;
    
    if (memoryPressure > this.MEMORY_THRESHOLD) {
      return true;
    }

    return false;
  }

  /**
   * Calculate retry-after time in seconds based on current load
   */
  private calculateRetryAfter(): number {
    const loadFactor = this.currentRequests / this.maxConcurrentRequests;
    
    if (loadFactor > 0.95) {
      return 60; // Heavy load: wait 60 seconds
    } else if (loadFactor > 0.9) {
      return 30; // High load: wait 30 seconds
    } else if (loadFactor > 0.85) {
      return 15; // Moderate load: wait 15 seconds
    } else {
      return 5; // Light load: wait 5 seconds
    }
  }

  /**
   * Get the reason for rejection
   */
  private getRejectionReason(): string {
    const heapUsed = process.memoryUsage().heapUsed;
    const heapTotal = process.memoryUsage().heapTotal;
    const memoryPressure = heapUsed / heapTotal;

    if (memoryPressure > this.MEMORY_THRESHOLD) {
      return 'High memory pressure';
    }

    if (this.currentRequests >= this.maxConcurrentRequests) {
      return 'Maximum concurrent requests reached';
    }

    return 'System overloaded';
  }

  /**
   * Start monitoring system health
   */
  private startHealthMonitoring(): void {
    setInterval(() => {
      const heapUsed = process.memoryUsage().heapUsed;
      const heapTotal = process.memoryUsage().heapTotal;
      const memoryPressure = heapUsed / heapTotal;

      // Update overload status
      this.isOverloaded = 
        memoryPressure > this.MEMORY_THRESHOLD ||
        this.currentRequests >= this.maxConcurrentRequests * 0.95;

      // Log warnings
      if (memoryPressure > 0.7) {
        console.warn(`⚠️ Memory pressure: ${(memoryPressure * 100).toFixed(2)}%`);
      }

      if (this.currentRequests > this.maxConcurrentRequests * 0.8) {
        console.warn(`⚠️ High concurrent requests: ${this.currentRequests}/${this.maxConcurrentRequests}`);
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Configure backpressure thresholds
   */
  public configure(options: {
    maxConcurrentRequests?: number;
    maxQueueDepth?: number;
    memoryThreshold?: number;
  }): void {
    if (options.maxConcurrentRequests) {
      this.maxConcurrentRequests = options.maxConcurrentRequests;
    }
    if (options.maxQueueDepth) {
      this.maxQueueDepth = options.maxQueueDepth;
    }
    if (options.memoryThreshold) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _ = options.memoryThreshold; // Reserved for future use
    }
  }

  /**
   * Get current system load statistics
   */
  public getStats(): {
    currentRequests: number;
    maxConcurrentRequests: number;
    queueDepth: number;
    isOverloaded: boolean;
    memoryPressure: number;
  } {
    const heapUsed = process.memoryUsage().heapUsed;
    const heapTotal = process.memoryUsage().heapTotal;
    
    return {
      currentRequests: this.currentRequests,
      maxConcurrentRequests: this.maxConcurrentRequests,
      queueDepth: this.queueDepth,
      isOverloaded: this.isOverloaded,
      memoryPressure: heapUsed / heapTotal,
    };
  }
}
