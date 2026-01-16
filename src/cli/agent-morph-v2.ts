#!/usr/bin/env node
/**
 * @deprecated This CLI is deprecated. Use `chrysalis` instead.
 *
 * Agent Morph v2 CLI - DEPRECATED
 *
 * This CLI has been superseded by the unified `chrysalis` CLI.
 * Please migrate to using `chrysalis` for all operations.
 *
 * Migration guide:
 *   OLD: agent-morph-v2 morph --type mcp --to mcp --input agent.json --output out.json
 *   NEW: chrysalis morph --type mcp --from elizaos --to mcp --input agent.json --output out.json
 *
 *   OLD: agent-morph-v2 sync --instance-id <id> --agent-file <file>
 *   NEW: chrysalis sync --instance-id <id> --agent-file <file>
 *
 * @see src/cli/chrysalis-cli.ts - The unified CLI
 * @see plans/CHRYSALIS_DEVELOPMENT_STREAMLINING_PLAN.md - Item H-2
 */

import { createLogger } from '../shared/logger';

const log = createLogger('agent-morph-v2');

// Deprecation warning
log.warn('"agent-morph-v2" is deprecated. Use "chrysalis" CLI instead.');

import { program } from 'commander';
import * as fs from 'fs/promises';
import { ConverterV2 } from '../converter/ConverterV2';
import { adapterRegistry } from '../adapters/unified-adapter';
import { generateKeyPair } from '../core/Encryption';
import type { AgentImplementationType, SyncProtocol } from '../core/UniformSemanticAgentV2';

// Adapters are now auto-registered or loaded via registry-v2
// Legacy manual registration is removed.

/**
 * Morph command
 */
program
  .command('morph')
  .description('Morph agent to target implementation type')
  .requiredOption('--type <type>', 'Target type (mcp, multi_agent, orchestrated)')
  .requiredOption('--to <framework>', 'Target framework adapter')
  .requiredOption('--input <file>', 'Input Uniform Semantic Agent file')
  .requiredOption('--output <file>', 'Output file path')
  .option('--sync <protocol>', 'Sync protocol (streaming, lumped, check_in)')
  .option('--key <file>', 'Private key file for signing')
  .option('--no-experience-sync', 'Disable experience synchronization')
  .action(async (options) => {
    try {
      log.info('morphing agent');
      
      // Load input
      const inputData = await fs.readFile(options.input, 'utf-8');
      const sourceAgent = JSON.parse(inputData);
      
      // Get adapter (must be v2)
      const toAdapter = adapterRegistry.get(options.to) as any;  // Cast to FrameworkAdapterV2
      
      if (!toAdapter.supports_experience_sync) {
        log.warn('adapter does not support experience sync');
      }
      
      log.info('morph options', { type: options.type, framework: toAdapter.name, version: toAdapter.version, sync: options.sync || 'auto' });
      
      // Load private key if provided
      let privateKey: string | undefined;
      if (options.key) {
        privateKey = await fs.readFile(options.key, 'utf-8');
      }
      
      // Morph
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
      
      log.info('morph complete', {
        output: options.output,
        instance_id: result.instance_id,
        type: result.metadata.type,
        sync_protocol: result.syncChannel.protocol,
      });
      
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
      
      console.log(`   Also saved to: ${keyFile}`);
      console.log(`   Instance metadata: ${metaFile}\n`);
      
    } catch (error: any) {
      console.error('\n❌ Morphing failed:', error.message);
      process.exit(1);
    }
  });

/**
 * Sync command
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
      console.log(`Source agent: ${sourceAgent.identity.name}\n`);
      
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
 * Merge command
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
      
      console.log(`Source agent: ${sourceAgent.identity.name}`);
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
 * Instances command
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
      
      console.log(`Agent: ${sourceAgent.identity.name}\n`);
      
      const instances = options.status
        ? sourceAgent.instances.active.filter((i: any) => i.status === options.status)
        : sourceAgent.instances.active;
      
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
        console.log(`   Stats: ${inst.statistics.total_syncs} syncs, ${inst.statistics.memories_contributed} memories`);
        console.log();
      });
      
    } catch (error: any) {
      console.error('\n❌ Failed:', error.message);
      process.exit(1);
    }
  });

/**
 * List adapters command
 */
program
  .command('adapters')
  .description('List available adapters')
  .action(() => {
    console.log('\n📦 Available Adapters:\n');
    
    const adapters = adapterRegistry.list();
    
    adapters.forEach(adapter => {
      const info = adapterRegistry.getInfo(adapter.name);
      console.log(`  • ${adapter.name} v${adapter.version}`);
      console.log(`    Shadow: ${adapter.supports_shadow ? '✓' : '✗'}`);
      if (info.aliases.length > 0) {
        console.log(`    Aliases: ${info.aliases.join(', ')}`);
      }
      console.log();
    });
  });

/**
 * Keygen command
 */
program
  .command('keygen')
  .description('Generate RSA key pair')
  .option('--output-dir <dir>', 'Output directory', '.')
  .action(async (options) => {
    try {
      console.log('\n🔐 Generating RSA key pair...\n');
      
      const { publicKey, privateKey } = generateKeyPair();
      
      const privateKeyPath = `${options.outputDir}/agent_private_key.pem`;
      const publicKeyPath = `${options.outputDir}/agent_public_key.pem`;
      
      await fs.writeFile(privateKeyPath, privateKey);
      await fs.writeFile(publicKeyPath, publicKey);
      
      console.log(`✓ Private key: ${privateKeyPath}`);
      console.log(`✓ Public key: ${publicKeyPath}`);
      console.log('\n⚠️  Keep the private key secure!\n');
      
    } catch (error: any) {
      console.error('\n❌ Key generation failed:', error.message);
      process.exit(1);
    }
  });

// Parse arguments
program
  .name('agent-morph-v2')
  .description('Uniform Semantic Agent Morphing System v2.0 - With Experience Synchronization')
  .version('2.0.0');

program.parse();
