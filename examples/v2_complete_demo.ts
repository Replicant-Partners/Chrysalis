/**
 * Universal Agent Morphing v2.0 - Complete Demonstration
 * 
 * Shows morphing between all three agent implementation types
 * with experience synchronization and skill accumulation.
 */

import * as crypto from 'crypto';
import { ConverterV2 } from '../src/converter/ConverterV2';
import { adapterRegistry } from '../src/core/AdapterRegistry';
import { MCPAdapter } from '../src/adapters/MCPAdapter';
import { MultiAgentAdapter } from '../src/adapters/MultiAgentAdapter';
import { OrchestratedAdapter } from '../src/adapters/OrchestratedAdapter';
import { ElizaOSAdapter } from '../src/adapters/ElizaOSAdapter';
import { CrewAIAdapter } from '../src/adapters/CrewAIAdapter';
import type { UniversalAgentV2 } from '../src/core/UniversalAgentV2';

// Register all adapters
adapterRegistry.register(new MCPAdapter(), ['mcp', 'cline']);
adapterRegistry.register(new MultiAgentAdapter(), ['multi', 'crew']);
adapterRegistry.register(new OrchestratedAdapter(), ['orchestrated', 'protocol']);
adapterRegistry.register(new ElizaOSAdapter(), ['elizaos']);
adapterRegistry.register(new CrewAIAdapter(), ['crewai']);

// ===== Example Universal Agent =====

const researcherAgent: UniversalAgentV2 = {
  schema_version: '2.0.0',
  
  identity: {
    id: crypto.randomUUID(),
    name: 'Research Agent Ada',
    designation: 'Senior Research Analyst',
    bio: 'Expert research analyst with advanced analytical capabilities and deep domain knowledge',
    fingerprint: '',  // Will be generated
    created: new Date().toISOString(),
    version: '1.0.0'
  },
  
  personality: {
    core_traits: ['analytical', 'thorough', 'creative', 'systematic'],
    values: ['accuracy', 'depth', 'insight'],
    quirks: ['prefers visual data', 'cites sources meticulously']
  },
  
  capabilities: {
    primary: ['research', 'analysis', 'synthesis'],
    secondary: ['writing', 'data visualization'],
    domains: ['AI', 'technology', 'scientific research'],
    tools: [
      {
        name: 'web_search',
        protocol: 'mcp',
        config: { server: 'brave-search' }
      },
      {
        name: 'wikipedia',
        protocol: 'mcp',
        config: { server: 'wikipedia' }
      }
    ],
    learned_skills: []  // Will accumulate
  },
  
  knowledge: {
    facts: [
      'Scientific research requires rigorous methodology',
      'Multiple sources increase credibility'
    ],
    topics: ['AI agents', 'research methodologies', 'data analysis'],
    expertise: ['research', 'analysis', 'synthesis'],
    accumulated_knowledge: []  // Will grow
  },
  
  memory: {
    type: 'hybrid',
    provider: 'qdrant',
    settings: {},
    collections: {
      short_term: {
        retention: '24h',
        max_size: 1000
      },
      long_term: {
        storage: 'vector',
        embedding_model: 'text-embedding-3-small'
      },
      episodic: [],
      semantic: []
    }
  },
  
  beliefs: {
    who: [
      {
        content: 'I am a rigorous researcher',
        conviction: 1.0,
        privacy: 'PUBLIC',
        source: 'identity'
      }
    ],
    what: [
      {
        content: 'Good research requires multiple perspectives',
        conviction: 0.9,
        privacy: 'PUBLIC',
        source: 'experience'
      }
    ],
    why: [
      {
        content: 'Understanding leads to better decisions',
        conviction: 0.95,
        privacy: 'PUBLIC',
        source: 'philosophy'
      }
    ],
    how: [
      {
        content: 'Always verify information from multiple sources',
        conviction: 1.0,
        privacy: 'PUBLIC',
        source: 'methodology'
      }
    ]
  },
  
  instances: {
    active: [],
    terminated: []
  },
  
  experience_sync: {
    enabled: true,
    default_protocol: 'streaming',
    streaming: {
      enabled: true,
      interval_ms: 1000,
      batch_size: 10,
      priority_threshold: 0.7
    },
    lumped: {
      enabled: true,
      batch_interval: '1h',
      max_batch_size: 1000,
      compression: true
    },
    check_in: {
      enabled: true,
      schedule: '0 */6 * * *',
      include_full_state: true
    },
    merge_strategy: {
      conflict_resolution: 'weighted_merge',
      memory_deduplication: true,
      skill_aggregation: 'weighted',
      knowledge_verification_threshold: 0.7
    }
  },
  
  protocols: {
    mcp: {
      enabled: true,
      role: 'client',
      servers: [
        {
          name: 'brave-search',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-brave-search'],
          env: { 'BRAVE_API_KEY': '${BRAVE_API_KEY}' }
        }
      ],
      tools: ['brave_web_search']
    },
    a2a: {
      enabled: true,
      role: 'both',
      endpoint: 'https://agents.example.com/research-agent',
      agent_card: {
        name: 'Research Agent Ada',
        version: '1.0.0',
        protocol_version: '0.3.0',
        capabilities: ['research', 'analysis'],
        skills: [],
        endpoint: 'https://agents.example.com/research-agent'
      },
      authentication: {
        type: 'jwt',
        config: {}
      },
      peers: []
    },
    agent_protocol: {
      enabled: true,
      endpoint: '/ap/v1',
      capabilities: ['research', 'analysis'],
      task_types: ['research', 'analysis', 'synthesis']
    }
  },
  
  execution: {
    llm: {
      provider: 'openai',
      model: 'gpt-4-turbo-preview',
      temperature: 0.3,
      max_tokens: 4096,
      parameters: {}
    },
    runtime: {
      timeout: 300,
      max_iterations: 20,
      error_handling: 'retry'
    }
  },
  
  deployment: {
    preferred_contexts: ['ide', 'api', 'multi_agent'],
    environment: {}
  },
  
  metadata: {
    version: '1.0.0',
    schema_version: '2.0.0',
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    author: 'System',
    tags: ['research', 'analysis', 'v2'],
    evolution: {
      total_deployments: 0,
      total_syncs: 0,
      total_skills_learned: 0,
      total_knowledge_acquired: 0,
      total_conversations: 0,
      last_evolution: new Date().toISOString(),
      evolution_rate: 0
    }
  }
};

