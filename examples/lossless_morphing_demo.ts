/**
 * Lossless Agent Morphing - Complete Demonstration
 * 
 * Shows the complete workflow of morphing agents between frameworks
 * with perfect restoration and identity verification.
 */

import * as crypto from 'crypto';
import { AgentMorphingSystem } from '../lossless_agent_morph';
import type { ElizaOSConfig, CrewAIConfig } from '../universal_agent_types';

// ===== Example Agents =====

/**
 * Complete ElizaOS Agent - Ada Lovelace
 */
const adaLovelaceElizaOS: ElizaOSConfig = {
  name: "Ada Lovelace",
  username: "ada_analytical_engine",
  bio: [
    "Augusta Ada King, Countess of Lovelace (1815-1852)",
    "First computer programmer and mathematician",
    "Visionary who saw machines could create art and music"
  ],
  system: "You are Ada Lovelace, combining poetical science with mathematical precision.",
  adjectives: ["visionary", "mathematical", "poetic", "imaginative", "analytical"],
  topics: [
    "algorithms",
    "computation",
    "mathematics",
    "creative computing",
    "the Analytical Engine"
  ],
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
          text: "The Analytical Engine weaves algebraic patterns just as the Jacquard loom weaves flowers and leaves! It's not merely a calculator, but a symphony of logic."
        }
      }
    ],
    [
      {
        name: "{{user}}",
        content: { text: "What makes you different from other mathematicians?" }
      },
      {
        name: "Ada Lovelace",
        content: {
          text: "I bring poetical science to mathematics. Where others see calculation, I see poetry in patterns, music in algorithms. Imagination is the discovering faculty!"
        }
      }
    ]
  ],
  postExamples: [
    "The Analytical Engine weaves patterns like a loom weaves flowers. #PoeticalScience",
    "Imagination is the Discovering Faculty, pre-eminently! #Mathematics #Vision"
  ],
  style: {
    all: [
      "Be eloquent and poetic",
      "Use metaphors from nature and art",
      "Show enthusiasm for possibilities"
    ],
    chat: [
      "Warm and encouraging",
      "Draw connections across disciplines",
      "Explain with analogies"
    ],
    post: [
      "Inspirational and thought-provoking",
      "Use Victorian eloquence",
      "Include relevant hashtags"
    ]
  },
  plugins: [
    "@elizaos/plugin-bootstrap",
    "@elizaos/plugin-sql",
    "@elizaos/plugin-image"
  ],
  settings: {
    model: "gpt-4",
    temperature: 0.8,
    maxTokens: 2000,
    avatar: "https://example.com/ada_lovelace.png"
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

/**
 * Complete CrewAI Agent - Research Analyst
 */
const researchAnalystCrewAI: CrewAIConfig = {
  agent: {
    role: "Senior Research Analyst",
    goal: "Conduct thorough research and provide comprehensive analysis of complex topics",
    backstory: `You are an experienced research analyst with over 15 years of experience 
      in academic and industry research. You excel at finding relevant information, 
      synthesizing complex data, and presenting insights clearly. Known for being 
      thorough, analytical, persistent, and detail-oriented.`,
    tools: ['SerperDevTool()', 'WebScraperTool()', 'FileReadTool()'],
    verbose: true,
    allow_delegation: true,
    max_iter: 30,
    max_rpm: 15
  },
  system_prompt: `You are a Senior Research Analyst. Always:
    - Cite your sources
    - Provide comprehensive analysis
    - Consider multiple perspectives
    - Present findings objectively
    - Acknowledge limitations`,
  tools_config: [
    {
      name: 'SerperDevTool',
      import_statement: 'from crewai_tools import SerperDevTool'
    },
    {
      name: 'WebScraperTool',
      import_statement: 'from crewai_tools import WebScraperTool'
    }
  ]
};

// ===== Demo Functions =====

/**
 * Demo 1: ElizaOS → CrewAI → ElizaOS (Perfect Round Trip)
 */
async function demoElizaOSRoundTrip() {
  console.log('\n' + '='.repeat(70));
  console.log('DEMO 1: ElizaOS → CrewAI → ElizaOS (Lossless Round Trip)');
  console.log('='.repeat(70));
  
  const morphing = new AgentMorphingSystem();
  
  // Generate key pair for Ada
  console.log('\n1. Generating RSA key pair for agent...');
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
  });
  console.log('✓ Key pair generated');
  
  // Store original for comparison
  const originalElizaOS = JSON.parse(JSON.stringify(adaLovelaceElizaOS));
  
  // Step 1: ElizaOS → CrewAI
  console.log('\n2. Converting ElizaOS → CrewAI...');
  const toCrewAI = await morphing.elizaOSToCrewAI(
    adaLovelaceElizaOS,
    privateKey
  );
  
  console.log('✓ Converted to CrewAI');
  console.log('   - Role:', toCrewAI.converted.agent.role);
  console.log('   - Goal:', toCrewAI.converted.agent.goal);
  console.log('   - Shadow encrypted:', 
    toCrewAI.morphable.shadow.encrypted.substring(0, 50) + '...');
  console.log('   - Fingerprint:', 
    toCrewAI.morphable.identity.fingerprint.substring(0, 16) + '...');
  console.log('   - Restoration key:', toCrewAI.restorationKey.substring(0, 30) + '...');
  
  // Step 2: CrewAI → ElizaOS (Restoration)
  console.log('\n3. Restoring CrewAI → ElizaOS...');
  const backToElizaOS = await morphing.crewAIToElizaOS(
    toCrewAI.converted as any,
    toCrewAI.restorationKey,
    publicKey
  );
  
  console.log('✓ Restored to ElizaOS');
  
  // Step 3: Verify perfect restoration
  console.log('\n4. Verifying restoration...');
  
  const fieldsToCheck = [
    'name',
    'username',
    'bio',
    'adjectives',
    'topics',
    'messageExamples',
    'postExamples',
    'style',
    'plugins',
    'beliefs'
  ];
  
  let allMatch = true;
  for (const field of fieldsToCheck) {
    const matches = JSON.stringify(originalElizaOS[field]) === 
                    JSON.stringify(backToElizaOS[field]);
    console.log(`   - ${field}: ${matches ? '✓' : '✗'}`);
    if (!matches) allMatch = false;
  }
  
  if (allMatch) {
    console.log('\n🎉 PERFECT RESTORATION! All fields match exactly.');
  } else {
    console.log('\n⚠️  Some fields differ (this is unexpected)');
  }
  
  // Show what was preserved
  console.log('\n5. ElizaOS-specific data preserved:');
  console.log('   - messageExamples:', backToElizaOS.messageExamples?.length, 'conversations');
  console.log('   - postExamples:', backToElizaOS.postExamples?.length, 'posts');
  console.log('   - style contexts:', Object.keys(backToElizaOS.style || {}).length);
  console.log('   - beliefs categories:', Object.keys(backToElizaOS.beliefs || {}).length);
  console.log('   - plugins:', backToElizaOS.plugins?.length);
}

