#!/usr/bin/env node
/**
 * Chrysalis CLI - Unified Command-Line Interface
 * 
 * Consolidates agent-morph v1 and v2 into a single CLI with standardized
 * "morph" terminology. All agent transformation operations use "morph" as
 * the canonical verb.
 * 
 * @module chrysalis-cli
 * @see plans/CHRYSALIS_DEVELOPMENT_STREAMLINING_PLAN.md - Items H-2, M-1
 * 
 * Usage:
 *   chrysalis morph --from elizaos --to crewai --input agent.json --output agent_crewai.json
 *   chrysalis morph --type mcp --to mcp --input agent.json --output agent_mcp.json
 *   chrysalis sync --instance-id <id> --agent-file <file>
 *   chrysalis merge --agent-file <file> --instances <id1,id2,id3>
 *   chrysalis instances --agent-file <file>
 *   chrysalis validate --framework elizaos --input agent.json
 *   chrysalis keygen --output-dir ./keys
 *   chrysalis adapters
 *   chrysalis config --show
 */

import { program } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Converter } from '../converter/Converter';
import { ConverterV2 } from '../converter/ConverterV2';
import { adapterRegistry } from '../core/AdapterRegistry';
import { ElizaOSAdapter } from '../adapters/ElizaOSAdapter';
import { CrewAIAdapter } from '../adapters/CrewAIAdapter';
import { generateKeyPair } from '../core/Encryption';
import { getConfig, initializeConfig, validateConfig, exportConfig } from '../core/config';
import type { AgentImplementationType, SyncProtocol } from '../core/UniformSemanticAgentV2';

// Conditionally import v2 adapters (they may not exist in all setups)
let MCPAdapter: any;
let MultiAgentAdapter: any;
let OrchestratedAdapter: any;

try {
  MCPAdapter = require('../adapters/MCPAdapter').MCPAdapter;
  MultiAgentAdapter = require('../adapters/MultiAgentAdapter').MultiAgentAdapter;
  OrchestratedAdapter = require('../adapters/OrchestratedAdapter').OrchestratedAdapter;
} catch {
  // V2 adapters not available
}

// Register adapters
adapterRegistry.register(new ElizaOSAdapter(), ['elizaos', 'eliza']);
adapterRegistry.register(new CrewAIAdapter(), ['crewai', 'crew']);

// Register v2 adapters if available
if (MCPAdapter) {
  adapterRegistry.register(new MCPAdapter(), ['mcp', 'cline']);
}
if (MultiAgentAdapter) {
  adapterRegistry.register(new MultiAgentAdapter(), ['multi', 'multi_agent']);
}
if (OrchestratedAdapter) {
  adapterRegistry.register(new OrchestratedAdapter(), ['orchestrated', 'protocol']);
}

/**
 * Morph command - Unified transformation command
 * Replaces both "convert" (v1) and "morph" (v2) with a single implementation
 */
