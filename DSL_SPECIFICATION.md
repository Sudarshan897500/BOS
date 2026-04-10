# 📜 BOS Flow DSL Specification (v1.0)

## 1. Overview
The **BOS Flow DSL** is a declarative, JSON-based language used to define API logic, workflows, and data transformations. It is designed to be:
*   **Human-Readable:** Easy to write and debug.
*   **Machine-Executable:** Directly interpreted by the Execution Engine.
*   **Composable:** Steps can be nested and reused.
*   **Tenant-Aware:** Supports dynamic configuration injection.

---

## 2. Core Structure

A Flow Definition consists of metadata and a sequence of steps.

```json
{
  "meta": {
    "id": "flow_user_signup",
    "version": "1.0.0",
    "tenantId": "{{config.tenantId}}",
    "description": "Handles user registration with optional email verification"
  },
  "steps": [
    // Step definitions go here
  ]
}
```

---

## 3. Step Types

Every step in the `steps` array must define a `type`. The engine switches behavior based on this type.

### 3.1 Action Step
Executes a specific operation (API call, DB write, Module invocation).

```json
{
  "id": "step_1",
  "type": "action",
  "service": "user.create", 
  "input": {
    "email": "{{context.request.body.email}}",
    "password": "{{context.request.body.password}}",
    "role": "member"
  },
  "outputMapping": {
    "userId": "result.id",
    "createdUser": "result"
  }
}
```

### 3.2 Condition Step
Branches execution flow based on boolean logic.

```json
{
  "id": "step_check_email",
  "type": "condition",
  "expression": "{{config.requireEmailVerification}} == true",
  "true": [
    {
      "type": "action",
      "service": "email.sendVerification",
      "input": { "to": "{{createdUser.email}}" }
    }
  ],
  "false": [
    {
      "type": "log",
      "message": "Skipping email verification per tenant config"
    }
  ]
}
```

### 3.3 Transform Step
Manipulates data without side effects (mapping, filtering, formatting).

```json
{
  "id": "step_format_response",
  "type": "transform",
  "operation": "map",
  "input": "{{createdUser}}",
  "schema": {
    "id": "$.id",
    "displayName": "$.profile.name",
    "joinedAt": "$.createdAt"
  },
  "outputMapping": {
    "finalResponse": "result"
  }
}
```

### 3.4 Loop Step
Iterates over a list of items.

```json
{
  "id": "step_process_items",
  "type": "loop",
  "collection": "{{request.body.items}}",
  "steps": [
    {
      "type": "action",
      "service": "inventory.reserve",
      "input": {
        "itemId": "{{item.id}}",
        "qty": "{{item.qty}}"
      }
    }
  ]
}
```

### 3.5 Parallel Step
Executes multiple branches concurrently.

```json
{
  "id": "step_notify_all",
  "type": "parallel",
  "branches": [
    [
      { "type": "action", "service": "email.send", "input": { ... } }
    ],
    [
      { "type": "action", "service": "sms.send", "input": { ... } }
    ],
    [
      { "type": "action", "service": "slack.notify", "input": { ... } }
    ]
  ]
}
```

### 3.6 Delay Step
Pauses execution for a specified duration (used in Workflows).

```json
{
  "id": "step_wait_24h",
  "type": "delay",
  "duration": "24h"
}
```

### 3.7 Event Step
Emits an event to the global event bus.

```json
{
  "id": "step_emit_signup",
  "type": "event",
  "eventName": "user.signup.completed",
  "payload": {
    "userId": "{{createdUser.id}}",
    "tenantId": "{{context.tenantId}}"
  }
}
```

---

## 4. Expression Syntax

The DSL uses a Mustache-like syntax `{{ }}` for dynamic value resolution.

### 4.1 Context Access
*   `{{context.request.body}}` - Incoming request data.
*   `{{context.headers}}` - Request headers.
*   `{{context.params}}` - URL parameters.

### 4.2 State Access
*   `{{previousStep.result}}` - Output of the immediate previous step.
*   `{{step_id.result}}` - Output of a specific named step.
*   `{{global.user}}` - Data stored in global execution state.

### 4.3 Config Access
*   `{{config.featureFlags.newCheckout}}` - Tenant-specific config.
*   `{{config.apiKeys.stripe}}` - Secure tenant secrets.

### 4.4 Simple Logic
Expressions support basic operators:
*   `{{value}} == "expected"`
*   `{{count}} > 10`
*   `{{enabled}} && {{isAdmin}}`

---

## 5. Error Handling

Steps can define custom error handling strategies.

```json
{
  "id": "step_payment",
  "type": "action",
  "service": "stripe.charge",
  "onError": {
    "retry": {
      "maxAttempts": 3,
      "delay": "2s"
    },
    "fallback": [
      {
        "type": "log",
        "level": "error",
        "message": "Payment failed, marking order as pending"
      }
    ]
  }
}
```

---

## 6. Complete Example: Multi-Tenant Signup Flow

This example demonstrates how one flow definition behaves differently based on tenant configuration.

```json
{
  "meta": {
    "id": "api_signup",
    "path": "/auth/signup",
    "method": "POST"
  },
  "steps": [
    {
      "id": "validate_input",
      "type": "action",
      "service": "validator.run",
      "input": {
        "schema": "user_signup_schema"
      }
    },
    {
      "id": "create_user",
      "type": "action",
      "service": "user.create",
      "input": {
        "email": "{{context.request.body.email}}",
        "password": "{{context.request.body.password}}",
        "source": "web"
      }
    },
    {
      "id": "check_tenant_config",
      "type": "condition",
      "expression": "{{config.auth.requireEmailVerification}} == true",
      "true": [
        {
          "id": "send_welcome_email",
          "type": "action",
          "service": "email.sendTemplate",
          "input": {
            "templateId": "welcome_verified",
            "to": "{{create_user.result.email}}"
          }
        },
        {
          "id": "set_pending_status",
          "type": "action",
          "service": "user.updateStatus",
          "input": {
            "userId": "{{create_user.result.id}}",
            "status": "pending_verification"
          }
        }
      ],
      "false": [
        {
          "id": "set_active_status",
          "type": "action",
          "service": "user.updateStatus",
          "input": {
            "userId": "{{create_user.result.id}}",
            "status": "active"
          }
        }
      ]
    },
    {
      "id": "emit_event",
      "type": "event",
      "eventName": "user.created",
      "payload": {
        "userId": "{{create_user.result.id}}",
        "tenantId": "{{context.tenantId}}"
      }
    },
    {
      "id": "return_response",
      "type": "transform",
      "operation": "map",
      "input": "{{create_user.result}}",
      "schema": {
        "success": true,
        "userId": "$.id",
        "message": "Account created successfully"
      }
    }
  ]
}
```

---

## 7. Extensibility

### 7.1 Custom Functions
Tenants can register custom JS functions (sandboxed) for complex transforms.

```json
{
  "type": "transform",
  "operation": "custom",
  "functionName": "calculateTax",
  "args": ["{{amount}}", "{{region}}"]
}
```

### 7.2 Sub-Flows
Flows can invoke other flows as steps.

```json
{
  "type": "subflow",
  "flowId": "internal_send_notification",
  "input": { ... }
}
```

---

## 8. Versioning & Migration

*   Flows are versioned (`v1`, `v2`).
*   API Gateway routes requests to specific versions.
*   Migration scripts can be defined as flows themselves to transform old data structures to new ones.