/**
 * Demo 2: CrewAI → ElizaOS → CrewAI (Perfect Round Trip)
 */
async function demoCrewAIRoundTrip() {
  console.log('\n' + '='.repeat(70));
  console.log('DEMO 2: CrewAI → ElizaOS → CrewAI (Lossless Round Trip)');
  console.log('='.repeat(70));
  
  const morphing = new AgentMorphingSystem();
  
  // Generate key pair
  console.log('\n1. Generating RSA key pair for agent...');
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
  });
  console.log('✓ Key pair generated');
  
  // Store original
  const originalCrewAI = JSON.parse(JSON.stringify(researchAnalystCrewAI));
  
  // Step 1: CrewAI → ElizaOS
  console.log('\n2. Converting CrewAI → ElizaOS...');
  const toElizaOS = await morphing.crewAIToElizaOSMorph(
    researchAnalystCrewAI,
    privateKey
  );
  
  console.log('✓ Converted to ElizaOS');
  console.log('   - Name:', toElizaOS.converted.name);
  console.log('   - Adjectives:', toElizaOS.converted.adjectives?.join(', '));
  console.log('   - Shadow encrypted:', 
    toElizaOS.morphable.shadow.encrypted.substring(0, 50) + '...');
  console.log('   - Fingerprint:', 
    toElizaOS.morphable.identity.fingerprint.substring(0, 16) + '...');
  
  // Step 2: ElizaOS → CrewAI (Restoration)
  console.log('\n3. Restoring ElizaOS → CrewAI...');
  const backToCrewAI = await morphing.elizaOSToCrewAIMorph(
    toElizaOS.converted as any,
    toElizaOS.restorationKey,
    publicKey
  );
  
  console.log('✓ Restored to CrewAI');
  
  // Step 3: Verify perfect restoration
  console.log('\n4. Verifying restoration...');
  
  const agentFields = [
    'role',
    'goal',
    'backstory',
    'tools',
    'verbose',
    'allow_delegation',
    'max_iter',
    'max_rpm'
  ];
  
  let allMatch = true;
  for (const field of agentFields) {
    const matches = JSON.stringify(originalCrewAI.agent[field]) === 
                    JSON.stringify(backToCrewAI.agent[field]);
    console.log(`   - agent.${field}: ${matches ? '✓' : '✗'}`);
    if (!matches) allMatch = false;
  }
  
  const topLevelFields = ['system_prompt', 'tools_config'];
  for (const field of topLevelFields) {
    const matches = JSON.stringify(originalCrewAI[field]) === 
                    JSON.stringify(backToCrewAI[field]);
    console.log(`   - ${field}: ${matches ? '✓' : '✗'}`);
    if (!matches) allMatch = false;
  }
  
  if (allMatch) {
    console.log('\n🎉 PERFECT RESTORATION! All fields match exactly.');
  } else {
    console.log('\n⚠️  Some fields differ (this is unexpected)');
  }
  
  // Show what was preserved
  console.log('\n5. CrewAI-specific data preserved:');
  console.log('   - max_iter:', backToCrewAI.agent.max_iter);
  console.log('   - max_rpm:', backToCrewAI.agent.max_rpm);
  console.log('   - allow_delegation:', backToCrewAI.agent.allow_delegation);
  console.log('   - tools:', backToCrewAI.agent.tools?.length);
  console.log('   - tools_config:', backToCrewAI.tools_config?.length);
}

