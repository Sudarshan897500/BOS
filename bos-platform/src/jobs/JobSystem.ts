/**
 * Background Jobs System - Phase 8
 * 
 * Queue-based async processing with workers.
 * Supports priorities, retries, and delayed execution.
 */

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'delayed';

export interface Job<T = any> {
  id: string;
  type: string;
  tenantId: string;
  payload: T;
  status: JobStatus;
  priority: number;        // Higher = more urgent (1-10)
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  processedAt?: number;
  delayUntil?: number;     // For delayed jobs
  error?: string;
}

export interface JobHandler<T = any> {
  (job: Job<T>): Promise<void>;
}

export interface JobStore {
  enqueue(job: Job): Promise<void>;
  dequeue(type: string, maxPriority?: number): Promise<Job | null>;
  complete(id: string): Promise<void>;
  fail(id: string, error: string): Promise<void>;
  findById(id: string): Promise<Job | null>;
  getPendingCount(type: string): Promise<number>;
}

/**
 * In-memory job store for demo purposes.
 * In production, use Redis/RabbitMQ/Database.
 */
export class InMemoryJobStore implements JobStore {
  private queue: Map<string, Job[]> = new Map(); // type -> jobs
  private completed: Map<string, Job> = new Map();

  async enqueue(job: Job): Promise<void> {
    const typeQueue = this.queue.get(job.type) || [];
    typeQueue.push(job);
    // Sort by priority (desc) then createdAt (asc)
    typeQueue.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.createdAt - b.createdAt;
    });
    this.queue.set(job.type, typeQueue);
  }

  async dequeue(type: string): Promise<Job | null> {
    const typeQueue = this.queue.get(type) || [];
    
    // Find first eligible job (not delayed)
    const now = Date.now();
    const eligibleIndex = typeQueue.findIndex(job => {
      if (job.status !== 'pending' && job.status !== 'delayed') return false;
      if (job.delayUntil && job.delayUntil > now) return false;
      return true;
    });

    if (eligibleIndex === -1) return null;

    const job = typeQueue[eligibleIndex];
    job.status = 'processing';
    typeQueue.splice(eligibleIndex, 1);
    this.queue.set(type, typeQueue);

    return job;
  }

  async complete(id: string): Promise<void> {
    // Move to completed store
    const job = await this.findById(id);
    if (job) {
      job.status = 'completed';
      job.processedAt = Date.now();
      this.completed.set(id, job);
      
      // Remove from queue if still there
      const typeQueue = this.queue.get(job.type) || [];
      const idx = typeQueue.findIndex(j => j.id === id);
      if (idx !== -1) typeQueue.splice(idx, 1);
      this.queue.set(job.type, typeQueue);
    }
  }

  async fail(id: string, error: string): Promise<void> {
    const job = await this.findById(id);
    if (job) {
      job.error = error;
      if (job.attempts < job.maxAttempts) {
        job.status = 'pending'; // Retry
        job.attempts++;
        await this.enqueue(job);
      } else {
        job.status = 'failed';
        this.completed.set(id, job);
        
        // Remove from queue
        const typeQueue = this.queue.get(job.type) || [];
        const idx = typeQueue.findIndex(j => j.id === id);
        if (idx !== -1) typeQueue.splice(idx, 1);
        this.queue.set(job.type, typeQueue);
      }
    }
  }

  async findById(id: string): Promise<Job | null> {
    // Search in queues
    for (const [type, jobs] of this.queue.entries()) {
      const job = jobs.find(j => j.id === id);
      if (job) return job;
    }
    // Search in completed
    return this.completed.get(id) || null;
  }

  async getPendingCount(type: string): Promise<number> {
    const typeQueue = this.queue.get(type) || [];
    return typeQueue.filter(j => j.status === 'pending' || j.status === 'delayed').length;
  }
}

export interface WorkerOptions {
  concurrency?: number;
  pollIntervalMs?: number;
}

export class Worker {
  private store: JobStore;
  private handlers: Map<string, JobHandler> = new Map();
  private running = false;
  private activeJobs: Set<string> = new Set();
  private concurrency: number;
  private pollIntervalMs: number;

  constructor(store: JobStore, options: WorkerOptions = {}) {
    this.store = store;
    this.concurrency = options.concurrency || 5;
    this.pollIntervalMs = options.pollIntervalMs || 1000;
  }

  /**
   * Register a handler for a job type
   */
  register(type: string, handler: JobHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * Start processing jobs
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.processLoop();
  }

  /**
   * Stop processing jobs
   */
  stop(): void {
    this.running = false;
  }

  private async processLoop(): Promise<void> {
    while (this.running) {
      // Check concurrency limit
      if (this.activeJobs.size >= this.concurrency) {
        await this.sleep(this.pollIntervalMs);
        continue;
      }

      // Process each registered job type
      const promises: Promise<void>[] = [];
      for (const [type] of this.handlers.entries()) {
        if (this.activeJobs.size >= this.concurrency) break;
        
        promises.push(this.processOne(type));
      }

      await Promise.all(promises);
      
      if (promises.length === 0) {
        await this.sleep(this.pollIntervalMs);
      }
    }
  }

  private async processOne(type: string): Promise<void> {
    const job = await this.store.dequeue(type);
    if (!job) return;

    this.activeJobs.add(job.id);

    try {
      const handler = this.handlers.get(job.type);
      if (!handler) {
        throw new Error(`No handler registered for job type: ${job.type}`);
      }

      await handler(job);
      await this.store.complete(job.id);
    } catch (error: any) {
      await this.store.fail(job.id, error.message);
    } finally {
      this.activeJobs.delete(job.id);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Job Client - Enqueue jobs
 */
export class JobClient {
  private store: JobStore;

  constructor(store: JobStore) {
    this.store = store;
  }

  /**
   * Enqueue a job
   */
  async enqueue<T>(type: string, payload: T, options: {
    tenantId: string;
    priority?: number;
    delayMs?: number;
    maxAttempts?: number;
  }): Promise<string> {
    const job: Job<T> = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      tenantId: options.tenantId,
      payload,
      status: options.delayMs ? 'delayed' : 'pending',
      priority: options.priority || 5,
      attempts: 0,
      maxAttempts: options.maxAttempts || 3,
      createdAt: Date.now(),
      delayUntil: options.delayMs ? Date.now() + options.delayMs : undefined
    };

    await this.store.enqueue(job);
    return job.id;
  }

  /**
   * Get pending count for a job type
   */
  async getPendingCount(type: string): Promise<number> {
    return this.store.getPendingCount(type);
  }
}
