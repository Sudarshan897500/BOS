/**
 * Batch Processing Engine - Phase 9
 * 
 * Process large datasets with parallel execution,
 * chunking, and progress tracking.
 */

export interface BatchJob<T = any, R = any> {
  id: string;
  type: string;
  tenantId: string;
  items: T[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalItems: number;
  processedItems: number;
  failedItems: number;
  results?: R[];
  errors?: BatchError[];
  createdAt: number;
  completedAt?: number;
}

export interface BatchError {
  index: number;
  item: any;
  error: string;
}

export interface BatchProcessor<T = any, R = any> {
  (item: T, index: number, batchId: string): Promise<R>;
}

export interface BatchOptions {
  chunkSize?: number;
  concurrency?: number;
  stopOnError?: boolean;
}

export class BatchEngine {
  private processors: Map<string, BatchProcessor> = new Map();
  private batches: Map<string, BatchJob> = new Map();

  /**
   * Register a processor for a batch type
   */
  register(type: string, processor: BatchProcessor): void {
    this.processors.set(type, processor);
  }

  /**
   * Create and start a batch job
   */
  async createBatch<T, R>(
    type: string,
    items: T[],
    tenantId: string,
    options: BatchOptions = {}
  ): Promise<string> {
    const processor = this.processors.get(type);
    if (!processor) {
      throw new Error(`No processor registered for batch type: ${type}`);
    }

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const batch: BatchJob<T, R> = {
      id: batchId,
      type,
      tenantId,
      items,
      status: 'pending',
      totalItems: items.length,
      processedItems: 0,
      failedItems: 0,
      results: [],
      errors: [],
      createdAt: Date.now()
    };

    this.batches.set(batchId, batch);

    // Start processing asynchronously
    this.processBatch(batch, options).catch(console.error);

    return batchId;
  }

  /**
   * Process a batch with chunking and concurrency
   */
  private async processBatch<T, R>(
    batch: BatchJob<T, R>,
    options: BatchOptions
  ): Promise<void> {
    const processor = this.processors.get(batch.type);
    if (!processor) {
      batch.status = 'failed';
      return;
    }

    batch.status = 'processing';
    
    const chunkSize = options.chunkSize || 100;
    const concurrency = options.concurrency || 5;
    const stopOnError = options.stopOnError ?? false;

    const chunks: T[][] = [];
    for (let i = 0; i < batch.items.length; i += chunkSize) {
      chunks.push(batch.items.slice(i, i + chunkSize));
    }

    try {
      // Process chunks with limited concurrency
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkPromises: Promise<void>[] = [];

        for (let j = 0; j < chunk.length; j++) {
          const globalIndex = i * chunkSize + j;
          const item = chunk[j];

          const promise = Promise.resolve().then(async () => {
            try {
              const result = await processor(item, globalIndex, batch.id);
              batch.results!.push(result);
              batch.processedItems++;
            } catch (error: any) {
              batch.errors!.push({
                index: globalIndex,
                item,
                error: error.message
              });
              batch.failedItems++;

              if (stopOnError) {
                throw error;
              }
            }
          });

          chunkPromises.push(promise);

          // Limit concurrency within chunk
          if (chunkPromises.length >= concurrency) {
            await Promise.all(chunkPromises);
            chunkPromises.length = 0;
          }
        }

        // Finish remaining promises in chunk
        await Promise.all(chunkPromises);
      }

      batch.status = 'completed';
      batch.completedAt = Date.now();
    } catch (error: any) {
      batch.status = 'failed';
      batch.errors!.push({
        index: batch.processedItems,
        item: null,
        error: error.message
      });
    }
  }

  /**
   * Get batch status
   */
  getBatchStatus(batchId: string): BatchJob | null {
    return this.batches.get(batchId) || null;
  }

  /**
   * Wait for batch completion
   */
  async waitForCompletion(batchId: string, pollIntervalMs: number = 1000): Promise<BatchJob> {
    return new Promise((resolve, reject) => {
      const check = () => {
        const batch = this.batches.get(batchId);
        if (!batch) {
          reject(new Error(`Batch ${batchId} not found`));
          return;
        }

        if (batch.status === 'completed') {
          resolve(batch);
        } else if (batch.status === 'failed') {
          resolve(batch); // Return batch with errors
        } else {
          setTimeout(check, pollIntervalMs);
        }
      };
      check();
    });
  }

  /**
   * Split data into chunks (utility)
   */
  static chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Process items in parallel with limit (utility)
   */
  static async parallelMap<T, R>(
    items: T[],
    fn: (item: T, index: number) => Promise<R>,
    concurrency: number = 5
  ): Promise<R[]> {
    const results: R[] = [];
    let index = 0;

    const workers: Promise<void>[] = [];

    for (let i = 0; i < concurrency; i++) {
      workers.push(
        (async () => {
          while (index < items.length) {
            const currentIndex = index++;
            const item = items[currentIndex];
            const result = await fn(item, currentIndex);
            results[currentIndex] = result;
          }
        })()
      );
    }

    await Promise.all(workers);
    return results;
  }
}
