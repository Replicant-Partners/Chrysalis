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
import { createLogger } from '../shared/logger';
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
const log = createLogger('quality-cli');

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

            // Output summary (structured)
            log.info('quality summary', {
                tools_executed: summary.total_tools,
                tools_succeeded: summary.tools_succeeded,
                tools_failed: summary.tools_failed,
                total_issues: summary.total_issues,
                total_errors: summary.total_errors,
                total_warnings: summary.total_warnings,
                files_with_issues: summary.files_with_issues,
                overall_success: summary.overall_success,
                errors: result.errors,
            });

            // Exit with error code if failed
            process.exit(summary.overall_success ? 0 : 1);
        } catch (error: any) {
            log.error('quality check failed', { error: error?.message || String(error) });
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
            log.info('fixable tools', { tools: fixableTools });

            // Apply fixes
            const result = await autoFixer.applyFixes(projectRoot, {
                parallel: options.parallel,
                timeout_ms: parseInt(options.timeout, 10),
                continue_on_error: options.continueOnError,
                tools: options.tools,
            });

            // Output summary
            log.info('auto-fix summary', {
                tools_executed: result.tools_executed,
                tools_succeeded: result.tools_succeeded,
                tools_failed: result.tools_failed,
                files_fixed: result.files_fixed,
                execution_time_ms: result.total_execution_time_ms,
                overall_success: result.success,
                errors: result.errors,
            });

            // Exit with error code if failed
            process.exit(result.success ? 0 : 1);
        } catch (error: any) {
            log.error('auto-fix failed', { error: error?.message || String(error) });
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
                log.error('metrics process error', { error: error.message });
                process.exit(1);
            });
        } catch (error: any) {
            log.error('metrics failed', { error: error?.message || String(error) });
            process.exit(1);
        }
    });

// Parse arguments
program.parse();
