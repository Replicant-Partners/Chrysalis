#!/usr/bin/env node
/**
 * Universal Adapter Task CLI
 * 
 * Command-line interface for executing tasks with the Universal Adapter.
 * 
 * Usage:
 *   chrysalis-task <task-file.json> [options]
 *   chrysalis-task --help
 * 
 * @module cli/adapter-task
 */

import { Command } from 'commander';
import { executeTaskFromFile, createTaskExecutor } from '../adapters/universal/task-executor';
import type { Task } from '../adapters/universal/task-executor';
import chalk from 'chalk';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const program = new Command();

program
  .name('chrysalis-task')
  .description('Execute tasks with the Universal Adapter')
  .version('1.0.0')
  .argument('<task-file>', 'Path to task JSON file')
  .option('-o, --output <file>', 'Output file for results (default: <task-file>-result.json)')
  .option('-v, --verbose', 'Verbose output')
  .option('--no-save', 'Do not save result to file')
  .option('--pretty', 'Pretty print JSON output')
  .action(async (taskFile: string, options) => {
    try {
      console.log(chalk.cyan.bold('\n🔄 Universal Adapter Task Executor\n'));
      
      const taskPath = resolve(taskFile);
      console.log(chalk.gray(`📂 Loading task: ${taskPath}`));
      
      // Determine output path
      const outputPath = options.output || taskPath.replace(/\.json$/, '-result.json');
      
      // Execute task
      const startTime = Date.now();
      const result = await executeTaskFromFile(
        taskPath,
        options.save ? outputPath : undefined
      );
      const duration = Date.now() - startTime;
      
      // Print results
      console.log();
      if (result.success) {
        console.log(chalk.green('✅ Task Completed Successfully\n'));
      } else {
        console.log(chalk.red('❌ Task Failed\n'));
      }
      
      console.log(chalk.yellow('📊 Task Summary:'));
      console.log(chalk.gray(`  Task ID: ${result.taskId}`));
      console.log(chalk.gray(`  Task Type: ${result.taskType}`));
      if (result.taskName) {
        console.log(chalk.gray(`  Task Name: ${result.taskName}`));
      }
      console.log(chalk.gray(`  Duration: ${result.telemetry.durationMs}ms (wall: ${duration}ms)`));
      console.log(chalk.gray(`  LLM Calls: ${result.telemetry.llmCalls}`));
      console.log(chalk.gray(`  Cache Hits: spec=${result.telemetry.cacheHits.spec}, mapping=${result.telemetry.cacheHits.mapping}`));
      
      if (result.telemetry.warnings.length > 0) {
        console.log(chalk.yellow('\n⚠️  Warnings:'));
        result.telemetry.warnings.forEach(w => console.log(chalk.yellow(`  - ${w}`)));
      }
      
      if (result.telemetry.errors.length > 0) {
        console.log(chalk.red('\n❌ Errors:'));
        result.telemetry.errors.forEach(e => {
          console.log(chalk.red(`  - ${e.message}`));
          if (options.verbose && e.context) {
            console.log(chalk.gray(`    Context: ${e.context}`));
          }
        });
      }
      
      if (result.error) {
        console.log(chalk.red('\n❌ Error Details:'));
        console.log(chalk.red(`  ${result.error.message}`));
        if (options.verbose) {
          console.log(chalk.gray(JSON.stringify(result.error.details, null, 2)));
        }
      }
      
      if (options.save) {
        console.log(chalk.green(`\n💾 Results saved to: ${outputPath}`));
      }
      
      if (options.verbose && result.result) {
        console.log(chalk.cyan('\n📦 Result Data:'));
        console.log(chalk.gray(JSON.stringify(result.result, null, 2)));
      }
      
      console.log();
      
      // Exit with appropriate code
      process.exit(result.success ? 0 : 1);
      
    } catch (error) {
      console.error(chalk.red('\n💥 Fatal Error:'));
      console.error(chalk.red((error as Error).message));
      if (options.verbose) {
        console.error(chalk.gray((error as Error).stack));
      }
      process.exit(1);
    }
  });

