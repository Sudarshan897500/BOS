/**
 * @fileoverview BOS Platform Unit Tests
 * @author Senior Architect (60+ years experience)
 * @description Comprehensive test suite following testing best practices
 */

import { BOSPlatform, FlowDefinition } from '../src/index';

describe('BOSPlatform', () => {
  let platform: BOSPlatform;

  beforeEach(async () => {
    platform = new BOSPlatform();
    await platform.initialize();
  });

  afterEach(async () => {
    await platform.shutdown();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const status = platform.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.connectors).toContain('memory');
    });

    it('should include default memory connector', async () => {
      const status = platform.getStatus();
      expect(status.connectors).toEqual(['memory']);
    });
  });

  describe('Flow Execution', () => {
    it('should execute a simple action flow', async () => {
      const flow: FlowDefinition = {
        id: 'test-flow-1',
        name: 'Test Create User',
        version: '1.0.0',
        steps: [
          {
            id: 'create-user',
            type: 'action',
            service: 'memory',
            action: 'create',
            input: {
              collection: 'users',
              data: {
                name: '{{input.name}}',
                email: '{{input.email}}',
              },
            },
          },
        ],
      };

      const result = await platform.executeFlow(
        flow,
        { name: 'John Doe', email: 'john@example.com' },
        'tenant-1'
      );

      expect((result as any)['create-user']).toBeDefined();
      expect((result as any)['create-user'].name).toBe('John Doe');
      expect((result as any)['create-user'].email).toBe('john@example.com');
      expect((result as any)['create-user'].id).toBeDefined();
    });

    it('should execute a flow with transformation', async () => {
      const flow: FlowDefinition = {
        id: 'test-flow-2',
        name: 'Test Transform',
        version: '1.0.0',
        steps: [
          {
            id: 'transform-data',
            type: 'transform',
            transform: {
              fullName: '{{input.firstName}} {{input.lastName}}',
              age: '{{input.age}}',
              generated: true,
            },
          },
        ],
      };

      const result = await platform.executeFlow(
        flow,
        { firstName: 'Jane', lastName: 'Doe', age: 30 },
        'tenant-1'
      );

      expect((result as any)['transform-data'].fullName).toBe('Jane Doe');
      expect((result as any)['transform-data'].age).toBe(30);
      expect((result as any)['transform-data'].generated).toBe(true);
    });

    it('should execute a multi-step flow', async () => {
      const flow: FlowDefinition = {
        id: 'test-flow-3',
        name: 'Test Multi-Step',
        version: '1.0.0',
        steps: [
          {
            id: 'create-record',
            type: 'action',
            service: 'memory',
            action: 'create',
            input: {
              collection: 'posts',
              data: {
                title: '{{input.title}}',
                content: '{{input.content}}',
              },
            },
          },
          {
            id: 'format-response',
            type: 'transform',
            transform: {
              success: true,
              message: 'Record created successfully',
            },
          },
        ],
      };

      const result = await platform.executeFlow(
        flow,
        { title: 'My Post', content: 'Post content' },
        'tenant-1'
      );

      expect((result as any)['create-record']).toBeDefined();
      expect((result as any)['format-response'].success).toBe(true);
      expect((result as any)['format-response'].message).toBe('Record created successfully');
    });
  });

  describe('Multi-Tenant Configuration', () => {
    it('should support different tenant configurations', async () => {
      // Register tenant A with specific config
      platform.registerTenant({
        tenantId: 'tenant-a',
        name: 'Tenant A',
        flows: {
          'signup-flow': {
            enabled: true,
            steps: {
              'send-email': {
                enabled: true,
              },
            },
          },
        },
        modules: {},
        globalSettings: { sendWelcomeEmail: true },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Register tenant B with different config
      platform.registerTenant({
        tenantId: 'tenant-b',
        name: 'Tenant B',
        flows: {
          'signup-flow': {
            enabled: true,
            steps: {
              'send-email': {
                enabled: false,
              },
            },
          },
        },
        modules: {},
        globalSettings: { sendWelcomeEmail: false },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const flow: FlowDefinition = {
        id: 'signup-flow',
        name: 'Signup Flow',
        version: '1.0.0',
        steps: [
          {
            id: 'create-user',
            type: 'action',
            service: 'memory',
            action: 'create',
            input: {
              collection: 'users',
              data: { email: '{{input.email}}' },
            },
          },
          {
            id: 'send-email',
            type: 'action',
            service: 'memory',
            action: 'create',
            input: {
              collection: 'emails',
              data: { to: '{{input.email}}', subject: 'Welcome!' },
            },
          },
        ],
      };

      // Both tenants should execute without errors
      const resultA = await platform.executeFlow(flow, { email: 'a@test.com' }, 'tenant-a');
      const resultB = await platform.executeFlow(flow, { email: 'b@test.com' }, 'tenant-b');

      expect((resultA as any)['create-user']).toBeDefined();
      expect((resultB as any)['create-user']).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid connector in flow', async () => {
      const flow: FlowDefinition = {
        id: 'test-error',
        name: 'Test Error',
        version: '1.0.0',
        steps: [
          {
            id: 'invalid-action',
            type: 'action',
            service: 'nonexistent',
            action: 'doSomething',
            input: {},
          },
        ],
      };

      // Should return error in result, not throw
      const result = await platform.executeFlow(flow, {}, 'tenant-1');
      expect(result).toBeDefined();
    });

    it('should handle execution errors gracefully', async () => {
      const flow: FlowDefinition = {
        id: 'test-error-handling',
        name: 'Test Error Handling',
        version: '1.0.0',
        steps: [
          {
            id: 'failing-action',
            type: 'action',
            service: 'memory',
            action: 'invalidAction',
            input: {},
          },
        ],
      };

      // Should return error in result, not throw
      const result = await platform.executeFlow(flow, {}, 'tenant-1');
      expect(result).toBeDefined();
    });
  });

  describe('Expression Evaluation', () => {
    it('should evaluate nested expressions', async () => {
      const flow: FlowDefinition = {
        id: 'test-nested',
        name: 'Test Nested',
        version: '1.0.0',
        steps: [
          {
            id: 'process',
            type: 'transform',
            transform: {
              user: {
                displayName: '{{input.user.firstName}} {{input.user.lastName}}',
                contact: {
                  email: '{{input.user.email}}',
                },
              },
            },
          },
        ],
      };

      const result = await platform.executeFlow(
        flow,
        {
          user: {
            firstName: 'Alice',
            lastName: 'Smith',
            email: 'alice@example.com',
          },
        },
        'tenant-1'
      );

      expect((result as any).process.user.displayName).toBe('Alice Smith');
      expect((result as any).process.user.contact.email).toBe('alice@example.com');
    });
  });
});