program
  .command('morph')
  .description('Morph agent between frameworks or implementation types')
  .requiredOption('--from <framework>', 'Source framework (elizaos, crewai, mcp, etc.)')
  .requiredOption('--to <framework>', 'Target framework')
  .requiredOption('--input <file>', 'Input agent file')
  .requiredOption('--output <file>', 'Output file path')
  .option('--type <type>', 'Target implementation type for v2 morphing (mcp, multi_agent, orchestrated)')
  .option('--sync <protocol>', 'Sync protocol for v2 (streaming, lumped, check_in)')
  .option('--key <file>', 'Private key file for signing')
  .option('--no-original', 'Do not include original in shadow (v1 compatibility)')
  .option('--no-experience-sync', 'Disable experience synchronization (v2)')
  .action(async (options) => {
    try {
      console.log('\n🦋 Morphing agent...\n');
      
      // Load input
      const inputData = await fs.readFile(options.input, 'utf-8');
      const sourceAgent = JSON.parse(inputData);
      
      // Get adapters
      const fromAdapter = adapterRegistry.get(options.from) as any;
      const toAdapter = adapterRegistry.get(options.to) as any;
      
      console.log(`From: ${fromAdapter.name} v${fromAdapter.version}`);
      console.log(`To: ${toAdapter.name} v${toAdapter.version}`);
      
      // Load private key if provided
      let privateKey: string | undefined;
      if (options.key) {
        privateKey = await fs.readFile(options.key, 'utf-8');
      }
      
      // Determine if we should use v2 morphing
      const useV2 = options.type || (toAdapter.supports_experience_sync);
      
      if (useV2 && options.type) {
        // V2 morphing with implementation type
        console.log(`Type: ${options.type}`);
        console.log(`Sync: ${options.sync || 'auto'}\n`);
        
        const converter = new ConverterV2();
        const result = await converter.morph(
          sourceAgent,
          options.type as AgentImplementationType,
          toAdapter,
          {
            privateKey,
            syncProtocol: options.sync as SyncProtocol,
            enableExperienceSync: options.experienceSync !== false
          }
        );
        
        // Save output
        await fs.writeFile(
          options.output,
          JSON.stringify(result.agent, null, 2)
        );
        
        console.log(`\n✓ Morphed agent saved to: ${options.output}`);
        console.log(`\n📋 Instance Details:`);
        console.log(`   Instance ID: ${result.instance_id}`);
        console.log(`   Type: ${result.metadata.type}`);
        console.log(`   Sync Protocol: ${result.syncChannel.protocol}`);
        console.log(`\n🔑 Restoration Key:`);
        console.log(`   ${result.restorationKey}\n`);
        
        // Save restoration key
        const keyFile = options.output.replace(/\.[^.]+$/, '.restoration-key.txt');
        await fs.writeFile(keyFile, result.restorationKey);
        
        // Save instance metadata
        const metaFile = options.output.replace(/\.[^.]+$/, '.instance.json');
        await fs.writeFile(metaFile, JSON.stringify({
          instance_id: result.instance_id,
          type: result.metadata.type,
          sync_channel: result.syncChannel
        }, null, 2));
        
        console.log(`   Key saved to: ${keyFile}`);
        console.log(`   Instance metadata: ${metaFile}\n`);
        
      } else {
        // V1 morphing (framework conversion)
        console.log();
        
        const converter = new Converter();
        const result = await converter.convert(
          sourceAgent,
          fromAdapter,
          toAdapter,
          {
            privateKey,
            includeOriginal: options.original !== false
          }
        );
        
        // Save output
        await fs.writeFile(
          options.output,
          JSON.stringify(result.agent, null, 2)
        );
        
        console.log(`\n✓ Morphed agent saved to: ${options.output}`);
        console.log(`\n🔑 Restoration Key (SAVE THIS!):`);
        console.log(`   ${result.restorationKey}\n`);
        
        // Save restoration key to file
        const keyFile = options.output.replace(/\.[^.]+$/, '.restoration-key.txt');
        await fs.writeFile(keyFile, result.restorationKey);
        console.log(`   Also saved to: ${keyFile}\n`);
      }
      
    } catch (error: any) {
      console.error('\n❌ Morphing failed:', error.message);
      process.exit(1);
    }
  });

/**
 * Restore command
 */
program
  .command('restore')
  .description('Restore agent to original framework using restoration key')
  .requiredOption('--framework <framework>', 'Target framework')
  .requiredOption('--input <file>', 'Input file (morphed agent)')
  .requiredOption('--output <file>', 'Output file path')
  .requiredOption('--restoration-key <key>', 'Restoration key')
  .option('--public-key <file>', 'Public key file for verification')
  .option('--merge-changes', 'Merge changes from morphed agent')
  .action(async (options) => {
    try {
      console.log('\n🦋 Restoring agent...\n');
      
      // Load input
      const inputData = await fs.readFile(options.input, 'utf-8');
      const morphedAgent = JSON.parse(inputData);
      
      // Get adapter
      const adapter = adapterRegistry.get(options.framework);
      console.log(`Framework: ${adapter.name} v${adapter.version}\n`);
      
      // Load public key if provided
      let publicKey: string | undefined;
      if (options.publicKey) {
        publicKey = await fs.readFile(options.publicKey, 'utf-8');
      }
      
      // Restore
      const converter = new Converter();
      const restored = await converter.restore(
        morphedAgent,
        adapter as any,
        options.restorationKey,
        {
          publicKey,
          mergeChanges: options.mergeChanges
        }
      );
      
      // Save output
      await fs.writeFile(
        options.output,
        JSON.stringify(restored, null, 2)
      );
      
      console.log(`\n✓ Agent restored to: ${options.output}\n`);
      
    } catch (error: any) {
      console.error('\n❌ Restoration failed:', error.message);
      process.exit(1);
    }
  });

