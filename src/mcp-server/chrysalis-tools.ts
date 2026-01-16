/**
 * Chrysalis MCP Tools Registration
 * 
 * Pre-configured tools, resources, and prompts that expose Chrysalis
 * capabilities through the MCP server.
 * 
 * @module mcp-server/chrysalis-tools
 * @version 1.0.0
 */

/**
 * Error thrown when a stub implementation is called.
 * This replaces silent fake data returns with explicit failures.
 */
export class NotImplementedError extends Error {
  constructor(feature: string) {
    super(`${feature} is not yet implemented. This is a stub that requires integration with the actual system.`);
    this.name = 'NotImplementedError';
  }
}

import { MCPServer } from './mcp-server';
import {
  MCPToolDefinition,
  MCPResourceDefinition,
  MCPResourceTemplate,
  MCPPromptDefinition,
  CallToolResult,
  ResourceContent,
  GetPromptResult
} from './types';

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * Memory Query Tool - Query the Chrysalis memory system.
 */
export const memoryQueryTool: MCPToolDefinition = {
  name: 'memory-query',
  description: 'Query the Chrysalis memory system to retrieve relevant information based on semantic similarity',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query to find relevant memories'
      },
      limit: {
        type: 'integer',
        description: 'Maximum number of results to return',
        default: 10,
        minimum: 1,
        maximum: 100
      },
      threshold: {
        type: 'number',
        description: 'Minimum similarity threshold (0-1)',
        default: 0.7,
        minimum: 0,
        maximum: 1
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional tags to filter results'
      }
    },
    required: ['query']
  }
};

/**
 * Memory Store Tool - Store new information in the memory system.
 */
export const memoryStoreTool: MCPToolDefinition = {
  name: 'memory-store',
  description: 'Store new information in the Chrysalis memory system',
  inputSchema: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The content to store'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags to associate with this memory'
      },
      source: {
        type: 'string',
        description: 'Source of this information'
      },
      metadata: {
        type: 'object',
        description: 'Additional metadata to store'
      }
    },
    required: ['content']
  }
};

/**
 * Agent Invoke Tool - Invoke a registered agent.
 */
export const agentInvokeTool: MCPToolDefinition = {
  name: 'agent-invoke',
  description: 'Invoke a Chrysalis agent to perform a task',
  inputSchema: {
    type: 'object',
    properties: {
      agent: {
        type: 'string',
        description: 'Name or ID of the agent to invoke'
      },
      task: {
        type: 'string',
        description: 'The task or message for the agent'
      },
      context: {
        type: 'object',
        description: 'Additional context for the agent'
      },
      async: {
        type: 'boolean',
        description: 'Whether to run asynchronously',
        default: false
      }
    },
    required: ['agent', 'task']
  }
};

/**
 * Agent List Tool - List available agents.
 */
export const agentListTool: MCPToolDefinition = {
  name: 'agent-list',
  description: 'List all available Chrysalis agents and their capabilities',
  inputSchema: {
    type: 'object',
    properties: {
      filter: {
        type: 'string',
        description: 'Optional filter for agent names or capabilities'
      },
      includeCapabilities: {
        type: 'boolean',
        description: 'Include detailed capability information',
        default: true
      }
    }
  }
};

/**
 * Semantic Analyzer Tool - Analyze semantic content.
 */
export const semanticAnalyzerTool: MCPToolDefinition = {
  name: 'semantic-analyze',
  description: 'Analyze content semantically to extract entities, relationships, and structure',
  inputSchema: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'Content to analyze'
      },
      operations: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['entities', 'relationships', 'sentiment', 'topics', 'summary']
        },
        description: 'Analysis operations to perform'
      }
    },
    required: ['content', 'operations']
  }
};

/**
 * Pattern Detector Tool - Detect evolutionary patterns.
 */