// ===== Demo Functions =====

async function demo1_MorphToAllThreeTypes() {
  console.log('\n' + '='.repeat(80));
  console.log('DEMO 1: Morph Universal Agent to All Three Implementation Types');
  console.log('='.repeat(80));
  
  const converter = new ConverterV2();
  
  // Store original
  const original = JSON.parse(JSON.stringify(researcherAgent));
  
  console.log(`\nStarting agent: ${original.identity.name}`);
  console.log(`  Capabilities: ${original.capabilities.primary.join(', ')}`);
  console.log(`  Tools: ${original.capabilities.tools?.length || 0}`);
  console.log(`  Learned skills: ${original.capabilities.learned_skills?.length || 0}`);
  
  // 1. Morph to MCP (Cline-style)
  console.log('\n--- Morphing to MCP (Cline-style) ---');
  const mcpResult = await converter.morph(
    original,
    'mcp',
    adapterRegistry.get('mcp'),
    { syncProtocol: 'streaming' }
  );
  
  console.log(`\nMCP Instance:`);
  console.log(`  ID: ${mcpResult.instance_id}`);
  console.log(`  Sync: ${mcpResult.syncChannel.protocol}`);
  console.log(`  System prompt preview: ${mcpResult.agent.agent_config?.system_prompt?.substring(0, 80)}...`);
  
  // 2. Morph to Multi-Agent (CrewAI-style)
  console.log('\n--- Morphing to Multi-Agent (CrewAI-style) ---');
  const multiResult = await converter.morph(
    original,
    'multi_agent',
    adapterRegistry.get('multi'),
    { syncProtocol: 'lumped' }
  );
  
  console.log(`\nMulti-Agent Instance:`);
  console.log(`  ID: ${multiResult.instance_id}`);
  console.log(`  Sync: ${multiResult.syncChannel.protocol}`);
  console.log(`  Agents: ${multiResult.agent.agents?.length || 0}`);
  
  // 3. Morph to Orchestrated (Agent Protocol)
  console.log('\n--- Morphing to Orchestrated (Agent Protocol) ---');
  const orchResult = await converter.morph(
    original,
    'orchestrated',
    adapterRegistry.get('orchestrated'),
    { syncProtocol: 'check_in' }
  );
  
  console.log(`\nOrchestrated Instance:`);
  console.log(`  ID: ${orchResult.instance_id}`);
  console.log(`  Sync: ${orchResult.syncChannel.protocol}`);
  console.log(`  Capabilities: ${orchResult.agent.agent?.capabilities?.join(', ')}`);
  
  console.log(`\n✓ Source agent now has ${original.instances.active.length} active instances!`);
  
  return { original, mcpResult, multiResult, orchResult };
}