// Subcommand: validate task file
program
  .command('validate <task-file>')
  .description('Validate a task JSON file without executing it')
  .action((taskFile: string) => {
    try {
      console.log(chalk.cyan.bold('\n🔍 Validating Task File\n'));
      
      const taskPath = resolve(taskFile);
      console.log(chalk.gray(`📂 Loading: ${taskPath}`));
      
      const content = readFileSync(taskPath, 'utf-8');
      const task = JSON.parse(content) as Task;
      
      console.log(chalk.green('✅ Valid JSON'));
      console.log(chalk.gray(`  Task Type: ${task.type}`));
      console.log(chalk.gray(`  Task Name: ${task.name || 'N/A'}`));
      console.log(chalk.gray(`  Task ID: ${task.id || 'auto-generated'}`));
      
      // Type-specific validation
      switch (task.type) {
        case 'translate':
          console.log(chalk.gray(`  Source: ${task.sourceProtocol}`));
          console.log(chalk.gray(`  Target: ${task.targetProtocol}`));
          console.log(chalk.gray(`  Agent: ${task.agent ? '✓' : '✗'}`));
          break;
        
        case 'morph':
          console.log(chalk.gray(`  Source: ${task.sourceProtocol}`));
          console.log(chalk.gray(`  Target: ${task.targetProtocol}`));
          console.log(chalk.gray(`  Agent: ${task.agent ? '✓' : '✗'}`));
          break;
        
        case 'validate':
          console.log(chalk.gray(`  Protocol: ${task.protocol}`));
          console.log(chalk.gray(`  Agent: ${task.agent ? '✓' : '✗'}`));
          break;
        
        case 'discover':
          console.log(chalk.gray(`  Protocol: ${task.protocol}`));
          break;
        
        case 'batch':
          console.log(chalk.gray(`  Subtasks: ${task.tasks.length}`));
          console.log(chalk.gray(`  Stop on Error: ${task.stopOnError ?? false}`));
          break;
      }
      
      console.log(chalk.green('\n✅ Task file is valid\n'));
      process.exit(0);
      
    } catch (error) {
      console.error(chalk.red('\n❌ Invalid Task File:'));
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

// Subcommand: create template
program
  .command('template <type>')
  .description('Create a task template file')
  .option('-o, --output <file>', 'Output file (default: task-<type>.json)')
  .action((type: string, options) => {
    try {
      console.log(chalk.cyan.bold('\n📝 Creating Task Template\n'));
      
      const templates: Record<string, Task> = {
        translate: {
          type: 'translate',
          name: 'Example Translation Task',
          sourceProtocol: 'usa',
          targetProtocol: 'mcp',
          agent: {
            apiVersion: 'usa/v2',
            kind: 'Agent',
            metadata: { name: 'ExampleAgent' },
            identity: { name: 'Example', role: 'Assistant' },
            capabilities: { tools: [] }
          },
          metadata: {
            description: 'Translate USA agent to MCP format',
            created: new Date().toISOString()
          }
        },
        
        morph: {
          type: 'morph',
          name: 'Example Morphing Task',
          sourceProtocol: 'crewai',
          targetProtocol: 'openai',
          agent: {
            role: 'Data Analyst',
            goal: 'Analyze data',
            backstory: 'Expert analyst',
            tools: []
          },
          options: {
            preserveExtensions: true
          },
          metadata: {
            description: 'Morph CrewAI agent to OpenAI assistant',
            created: new Date().toISOString()
          }
        },
        
        validate: {
          type: 'validate',
          name: 'Example Validation Task',
          protocol: 'usa',
          agent: {
            apiVersion: 'usa/v2',
            kind: 'Agent',
            metadata: { name: 'TestAgent' }
          },
          metadata: {
            description: 'Validate agent against USA protocol',
            created: new Date().toISOString()
          }
        },
        
        discover: {
          type: 'discover',
          name: 'Example Discovery Task',
          protocol: 'mcp',
          metadata: {
            description: 'Discover MCP protocol capabilities',
            created: new Date().toISOString()
          }
        },
        
        batch: {
          type: 'batch',
          name: 'Example Batch Task',
          tasks: [
            {
              type: 'translate',
              sourceProtocol: 'usa',
              targetProtocol: 'mcp',
              agent: { metadata: { name: 'Agent1' } }
            },
            {
              type: 'translate',
              sourceProtocol: 'usa',
              targetProtocol: 'a2a',
              agent: { metadata: { name: 'Agent2' } }
            }
          ],
          stopOnError: false,
          metadata: {
            description: 'Batch translation of multiple agents',
            created: new Date().toISOString()
          }
        }
      };
      
      const template = templates[type];
      if (!template) {
        console.error(chalk.red(`Unknown template type: ${type}`));
        console.log(chalk.gray(`Available: ${Object.keys(templates).join(', ')}`));
        process.exit(1);
      }
      
      const outputPath = options.output || `task-${type}.json`;
      writeFileSync(outputPath, JSON.stringify(template, null, 2), 'utf-8');
      
      console.log(chalk.green(`✅ Template created: ${outputPath}`));
      console.log(chalk.gray('\nEdit the file and run:'));
      console.log(chalk.cyan(`  chrysalis-task ${outputPath}\n`));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to create template:'));
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

program.parse();