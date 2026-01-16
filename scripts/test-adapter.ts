#!/usr/bin/env tsx
/**
 * Universal Adapter Test Script
 * 
 * Ad-hoc testing interface for the Universal Adapter V2.
 * Tests protocol translation between different agent formats.
 * 
 * Usage:
 *   npm run test:adapter
 *   npm run test:adapter -- --translate crewai mcp
 *   npm run test:adapter -- --morph usa a2a
 *   npm run test:adapter -- --list
 * 
 * @module scripts/test-adapter
 */

import { getSharedAdapter, quickTranslate, quickMorph } from '../src/adapters/universal';
import { createLogger } from '../src/shared/logger';
import chalk from 'chalk';

const log = createLogger('test-adapter');

// ============================================================================
// Example Agents for Testing
// ============================================================================

const EXAMPLE_AGENTS: Record<string, { protocol: string; agent: Record<string, unknown> }> = {
  usa: {
    protocol: 'usa',
    agent: {
      apiVersion: 'usa/v2',
      kind: 'Agent',
      metadata: {
        name: 'TestAgent',
        version: '1.0.0',
        tags: ['test', 'demo']
      },
      identity: {
        name: 'Test Agent',
        role: 'Testing assistant',
        goal: 'Demonstrate protocol translation',
        backstory: 'A simple agent created for testing the Universal Adapter',
        personality: ['helpful', 'curious', 'technical']
      },
      capabilities: {
        tools: [
          {
            name: 'calculate',
            description: 'Perform mathematical calculations',
            parameters: {
              type: 'object',
              properties: {
                expression: { type: 'string', description: 'Math expression' }
              }
            }
          },
          {
            name: 'search',
            description: 'Search the web',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query' }
              }
            }
          }
        ],
        reasoning: {
          enabled: true,
          strategy: 'chain-of-thought'
        },
        memory: {
          enabled: true,
          shortTerm: true,
          longTerm: true
        }
      },
      execution: {
        llm: {
          provider: 'ollama',
          model: 'ministral-3:3b',
          temperature: 0.7
        }
      }
    }
  },

  crewai: {
    protocol: 'crewai',
    agent: {
      role: 'Data Analyst',
      goal: 'Analyze data and provide insights',
      backstory: 'An experienced data analyst with 10 years of experience in statistical analysis and visualization',
      tools: ['python_repl', 'file_reader', 'web_search'],
      memory: true,
      verbose: true,
      llm: {
        model: 'gpt-4',
        temperature: 0.5
      }
    }
  },

  mcp: {
    protocol: 'mcp',
    agent: {
      protocolVersion: '2025-11-25',
      serverInfo: {
        name: 'FileSystemServer',
        version: '1.0.0'
      },
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      },
      tools: [
        {
          name: 'read_file',
          description: 'Read contents of a file',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File path to read' }
            },
            required: ['path']
          }
        },
        {
          name: 'list_directory',
          description: 'List files in a directory',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Directory path' }
            },
            required: ['path']
          }
        }
      ]
    }
  },

  openai: {
    protocol: 'openai',
    agent: {
      name: 'Customer Support Assistant',
      description: 'Helpful assistant for customer support inquiries',
      model: 'gpt-4o',
      instructions: 'You are a friendly customer support assistant. Help users with their questions and issues in a professional and empathetic manner.',
      tools: [
        {
          type: 'function',
          function: {
            name: 'lookup_order',
            description: 'Look up order details by order ID',
            parameters: {
              type: 'object',
              properties: {
                order_id: { type: 'string', description: 'Order ID to look up' }
              },
              required: ['order_id']
            }
          }
        },
        {
          type: 'file_search'
        }
      ],
      metadata: {
        department: 'support',
        tier: 'premium'
      }
    }
  },

  a2a: {
    protocol: 'a2a',
    agent: {
      name: 'Translation Agent',
      description: 'Multilingual translation service',
      url: 'https://example.com/translation-agent',
      version: '2.1.0',
      skills: [
        {
          id: 'translate',
          name: 'Translate Text',
          description: 'Translate text between languages',
          parameters: {
            text: { type: 'string' },
            from_lang: { type: 'string' },
            to_lang: { type: 'string' }
          }
        },
        {
          id: 'detect_language',
          name: 'Detect Language',
          description: 'Detect the language of input text',
          parameters: {
            text: { type: 'string' }
          }
        }
      ],
      capabilities: {
        streaming: true,
        pushNotifications: false
      },
      defaultInputModes: ['text'],
      defaultOutputModes: ['text']
    }
  }
};

// ============================================================================
// CLI Functions
// ============================================================================

/**
 * Print banner
 */
function printBanner() {
  console.log(chalk.cyan.bold('\n╔═══════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║   🔄 Universal Adapter V2 Test Suite 🔄      ║'));
  console.log(chalk.cyan.bold('╚═══════════════════════════════════════════════╝\n'));
}

/**
 * List available protocols
 */