/**
 * Sync command (v2 feature)
 */
program
  .command('sync')
  .description('Sync experiences from instance to source agent')
  .requiredOption('--instance-id <id>', 'Instance ID')
  .requiredOption('--agent-file <file>', 'Source agent file')
  .action(async (options) => {
    try {
      console.log('\n🔄 Syncing experiences...\n');
      
      // Load agent
      const agentData = await fs.readFile(options.agentFile, 'utf-8');
      const sourceAgent = JSON.parse(agentData);
      
      console.log(`Instance: ${options.instanceId}`);
      console.log(`Source agent: ${sourceAgent.identity?.name || 'Unknown'}\n`);
      
      // Sync
      const converter = new ConverterV2();
      const result = await converter.syncExperience(
        sourceAgent,
        options.instanceId
      );
      
      console.log(`\n✓ Sync complete!`);
      console.log(`   Memories: +${result.memories_added}`);
      console.log(`   Skills: +${result.skills_added}, ~${result.skills_updated}`);
      console.log(`   Knowledge: +${result.knowledge_added}`);
      console.log(`   Conflicts: ${result.conflicts.resolved}/${result.conflicts.total} resolved\n`);
      
      // Save updated agent
      await fs.writeFile(
        options.agentFile,
        JSON.stringify(sourceAgent, null, 2)
      );
      
    } catch (error: any) {
      console.error('\n❌ Sync failed:', error.message);
      process.exit(1);
    }
  });

/**
 * Merge command (v2 feature)
 */
program
  .command('merge')
  .description('Merge experiences from multiple instances')
  .requiredOption('--agent-file <file>', 'Source agent file')
  .requiredOption('--instances <ids>', 'Comma-separated instance IDs')
  .action(async (options) => {
    try {
      console.log('\n🔄 Merging experiences from multiple instances...\n');
      
      // Load agent
      const agentData = await fs.readFile(options.agentFile, 'utf-8');
      const sourceAgent = JSON.parse(agentData);
      
      const instanceIds = options.instances.split(',');
      
      console.log(`Source agent: ${sourceAgent.identity?.name || 'Unknown'}`);
      console.log(`Instances: ${instanceIds.length}\n`);
      
      // Merge
      const converter = new ConverterV2();
      const result = await converter.mergeMultipleInstances(
        sourceAgent,
        instanceIds
      );
      
      console.log(`\n✓ Multi-instance merge complete!`);
      console.log(`   Memories: +${result.memories_added}`);
      console.log(`   Skills: +${result.skills_added}`);
      console.log(`   Knowledge: +${result.knowledge_added}\n`);
      
      // Save updated agent
      await fs.writeFile(
        options.agentFile,
        JSON.stringify(sourceAgent, null, 2)
      );
      
    } catch (error: any) {
      console.error('\n❌ Merge failed:', error.message);
      process.exit(1);
    }
  });

/**
 * Instances command (v2 feature)
 */
program
  .command('instances')
  .description('List agent instances')
  .requiredOption('--agent-file <file>', 'Source agent file')
  .option('--status <status>', 'Filter by status')
  .action(async (options) => {
    try {
      console.log('\n📋 Agent Instances\n');
      
      // Load agent
      const agentData = await fs.readFile(options.agentFile, 'utf-8');
      const sourceAgent = JSON.parse(agentData);
      
      console.log(`Agent: ${sourceAgent.identity?.name || 'Unknown'}\n`);
      
      const allInstances = sourceAgent.instances?.active || [];
      const instances = options.status
        ? allInstances.filter((i: any) => i.status === options.status)
        : allInstances;
      
      if (instances.length === 0) {
        console.log('No instances found.\n');
        return;
      }
      
      console.log(`Active Instances: ${instances.length}\n`);
      
      instances.forEach((inst: any, i: number) => {
        console.log(`${i + 1}. ${inst.instance_id}`);
        console.log(`   Type: ${inst.type}`);
        console.log(`   Framework: ${inst.framework}`);
        console.log(`   Status: ${inst.status}`);
        console.log(`   Sync: ${inst.sync_protocol}`);
        console.log(`   Created: ${new Date(inst.created).toLocaleString()}`);
        console.log(`   Last sync: ${new Date(inst.last_sync).toLocaleString()}`);
        if (inst.statistics) {
          console.log(`   Stats: ${inst.statistics.total_syncs} syncs, ${inst.statistics.memories_contributed} memories`);
        }
        console.log();
      });
      
    } catch (error: any) {
      console.error('\n❌ Failed:', error.message);
      process.exit(1);
    }
  });

