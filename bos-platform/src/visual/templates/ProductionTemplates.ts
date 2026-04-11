/**
 * Pre-built Visual Flow Templates
 * Production-grade patterns for common business scenarios
 */

import { VisualFlowDefinition, NodeType } from '../runtime/VisualRuntimeEngine';

// ============================================================================
// TEMPLATE 1: Money Transfer (Banking/Payment)
// Features: Idempotency, Transactions, Retry, Circuit Breaker, Audit
// ============================================================================

export const MoneyTransferTemplate: VisualFlowDefinition = {
  id: 'template_money_transfer',
  name: 'Secure Money Transfer',
  version: '1.0.0',
  trigger: {
    type: 'http',
    config: { method: 'POST', path: '/api/transfers' }
  },
  variables: {
    maxDailyLimit: 10000,
    retryAttempts: 3
  },
  settings: {
    timeoutMs: 30000,
    maxRetries: 3,
    isolationLevel: 'high'
  },
  nodes: [
    {
      id: 'start',
      type: NodeType.AUTH_CHECK,
      name: 'Authenticate User',
      inputs: { requireAuth: true, roles: ['user', 'admin'] },
      outputs: ['success', 'failure'],
      nextNodes: ['rate_limit'],
      errorNode: 'error_handler',
      metadata: { position: { x: 100, y: 50 }, category: 'Security', description: 'Verify user identity' }
    },
    {
      id: 'rate_limit',
      type: NodeType.RATE_LIMIT,
      name: 'Rate Limit Check',
      inputs: { keyPrefix: 'transfer', requestsPerSecond: 5, windowSeconds: 60 },
      outputs: ['allowed', 'blocked'],
      nextNodes: ['idempotency_check'],
      errorNode: 'error_handler',
      metadata: { position: { x: 100, y: 150 }, category: 'Security', description: 'Prevent abuse' }
    },
    {
      id: 'idempotency_check',
      type: NodeType.CACHE_GET,
      name: 'Check Idempotency',
      inputs: { key: '{{input.idempotencyKey}}' },
      outputs: ['exists', 'not_exists'],
      nextNodes: ['transaction_start'],
      errorNode: 'error_handler',
      metadata: { position: { x: 100, y: 250 }, category: 'Reliability', description: 'Prevent duplicate transfers' }
    },
    {
      id: 'transaction_start',
      type: NodeType.TRANSACTION_START,
      name: 'Begin Transaction',
      inputs: { isolationLevel: 'serializable' },
      outputs: ['started'],
      nextNodes: ['validate_balance'],
      errorNode: 'transaction_rollback',
      metadata: { position: { x: 100, y: 350 }, category: 'Transaction', description: 'ACID transaction boundary' }
    },
    {
      id: 'validate_balance',
      type: NodeType.DB_READ,
      name: 'Check Sender Balance',
      inputs: { 
        collection: 'accounts', 
        query: { userId: '{{input.senderId}}' },
        expression: '{{output.balance >= input.amount}}'
      },
      outputs: ['sufficient', 'insufficient'],
      nextNodes: ['debit_sender'],
      errorNode: 'transaction_rollback',
      metadata: { position: { x: 100, y: 450 }, category: 'Validation', description: 'Verify sufficient funds' }
    },
    {
      id: 'debit_sender',
      type: NodeType.DB_WRITE,
      name: 'Debit Sender Account',
      inputs: { 
        collection: 'accounts',
        operation: 'decrement',
        field: 'balance',
        value: '{{input.amount}}',
        idempotencyKey: 'debit_{{input.idempotencyKey}}'
      },
      outputs: ['success'],
      nextNodes: ['credit_receiver'],
      errorNode: 'transaction_rollback',
      metadata: { position: { x: 100, y: 550 }, category: 'Transaction', description: 'Remove funds from sender' }
    },
    {
      id: 'credit_receiver',
      type: NodeType.DB_WRITE,
      name: 'Credit Receiver Account',
      inputs: { 
        collection: 'accounts',
        operation: 'increment',
        field: 'balance',
        value: '{{input.amount}}',
        idempotencyKey: 'credit_{{input.idempotencyKey}}'
      },
      outputs: ['success'],
      nextNodes: ['circuit_breaker_notify'],
      errorNode: 'transaction_rollback',
      metadata: { position: { x: 100, y: 650 }, category: 'Transaction', description: 'Add funds to receiver' }
    },
    {
      id: 'circuit_breaker_notify',
      type: NodeType.CIRCUIT_BREAKER,
      name: 'Send Notification (Circuit Protected)',
      inputs: { 
        serviceName: 'notification_service',
        fallback: { queued: true }
      },
      outputs: ['success', 'fallback'],
      nextNodes: ['transaction_commit'],
      errorNode: 'transaction_commit',
      metadata: { position: { x: 100, y: 750 }, category: 'Resilience', description: 'Notify users with fallback' }
    },
    {
      id: 'transaction_commit',
      type: NodeType.TRANSACTION_COMMIT,
      name: 'Commit Transaction',
      inputs: {},
      outputs: ['committed'],
      nextNodes: ['cache_result'],
      errorNode: 'error_handler',
      metadata: { position: { x: 100, y: 850 }, category: 'Transaction', description: 'Finalize changes' }
    },
    {
      id: 'cache_result',
      type: NodeType.CACHE_SET,
      name: 'Cache Result for Idempotency',
      inputs: { 
        key: '{{input.idempotencyKey}}', 
        value: '{{output}}',
        ttl: 3600
      },
      outputs: ['cached'],
      nextNodes: ['end'],
      metadata: { position: { x: 100, y: 950 }, category: 'Performance', description: 'Store result for replay protection' }
    },
    {
      id: 'transaction_rollback',
      type: NodeType.TRANSACTION_ROLLBACK,
      name: 'Rollback Transaction',
      inputs: {},
      outputs: ['rolled_back'],
      nextNodes: ['error_handler'],
      metadata: { position: { x: 400, y: 550 }, category: 'Transaction', description: 'Undo all changes on failure' }
    },
    {
      id: 'error_handler',
      type: NodeType.TRANSFORM,
      name: 'Format Error Response',
      inputs: { 
        template: {
          success: false,
          error: '{{error.message}}',
          code: '{{error.code}}',
          traceId: '{{traceId}}'
        }
      },
      outputs: ['formatted'],
      nextNodes: ['end'],
      metadata: { position: { x: 400, y: 850 }, category: 'Error Handling', description: 'Standardize error output' }
    },
    {
      id: 'end',
      type: NodeType.TRANSFORM,
      name: 'Return Response',
      inputs: { returnData: true },
      outputs: [],
      metadata: { position: { x: 100, y: 1050 }, category: 'End', description: 'Flow completion' }
    }
  ]
};

