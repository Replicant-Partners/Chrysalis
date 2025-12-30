/**
 * Simple V2 Example - Basic morphing with experience sync
 */

import { ConverterV2 } from '../src/converter/ConverterV2';
import { AdapterRegistry } from '../src/core/AdapterRegistry';
import { MCPAdapter } from '../src/adapters/MCPAdapter';
import { MultiAgentAdapter } from '../src/adapters/MultiAgentAdapter';
import { OrchestratedAdapter } from '../src/adapters/OrchestratedAdapter';
import type { UniversalAgentV2 } from '../src/core/UniversalAgentV2';
import * as crypto from 'crypto';

// Create registry and register v2 adapters
const registry = new AdapterRegistry();
registry.register(new MCPAdapter(), ['mcp']);
registry.register(new MultiAgentAdapter(), ['multi']);
registry.register(new OrchestratedAdapter(), ['orchestrated']);

// Simple universal agent
const simpleAgent: UniversalAgentV2 = {
  schema_version: '2.0.0',
  
  identity: {
    id: crypto.randomUUID(),
    name: 'Simple Researcher',
    designation: 'Researcher',
    bio: 'A simple research agent',
    fingerprint: '',
    created: new Date().toISOString(),
    version: '1.0.0'
  },
  
  personality: {
    core_traits: ['analytical'],
    values: ['accuracy'],
    quirks: []
  },
  
  communication: {
    style: {
      all: ['Professional']
    }
  },
  
  capabilities: {
    primary: ['research'],
    secondary: [],
    domains: [],
    tools: []
  },
  
  knowledge: {
    facts: [],
    topics: [],
    expertise: []
  },
  
  memory: {
    type: 'hybrid',
    provider: 'local',
    settings: {}
  },
  
  beliefs: {
    who: [],
    what: [],
    why: [],
    how: []
  },
  
  instances: {
    active: [],
    terminated: []
  },
  
  experience_sync: {
    enabled: true,
    default_protocol: 'streaming',
    merge_strategy: {
      conflict_resolution: 'latest_wins',
      memory_deduplication: true,
      skill_aggregation: 'max',
      knowledge_verification_threshold: 0.7
    }
  },
  
  protocols: {
    mcp: {
      enabled: true,
      role: 'client',
      servers: [],
      tools: []
    }
  },
  
  execution: {
    llm: {
      provider: 'openai',
      model: 'gpt-4',
      temperature: 0.7,
      max_tokens: 2000,
      parameters: {}
    },
    runtime: {
      timeout: 300,
      max_iterations: 20,
      error_handling: 'retry'
    }
  },
  
  metadata: {
    version: '1.0.0',
    schema_version: '2.0.0',
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  }
};

async function main() {
  console.log('Universal Agent Morphing v2 - Simple Example\n');
  
  const converter = new ConverterV2();
  const mcpAdapter = registry.get('mcp') as any;
  
  // Morph to MCP
  const result = await converter.morph(
    simpleAgent,
    'mcp',
    mcpAdapter,
    { syncProtocol: 'streaming' }
  );
  
  console.log('✓ Morphed to MCP!');
  console.log(`  Instance ID: ${result.instance_id}`);
  console.log(`  Sync protocol: ${result.syncChannel.protocol}`);
}

if (require.main === module) {
  main().catch(console.error);
}

export { simpleAgent };