/**
 * Validate command
 */
program
  .command('validate')
  .description('Validate agent configuration')
  .requiredOption('--framework <framework>', 'Framework (elizaos, crewai, etc.)')
  .requiredOption('--input <file>', 'Input file path')
  .action(async (options) => {
    try {
      console.log('\n🔍 Validating agent...\n');
      
      // Load input
      const inputData = await fs.readFile(options.input, 'utf-8');
      const agent = JSON.parse(inputData);
      
      // Get adapter
      const adapter = adapterRegistry.get(options.framework) as any;
      console.log(`Framework: ${adapter.name} v${adapter.version}\n`);
      
      // Validate
      const result = await adapter.validate(agent);
      
      if (result.valid) {
        console.log('✓ Agent is valid\n');
        
        if (result.warnings && result.warnings.length > 0) {
          console.log('⚠️  Warnings:');
          result.warnings.forEach((w: string) => console.log(`   - ${w}`));
          console.log();
        }
      } else {
        console.log('❌ Agent is invalid\n');
        console.log('Errors:');
        result.errors.forEach((e: string) => console.log(`   - ${e}`));
        console.log();
        
        process.exit(1);
      }
      
    } catch (error: any) {
      console.error('\n❌ Validation failed:', error.message);
      process.exit(1);
    }
  });

/**
 * Inspect command
 */
program
  .command('inspect')
  .description('Inspect agent configuration and shadow data')
  .requiredOption('--framework <framework>', 'Framework')
  .requiredOption('--input <file>', 'Input file path')
  .action(async (options) => {
    try {
      console.log('\n🔍 Inspecting agent...\n');
      
      // Load input
      const inputData = await fs.readFile(options.input, 'utf-8');
      const agent = JSON.parse(inputData);
      
      // Get adapter
      const adapter = adapterRegistry.get(options.framework);
      
      // Convert to universal
      const universal: any = await adapter.toUniversal(agent);
      
      console.log(`Name: ${universal.identity?.name || 'Unknown'}`);
      console.log(`Designation: ${universal.identity?.designation || 'Unknown'}`);
      if (universal.identity?.fingerprint) {
        console.log(`Fingerprint: ${universal.identity.fingerprint.substring(0, 16)}...`);
      }
      if (universal.personality?.core_traits) {
        console.log(`\nPersonality Traits: ${universal.personality.core_traits.join(', ')}`);
      }
      if (universal.capabilities?.primary) {
        console.log(`Primary Capabilities: ${universal.capabilities.primary.join(', ')}`);
      }
      if (universal.knowledge?.topics) {
        console.log(`Knowledge Topics: ${universal.knowledge.topics.slice(0, 5).join(', ')}`);
      }
      
      // Check for shadow
      const converter = new Converter();
      const hasShadow = await converter.hasShadow(agent, adapter as any);
      console.log(`\nHas Shadow Data: ${hasShadow ? '✓' : '✗'}`);
      
      if (hasShadow) {
        const shadowInfo = await converter.getShadowInfo(agent, adapter as any);
        if (shadowInfo) {
          console.log(`Shadow Framework: ${shadowInfo.framework}`);
          console.log(`Shadow Version: ${shadowInfo.version}`);
          console.log(`Shadow Timestamp: ${new Date(shadowInfo.timestamp).toISOString()}`);
        }
      }
      
      console.log();
      
    } catch (error: any) {
      console.error('\n❌ Inspection failed:', error.message);
      process.exit(1);
    }
  });

/**
 * Key generation command
 */
program
  .command('keygen')
  .description('Generate RSA key pair for agent signing')
  .option('--output-dir <dir>', 'Output directory', '.')
  .action(async (options) => {
    try {
      console.log('\n🔐 Generating RSA key pair...\n');
      
      const { publicKey, privateKey } = generateKeyPair();
      
      const privateKeyPath = path.join(options.outputDir, 'agent_private_key.pem');
      const publicKeyPath = path.join(options.outputDir, 'agent_public_key.pem');
      
      await fs.writeFile(privateKeyPath, privateKey);
      await fs.writeFile(publicKeyPath, publicKey);
      
      console.log(`✓ Private key saved to: ${privateKeyPath}`);
      console.log(`✓ Public key saved to: ${publicKeyPath}`);
      console.log('\n⚠️  Keep the private key secure!\n');
      
    } catch (error: any) {
      console.error('\n❌ Key generation failed:', error.message);
      process.exit(1);
    }
  });