// ============================================================================
// TEMPLATE 2: E-commerce Order Processing
// Features: Inventory Check, Payment, Saga Pattern, Async Notifications
// ============================================================================

export const OrderProcessingTemplate: VisualFlowDefinition = {
  id: 'template_order_processing',
  name: 'E-commerce Order Flow',
  version: '1.0.0',
  trigger: {
    type: 'http',
    config: { method: 'POST', path: '/api/orders' }
  },
  variables: {},
  settings: {
    timeoutMs: 60000,
    maxRetries: 3,
    isolationLevel: 'medium'
  },
  nodes: [
    {
      id: 'start',
      type: NodeType.AUTH_CHECK,
      name: 'Verify Customer',
      inputs: { requireAuth: true },
      outputs: ['success'],
      nextNodes: ['validate_cart'],
      errorNode: 'error_response',
      metadata: { position: { x: 100, y: 50 }, category: 'Security', description: '' }
    },
    {
      id: 'validate_cart',
      type: NodeType.DB_READ,
      name: 'Validate Cart Items',
      inputs: { 
        collection: 'carts',
        query: { userId: '{{userId}}', status: 'active' }
      },
      outputs: ['valid'],
      nextNodes: ['check_inventory_parallel'],
      errorNode: 'error_response',
      metadata: { position: { x: 100, y: 150 }, category: 'Validation', description: '' }
    },
    {
      id: 'check_inventory_parallel',
      type: NodeType.PARALLEL,
      name: 'Check All Items Inventory',
      inputs: { 
        branches: ['check_item_1', 'check_item_2', 'check_item_3']
      },
      outputs: ['all_available', 'some_unavailable'],
      nextNodes: ['reserve_inventory'],
      errorNode: 'error_response',
      metadata: { position: { x: 100, y: 250 }, category: 'Performance', description: 'Parallel inventory checks' }
    },
    {
      id: 'reserve_inventory',
      type: NodeType.DB_WRITE,
      name: 'Reserve Inventory',
      inputs: { 
        collection: 'inventory',
        operation: 'reserve',
        items: '{{input.cartItems}}'
      },
      outputs: ['reserved'],
      nextNodes: ['process_payment'],
      errorNode: 'release_inventory',
      metadata: { position: { x: 100, y: 350 }, category: 'Inventory', description: '' }
    },
    {
      id: 'process_payment',
      type: NodeType.RETRY,
      name: 'Process Payment (Retry 3x)',
      inputs: { 
        maxAttempts: 3,
        backoff: 'exponential',
        delayMs: 1000
      },
      outputs: ['paid', 'failed'],
      nextNodes: ['create_order'],
      errorNode: 'release_inventory',
      metadata: { position: { x: 100, y: 450 }, category: 'Payment', description: 'Retry failed payments' }
    },
    {
      id: 'create_order',
      type: NodeType.DB_WRITE,
      name: 'Create Order Record',
      inputs: { 
        collection: 'orders',
        data: {
          userId: '{{userId}}',
          items: '{{input.cartItems}}',
          total: '{{input.total}}',
          status: 'confirmed'
        }
      },
      outputs: ['created'],
      nextNodes: ['async_notifications'],
      errorNode: 'refund_payment',
      metadata: { position: { x: 100, y: 550 }, category: 'Order', description: '' }
    },
    {
      id: 'async_notifications',
      type: NodeType.JOB_ENQUEUE,
      name: 'Queue Notifications (Async)',
      inputs: { 
        jobType: 'send_order_confirmation',
        payload: { orderId: '{{output.orderId}}', email: '{{user.email}}' },
        priority: 'low'
      },
      outputs: ['queued'],
      nextNodes: ['update_analytics'],
      metadata: { position: { x: 100, y: 650 }, category: 'Async', description: 'Non-blocking notifications' }
    },
    {
      id: 'update_analytics',
      type: NodeType.EVENT_EMIT,
      name: 'Emit Analytics Event',
      inputs: { 
        event: 'order.completed',
        data: { orderId: '{{output.orderId}}', total: '{{input.total}}' }
      },
      outputs: ['emitted'],
      nextNodes: ['end'],
      metadata: { position: { x: 100, y: 750 }, category: 'Analytics', description: '' }
    },
    {
      id: 'release_inventory',
      type: NodeType.DB_WRITE,
      name: 'Release Reserved Inventory',
      inputs: { 
        collection: 'inventory',
        operation: 'release',
        items: '{{input.cartItems}}'
      },
      outputs: ['released'],
      nextNodes: ['error_response'],
      metadata: { position: { x: 400, y: 450 }, category: 'Compensation', description: 'Saga compensation step' }
    },
    {
      id: 'refund_payment',
      type: NodeType.DB_WRITE,
      name: 'Refund Payment',
      inputs: { 
        collection: 'payments',
        operation: 'refund',
        paymentId: '{{output.paymentId}}'
      },
      outputs: ['refunded'],
      nextNodes: ['release_inventory'],
      metadata: { position: { x: 400, y: 550 }, category: 'Compensation', description: '' }
    },
    {
      id: 'error_response',
      type: NodeType.TRANSFORM,
      name: 'Format Response',
      inputs: { template: { success: '{{success}}', data: '{{output}}' } },
      outputs: [],
      nextNodes: ['end'],
      metadata: { position: { x: 400, y: 750 }, category: 'Response', description: '' }
    },
    {
      id: 'end',
      type: NodeType.TRANSFORM,
      name: 'Complete',
      inputs: {},
      outputs: [],
      metadata: { position: { x: 100, y: 850 }, category: 'End', description: '' }
    }
  ]
};