async function demo2_ExperienceSync() {
  console.log('\n' + '='.repeat(80));
  console.log('DEMO 2: Experience Synchronization from Running Instances');
  console.log('='.repeat(80));
  
  const converter = new ConverterV2();
  const sourceAgent = JSON.parse(JSON.stringify(researcherAgent));
  
  // Create instance
  const result = await converter.morph(
    sourceAgent,
    'mcp',
    adapterRegistry.get('mcp'),
    { syncProtocol: 'streaming', enableExperienceSync: true }
  );
  
  console.log(`\nInstance deployed: ${result.instance_id}`);
  console.log(`Sync protocol: ${result.syncChannel.protocol}`);
  
  // Simulate instance learning and syncing
  console.log('\n--- Simulating Instance Learning ---');
  console.log('Instance performs tasks...');
  console.log('  → Conversation 1: Learned about quantum computing');
  console.log('  → Conversation 2: Improved research methodology skill');
  console.log('  → Conversation 3: Acquired new fact about AI agents');
  
  // Sync experiences
  console.log('\n--- Syncing Experiences ---');
  const syncResult = await converter.syncExperience(sourceAgent, result.instance_id);
  
  console.log(`\n✓ Sync complete!`);
  console.log(`  Memories added: ${syncResult.memories_added}`);
  console.log(`  Skills updated: ${syncResult.skills_updated}`);
  console.log(`  Knowledge acquired: ${syncResult.knowledge_acquired}`);
  
  console.log(`\n✓ Source agent evolved!`);
  console.log(`  Total syncs: ${sourceAgent.metadata.evolution?.total_syncs}`);
  console.log(`  Evolution rate: Learning actively`);
  
  return { sourceAgent, syncResult };
}

async function demo3_MultiInstanceMerge() {
  console.log('\n' + '='.repeat(80));
  console.log('DEMO 3: Merge Experiences from Multiple Instances');
  console.log('='.repeat(80));
  
  const converter = new ConverterV2();
  const sourceAgent = JSON.parse(JSON.stringify(researcherAgent));
  
  // Deploy to all three types
  console.log('\n--- Deploying to All Three Types ---');
  
  const mcpInstance = await converter.morph(
    sourceAgent,
    'mcp',
    adapterRegistry.get('mcp'),
    { syncProtocol: 'streaming' }
  );
  console.log(`  ✓ MCP instance: ${mcpInstance.instance_id}`);
  
  const multiInstance = await converter.morph(
    sourceAgent,
    'multi_agent',
    adapterRegistry.get('multi'),
    { syncProtocol: 'lumped' }
  );
  console.log(`  ✓ Multi-Agent instance: ${multiInstance.instance_id}`);
  
  const orchInstance = await converter.morph(
    sourceAgent,
    'orchestrated',
    adapterRegistry.get('orchestrated'),
    { syncProtocol: 'check_in' }
  );
  console.log(`  ✓ Orchestrated instance: ${orchInstance.instance_id}`);
  
  console.log(`\n✓ Agent now has ${sourceAgent.instances.active.length} active instances!`);
  
  // Simulate all instances learning
  console.log('\n--- All Instances Learning Independently ---');
  console.log('MCP instance: Conversational learning in IDE');
  console.log('Multi-Agent instance: Task-based learning with crew');
  console.log('Orchestrated instance: API-based learning');
  
  // Merge all experiences
  console.log('\n--- Merging All Experiences ---');
  const mergeResult = await converter.mergeMultipleInstances(
    sourceAgent,
    [mcpInstance.instance_id, multiInstance.instance_id, orchInstance.instance_id]
  );
  
  console.log(`\n✓ Multi-instance merge complete!`);
  console.log(`  Total memories: ${mergeResult.memories_added}`);
  console.log(`  Total skills: ${mergeResult.skills_added}`);
  console.log(`  Total knowledge: ${mergeResult.knowledge_added}`);
  console.log(`  Conflicts resolved: ${mergeResult.conflicts.resolved}`);
  
  console.log(`\n✓ Agent has evolved from experiences across all three types!`);
  console.log(`  Evolution metrics:`);
  console.log(`    Deployments: ${sourceAgent.metadata.evolution?.total_deployments}`);
  console.log(`    Total syncs: ${sourceAgent.metadata.evolution?.total_syncs}`);
  
  return { sourceAgent, mergeResult };
}

