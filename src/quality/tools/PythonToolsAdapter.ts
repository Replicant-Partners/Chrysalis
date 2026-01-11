/**
 * Python Quality Tools Adapter
 *
 * Adapter for Python quality tools (flake8, black, mypy, isort, bandit, safety).
 *
 * Design Pattern: Adapter Pattern (GoF, p. 139)
 * - Adapts Python quality tools to unified interface
 * - Provides consistent interface for all Python tools
 *
 * References:
 * - Gamma, E., Helm, R., Johnson, R., & Vlissides, J. (1994). Design Patterns: Elements of Reusable Object-Oriented Software. Addison-Wesley. p. 139.
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
    IQualityTool,
    QualityToolResult,
    QualityIssue,
    QualityMetrics,
    QualityToolConfig,
} from './QualityToolInterface';
import { Result, ResultUtils, isFailure, getError } from './Result';

/**
 * Base Python Tool Adapter
 */
abstract class BasePythonTool implements IQualityTool {
    abstract readonly name: string;
    abstract readonly version?: string;

    constructor(protected projectRoot: string) {}

    /**
     * Check if tool is available
     */
    async isAvailable(): Promise<boolean> {
        try {
            const result = await this.executeCommand(['--version']);
            return result.exitCode === 0;
        } catch {
            return false;
        }
    }

    /**
     * Run quality check
     */
    abstract runCheck(
        targetPath: string,
        config?: QualityToolConfig
    ): Promise<QualityToolResult>;

    /**
     * Get default configuration
     */
    abstract getDefaultConfig(): QualityToolConfig;

    /**
     * Validate configuration
     */
    validateConfig(config: QualityToolConfig): boolean {
        return config.enabled !== false; // Default enabled
    }

    /**
     * Execute command
     */
    protected async executeCommand(
        args: string[],
        options?: { timeout?: number; cwd?: string }
    ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
        return new Promise((resolve, reject) => {
            const process = spawn(this.name, args, {
                cwd: options?.cwd || this.projectRoot,
                shell: true,
            });

            let stdout = '';
            let stderr = '';

            process.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            const timeout = options?.timeout || 300000; // 5 minutes default
            const timeoutId = setTimeout(() => {
                process.kill();
                reject(new Error(`Command timeout after ${timeout}ms`));
            }, timeout);

            process.on('close', (exitCode) => {
                clearTimeout(timeoutId);
                resolve({
                    exitCode: exitCode || 0,
                    stdout,
                    stderr,
                });
            });

            process.on('error', (error) => {
                clearTimeout(timeoutId);
                reject(error);
            });
        });
    }

    /**
     * Execute command with Result wrapper (Result pattern)
     */
    protected async executeCommandResult(
        args: string[],
        options?: { timeout?: number; cwd?: string }
    ): Promise<Result<{ exitCode: number; stdout: string; stderr: string }>> {
        return ResultUtils.fromPromise(this.executeCommand(args, options));
    }

    /**
     * Parse tool output (to be implemented by subclasses)
     */
    protected abstract parseOutput(
        stdout: string,
        stderr: string,
        exitCode: number,
        executionTime: number
    ): QualityToolResult;

    /**
     * Create error result for tool execution failure
     *
     * Reduces code duplication across adapters (DRY principle).
     *
     * @param error - The error that occurred
     * @param targetPath - Path that was being checked
     * @param executionTime - Time elapsed before error
     * @returns Standardized error result
     */
    protected createErrorResult(
        error: any,
        targetPath: string,
        executionTime: number
    ): QualityToolResult {
        return {
            tool_name: this.name,
            tool_version: this.version,
            success: false,
            errors: [
                {
                    severity: 'error',
                    message: error?.message || `${this.name} execution failed`,
                    file_path: targetPath,
                },
            ],
            warnings: [],
            metrics: this.createEmptyMetrics(1),
            execution_time_ms: executionTime,
            timestamp: new Date().toISOString(),
            error_output: error?.message,
        };
    }

    /**
     * Create empty metrics with optional error count
     *
     * @param errorCount - Number of errors (default 0)
     * @returns Empty metrics object
     */
    protected createEmptyMetrics(errorCount: number = 0): QualityMetrics {
        return {
            total_issues: errorCount,
            errors: errorCount,
            warnings: 0,
            info: 0,
            fixable_issues: 0,
            files_checked: 0,
            files_with_issues: errorCount > 0 ? 1 : 0,
        };
    }
}

/**
 * Flake8 Adapter
 */
export class Flake8Adapter extends BasePythonTool {
    readonly name = 'flake8';
    version?: string;

