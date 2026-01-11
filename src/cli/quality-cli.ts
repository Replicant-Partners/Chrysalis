#!/usr/bin/env node
/**
 * Quality CLI
 *
 * Command-line interface for quality tools and auto-fix.
 *
 * Usage:
 *   node dist/cli/quality-cli.js check <path>
 *   node dist/cli/quality-cli.js fix <path>
 *   node dist/cli/quality-cli.js metrics <path>
 */

import { Command } from 'commander';
import * as path from 'path';
import {
    QualityToolOrchestrator,
} from '../quality/tools/QualityToolOrchestrator';
import {
    QualityResultAggregator,
} from '../quality/tools/QualityResultAggregator';
import { AutoFixer } from '../quality/auto-fix/AutoFixer';
import { Flake8Adapter, BlackAdapter, MyPyAdapter } from '../quality/tools/PythonToolsAdapter';
import { ESLintAdapter, TypeScriptCompilerAdapter } from '../quality/tools/TypeScriptToolsAdapter';

const program = new Command();

program
    .name('quality')
    .description('Quality tools and auto-fix CLI')
    .version('1.0.0');

// Check command
program
    .command('check')
    .description('Run quality checks')
    .argument('<path>', 'Path to check')
    .option('--parallel', 'Run tools in parallel', false)
    .option('--timeout <ms>', 'Timeout in milliseconds', '300000')
    .option('--continue-on-error', 'Continue on error', true)
    .option('--tools <tools...>', 'Specific tools to run (default: all)')
    .action(async (targetPath: string, options) => {
        try {
            const projectRoot = path.resolve(process.cwd(), targetPath);
            const orchestrator = new QualityToolOrchestrator({
                parallel: options.parallel,
                timeout_ms: parseInt(options.timeout, 10),
                continue_on_error: options.continueOnError,
            });

            // Register tools
            orchestrator.registerTools([
                new Flake8Adapter(projectRoot),
                new BlackAdapter(projectRoot),
                new MyPyAdapter(projectRoot),
                new ESLintAdapter(projectRoot),
                new TypeScriptCompilerAdapter(projectRoot),
            ]);

            // Execute tools
            const toolNames = options.tools || undefined;
            const result = toolNames
                ? await orchestrator.executeTools(toolNames, projectRoot, {
                      parallel: options.parallel,
                      timeout_ms: parseInt(options.timeout, 10),
                      continue_on_error: options.continueOnError,
                  })
                : await orchestrator.executeAll(projectRoot, {
                      parallel: options.parallel,
                      timeout_ms: parseInt(options.timeout, 10),
                      continue_on_error: options.continueOnError,
                  });

            // Aggregate results
            const aggregator = new QualityResultAggregator();
            const report = aggregator.aggregateResults(result.results);
            const summary = aggregator.getSummary(report);

            // Output summary
            console.log('\nQuality Check Summary:');
            console.log('='.repeat(70));
            console.log(`Tools Executed: ${summary.total_tools}`);
            console.log(`Tools Succeeded: ${summary.tools_succeeded}`);
            console.log(`Tools Failed: ${summary.tools_failed}`);
            console.log(`Total Issues: ${summary.total_issues}`);
            console.log(`Total Errors: ${summary.total_errors}`);
            console.log(`Total Warnings: ${summary.total_warnings}`);
            console.log(`Files with Issues: ${summary.files_with_issues}`);
            console.log(`Overall Success: ${summary.overall_success ? '✅' : '❌'}`);

            if (result.errors.length > 0) {
                console.log('\nErrors:');
                result.errors.forEach((error) => console.log(`  - ${error}`));
            }

            // Exit with error code if failed
            process.exit(summary.overall_success ? 0 : 1);
        } catch (error: any) {
            console.error('Error:', error.message);
            process.exit(1);
        }
    });

// Fix command
program
    .command('fix')
    .description('Auto-fix quality issues')
    .argument('<path>', 'Path to fix')
    .option('--parallel', 'Run tools in parallel', false)
    .option('--timeout <ms>', 'Timeout in milliseconds', '300000')
    .option('--continue-on-error', 'Continue on error', true)
    .option('--tools <tools...>', 'Specific tools to run (default: all fixable)')
    .action(async (targetPath: string, options) => {
        try {
            const projectRoot = path.resolve(process.cwd(), targetPath);
            const orchestrator = new QualityToolOrchestrator({
                parallel: options.parallel,
                timeout_ms: parseInt(options.timeout, 10),
                continue_on_error: options.continueOnError,
            });

            // Register tools
            orchestrator.registerTools([
                new Flake8Adapter(projectRoot),
                new BlackAdapter(projectRoot),
                new MyPyAdapter(projectRoot),
                new ESLintAdapter(projectRoot),
                new TypeScriptCompilerAdapter(projectRoot),
            ]);

            // Create auto-fixer
            const autoFixer = new AutoFixer(orchestrator);

            // Show fixable tools
            const fixableTools = autoFixer.getFixableTools();
            console.log(`\nFixable tools: ${fixableTools.join(', ')}`);

            // Apply fixes
            const result = await autoFixer.applyFixes(projectRoot, {
                parallel: options.parallel,
                timeout_ms: parseInt(options.timeout, 10),
                continue_on_error: options.continueOnError,
                tools: options.tools,
            });

            // Output summary
            console.log('\nAuto-Fix Summary:');
            console.log('='.repeat(70));
            console.log(`Tools Executed: ${result.tools_executed}`);
            console.log(`Tools Succeeded: ${result.tools_succeeded}`);
            console.log(`Tools Failed: ${result.tools_failed}`);
            console.log(`Files Fixed: ${result.files_fixed}`);
            console.log(`Execution Time: ${result.total_execution_time_ms}ms`);
            console.log(`Overall Success: ${result.success ? '✅' : '❌'}`);

            if (result.errors.length > 0) {
                console.log('\nErrors:');
                result.errors.forEach((error) => console.log(`  - ${error}`));
            }

            // Exit with error code if failed
            process.exit(result.success ? 0 : 1);
        } catch (error: any) {
            console.error('Error:', error.message);
            process.exit(1);
        }
    });

// Metrics command
program
    .command('metrics')
    .description('Collect quality metrics')
    .argument('<path>', 'Path to analyze')
    .option('--output <file>', 'Output file (default: stdout)')
    .option('--format <format>', 'Output format (json|summary)', 'summary')
    .action(async (targetPath: string, options) => {
        try {
            const { spawn } = await import('child_process');
            const projectRoot = path.resolve(process.cwd(), targetPath);
            const scriptPath = path.join(__dirname, '../../../scripts/quality/enhanced_quality_metrics.py');

            const args = [scriptPath, '--project-root', projectRoot];
            if (options.output) {
                args.push('--output', options.output);
            }
            if (options.format) {
                args.push('--format', options.format);
            }

            const process_handle = spawn('python3', args, {
                cwd: projectRoot,
                stdio: 'inherit',
            });

            process_handle.on('close', (code) => {
                process.exit(code || 0);
            });

            process_handle.on('error', (error: Error) => {
                console.error('Error:', error.message);
                process.exit(1);
            });
        } catch (error: any) {
            console.error('Error:', error.message);
            process.exit(1);
        }
    });

// Parse arguments
program.parse();
