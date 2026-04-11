/**
 * Event System - Phase 6
 * 
 * Decoupled communication layer using Pub/Sub pattern.
 * Supports wildcard subscriptions and async handling.
 */

export interface BOSEvent {
  id: string;
  type: string;          // e.g., "user.created", "order.completed"
  source: string;        // e.g., "auth-module", "api-gateway"
  tenantId: string;
  timestamp: number;
  payload: any;
  metadata?: {
    traceId?: string;
    correlationId?: string;
  };
}

export type EventHandler = (event: BOSEvent) => Promise<void> | void;

export interface EventSubscription {
  id: string;
  pattern: string;       // Supports wildcards: "user.*"
  handler: EventHandler;
  tenantId?: string;     // Optional tenant filtering
}

export class EventBus {
  private subscriptions: Map<string, Set<EventSubscription>> = new Map();

  /**
   * Subscribe to an event type.
   * Supports wildcards: "user.*" matches "user.created", "user.deleted"
   */
  subscribe(pattern: string, handler: EventHandler, tenantId?: string): string {
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const subscription: EventSubscription = {
      id: subscriptionId,
      pattern,
      handler,
      tenantId
    };

    // Normalize pattern for lookup (use base key for wildcards)
    const key = pattern.includes('*') ? pattern.split('*')[0] : pattern;
    
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
    }
    this.subscriptions.get(key)!.add(subscription);

    return subscriptionId;
  }

  /**
   * Unsubscribe by ID
   */
  unsubscribe(subscriptionId: string): boolean {
    for (const [key, subs] of this.subscriptions.entries()) {
      for (const sub of subs) {
        if (sub.id === subscriptionId) {
          subs.delete(sub);
          if (subs.size === 0) this.subscriptions.delete(key);
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Publish an event to all matching subscribers
   */
  async publish(event: Omit<BOSEvent, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent: BOSEvent = {
      ...event,
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };

    const tasks: Promise<void>[] = [];

    // 1. Exact match subscribers
    const exactSubs = this.subscriptions.get(fullEvent.type);
    if (exactSubs) {
      for (const sub of exactSubs) {
        if (this.matchesTenant(sub, fullEvent)) {
          tasks.push(this.safeExecute(sub, fullEvent));
        }
      }
    }

    // 2. Wildcard subscribers
    for (const [pattern, subs] of this.subscriptions.entries()) {
      if (pattern.includes('*')) {
        const prefix = pattern.split('*')[0];
        if (fullEvent.type.startsWith(prefix)) {
          for (const sub of subs) {
            if (this.matchesTenant(sub, fullEvent)) {
              tasks.push(this.safeExecute(sub, fullEvent));
            }
          }
        }
      }
    }

    // Fire and forget, but catch errors to prevent crash
    await Promise.allSettled(tasks);
  }

  private matchesTenant(sub: EventSubscription, event: BOSEvent): boolean {
    if (!sub.tenantId) return true; // Global listener
    return sub.tenantId === event.tenantId;
  }

  private async safeExecute(sub: EventSubscription, event: BOSEvent): Promise<void> {
    try {
      await sub.handler(event);
    } catch (error) {
      console.error(`[EventBus] Error in handler for ${sub.pattern}:`, error);
      // In prod: Send to Dead Letter Queue
    }
  }
}