// ============================================================================
// TEMPLATE 3: Social Media Feed Generation (Instagram-scale)
// Features: Fan-out, Caching, Parallel Loading, Pagination
// ============================================================================

export const FeedGenerationTemplate: VisualFlowDefinition = {
  id: 'template_feed_generation',
  name: 'Social Media Feed',
  version: '1.0.0',
  trigger: {
    type: 'http',
    config: { method: 'GET', path: '/api/feed' }
  },
  variables: {
    pageSize: 20,
    cacheTTL: 300
  },
  settings: {
    timeoutMs: 5000,
    maxRetries: 2,
    isolationLevel: 'low'
  },
  nodes: [
    {
      id: 'cache_lookup',
      type: NodeType.CACHE_GET,
      name: 'Check Feed Cache',
      inputs: { key: 'feed:{{userId}}:{{input.cursor}}' },
      outputs: ['hit', 'miss'],
      nextNodes: ['fetch_following'],
      errorNode: 'fetch_from_db',
      metadata: { position: { x: 100, y: 50 }, category: 'Performance', description: 'Redis cache first' }
    },
    {
      id: 'fetch_following',
      type: NodeType.DB_READ,
      name: 'Get Following List',
      inputs: { 
        collection: 'follows',
        query: { followerId: '{{userId}}' },
        fields: ['followingId']
      },
      outputs: ['list'],
      nextNodes: ['parallel_fetch_posts'],
      errorNode: 'error_response',
      metadata: { position: { x: 100, y: 150 }, category: 'Social', description: '' }
    },
    {
      id: 'parallel_fetch_posts',
      type: NodeType.PARALLEL,
      name: 'Fetch Posts from All Users',
      inputs: { 
        branches: ['fetch_user_posts_1', 'fetch_user_posts_2', 'fetch_user_posts_3']
      },
      outputs: ['posts'],
      nextNodes: ['rank_and_sort'],
      errorNode: 'error_response',
      metadata: { position: { x: 100, y: 250 }, category: 'Performance', description: 'Fan-out pattern' }
    },
    {
      id: 'rank_and_sort',
      type: NodeType.TRANSFORM,
      name: 'Rank Posts by Engagement',
      inputs: { 
        operation: 'sort',
        sortBy: 'score',
        order: 'desc',
        limit: '{{variables.pageSize}}'
      },
      outputs: ['ranked'],
      nextNodes: ['enrich_with_metadata'],
      metadata: { position: { x: 100, y: 350 }, category: 'Ranking', description: 'Algorithm scoring' }
    },
    {
      id: 'enrich_with_metadata',
      type: NodeType.PARALLEL,
      name: 'Enrich Posts (Likes, Comments)',
      inputs: { 
        branches: ['fetch_likes', 'fetch_comments', 'fetch_shares']
      },
      outputs: ['enriched'],
      nextNodes: ['cache_store'],
      metadata: { position: { x: 100, y: 450 }, category: 'Enrichment', description: '' }
    },
    {
      id: 'cache_store',
      type: NodeType.CACHE_SET,
      name: 'Store in Cache',
      inputs: { 
        key: 'feed:{{userId}}:{{input.cursor}}',
        value: '{{output}}',
        ttl: '{{variables.cacheTTL}}'
      },
      outputs: ['stored'],
      nextNodes: ['return_feed'],
      metadata: { position: { x: 100, y: 550 }, category: 'Performance', description: '' }
    },
    {
      id: 'return_feed',
      type: NodeType.TRANSFORM,
      name: 'Format Response',
      inputs: { 
        template: {
          posts: '{{output.posts}}',
          nextCursor: '{{output.nextCursor}}',
          hasMore: '{{output.hasMore}}'
        }
      },
      outputs: [],
      nextNodes: ['end'],
      metadata: { position: { x: 100, y: 650 }, category: 'Response', description: '' }
    },
    {
      id: 'fetch_from_db',
      type: NodeType.DB_READ,
      name: 'Fallback to Database',
      inputs: { collection: 'feeds', query: { userId: '{{userId}}' } },
      outputs: ['data'],
      nextNodes: ['return_feed'],
      metadata: { position: { x: 400, y: 150 }, category: 'Fallback', description: 'Cache miss fallback' }
    },
    {
      id: 'error_response',
      type: NodeType.TRANSFORM,
      name: 'Error Handler',
      inputs: { template: { error: 'Failed to load feed' } },
      outputs: [],
      nextNodes: ['end'],
      metadata: { position: { x: 400, y: 450 }, category: 'Error', description: '' }
    },
    {
      id: 'end',
      type: NodeType.TRANSFORM,
      name: 'Complete',
      inputs: {},
      outputs: [],
      metadata: { position: { x: 100, y: 750 }, category: 'End', description: '' }
    }
  ]
};