function listProtocols() {
  const adapter = getSharedAdapter();
  const protocols = adapter.listProtocols();

  console.log(chalk.yellow.bold('\n📋 Registered Protocols:\n'));

  for (const protocol of protocols) {
    const trustColor = {
      internal: chalk.green,
      verified: chalk.blue,
      experimental: chalk.yellow,
      community: chalk.gray
    }[protocol.trustLevel];

    console.log(trustColor(`  • ${protocol.id.padEnd(12)} - ${protocol.name}`));
    console.log(chalk.gray(`    Version: ${protocol.version}, Trust: ${protocol.trustLevel}`));
    console.log(chalk.gray(`    Docs: ${protocol.docsUrl}\n`));
  }

  console.log(chalk.yellow.bold('📦 Example Agents Available:\n'));
  for (const [key, { protocol }] of Object.entries(EXAMPLE_AGENTS)) {
    console.log(chalk.cyan(`  • ${key.padEnd(12)} (${protocol})`));
  }
  console.log();
}

/**
 * Translate agent between protocols
 */
async function testTranslation(sourceProtocol: string, targetProtocol: string) {
  console.log(chalk.yellow.bold(`\n🔄 Translation Test: ${sourceProtocol} → ${targetProtocol}\n`));

  // Get example agent
  const example = EXAMPLE_AGENTS[sourceProtocol];
  if (!example) {
    console.error(chalk.red(`❌ No example agent found for protocol: ${sourceProtocol}`));
    console.log(chalk.gray(`Available: ${Object.keys(EXAMPLE_AGENTS).join(', ')}`));
    return;
  }

  try {
    const startTime = Date.now();
    
    console.log(chalk.cyan('📤 Source Agent:'));
    console.log(chalk.gray(JSON.stringify(example.agent, null, 2)));
    console.log();

    // Perform translation
    const result = await quickTranslate(example.agent, sourceProtocol, targetProtocol);

    const duration = Date.now() - startTime;

    console.log(chalk.green('✅ Translation Complete!\n'));
    console.log(chalk.yellow(`⏱️  Duration: ${duration}ms`));
    console.log(chalk.yellow(`🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%`));
    console.log(chalk.yellow(`💾 Cache Hits: spec=${result.cacheHits.specCache}, mapping=${result.cacheHits.mappingCache}`));
    
    if (result.verified) {
      console.log(chalk.green(`✓ Verified (fidelity: ${((result.fidelityScore ?? 0) * 100).toFixed(1)}%)`));
    }

    if (result.warnings.length > 0) {
      console.log(chalk.yellow('\n⚠️  Warnings:'));
      result.warnings.forEach(w => console.log(chalk.yellow(`  - ${w}`)));
    }

    if (result.unmappedFields.length > 0) {
      console.log(chalk.gray('\n🔍 Unmapped Fields:'));
      result.unmappedFields.forEach(f => console.log(chalk.gray(`  - ${f}`)));
    }

    console.log(chalk.cyan('\n📥 Translated Agent:'));
    console.log(chalk.gray(JSON.stringify(result.translatedAgent, null, 2)));
    console.log();

    console.log(chalk.green('✨ Translation successful!\n'));
  } catch (error) {
    console.error(chalk.red('\n❌ Translation failed:'));
    console.error(chalk.red((error as Error).message));
    console.log();
  }
}

/**
 * Morph agent while preserving identity
 */
async function testMorphing(sourceProtocol: string, targetProtocol: string) {
  console.log(chalk.yellow.bold(`\n🦋 Morphing Test: ${sourceProtocol} → ${targetProtocol}\n`));

  const example = EXAMPLE_AGENTS[sourceProtocol];
  if (!example) {
    console.error(chalk.red(`❌ No example agent found for protocol: ${sourceProtocol}`));
    return;
  }

  try {
    const startTime = Date.now();

    console.log(chalk.cyan('📤 Source Agent:'));
    console.log(chalk.gray(JSON.stringify(example.agent, null, 2)));
    console.log();

    // Perform morphing
    const result = await quickMorph(example.agent, sourceProtocol, targetProtocol, {
      preserveExtensions: true
    });

    const duration = Date.now() - startTime;

    console.log(chalk.green('✅ Morphing Complete!\n'));
    console.log(chalk.yellow(`⏱️  Duration: ${duration}ms`));
    console.log(chalk.yellow(`🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%`));

    const report = result.morphingReport;
    console.log(chalk.cyan('\n📊 Morphing Report:'));
    console.log(chalk.gray(`  Identity Preserved: ${report.identityPreserved ? '✓' : '✗'}`));
    console.log(chalk.gray(`  Capabilities: ${report.capabilitiesCount.source} → ${report.capabilitiesCount.target}`));
    console.log(chalk.gray(`  Instructions Transferred: ${report.instructionsTransferred ? '✓' : '✗'}`));
    console.log(chalk.gray(`  State Preserved: ${report.statePreserved ? '✓' : '✗'}`));

    if (report.dataLoss.length > 0) {
      console.log(chalk.red('\n⚠️  Data Loss:'));
      report.dataLoss.forEach(d => console.log(chalk.red(`  - ${d}`)));
    }

    if (report.transformations.length > 0) {
      console.log(chalk.cyan('\n🔧 Transformations:'));
      report.transformations.forEach(t => {
        console.log(chalk.gray(`  - ${t.field}: ${t.action}`));
        if (t.from && t.to) {
          console.log(chalk.gray(`    ${t.from} → ${t.to}`));
        }
      });
    }

    console.log(chalk.cyan('\n📥 Morphed Agent:'));
    console.log(chalk.gray(JSON.stringify(result.translatedAgent, null, 2)));
    console.log();

    console.log(chalk.green('✨ Morphing successful!\n'));
  } catch (error) {
    console.error(chalk.red('\n❌ Morphing failed:'));
    console.error(chalk.red((error as Error).message));
    console.log();
  }
}