export const patternDetectorTool: MCPToolDefinition = {
  name: 'pattern-detect',
  description: 'Detect evolutionary patterns in code or protocol specifications',
  inputSchema: {
    type: 'object',
    properties: {
      source: {
        type: 'string',
        description: 'Source code or specification to analyze'
      },
      patterns: {
        type: 'array',
        items: {
          type: 'string',
          enum: [
            'method-rename',
            'parameter-add',
            'parameter-remove',
            'return-type-change',
            'interface-extension',
            'deprecated-replacement'
          ]
        },
        description: 'Specific patterns to detect'
      }
    },
    required: ['source']
  }
};

/**
 * Adapter Status Tool - Get adapter synchronization status.
 */
export const adapterStatusTool: MCPToolDefinition = {
  name: 'adapter-status',
  description: 'Get the status of protocol adapters and their synchronization state',
  inputSchema: {
    type: 'object',
    properties: {
      protocol: {
        type: 'string',
        enum: ['mcp', 'a2a', 'anp', 'fipa', 'jade', 'ros2'],
        description: 'Specific protocol to check'
      },
      includeMetrics: {
        type: 'boolean',
        description: 'Include performance metrics',
        default: false
      }
    }
  }
};

// ============================================================================
// Resource Definitions
// ============================================================================

/**
 * Memory store resource.
 */
export const memoryStoreResource: MCPResourceDefinition = {
  uri: 'chrysalis://memory/store',
  name: 'Memory Store',
  description: 'The Chrysalis memory store containing all stored knowledge',
  mimeType: 'application/json'
};

/**
 * Agent registry resource.
 */
export const agentRegistryResource: MCPResourceDefinition = {
  uri: 'chrysalis://agents/registry',
  name: 'Agent Registry',
  description: 'Registry of all available Chrysalis agents',
  mimeType: 'application/json'
};

/**
 * Protocol adapters resource.
 */
export const protocolAdaptersResource: MCPResourceDefinition = {
  uri: 'chrysalis://adapters/registry',
  name: 'Protocol Adapters',
  description: 'Registry of protocol adapters and their status',
  mimeType: 'application/json'
};

/**
 * Evolutionary patterns resource.
 */
export const evolutionaryPatternsResource: MCPResourceDefinition = {
  uri: 'chrysalis://patterns/evolutionary',
  name: 'Evolutionary Patterns',
  description: 'Registry of known evolutionary patterns for AI adaptation',
  mimeType: 'application/json'
};

/**
 * System config resource.
 */
export const systemConfigResource: MCPResourceDefinition = {
  uri: 'chrysalis://config/system',
  name: 'System Configuration',
  description: 'Current Chrysalis system configuration',
  mimeType: 'application/json'
};

// ============================================================================
// Resource Templates
// ============================================================================

/**
 * Memory item template.
 */
export const memoryItemTemplate: MCPResourceTemplate = {
  uriTemplate: 'chrysalis://memory/item/{id}',
  name: 'Memory Item',
  description: 'Individual memory item by ID',
  mimeType: 'application/json'
};

/**
 * Agent profile template.
 */
export const agentProfileTemplate: MCPResourceTemplate = {
  uriTemplate: 'chrysalis://agents/{name}/profile',
  name: 'Agent Profile',
  description: 'Detailed profile for a specific agent',
  mimeType: 'application/json'
};

/**
 * Protocol adapter template.
 */
export const adapterTemplate: MCPResourceTemplate = {
  uriTemplate: 'chrysalis://adapters/{protocol}',
  name: 'Protocol Adapter',
  description: 'Status and configuration for a specific protocol adapter',
  mimeType: 'application/json'
};

// ============================================================================
// Prompt Definitions
// ============================================================================

/**
 * Memory search prompt.
 */
export const memorySearchPrompt: MCPPromptDefinition = {
  name: 'memory-search',
  description: 'Search memories with natural language query',
  arguments: [
    {
      name: 'query',
      description: 'What are you looking for?',
      required: true
    },
    {
      name: 'context',
      description: 'Additional context to narrow the search',
      required: false
    }
  ]
};

/**
 * Agent task prompt.
 */
