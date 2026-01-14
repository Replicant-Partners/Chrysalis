/**
 * Pre-defined Agent Schemas
 * 
 * Schema definitions for USA, LMOS, and MCP agent formats.
 * 
 * @module bridge/validation/agent-schemas
 */

import { S } from './schema-builder';

/**
 * USA Agent metadata schema
 */
const USAMetadataSchema = S.object({
  name: S.string({ minLength: 1 }),
  version: S.optional(S.string()),
  description: S.optional(S.string()),
  author: S.optional(S.string()),
  tags: S.optional(S.array(S.string())),
}, { requiredProperties: ['name'] });

/**
 * USA Agent identity schema
 */
const USAIdentitySchema = S.object({
  role: S.string({ minLength: 1 }),
  goal: S.string({ minLength: 1 }),
  backstory: S.optional(S.string()),
  personality_traits: S.optional(S.record(S.union([S.string(), S.number(), S.boolean()]))),
  constraints: S.optional(S.array(S.string())),
}, { requiredProperties: ['role', 'goal'] });

/**
 * USA Agent tool schema
 */
const USAToolSchema = S.object({
  name: S.string({ minLength: 1 }),
  protocol: S.optional(S.string()),
  config: S.optional(S.record(S.any())),
  description: S.optional(S.string()),
}, { requiredProperties: ['name'] });

/**
 * USA Agent LLM schema
 */
const USALLMSchema = S.object({
  provider: S.string({ minLength: 1 }),
  model: S.string({ minLength: 1 }),
  temperature: S.optional(S.number({ minimum: 0, maximum: 2 })),
  max_tokens: S.optional(S.integer({ minimum: 1 })),
}, { requiredProperties: ['provider', 'model'] });

/**
 * Complete USA Agent schema
 */
export const USAAgentSchema = S.object({
  apiVersion: S.string({ pattern: /^usa\/v\d+/ }),
  kind: S.enum(['Agent'] as const),
  metadata: USAMetadataSchema,
  identity: USAIdentitySchema,
  capabilities: S.object({
    tools: S.optional(S.array(USAToolSchema)),
    reasoning: S.optional(S.object({
      strategy: S.string(),
      max_iterations: S.optional(S.integer({ minimum: 1 })),
      allow_backtracking: S.optional(S.boolean()),
    })),
    memory: S.optional(S.object({
      architecture: S.string(),
      working: S.optional(S.object({
        enabled: S.boolean(),
        max_tokens: S.optional(S.integer({ minimum: 1 })),
      })),
      episodic: S.optional(S.object({
        enabled: S.boolean(),
        storage: S.optional(S.string()),
      })),
      semantic: S.optional(S.object({
        enabled: S.boolean(),
        storage: S.optional(S.string()),
      })),
      procedural: S.optional(S.object({
        enabled: S.boolean(),
      })),
      core: S.optional(S.object({
        enabled: S.boolean(),
        blocks: S.optional(S.array(S.object({
          name: S.string(),
          content: S.string(),
        }))),
      })),
    })),
  }),
  execution: S.object({
    llm: USALLMSchema,
    runtime: S.optional(S.object({
      timeout: S.optional(S.integer({ minimum: 1 })),
      max_iterations: S.optional(S.integer({ minimum: 1 })),
    })),
  }, { requiredProperties: ['llm'] }),
  protocols: S.optional(S.object({
    mcp: S.optional(S.object({
      enabled: S.boolean(),
      role: S.optional(S.string()),
    })),
    a2a: S.optional(S.object({
      enabled: S.boolean(),
      agent_protocol: S.optional(S.object({
        enabled: S.boolean(),
        endpoint: S.optional(S.string({ format: 'uri' })),
      })),
    })),
    agent_protocol: S.optional(S.object({
      enabled: S.boolean(),
      endpoint: S.optional(S.string({ format: 'uri' })),
    })),
  })),
}, { requiredProperties: ['apiVersion', 'kind', 'metadata', 'identity', 'execution'] });

/**
 * LMOS Agent schema (W3C WoT Thing Description based)
 */
export const LMOSAgentSchema = S.object({
  '@context': S.union([
    S.string(),
    S.array(S.union([S.string(), S.record(S.any())])),
    S.record(S.any()),
  ]),
  '@type': S.optional(S.union([S.string(), S.array(S.string())])),
  id: S.string({ minLength: 1 }),
  title: S.string({ minLength: 1 }),
  description: S.optional(S.string()),
  version: S.optional(S.object({
    instance: S.optional(S.string()),
    model: S.optional(S.string()),
  })),
  securityDefinitions: S.optional(S.record(S.object({
    scheme: S.string(),
    description: S.optional(S.string()),
    pubKeyPem: S.optional(S.string()),
  }))),
  security: S.optional(S.union([S.string(), S.array(S.string())])),
  properties: S.optional(S.record(S.object({
    type: S.optional(S.string()),
    title: S.optional(S.string()),
    description: S.optional(S.string()),
    observable: S.optional(S.boolean()),
  }))),
  actions: S.optional(S.record(S.object({
    title: S.optional(S.string()),
    description: S.optional(S.string()),
    input: S.optional(S.record(S.any())),
    output: S.optional(S.record(S.any())),
    forms: S.optional(S.array(S.object({
      href: S.string(),
      contentType: S.optional(S.string()),
    }))),
  }))),
  events: S.optional(S.record(S.object({
    title: S.optional(S.string()),
    description: S.optional(S.string()),
    data: S.optional(S.record(S.any())),
  }))),
  forms: S.optional(S.array(S.object({
    href: S.string(),
    contentType: S.optional(S.string()),
    subprotocol: S.optional(S.string()),
    op: S.optional(S.union([S.string(), S.array(S.string())])),
  }))),
  'lmos:agentClass': S.optional(S.string()),
  'lmos:capabilities': S.optional(S.array(S.string())),
  'lmos:llmConfig': S.optional(S.object({
    provider: S.string(),
    model: S.string(),
    temperature: S.optional(S.number()),
    maxTokens: S.optional(S.integer()),
    systemPrompt: S.optional(S.string()),
  })),
  'lmos:memory': S.optional(S.object({
    type: S.string(),
    vectorStore: S.optional(S.object({
      provider: S.string(),
      config: S.optional(S.record(S.any())),
    })),
    contextWindow: S.optional(S.integer()),
  })),
  'lmos:protocols': S.optional(S.object({
    mcp: S.optional(S.boolean()),
    a2a: S.optional(S.boolean()),
    http: S.optional(S.boolean()),
    websocket: S.optional(S.boolean()),
  })),
}, { requiredProperties: ['@context', 'id', 'title'] });

/**
 * MCP Agent schema
 */
export const MCPAgentSchema = S.object({
  name: S.string({ minLength: 1 }),
  version: S.string(),
  description: S.optional(S.string()),
  tools: S.optional(S.array(S.object({
    name: S.string({ minLength: 1 }),
    description: S.string(),
    inputSchema: S.record(S.any()),
  }))),
  resources: S.optional(S.array(S.object({
    uri: S.string(),
    name: S.string(),
    description: S.optional(S.string()),
    mimeType: S.optional(S.string()),
  }))),
  prompts: S.optional(S.array(S.object({
    name: S.string(),
    description: S.optional(S.string()),
    arguments: S.optional(S.array(S.object({
      name: S.string(),
      description: S.optional(S.string()),
      required: S.optional(S.boolean()),
    }))),
  }))),
}, { requiredProperties: ['name', 'version'] });