/**
 * Run interactive demo
 */
async function runDemo() {
  console.log(chalk.yellow.bold('\n🎪 Running Interactive Demo\n'));

  const tests = [
    { name: 'USA → MCP', source: 'usa', target: 'mcp' },
    { name: 'CrewAI → A2A', source: 'crewai', target: 'a2a' },
    { name: 'OpenAI → USA', source: 'openai', target: 'usa' }
  ];

  for (const test of tests) {
    console.log(chalk.cyan(`\n${'═'.repeat(60)}`));
    console.log(chalk.cyan.bold(`  ${test.name}`));
    console.log(chalk.cyan(`${'═'.repeat(60)}\n`));

    await testTranslation(test.source, test.target);
    
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(chalk.green.bold('\n✨ Demo complete!\n'));
}

/**
 * Get cache statistics
 */
function showCacheStats() {
  const adapter = getSharedAdapter();
  const stats = adapter.getCacheStats();

  console.log(chalk.yellow.bold('\n📊 Cache Statistics:\n'));
  console.log(chalk.cyan('  Spec Cache:'));
  console.log(chalk.gray(`    Size: ${stats.specCache.size} entries`));
  console.log(chalk.gray(`    Hit Rate: ${(stats.specCache.hitRate * 100).toFixed(1)}%`));
  
  console.log(chalk.cyan('\n  Mapping Cache:'));
  console.log(chalk.gray(`    Size: ${stats.mappingCache.size} entries`));
  console.log(chalk.gray(`    Total Uses: ${stats.mappingCache.totalUses}`));
  console.log(chalk.gray(`    Avg Confidence: ${(stats.mappingCache.avgConfidence * 100).toFixed(1)}%`));
  console.log();
}

// ============================================================================
// Main CLI
// ============================================================================

async function main() {
  printBanner();

  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case '--list':
    case '-l':
      listProtocols();
      break;

    case '--translate':
    case '-t': {
      const [_, source, target] = args;
      if (!source || !target) {
        console.error(chalk.red('Usage: --translate <source-protocol> <target-protocol>'));
        console.log(chalk.gray('Example: --translate usa mcp'));
        process.exit(1);
      }
      await testTranslation(source, target);
      break;
    }

    case '--morph':
    case '-m': {
      const [_, source, target] = args;
      if (!source || !target) {
        console.error(chalk.red('Usage: --morph <source-protocol> <target-protocol>'));
        console.log(chalk.gray('Example: --morph usa a2a'));
        process.exit(1);
      }
      await testMorphing(source, target);
      break;
    }

    case '--stats':
    case '-s':
      showCacheStats();
      break;

    case '--demo':
    case '-d':
      await runDemo();
      break;

    case '--help':
    case '-h':
    default:
      console.log(chalk.yellow('Usage:'));
      console.log(chalk.gray('  npm run test:adapter -- [command] [options]\n'));
      console.log(chalk.cyan('Commands:'));
      console.log(chalk.gray('  -l, --list                        List available protocols'));
      console.log(chalk.gray('  -t, --translate <src> <target>    Translate agent between protocols'));
      console.log(chalk.gray('  -m, --morph <src> <target>        Morph agent (preserve identity)'));
      console.log(chalk.gray('  -s, --stats                       Show cache statistics'));
      console.log(chalk.gray('  -d, --demo                        Run interactive demo'));
      console.log(chalk.gray('  -h, --help                        Show this help\n'));
      console.log(chalk.yellow('Examples:'));
      console.log(chalk.gray('  npm run test:adapter -- --list'));
      console.log(chalk.gray('  npm run test:adapter -- --translate usa mcp'));
      console.log(chalk.gray('  npm run test:adapter -- --morph crewai a2a'));
      console.log(chalk.gray('  npm run test:adapter -- --demo\n'));
      break;
  }
}

// Run CLI
main().catch(error => {
  console.error(chalk.red('\n💥 Fatal error:'));
  console.error(chalk.red(error.message));
  console.error(chalk.gray(error.stack));
  process.exit(1);
});