import crypto from 'crypto';

/**
 * Timing-Safe Authentication - Prevents timing attacks on secret comparisons
 * Uses constant-time comparison algorithms
 */
export class TimingSafeAuth {
  /**
   * Compare two secrets in constant time to prevent timing attacks
   * @param a - First secret
   * @param b - Second secret
   */
  public static safeCompare(a: string, b: string): boolean {
    // If lengths differ, still perform comparison to maintain constant time
    if (a.length !== b.length) {
      // Create dummy buffers of same length for comparison
      const dummyA = crypto.randomBytes(a.length);
      const dummyB = crypto.randomBytes(b.length);
      crypto.timingSafeEqual(dummyA, dummyB);
      return false;
    }

    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);

    return crypto.timingSafeEqual(bufferA, bufferB);
  }

  /**
   * Generate a secure random token
   * @param length - Length of the token in bytes (default: 32)
   */
  public static generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash a secret using SHA-256
   * @param secret - The secret to hash
   */
  public static hashSecret(secret: string): string {
    return crypto.createHash('sha256').update(secret).digest('hex');
  }

  /**
   * Verify an API key against a stored hash
   * @param apiKey - The provided API key
   * @param storedHash - The stored hash
   */
  public static verifyApiKey(apiKey: string, storedHash: string): boolean {
    const providedHash = this.hashSecret(apiKey);
    return this.safeCompare(providedHash, storedHash);
  }

  /**
   * Generate HMAC signature for request integrity
   * @param payload - The payload to sign
   * @param secret - The signing secret
   */
  public static generateHMAC(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Verify HMAC signature
   * @param payload - The original payload
   * @param signature - The provided signature
   * @param secret - The signing secret
   */
  public static verifyHMAC(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateHMAC(payload, secret);
    return this.safeCompare(expectedSignature, signature);
  }
}
