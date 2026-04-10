/**
 * @fileoverview Helper Service - Common utility functions
 * @description Stateless helper for formatting, extraction, and common tasks
 */

import { Service } from 'typedi';
import { Request } from 'express';

@Service()
export default class HelperService {
  /**
   * Extract token from Authorization header
   */
  public getTokenFromHeader(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }

  /**
   * Decode hashed ID (placeholder for actual hashing logic)
   */
  public decodeHash(hash: string): number {
    // In production, use proper decoding/hash verification
    const decoded = parseInt(hash, 10);
    if (isNaN(decoded)) {
      throw new Error('Invalid hash format');
    }
    return decoded;
  }

  /**
   * Encode ID to hash (placeholder for actual hashing logic)
   */
  public encodeHash(id: number): string {
    // In production, use proper encoding/hashing
    return id.toString();
  }

  /**
   * Convert time units to milliseconds
   */
  public convertToMilliseconds(value: number, unit: string): number {
    const multipliers: Record<string, number> = {
      ms: 1,
      s: 1000,
      m: 60000,
      h: 3600000,
      d: 86400000,
    };
    return value * (multipliers[unit] || 1);
  }

  /**
   * Generate unique trace ID
   */
  public generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Deep clone an object
   */
  public deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Check if value is empty (null, undefined, empty string/array/object)
   */
  public isEmpty(value: any): boolean {
    if (value === null || value === undefined) {
      return true;
    }
    if (typeof value === 'string' || Array.isArray(value)) {
      return value.length === 0;
    }
    if (typeof value === 'object') {
      return Object.keys(value).length === 0;
    }
    return false;
  }

  /**
   * Sanitize string to prevent injection attacks
   */
  public sanitizeString(str: string): string {
    return str.replace(/[<>\"'&]/g, (char) => {
      const replacements: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;',
      };
      return replacements[char] || char;
    });
  }
}