/**
 * List adapters command
 */
program
  .command('adapters')
  .description('List available framework adapters')
  .action(() => {
    console.log('\n📦 Available Framework Adapters:\n');
    
    const adapters = adapterRegistry.list();
    
    adapters.forEach(adapter => {
      const info = adapterRegistry.getInfo(adapter.name);
      console.log(`  • ${adapter.name} v${adapter.version}`);
      console.log(`    Shadow support: ${adapter.supports_shadow ? '✓' : '✗'}`);
      if (info.aliases.length > 0) {
        console.log(`    Aliases: ${info.aliases.join(', ')}`);
      }
      console.log();
    });
  });

/**
 * Configuration command
 */
program
  .command('config')
  .description('View or validate configuration')
  .option('--show', 'Show current configuration')
  .option('--validate', 'Validate configuration')
  .option('--file <path>', 'Load configuration from file')
  .action((options) => {
    try {
      // Initialize config
      const config = options.file ? initializeConfig(options.file) : getConfig();
      
      if (options.validate) {
        console.log('\n🔍 Validating configuration...\n');
        const result = validateConfig(config);
        
        if (result.valid) {
          console.log('✓ Configuration is valid\n');
        } else {
          console.log('❌ Configuration has errors:\n');
          result.errors.forEach(err => console.log(`   - ${err}`));
          console.log();
          process.exit(1);
        }
      }
      
      if (options.show || (!options.validate)) {
        console.log('\n📋 Current Configuration:\n');
        console.log(exportConfig(config));
        console.log();
      }
      
    } catch (error: any) {
      console.error('\n❌ Configuration error:', error.message);
      process.exit(1);
    }
  });

/**
 * Chat command - Interactive multi-agent TUI
 */
program
  .command('chat')
  .description('Start interactive multi-agent chat TUI')
  .option('--agent <name>', 'Start with specific agent focused')
  .option('--session <id>', 'Resume existing session')
  .option('--no-sidebar', 'Hide sidebar on start')
  .option('--debug', 'Enable debug mode')
  .action(async (options) => {
    try {
      // Dynamic import to avoid loading Ink when not needed
      const { startTUI } = await import('../tui');
      await startTUI({
        agent: options.agent,
        session: options.session,
        noSidebar: options.sidebar === false,
        debug: options.debug,
      });
    } catch (error: any) {
      console.error('\n❌ TUI Error:', error.message);
      if (error.message.includes('ink')) {
        console.error('\n💡 Make sure Ink is installed: npm install ink ink-text-input');
      }
      process.exit(1);
    }
  });

/**
 * Version command with deprecation notice for old CLIs
 */
program
  .command('version')
  .description('Show version information')
  .action(() => {
    console.log('\n🦋 Chrysalis CLI v3.0.0');
    console.log('   Uniform Semantic Agent Morphing System\n');
    console.log('   This CLI unifies and replaces:');
    console.log('   - agent-morph (v1) - DEPRECATED');
    console.log('   - agent-morph-v2 (v2) - DEPRECATED\n');
    console.log('   All "convert" operations are now "morph" operations.');
    console.log('   Use "chrysalis morph" for all agent transformations.\n');
  });

// Parse arguments
program
  .name('chrysalis')
  .description('Chrysalis - Uniform Semantic Agent Morphing System\n\n  Transform agents between frameworks while preserving identity and experience.')
  .version('3.0.0')
  .addHelpText('after', `

Examples:
  $ chrysalis chat                          # Start interactive multi-agent TUI
  $ chrysalis chat --agent architect        # Start with architect agent focused
  $ chrysalis morph --from elizaos --to crewai --input agent.json --output morphed.json
  $ chrysalis morph --type mcp --from elizaos --to mcp --input agent.json --output mcp_agent.json
  $ chrysalis sync --instance-id inst_123 --agent-file agent.json
  $ chrysalis validate --framework elizaos --input agent.json
  $ chrysalis config --show

Note: "agent-morph" and "agent-morph-v2" are deprecated. Use "chrysalis" instead.
`);

program.parse();