export const agentTaskPrompt: MCPPromptDefinition = {
  name: 'agent-task',
  description: 'Create a task for a Chrysalis agent',
  arguments: [
    {
      name: 'task',
      description: 'What task should the agent perform?',
      required: true
    },
    {
      name: 'agent',
      description: 'Which agent should handle this task?',
      required: false
    }
  ]
};

/**
 * Protocol analysis prompt.
 */
export const protocolAnalysisPrompt: MCPPromptDefinition = {
  name: 'protocol-analysis',
  description: 'Analyze protocol compatibility and suggest adaptations',
  arguments: [
    {
      name: 'source_protocol',
      description: 'Source protocol (e.g., mcp, a2a, anp)',
      required: true
    },
    {
      name: 'target_protocol',
      description: 'Target protocol for translation',
      required: true
    },
    {
      name: 'use_case',
      description: 'Describe the use case for translation',
      required: false
    }
  ]
};

// ============================================================================
// Registration Helper
// ============================================================================

/**
 * Register all Chrysalis tools, resources, and prompts with an MCP server.
 */
export function registerChrysalisCapabilities(
  server: MCPServer,
  options?: {
    enableMemory?: boolean;
    enableAgents?: boolean;
    enablePatterns?: boolean;
    enableAdapters?: boolean;
  }
): void {
  const opts = {
    enableMemory: true,
    enableAgents: true,
    enablePatterns: true,
    enableAdapters: true,
    ...options
  };
  
  // Register tools
  if (opts.enableMemory) {
    server.registerTool(memoryQueryTool, createMemoryQueryHandler());
    server.registerTool(memoryStoreTool, createMemoryStoreHandler());
  }
  
  if (opts.enableAgents) {
    server.registerTool(agentInvokeTool, createAgentInvokeHandler());
    server.registerTool(agentListTool, createAgentListHandler());
  }
  
  if (opts.enablePatterns) {
    server.registerTool(semanticAnalyzerTool, createSemanticAnalyzerHandler());
    server.registerTool(patternDetectorTool, createPatternDetectorHandler());
  }
  
  if (opts.enableAdapters) {
    server.registerTool(adapterStatusTool, createAdapterStatusHandler());
  }
  
  // Register resources
  if (opts.enableMemory) {
    server.registerResource(memoryStoreResource, createMemoryStoreResourceHandler());
    server.registerResourceTemplate(memoryItemTemplate);
  }
  
  if (opts.enableAgents) {
    server.registerResource(agentRegistryResource, createAgentRegistryHandler());
    server.registerResourceTemplate(agentProfileTemplate);
  }
  
  if (opts.enablePatterns) {
    server.registerResource(evolutionaryPatternsResource, createPatternsResourceHandler());
  }
  
  if (opts.enableAdapters) {
    server.registerResource(protocolAdaptersResource, createAdaptersResourceHandler());
    server.registerResourceTemplate(adapterTemplate);
  }
  
  server.registerResource(systemConfigResource, createSystemConfigHandler());
  
  // Register prompts
  if (opts.enableMemory) {
    server.registerPrompt(memorySearchPrompt, createMemorySearchPromptHandler());
  }
  
  if (opts.enableAgents) {
    server.registerPrompt(agentTaskPrompt, createAgentTaskPromptHandler());
  }
  
  if (opts.enableAdapters) {
    server.registerPrompt(protocolAnalysisPrompt, createProtocolAnalysisPromptHandler());
  }
}

// ============================================================================
// Tool Handlers
// ============================================================================

function createMemoryQueryHandler() {
  return async (_name: string, _args: Record<string, unknown>): Promise<CallToolResult> => {
    throw new NotImplementedError('memory-query');
  };
}

function createMemoryStoreHandler() {
  return async (_name: string, _args: Record<string, unknown>): Promise<CallToolResult> => {
    throw new NotImplementedError('memory-store');
  };
}

function createAgentInvokeHandler() {
  return async (_name: string, _args: Record<string, unknown>): Promise<CallToolResult> => {
    throw new NotImplementedError('agent-invoke');
  };
}

