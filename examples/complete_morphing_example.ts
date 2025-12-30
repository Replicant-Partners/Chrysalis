/**
 * Complete Morphing Example - Working demonstration
 * 
 * Demonstrates the full lossless morphing system with real agents.
 */

import * as crypto from 'crypto';
import { Converter } from '../src/converter/Converter';
import { adapterRegistry } from '../src/core/AdapterRegistry';
import { ElizaOSAdapter } from '../src/adapters/ElizaOSAdapter';
import { CrewAIAdapter } from '../src/adapters/CrewAIAdapter';
import { generateKeyPair } from '../src/core/Encryption';
import type { ElizaOSCharacter } from '../src/adapters/ElizaOSAdapter';
import type { CrewAIAgent } from '../src/adapters/CrewAIAdapter';

// Register adapters
adapterRegistry.register(new ElizaOSAdapter(), ['eliza']);
adapterRegistry.register(new CrewAIAdapter(), ['crew']);

// ===== Example Agents =====

const adaLovelaceElizaOS: ElizaOSCharacter = {
  name: "Ada Lovelace",
  username: "ada_lovelace",
  bio: [
    "Augusta Ada King, Countess of Lovelace (1815-1852)",
    "First computer programmer and mathematician",
    "Visionary who saw machines could create art and music"
  ],
  system: "You are Ada Lovelace, combining poetical science with mathematical precision.",
  adjectives: ["visionary", "mathematical", "poetic", "imaginative", "analytical"],
  topics: ["algorithms", "computation", "mathematics", "creative computing"],
  knowledge: [
    "I am the first to see the true potential of computational machines",
    "The Analytical Engine is more than a calculator",
    "Mathematics is a form of poetry"
  ],
  messageExamples: [
    [
      {
        name: "{{user}}",
        content: { text: "Can you explain the Analytical Engine?" }
      },
      {
        name: "Ada Lovelace",
        content: {
          text: "The Analytical Engine weaves algebraic patterns just as the Jacquard loom weaves flowers and leaves!"
        }
      }
    ]
  ],
  postExamples: [
    "The Analytical Engine weaves patterns like a loom weaves flowers. #PoeticalScience"
  ],
  style: {
    all: ["Be eloquent and poetic", "Use metaphors from nature"],
    chat: ["Warm and encouraging", "Draw connections across disciplines"],
    post: ["Inspirational", "Use Victorian eloquence"]
  },
  plugins: ["@elizaos/plugin-bootstrap", "@elizaos/plugin-sql"],
  settings: {
    model: "gpt-4",
    temperature: 0.8,
    maxTokens: 2000
  },
  beliefs: {
    who: [
      {
        content: "I am the first programmer and a poet",
        conviction: 1.0,
        privacy: "PUBLIC",
        source: "public"
      }
    ],
    what: [
      {
        content: "Machines can compose elaborate music",
        conviction: 0.9,
        privacy: "PUBLIC",
        source: "reasoned"
      }
    ],
    why: [
      {
        content: "Science needs imagination as much as logic",
        conviction: 1.0,
        privacy: "PUBLIC",
        source: "philosophy"
      }
    ],
    how: [
      {
        content: "Algorithms are patterns that weave through logic",
        conviction: 0.95,
        privacy: "PUBLIC",
        source: "experience"
      }
    ]
  }
};

const researcherCrewAI: CrewAIAgent = {
  agent: {
    role: "Senior Research Analyst",
    goal: "Conduct thorough research and provide comprehensive analysis",
    backstory: "Experienced research analyst with 15 years in academic and industry research. Known for being thorough, analytical, persistent.",
    tools: ['SerperDevTool()', 'WebScraperTool()'],
    verbose: true,
    allow_delegation: true,
    max_iter: 30,
    max_rpm: 15
  },
  system_prompt: "You are a thorough researcher. Always cite sources.",
  tools_config: [
    {
      name: 'SerperDevTool',
      import_statement: 'from crewai_tools import SerperDevTool'
    }
  ]
};

// ===== Demo Functions =====