    async runCheck(
        targetPath: string,
        config?: QualityToolConfig
    ): Promise<QualityToolResult> {
        const startTime = Date.now();
        const cfg = config || this.getDefaultConfig();

        const args = [
            targetPath,
            '--format',
            'default',
            '--statistics',
            '--count',
        ];

        if (cfg.exclude_patterns) {
            args.push('--exclude', cfg.exclude_patterns.join(','));
        }

        if (cfg.options?.max_line_length) {
            args.push('--max-line-length', String(cfg.options.max_line_length));
        }

        if (cfg.options?.max_complexity) {
            args.push('--max-complexity', String(cfg.options.max_complexity));
        }

        const commandResult = await this.executeCommandResult(args, {
            timeout: cfg.timeout_ms || 300000,
        });

        const executionTime = Date.now() - startTime;

        if (isFailure(commandResult)) {
            return this.createErrorResult(getError(commandResult), targetPath, executionTime);
        }

        const { stdout, stderr, exitCode } = commandResult.value;
        return this.parseOutput(stdout, stderr, exitCode, executionTime);
    }

    getDefaultConfig(): QualityToolConfig {
        return {
            enabled: true,
            options: {
                max_line_length: 127,
                max_complexity: 10,
            },
            timeout_ms: 300000,
        };
    }

    protected parseOutput(
        stdout: string,
        stderr: string,
        exitCode: number,
        executionTime: number
    ): QualityToolResult {
        const issues: QualityIssue[] = [];
        const lines = stdout.split('\n').filter((line) => line.trim());

        for (const line of lines) {
            // Skip statistics lines
            if (line.includes('total') || line.match(/^\d+\s+\w+/)) {
                continue;
            }

            // Parse flake8 output: file:line:column: code message
            const match = line.match(/^(.+?):(\d+):(\d+):\s+(\w+)\s+(.+)$/);
            if (match) {
                const [, filePath, lineNum, colNum, code, message] = match;
                const severity = code.startsWith('E') || code.startsWith('F')
                    ? 'error'
                    : 'warning';

                issues.push({
                    severity,
                    rule_id: code,
                    rule_name: code,
                    message: message.trim(),
                    file_path: filePath,
                    line_number: parseInt(lineNum, 10),
                    column_number: parseInt(colNum, 10),
                    code,
                    fixable: code.startsWith('E501') || code.startsWith('W503'), // Some are fixable
                });
            }
        }

        const errors = issues.filter((i) => i.severity === 'error');
        const warnings = issues.filter((i) => i.severity === 'warning');

        // Extract statistics
        const statsMatch = stdout.match(/(\d+)\s+files?\s+checked/);
        const filesChecked = statsMatch ? parseInt(statsMatch[1], 10) : 0;

        const uniqueFiles = new Set(issues.map((i) => i.file_path));

        return {
            tool_name: this.name,
            tool_version: this.version,
            success: exitCode === 0 || issues.length === 0,
            errors,
            warnings,
            metrics: {
                total_issues: issues.length,
                errors: errors.length,
                warnings: warnings.length,
                info: 0,
                fixable_issues: issues.filter((i) => i.fixable).length,
                files_checked: filesChecked,
                files_with_issues: uniqueFiles.size,
            },
            execution_time_ms: executionTime,
            timestamp: new Date().toISOString(),
            output: stdout,
            error_output: stderr,
        };
    }
}

/**
 * Black Adapter (Formatter)
 */
export class BlackAdapter extends BasePythonTool {
    readonly name = 'black';
    version?: string;

    async runCheck(
        targetPath: string,
        config?: QualityToolConfig
    ): Promise<QualityToolResult> {
        const startTime = Date.now();
        const cfg = config || this.getDefaultConfig();

        const args = ['--check', '--diff', targetPath];

        if (cfg.options?.line_length) {
            args.push('--line-length', String(cfg.options.line_length));
        }

        try {
            const { stdout, stderr, exitCode } = await this.executeCommand(
                args,
                { timeout: cfg.timeout_ms || 300000 }
            );

            const executionTime = Date.now() - startTime;
            return this.parseOutput(stdout, stderr, exitCode, executionTime);
        } catch (error: any) {
            const executionTime = Date.now() - startTime;
            return this.createErrorResult(error, targetPath, executionTime);
        }
    }

    async applyFixes(
        targetPath: string,
        config?: QualityToolConfig
    ): Promise<QualityToolResult> {
        const startTime = Date.now();
        const cfg = config || this.getDefaultConfig();

        const args = [targetPath];

        if (cfg.options?.line_length) {
            args.push('--line-length', String(cfg.options.line_length));
        }

        try {
            const { stdout, stderr, exitCode } = await this.executeCommand(
                args,
                { timeout: cfg.timeout_ms || 300000 }
            );

            const executionTime = Date.now() - startTime;
            return {
                tool_name: this.name,
                tool_version: this.version,
                success: exitCode === 0,
                errors: [],
                warnings: [],
                metrics: {
                    total_issues: 0,
                    errors: 0,
                    warnings: 0,
                    info: 0,
                    fixable_issues: 0,
                    files_checked: 0,
                    files_with_issues: 0,
                },
                execution_time_ms: executionTime,
                timestamp: new Date().toISOString(),
                output: stdout,
                error_output: stderr,
            };
        } catch (error: any) {
            const executionTime = Date.now() - startTime;
            return this.createErrorResult(error, targetPath, executionTime);
        }
    }