function createAgentListHandler() {
  return async (_name: string, _args: Record<string, unknown>): Promise<CallToolResult> => {
    throw new NotImplementedError('agent-list');
  };
}

function createSemanticAnalyzerHandler() {
  return async (_name: string, _args: Record<string, unknown>): Promise<CallToolResult> => {
    throw new NotImplementedError('semantic-analyze');
  };
}

function createPatternDetectorHandler() {
  return async (_name: string, _args: Record<string, unknown>): Promise<CallToolResult> => {
    throw new NotImplementedError('pattern-detect');
  };
}

function createAdapterStatusHandler() {
  return async (_name: string, _args: Record<string, unknown>): Promise<CallToolResult> => {
    throw new NotImplementedError('adapter-status');
  };
}

// ============================================================================
// Resource Handlers
// ============================================================================

function createMemoryStoreResourceHandler() {
  return async (_uri: string): Promise<ResourceContent[]> => {
    throw new NotImplementedError('memory-store-resource');
  };
}

function createAgentRegistryHandler() {
  return async (_uri: string): Promise<ResourceContent[]> => {
    throw new NotImplementedError('agent-registry-resource');
  };
}

function createPatternsResourceHandler() {
  return async (_uri: string): Promise<ResourceContent[]> => {
    throw new NotImplementedError('patterns-resource');
  };
}

function createAdaptersResourceHandler() {
  return async (_uri: string): Promise<ResourceContent[]> => {
    throw new NotImplementedError('adapters-resource');
  };
}

function createSystemConfigHandler() {
  return async (uri: string): Promise<ResourceContent[]> => {
    return [{
      uri,
      mimeType: 'application/json',
      text: JSON.stringify({
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        features: {
          memory: true,
          agents: true,
          adapters: true,
          patterns: true
        }
      }, null, 2)
    }];
  };
}

// ============================================================================
// Prompt Handlers
// ============================================================================

function createMemorySearchPromptHandler() {
  return async (name: string, args: Record<string, string>): Promise<GetPromptResult> => {
    const query = args.query;
    const context = args.context || '';
    
    return {
      description: 'Search the memory system',
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Search the Chrysalis memory system for: "${query}"${context ? `\n\nContext: ${context}` : ''}`
        }
      }]
    };
  };
}

function createAgentTaskPromptHandler() {
  return async (name: string, args: Record<string, string>): Promise<GetPromptResult> => {
    const task = args.task;
    const agent = args.agent || 'auto-select';
    
    return {
      description: 'Create a task for an agent',
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Create a task for ${agent === 'auto-select' ? 'the most suitable agent' : `agent "${agent}"`}:\n\nTask: ${task}`
        }
      }]
    };
  };
}

function createProtocolAnalysisPromptHandler() {
  return async (name: string, args: Record<string, string>): Promise<GetPromptResult> => {
    const source = args.source_protocol;
    const target = args.target_protocol;
    const useCase = args.use_case || 'general translation';
    
    return {
      description: 'Analyze protocol compatibility',
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Analyze the compatibility between ${source.toUpperCase()} and ${target.toUpperCase()} protocols.\n\nUse case: ${useCase}\n\nProvide:\n1. Feature overlap analysis\n2. Translation fidelity estimate\n3. Recommended adapter configuration\n4. Potential issues or limitations`
        }
      }]
    };
  };
}

// ============================================================================
// Exports
// ============================================================================

export default {
  // Tools
  memoryQueryTool,
  memoryStoreTool,
  agentInvokeTool,
  agentListTool,
  semanticAnalyzerTool,
  patternDetectorTool,
  adapterStatusTool,
  
  // Resources
  memoryStoreResource,
  agentRegistryResource,
  protocolAdaptersResource,
  evolutionaryPatternsResource,
  systemConfigResource,
  
  // Templates
  memoryItemTemplate,
  agentProfileTemplate,
  adapterTemplate,
  
  // Prompts
  memorySearchPrompt,
  agentTaskPrompt,
  protocolAnalysisPrompt,
  
  // Registration
  registerChrysalisCapabilities
};