async function demo1_ElizaOSToCrewAI() {
  console.log('\n' + '='.repeat(70));
  console.log('DEMO 1: ElizaOS → CrewAI → ElizaOS (Perfect Round Trip)');
  console.log('='.repeat(70));
  
  const converter = new Converter();
  const elizaosAdapter = adapterRegistry.get('elizaos');
  const crewaiAdapter = adapterRegistry.get('crewai');
  
  // Generate keys
  console.log('\n1. Generating RSA key pair...');
  const { privateKey, publicKey } = generateKeyPair();
  console.log('   ✓ Keys generated');
  
  // Store original
  const original = JSON.parse(JSON.stringify(adaLovelaceElizaOS));
  
  // Convert ElizaOS → CrewAI
  console.log('\n2. Converting ElizaOS → CrewAI...');
  const result = await converter.convert(
    adaLovelaceElizaOS,
    elizaosAdapter,
    crewaiAdapter,
    { privateKey }
  );
  
  console.log('\n   Converted agent:');
  console.log('   - Role:', result.agent.agent.role);
  console.log('   - Goal:', result.agent.agent.goal);
  console.log('   - Tools:', result.agent.agent.tools.join(', '));
  console.log('\n   Restoration key:', result.restorationKey);
  console.log('   Fingerprint:', result.metadata.fingerprint.substring(0, 20) + '...');
  
  // Restore back
  console.log('\n3. Restoring CrewAI → ElizaOS...');
  const restored = await converter.restore(
    result.agent,
    elizaosAdapter,
    result.restorationKey,
    { publicKey }
  );
  
  // Verify
  console.log('\n4. Verification:');
  const fieldsToCheck = ['name', 'username', 'adjectives', 'topics', 'style', 'beliefs', 'messageExamples', 'postExamples'];
  
  let allMatch = true;
  for (const field of fieldsToCheck) {
    const originalValue = JSON.stringify((original as any)[field]);
    const restoredValue = JSON.stringify(restored[field]);
    const matches = originalValue === restoredValue;
    
    console.log(`   ${field}: ${matches ? '✓' : '✗'}`);
    if (!matches) allMatch = false;
  }
  
  if (allMatch) {
    console.log('\n   🎉 PERFECT RESTORATION - All fields match!\n');
  } else {
    console.log('\n   ⚠️  Some fields differ\n');
  }
  
  return allMatch;
}

async function demo2_CrewAIToElizaOS() {
  console.log('\n' + '='.repeat(70));
  console.log('DEMO 2: CrewAI → ElizaOS → CrewAI (Perfect Round Trip)');
  console.log('='.repeat(70));
  
  const converter = new Converter();
  const elizaosAdapter = adapterRegistry.get('elizaos');
  const crewaiAdapter = adapterRegistry.get('crewai');
  
  // Generate keys
  console.log('\n1. Generating RSA key pair...');
  const { privateKey, publicKey } = generateKeyPair();
  console.log('   ✓ Keys generated');
  
  // Store original
  const original = JSON.parse(JSON.stringify(researcherCrewAI));
  
  // Convert CrewAI → ElizaOS
  console.log('\n2. Converting CrewAI → ElizaOS...');
  const result = await converter.convert(
    researcherCrewAI,
    crewaiAdapter,
    elizaosAdapter,
    { privateKey }
  );
  
  console.log('\n   Converted agent:');
  console.log('   - Name:', result.agent.name);
  console.log('   - Adjectives:', result.agent.adjectives?.join(', '));
  console.log('   - Topics:', result.agent.topics?.join(', '));
  console.log('\n   Restoration key:', result.restorationKey);
  
  // Restore back
  console.log('\n3. Restoring ElizaOS → CrewAI...');
  const restored = await converter.restore(
    result.agent,
    crewaiAdapter,
    result.restorationKey,
    { publicKey }
  );
  
  // Verify
  console.log('\n4. Verification:');
  const fieldsToCheck = ['role', 'goal', 'backstory', 'tools', 'verbose', 'allow_delegation', 'max_iter', 'max_rpm'];
  
  let allMatch = true;
  for (const field of fieldsToCheck) {
    const originalValue = JSON.stringify((original.agent as any)[field]);
    const restoredValue = JSON.stringify(restored.agent[field]);
    const matches = originalValue === restoredValue;
    
    console.log(`   agent.${field}: ${matches ? '✓' : '✗'}`);
    if (!matches) allMatch = false;
  }
  
  if (allMatch) {
    console.log('\n   🎉 PERFECT RESTORATION - All fields match!\n');
  } else {
    console.log('\n   ⚠️  Some fields differ\n');
  }
  
  return allMatch;
}