    getDefaultConfig(): QualityToolConfig {
        return {
            enabled: true,
            options: {
                line_length: 127,
            },
            timeout_ms: 300000,
        };
    }

    protected parseOutput(
        stdout: string,
        stderr: string,
        exitCode: number,
        executionTime: number
    ): QualityToolResult {
        // Exit code 0 = formatted correctly, 1 = would reformat
        const needsFormatting = exitCode === 1;
        const issues: QualityIssue[] = [];

        if (needsFormatting) {
            // Parse diff output to extract file paths
            const fileMatches = stdout.match(/^would reformat (.+)$/gm);
            if (fileMatches) {
                for (const match of fileMatches) {
                    const filePath = match.replace('would reformat ', '').trim();
                    issues.push({
                        severity: 'warning',
                        rule_id: 'black_format',
                        rule_name: 'Black Formatting',
                        message: 'File would be reformatted',
                        file_path: filePath,
                        fixable: true,
                        fix_suggestion: 'Run black to format',
                    });
                }
            }
        }

            return {
                tool_name: this.name,
                tool_version: this.version,
                success: !needsFormatting,
            errors: [],
            warnings: issues,
            metrics: {
                total_issues: issues.length,
                errors: 0,
                warnings: issues.length,
                info: 0,
                fixable_issues: issues.length,
                files_checked: 0,
                files_with_issues: issues.length,
            },
            execution_time_ms: executionTime,
            timestamp: new Date().toISOString(),
            output: stdout,
            error_output: stderr,
        };
    }
}

/**
 * MyPy Adapter (Type Checker)
 */
export class MyPyAdapter extends BasePythonTool {
    readonly name = 'mypy';
    version?: string;

    async runCheck(
        targetPath: string,
        config?: QualityToolConfig
    ): Promise<QualityToolResult> {
        const startTime = Date.now();
        const cfg = config || this.getDefaultConfig();

        const args = [targetPath, '--show-error-codes', '--no-error-summary'];

        if (cfg.options?.ignore_missing_imports) {
            args.push('--ignore-missing-imports');
        }

        if (cfg.options?.strict) {
            args.push('--strict');
        }

        try {
            const { stdout, stderr, exitCode } = await this.executeCommand(
                args,
                { timeout: cfg.timeout_ms || 300000 }
            );

            const executionTime = Date.now() - startTime;
            return this.parseOutput(stdout, stderr, exitCode, executionTime);
        } catch (error: any) {
            const executionTime = Date.now() - startTime;
            return this.createErrorResult(error, targetPath, executionTime);
        }
    }

    getDefaultConfig(): QualityToolConfig {
        return {
            enabled: true,
            options: {
                ignore_missing_imports: true,
                strict: false,
            },
            timeout_ms: 300000,
        };
    }

    protected parseOutput(
        stdout: string,
        stderr: string,
        exitCode: number,
        executionTime: number
    ): QualityToolResult {
        const issues: QualityIssue[] = [];
        const lines = stdout.split('\n').filter((line) => line.trim());

        for (const line of lines) {
            // Parse mypy output: file:line: severity: message [code]
            const match = line.match(/^(.+?):(\d+):\s+(error|warning|note):\s+(.+?)(?:\s+\[(.+?)\])?$/);
            if (match) {
                const [, filePath, lineNum, severity, message, code] = match;
                issues.push({
                    severity: severity === 'error' ? 'error' : 'warning',
                    rule_id: code,
                    rule_name: code,
                    message: message.trim(),
                    file_path: filePath,
                    line_number: parseInt(lineNum, 10),
                    code,
                    fixable: false, // MyPy issues typically need manual fixes
                });
            }
        }

        const errors = issues.filter((i) => i.severity === 'error');
        const warnings = issues.filter((i) => i.severity === 'warning');

        const uniqueFiles = new Set(issues.map((i) => i.file_path));

        return {
            tool_name: this.name,
            tool_version: this.version,
            success: exitCode === 0 || issues.length === 0,
            errors,
            warnings,
            metrics: {
                total_issues: issues.length,
                errors: errors.length,
                warnings: warnings.length,
                info: 0,
                fixable_issues: 0,
                files_checked: 0,
                files_with_issues: uniqueFiles.size,
            },
            execution_time_ms: executionTime,
            timestamp: new Date().toISOString(),
            output: stdout,
            error_output: stderr,
        };
    }
}
