#!/usr/bin/env node
/**
 * Agent Morph CLI - Command-line interface for agent morphing
 * 
 * Usage:
 *   agent-morph convert --from elizaos --to crewai --input agent.json --output agent_crewai.json
 *   agent-morph restore --framework elizaos --input agent.json --restoration-key "key" --output restored.json
 *   agent-morph validate --framework elizaos --input agent.json
 *   agent-morph keygen --output-dir ./keys
 */

import { program } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Converter } from '../converter/Converter';
import { adapterRegistry } from '../core/AdapterRegistry';
import { ElizaOSAdapter } from '../adapters/ElizaOSAdapter';
import { CrewAIAdapter } from '../adapters/CrewAIAdapter';
import { generateKeyPair } from '../core/Encryption';

// Register adapters
adapterRegistry.register(new ElizaOSAdapter(), ['eliza']);
adapterRegistry.register(new CrewAIAdapter(), ['crew']);

/**
 * Convert command
 */
program
  .command('convert')
  .description('Convert agent from one framework to another')
  .requiredOption('--from <framework>', 'Source framework (elizaos, crewai)')
  .requiredOption('--to <framework>', 'Target framework (elizaos, crewai)')
  .requiredOption('--input <file>', 'Input file path')
  .requiredOption('--output <file>', 'Output file path')
  .option('--key <file>', 'Private key file for signing')
  .option('--no-original', 'Do not include original in shadow')
  .action(async (options) => {
    try {
      console.log('\n🔄 Converting agent...\n');
      
      // Load input
      const inputData = await fs.readFile(options.input, 'utf-8');
      const sourceAgent = JSON.parse(inputData);
      
      // Get adapters
      const fromAdapter = adapterRegistry.get(options.from) as any;
      const toAdapter = adapterRegistry.get(options.to) as any;
      
      console.log(`From: ${fromAdapter.name} v${fromAdapter.version}`);
      console.log(`To: ${toAdapter.name} v${toAdapter.version}\n`);
      
      // Load private key if provided
      let privateKey: string | undefined;
      if (options.key) {
        privateKey = await fs.readFile(options.key, 'utf-8');
      }
      
      // Convert
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
      
      console.log(`\n✓ Converted agent saved to: ${options.output}`);
      console.log(`\n🔑 Restoration Key (SAVE THIS!):`);
      console.log(`   ${result.restorationKey}\n`);
      
      // Save restoration key to file
      const keyFile = options.output.replace(/\.[^.]+$/, '.restoration-key.txt');
      await fs.writeFile(keyFile, result.restorationKey);
      console.log(`   Also saved to: ${keyFile}\n`);
      
    } catch (error: any) {
      console.error('\n❌ Conversion failed:', error.message);
      process.exit(1);
    }
  });

/**
 * Restore command
 */
program
  .command('restore')
  .description('Restore agent to original framework')
  .requiredOption('--framework <framework>', 'Target framework')
  .requiredOption('--input <file>', 'Input file (morphed agent)')
  .requiredOption('--output <file>', 'Output file path')
  .requiredOption('--restoration-key <key>', 'Restoration key')
  .option('--public-key <file>', 'Public key file for verification')
  .option('--merge-changes', 'Merge changes from morphed agent')
  .action(async (options) => {
    try {
      console.log('\n🔄 Restoring agent...\n');
      
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
 * Validate command
 */
program
  .command('validate')
  .description('Validate agent configuration')
  .requiredOption('--framework <framework>', 'Framework (elizaos, crewai)')
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
        
        if (result.warnings.length > 0) {
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
 * Inspect command
 */
program
  .command('inspect')
  .description('Inspect agent configuration')
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
      
      console.log(`Name: ${universal.identity.name}`);
      console.log(`Designation: ${universal.identity.designation}`);
      console.log(`Fingerprint: ${universal.identity.fingerprint?.substring(0, 16)}...`);
      console.log(`\nPersonality Traits: ${universal.personality.core_traits.join(', ')}`);
      console.log(`Primary Capabilities: ${universal.capabilities.primary.join(', ')}`);
      console.log(`Knowledge Topics: ${universal.knowledge.topics.slice(0, 5).join(', ')}`);
      
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

// Parse arguments
program
  .name('agent-morph')
  .description('Universal Agent Morphing System - Convert agents between frameworks')
  .version('1.0.0');

program.parse();