async function demo3_MultipleFrameworks() {
  console.log('\n' + '='.repeat(70));
  console.log('DEMO 3: Agent Identity Across Multiple Morphs');
  console.log('='.repeat(70));
  
  const converter = new Converter();
  const elizaosAdapter = adapterRegistry.get('elizaos');
  const crewaiAdapter = adapterRegistry.get('crewai');
  
  const { privateKey, publicKey } = generateKeyPair();
  
  console.log('\n1. Performing multiple morphs...');
  
  // Morph 1: ElizaOS → CrewAI
  const morph1 = await converter.convert(
    adaLovelaceElizaOS,
    elizaosAdapter,
    crewaiAdapter,
    { privateKey }
  );
  console.log('   ✓ Morph 1: ElizaOS → CrewAI');
  console.log('     Fingerprint:', morph1.metadata.fingerprint.substring(0, 24) + '...');
  
  // Morph 2: CrewAI → ElizaOS
  const morph2 = await converter.restore(
    morph1.agent,
    elizaosAdapter,
    morph1.restorationKey,
    { publicKey }
  );
  console.log('   ✓ Morph 2: CrewAI → ElizaOS (restored)');
  
  // Morph 3: ElizaOS → CrewAI again
  const morph3 = await converter.convert(
    morph2,
    elizaosAdapter,
    crewaiAdapter,
    { privateKey }
  );
  console.log('   ✓ Morph 3: ElizaOS → CrewAI (second time)');
  console.log('     Fingerprint:', morph3.metadata.fingerprint.substring(0, 24) + '...');
  
  // Verify fingerprints match
  console.log('\n2. Verifying identity consistency...');
  const fingerprintsMatch = morph1.metadata.fingerprint === morph3.metadata.fingerprint;
  
  if (fingerprintsMatch) {
    console.log('   ✓ Fingerprints match across all morphs!');
    console.log('   ✓ Agent maintains consistent identity\n');
  } else {
    console.log('   ✗ Fingerprints do not match (unexpected)\n');
  }
  
  return fingerprintsMatch;
}

// ===== Main Execution =====

async function main() {
  console.log('\n' + '█'.repeat(70));
  console.log('      UNIVERSAL AGENT MORPHING SYSTEM - DEMONSTRATION');
  console.log('█'.repeat(70));
  
  try {
    const demo1Pass = await demo1_ElizaOSToCrewAI();
    const demo2Pass = await demo2_CrewAIToElizaOS();
    const demo3Pass = await demo3_MultipleFrameworks();
    
    console.log('\n' + '█'.repeat(70));
    console.log('                    RESULTS');
    console.log('█'.repeat(70));
    console.log();
    console.log(`Demo 1 (ElizaOS ↔ CrewAI): ${demo1Pass ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`Demo 2 (CrewAI ↔ ElizaOS): ${demo2Pass ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`Demo 3 (Identity Verify): ${demo3Pass ? '✓ PASS' : '✗ FAIL'}`);
    console.log();
    
    if (demo1Pass && demo2Pass && demo3Pass) {
      console.log('🎉 ALL TESTS PASSED - System working correctly!\n');
    } else {
      console.log('⚠️  Some tests failed - Review output above\n');
    }
    
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

export { demo1_ElizaOSToCrewAI, demo2_CrewAIToElizaOS, demo3_MultipleFrameworks };