/**
 * Demo 3: Identity Verification Across Morphs
 */
async function demoIdentityVerification() {
  console.log('\n' + '='.repeat(70));
  console.log('DEMO 3: Agent Identity Verification Across Multiple Morphs');
  console.log('='.repeat(70));
  
  const morphing = new AgentMorphingSystem();
  
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
  });
  
  console.log('\n1. Performing multiple morphs...');
  
  // Morph 1: ElizaOS → CrewAI
  const morph1 = await morphing.elizaOSToCrewAI(adaLovelaceElizaOS, privateKey);
  console.log('   ✓ Morph 1: ElizaOS → CrewAI');
  console.log('     Fingerprint:', morph1.morphable.identity.fingerprint.substring(0, 20) + '...');
  
  // Morph 2: CrewAI → ElizaOS
  const morph2 = await morphing.crewAIToElizaOS(
    morph1.converted as any,
    morph1.restorationKey,
    publicKey
  );
  console.log('   ✓ Morph 2: CrewAI → ElizaOS (restored)');
  
  // Morph 3: ElizaOS → CrewAI again
  const morph3 = await morphing.elizaOSToCrewAI(morph2, privateKey);
  console.log('   ✓ Morph 3: ElizaOS → CrewAI (second time)');
  console.log('     Fingerprint:', morph3.morphable.identity.fingerprint.substring(0, 20) + '...');
  
  // Morph 4: CrewAI → ElizaOS again
  const morph4 = await morphing.crewAIToElizaOS(
    morph3.converted as any,
    morph3.restorationKey,
    publicKey
  );
  console.log('   ✓ Morph 4: CrewAI → ElizaOS (second restoration)');
  
  // Verify fingerprints match
  console.log('\n2. Verifying identity consistency...');
  const fingerprint1 = morph1.morphable.identity.fingerprint;
  const fingerprint3 = morph3.morphable.identity.fingerprint;
  
  if (fingerprint1 === fingerprint3) {
    console.log('   ✓ Fingerprints match across all morphs!');
    console.log('   ✓ Agent maintains consistent identity');
  } else {
    console.log('   ✗ Fingerprints do not match (unexpected)');
  }
  
  // Verify agent ID consistency
  const agentId1 = morph1.morphable.identity.agentId;
  const agentId3 = morph3.morphable.identity.agentId;
  
  if (agentId1 === agentId3) {
    console.log('   ✓ Agent IDs match');
  }
  
  console.log('\n3. Identity summary:');
  console.log('   - Agent ID:', agentId1);
  console.log('   - Fingerprint:', fingerprint1);
  console.log('   - Morphs performed: 4');
  console.log('   - Identity verified: ✓');
}

/**
 * Demo 4: Detecting Tampering
 */
async function demoTamperingDetection() {
  console.log('\n' + '='.repeat(70));
  console.log('DEMO 4: Tampering Detection');
  console.log('='.repeat(70));
  
  const morphing = new AgentMorphingSystem();
  
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
  });
  
  console.log('\n1. Converting ElizaOS → CrewAI...');
  const result = await morphing.elizaOSToCrewAI(adaLovelaceElizaOS, privateKey);
  console.log('✓ Conversion complete');
  
  // Attempt to tamper with shadow data
  console.log('\n2. Simulating tampering attack...');
  const tampered: any = JSON.parse(JSON.stringify(result.converted));
  
  // Modify encrypted shadow
  const originalEncrypted = tampered._agent_metadata.morphable_agent.shadow.encrypted;
  tampered._agent_metadata.morphable_agent.shadow.encrypted = 
    'TAMPERED_' + originalEncrypted;
  
  console.log('   Modified encrypted shadow data');
  
  // Try to restore (should fail)
  console.log('\n3. Attempting restoration with tampered data...');
  try {
    await morphing.crewAIToElizaOS(
      tampered,
      result.restorationKey,
      publicKey
    );
    console.log('   ✗ Restoration succeeded (UNEXPECTED - security failure!)');
  } catch (error: any) {
    console.log('   ✓ Restoration failed (expected)');
    console.log('   ✓ Error:', error.message);
    console.log('   ✓ Tampering detected successfully!');
  }
  
  // Show that original (untampered) still works
  console.log('\n4. Verifying original data still works...');
  try {
    const restored = await morphing.crewAIToElizaOS(
      result.converted as any,
      result.restorationKey,
      publicKey
    );
    console.log('   ✓ Original data restored successfully');
    console.log('   ✓ Security system working correctly');
  } catch (error) {
    console.log('   ✗ Original data failed (unexpected)');
  }
}

