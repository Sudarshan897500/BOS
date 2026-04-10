import mongoose from 'mongoose';

/**
 * Transaction Manager - Handles multi-document and cross-database transactions
 * Ensures ACID compliance for critical operations
 */
export class TransactionManager {
  /**
   * Execute a function within a MongoDB transaction session
   * Automatically commits on success, rolls back on failure
   */
  public async executeInTransaction<T>(
    fn: (session: mongoose.ClientSession) => Promise<T>
  ): Promise<T> {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      const result = await fn(session);
      
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Execute multiple operations with retry logic for transient failures
   */
  public async executeWithRetry<T>(
    fn: (session: mongoose.ClientSession) => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeInTransaction(fn);
      } catch (error) {
        lastError = error as Error;
        
        // Only retry on transient errors (e.g., TransientTransactionError)
        if (this.isTransientError(error) && attempt < maxRetries) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
          continue;
        }
        
        throw error;
      }
    }
    
    throw lastError || new Error('Transaction failed after all retries');
  }

  /**
   * Check if an error is transient and can be retried
   */
  private isTransientError(error: any): boolean {
    const errorCode = error.codeName || error.code;
    const transientCodes = [
      'TransientTransactionError',
      'UnknownReplWriteConcern',
      'UnsatisfiableWriteConcern',
      43, // StaleConfig
      6, // HostUnreachable
      7, // HostNotFound
      89, // NetworkTimeout
      91, // ShutdownInProgress
      189, // PrimarySteppedDown
      9001, // SocketException
      10107, // NotPrimary
      11600, // InterruptedAtShutdown
      11602, // InterruptedDueToReplStateChange
      13435, // NotPrimaryNoSecondaryOk
      13436, // NotPrimaryOrSecondary
      63, // StaleShardVersion
    ];
    
    return transientCodes.includes(errorCode);
  }
}