// ============================================================================
// TEMPLATE 4: Multi-Tenant SaaS Onboarding (GoHighLevel-style)
// Features: Tenant Isolation, Resource Provisioning, Workflow Setup
// ============================================================================

export const TenantOnboardingTemplate: VisualFlowDefinition = {
  id: 'template_tenant_onboarding',
  name: 'SaaS Tenant Onboarding',
  version: '1.0.0',
  trigger: {
    type: 'http',
    config: { method: 'POST', path: '/api/tenants/onboard' }
  },
  variables: {},
  settings: {
    timeoutMs: 120000,
    maxRetries: 3,
    isolationLevel: 'high'
  },
  nodes: [
    {
      id: 'validate_tenant',
      type: NodeType.DB_READ,
      name: 'Check Tenant Uniqueness',
      inputs: { 
        collection: 'tenants',
        query: { subdomain: '{{input.subdomain}}' }
      },
      outputs: ['available', 'taken'],
      nextNodes: ['create_tenant'],
      errorNode: 'error_response',
      metadata: { position: { x: 100, y: 50 }, category: 'Validation', description: '' }
    },
    {
      id: 'create_tenant',
      type: NodeType.DB_WRITE,
      name: 'Create Tenant Record',
      inputs: { 
        collection: 'tenants',
        data: {
          subdomain: '{{input.subdomain}}',
          name: '{{input.name}}',
          plan: '{{input.plan}}',
          status: 'provisioning'
        }
      },
      outputs: ['created'],
      nextNodes: ['provision_database'],
      errorNode: 'error_response',
      metadata: { position: { x: 100, y: 150 }, category: 'Tenant', description: '' }
    },
    {
      id: 'provision_database',
      type: NodeType.HTTP_CALL,
      name: 'Provision Tenant Database',
      inputs: { 
        url: 'https://infra-api.internal/db/create',
        method: 'POST',
        body: { tenantId: '{{output.tenantId}}', region: '{{input.region}}' }
      },
      outputs: ['provisioned'],
      nextNodes: ['setup_workflows'],
      errorNode: 'cleanup_tenant',
      metadata: { position: { x: 100, y: 250 }, category: 'Infrastructure', description: '' }
    },
    {
      id: 'setup_workflows',
      type: NodeType.PARALLEL,
      name: 'Deploy Default Workflows',
      inputs: { 
        branches: ['deploy_workflow_1', 'deploy_workflow_2', 'deploy_workflow_3']
      },
      outputs: ['deployed'],
      nextNodes: ['create_admin_user'],
      metadata: { position: { x: 100, y: 350 }, category: 'Setup', description: '' }
    },
    {
      id: 'create_admin_user',
      type: NodeType.DB_WRITE,
      name: 'Create Admin User',
      inputs: { 
        collection: 'users',
        data: {
          tenantId: '{{output.tenantId}}',
          email: '{{input.adminEmail}}',
          role: 'admin',
          status: 'pending_activation'
        }
      },
      outputs: ['created'],
      nextNodes: ['send_welcome_email'],
      errorNode: 'cleanup_tenant',
      metadata: { position: { x: 100, y: 450 }, category: 'User', description: '' }
    },
    {
      id: 'send_welcome_email',
      type: NodeType.JOB_ENQUEUE,
      name: 'Queue Welcome Email',
      inputs: { 
        jobType: 'send_email',
        payload: {
          to: '{{input.adminEmail}}',
          template: 'welcome',
          data: { tenantName: '{{input.name}}' }
        }
      },
      outputs: ['queued'],
      nextNodes: ['activate_tenant'],
      metadata: { position: { x: 100, y: 550 }, category: 'Notification', description: '' }
    },
    {
      id: 'activate_tenant',
      type: NodeType.DB_WRITE,
      name: 'Activate Tenant',
      inputs: { 
        collection: 'tenants',
        operation: 'update',
        id: '{{output.tenantId}}',
        data: { status: 'active' }
      },
      outputs: ['activated'],
      nextNodes: ['emit_event'],
      metadata: { position: { x: 100, y: 650 }, category: 'Tenant', description: '' }
    },
    {
      id: 'emit_event',
      type: NodeType.EVENT_EMIT,
      name: 'Emit Tenant Created Event',
      inputs: { 
        event: 'tenant.created',
        data: { tenantId: '{{output.tenantId}}', plan: '{{input.plan}}' }
      },
      outputs: ['emitted'],
      nextNodes: ['return_success'],
      metadata: { position: { x: 100, y: 750 }, category: 'Event', description: '' }
    },
    {
      id: 'cleanup_tenant',
      type: NodeType.DB_WRITE,
      name: 'Cleanup on Failure',
      inputs: { 
        collection: 'tenants',
        operation: 'delete',
        id: '{{output.tenantId}}'
      },
      outputs: ['cleaned'],
      nextNodes: ['error_response'],
      metadata: { position: { x: 400, y: 450 }, category: 'Compensation', description: '' }
    },
    {
      id: 'return_success',
      type: NodeType.TRANSFORM,
      name: 'Success Response',
      inputs: { 
        template: {
          success: true,
          tenantId: '{{output.tenantId}}',
          adminEmail: '{{input.adminEmail}}',
          activationLink: 'https://{{input.subdomain}}.app.com/activate'
        }
      },
      outputs: [],
      nextNodes: ['end'],
      metadata: { position: { x: 100, y: 850 }, category: 'Response', description: '' }
    },
    {
      id: 'error_response',
      type: NodeType.TRANSFORM,
      name: 'Error Response',
      inputs: { template: { success: false, error: '{{error.message}}' } },
      outputs: [],
      nextNodes: ['end'],
      metadata: { position: { x: 400, y: 650 }, category: 'Error', description: '' }
    },
    {
      id: 'end',
      type: NodeType.TRANSFORM,
      name: 'Complete',
      inputs: {},
      outputs: [],
      metadata: { position: { x: 100, y: 950 }, category: 'End', description: '' }
    }
  ]
};