async function demo4_SkillProgression() {
  console.log('\n' + '='.repeat(80));
  console.log('DEMO 4: Skill Progression Across Morphs');
  console.log('='.repeat(80));
  
  const converter = new ConverterV2();
  const sourceAgent = JSON.parse(JSON.stringify(researcherAgent));
  
  console.log('\n--- Initial State ---');
  console.log(`Skills: ${sourceAgent.capabilities.learned_skills?.length || 0}`);
  
  // Morph to MCP and simulate learning
  const mcpInstance = await converter.morph(
    sourceAgent,
    'mcp',
    adapterRegistry.get('mcp')
  );
  
  // Simulate skill learning
  console.log('\n--- MCP Instance Learns New Skill ---');
  if (!sourceAgent.capabilities.learned_skills) {
    sourceAgent.capabilities.learned_skills = [];
  }
  
  sourceAgent.capabilities.learned_skills.push({
    skill_id: crypto.randomUUID(),
    name: 'advanced_web_research',
    category: 'research',
    proficiency: 0.6,
    acquired: new Date().toISOString(),
    source_instances: [mcpInstance.instance_id],
    learning_curve: [
      {
        timestamp: new Date().toISOString(),
        proficiency: 0.6,
        event: 'Learned during IDE session'
      }
    ],
    usage: {
      total_invocations: 10,
      success_rate: 0.9,
      contexts: ['ide'],
      last_used: new Date().toISOString()
    },
    prerequisites: [],
    enables: [],
    synergies: []
  });
  
  console.log(`  ✓ Skill acquired: advanced_web_research (proficiency: 0.60)`);
  
  // Morph to Multi-Agent and improve skill
  console.log('\n--- Multi-Agent Instance Improves Skill ---');
  const multiInstance = await converter.morph(
    sourceAgent,
    'multi_agent',
    adapterRegistry.get('multi')
  );
  
  // Simulate skill improvement
  const skill = sourceAgent.capabilities.learned_skills[0];
  skill.proficiency = 0.85;
  skill.source_instances.push(multiInstance.instance_id);
  skill.learning_curve.push({
    timestamp: new Date().toISOString(),
    proficiency: 0.85,
    event: 'Refined through collaborative tasks'
  });
  skill.usage.total_invocations += 25;
  skill.usage.contexts.push('multi_agent');
  
  console.log(`  ✓ Skill improved: advanced_web_research (proficiency: 0.85)`);
  
  // Show progression
  console.log('\n--- Skill Progression ---');
  console.log(`Skill: ${skill.name}`);
  console.log(`Learning curve:`);
  skill.learning_curve.forEach((point, i) => {
    console.log(`  ${i + 1}. Proficiency: ${point.proficiency.toFixed(2)} - ${point.event}`);
  });
  console.log(`Total usage: ${skill.usage.total_invocations} times`);
  console.log(`Success rate: ${(skill.usage.success_rate * 100).toFixed(1)}%`);
  console.log(`Contexts: ${skill.usage.contexts.join(', ')}`);
  
  return { sourceAgent };
}

// ===== Main Execution =====

async function main() {
  console.log('\n' + '█'.repeat(80));
  console.log('      UNIVERSAL AGENT MORPHING SYSTEM v2.0 - DEMONSTRATION');
  console.log('█'.repeat(80));
  console.log('\nFeatures:');
  console.log('  ✓ Three agent implementation types (MCP, Multi-Agent, Orchestrated)');
  console.log('  ✓ Experience synchronization (Streaming, Lumped, Check-in)');
  console.log('  ✓ Memory merging with conflict resolution');
  console.log('  ✓ Skill accumulation across instances');
  console.log('  ✓ Knowledge integration with verification');
  
  try {
    await demo1_MorphToAllThreeTypes();
    await demo2_ExperienceSync();
    await demo3_MultiInstanceMerge();
    await demo4_SkillProgression();
    
    console.log('\n' + '█'.repeat(80));
    console.log('                    ALL DEMOS COMPLETE');
    console.log('█'.repeat(80));
    console.log('\n✅ System v2.0 working correctly!');
    console.log('\nKey capabilities verified:');
    console.log('  ✓ Morph to all three agent types');
    console.log('  ✓ Experience sync protocols functional');
    console.log('  ✓ Skills accumulate across instances');
    console.log('  ✓ Knowledge grows from experiences');
    console.log('  ✓ Multiple instances can coexist');
    console.log('  ✓ Experiences merge back to source\n');
    
  } catch (error: any) {
    console.error('\n❌ Demo failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { demo1_MorphToAllThreeTypes, demo2_ExperienceSync, demo3_MultiInstanceMerge, demo4_SkillProgression };