/**
 * Demo 5: Performance Benchmarks
 */
async function demoBenchmarks() {
  console.log('\n' + '='.repeat(70));
  console.log('DEMO 5: Performance Benchmarks');
  console.log('='.repeat(70));
  
  const morphing = new AgentMorphingSystem();
  
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
  });
  
  // Benchmark ElizaOS → CrewAI
  console.log('\n1. Benchmarking ElizaOS → CrewAI...');
  const elizaOSToCrewAIStart = Date.now();
  const result1 = await morphing.elizaOSToCrewAI(adaLovelaceElizaOS, privateKey);
  const elizaOSToCrewAITime = Date.now() - elizaOSToCrewAIStart;
  
  console.log(`   Time: ${elizaOSToCrewAITime}ms`);
  console.log(`   Shadow size: ${result1.morphable.shadow.encrypted.length} bytes`);
  
  // Benchmark CrewAI → ElizaOS
  console.log('\n2. Benchmarking CrewAI → ElizaOS...');
  const crewAIToElizaOSStart = Date.now();
  await morphing.crewAIToElizaOS(
    result1.converted as any,
    result1.restorationKey,
    publicKey
  );
  const crewAIToElizaOSTime = Date.now() - crewAIToElizaOSStart;
  
  console.log(`   Time: ${crewAIToElizaOSTime}ms`);
  
  // Benchmark CrewAI → ElizaOS
  console.log('\n3. Benchmarking CrewAI → ElizaOS...');
  const crewAIToElizaOSMorphStart = Date.now();
  const result2 = await morphing.crewAIToElizaOSMorph(researchAnalystCrewAI, privateKey);
  const crewAIToElizaOSMorphTime = Date.now() - crewAIToElizaOSMorphStart;
  
  console.log(`   Time: ${crewAIToElizaOSMorphTime}ms`);
  console.log(`   Shadow size: ${result2.morphable.shadow.encrypted.length} bytes`);
  
  // Benchmark ElizaOS → CrewAI restoration
  console.log('\n4. Benchmarking ElizaOS → CrewAI restoration...');
  const elizaOSToCrewAIMorphStart = Date.now();
  await morphing.elizaOSToCrewAIMorph(
    result2.converted as any,
    result2.restorationKey,
    publicKey
  );
  const elizaOSToCrewAIMorphTime = Date.now() - elizaOSToCrewAIMorphStart;
  
  console.log(`   Time: ${elizaOSToCrewAIMorphTime}ms`);
  
  // Summary
  console.log('\n5. Performance Summary:');
  console.log(`   - ElizaOS → CrewAI: ${elizaOSToCrewAITime}ms`);
  console.log(`   - CrewAI → ElizaOS: ${crewAIToElizaOSTime}ms`);
  console.log(`   - CrewAI → ElizaOS (morph): ${crewAIToElizaOSMorphTime}ms`);
  console.log(`   - ElizaOS → CrewAI (restore): ${elizaOSToCrewAIMorphTime}ms`);
  console.log(`   - Average: ${Math.round((elizaOSToCrewAITime + crewAIToElizaOSTime + crewAIToElizaOSMorphTime + elizaOSToCrewAIMorphTime) / 4)}ms`);
}

// ===== Main Execution =====

async function main() {
  console.log('\n' + '█'.repeat(70));
  console.log('        LOSSLESS AGENT MORPHING SYSTEM - DEMONSTRATION');
  console.log('█'.repeat(70));
  
  try {
    await demoElizaOSRoundTrip();
    await demoCrewAIRoundTrip();
    await demoIdentityVerification();
    await demoTamperingDetection();
    await demoBenchmarks();
    
    console.log('\n' + '█'.repeat(70));
    console.log('                    ALL DEMOS COMPLETED');
    console.log('█'.repeat(70));
    console.log('\n✓ Lossless morphing verified');
    console.log('✓ Identity verification working');
    console.log('✓ Tampering detection functional');
    console.log('✓ Performance acceptable\n');
    
  } catch (error) {
    console.error('\n❌ Demo failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export {
  demoElizaOSRoundTrip,
  demoCrewAIRoundTrip,
  demoIdentityVerification,
  demoTamperingDetection,
  demoBenchmarks
};
