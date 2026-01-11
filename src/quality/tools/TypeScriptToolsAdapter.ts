/**
 * TypeScript Quality Tools Adapter
 *
 * Adapter for TypeScript quality tools (ESLint, TypeScript compiler).
 *
 * Design Pattern: Adapter Pattern (GoF, p. 139)
 * - Adapts TypeScript quality tools to unified interface
 * - Provides consistent interface for TypeScript tools
 *
 * References:
 * - Gamma, E., Helm, R., Johnson, R., & Vlissides, J. (1994). Design Patterns: Elements of Reusable Object-Oriented Software. Addison-Wesley. p. 139.
 */

import { spawn } from 'child_process';
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
 * Base TypeScript Tool Adapter
 */
abstract class BaseTypeScriptTool implements IQualityTool {
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
     * Execute npm script
     */
    protected async executeNpmScript(
        script: string,
        options?: { timeout?: number; cwd?: string }
    ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
        return this.executeCommand(['run', script], options);
    }

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
 * ESLint Adapter
 */
export class ESLintAdapter extends BaseTypeScriptTool {
    readonly name = 'eslint';
    version?: string;

    async runCheck(
        targetPath: string,
        config?: QualityToolConfig
    ): Promise<QualityToolResult> {
        const startTime = Date.now();
        const cfg = config || this.getDefaultConfig();

        // Use npm run lint if available, otherwise direct eslint
        let args: string[];
        let useNpm = false;

        try {
            // Check if package.json has lint script
            const packageJsonPath = path.join(this.projectRoot, 'package.json');
            const packageJson = JSON.parse(
                await fs.readFile(packageJsonPath, 'utf-8')
            );
            if (packageJson.scripts?.lint) {
                useNpm = true;
                args = ['lint', '--', targetPath];
            } else {
                args = [targetPath, '--format', 'json'];
            }
        } catch {
            // Fallback to direct eslint
            args = [targetPath, '--format', 'json'];
        }

        if (cfg.exclude_patterns) {
            args.push('--ignore-pattern', cfg.exclude_patterns.join(','));
        }

        const commandResult = useNpm
            ? await ResultUtils.fromPromise(
                  this.executeNpmScript('lint', {
                      timeout: cfg.timeout_ms || 300000,
                  })
              )
            : await this.executeCommandResult(args, {
                  timeout: cfg.timeout_ms || 300000,
              });

        const executionTime = Date.now() - startTime;

        if (isFailure(commandResult)) {
            return this.createErrorResult(getError(commandResult), targetPath, executionTime);
        }

        const result = commandResult.value;
        return this.parseOutput(
            result.stdout,
            result.stderr,
            result.exitCode,
            executionTime
        );
    }

    async applyFixes(
        targetPath: string,
        config?: QualityToolConfig
    ): Promise<QualityToolResult> {
        const startTime = Date.now();
        const cfg = config || this.getDefaultConfig();

        // Use npm run lint:fix if available, otherwise direct eslint --fix
        let args: string[];
        let useNpm = false;

        try {
            const packageJsonPath = path.join(this.projectRoot, 'package.json');
            const packageJson = JSON.parse(
                await fs.readFile(packageJsonPath, 'utf-8')
            );
            if (packageJson.scripts?.['lint:fix']) {
                useNpm = true;
                args = ['run', 'lint:fix', '--', targetPath];
            } else {
                args = [targetPath, '--fix'];
            }
        } catch {
            args = [targetPath, '--fix'];
        }

        try {
            let result: { exitCode: number; stdout: string; stderr: string };
            if (useNpm) {
                result = await this.executeNpmScript('lint:fix', {
                    timeout: cfg.timeout_ms || 300000,
                });
            } else {
                result = await this.executeCommand(args, {
                    timeout: cfg.timeout_ms || 300000,
                });
            }

            const executionTime = Date.now() - startTime;
            return {
                tool_name: this.name,
                tool_version: this.version,
                success: result.exitCode === 0,
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
                output: result.stdout,
                error_output: result.stderr,
            };
        } catch (error: any) {
            const executionTime = Date.now() - startTime;
            return this.createErrorResult(error, targetPath, executionTime);
        }
    }

    getDefaultConfig(): QualityToolConfig {
        return {
            enabled: true,
            options: {},
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

        try {
            // Try to parse JSON output
            const jsonOutput = JSON.parse(stdout);
            if (Array.isArray(jsonOutput)) {
                for (const fileResult of jsonOutput) {
                    if (fileResult.messages && Array.isArray(fileResult.messages)) {
                        for (const message of fileResult.messages) {
                            const severity = message.severity === 2 ? 'error' : 'warning';
                            issues.push({
                                severity,
                                rule_id: message.ruleId,
                                rule_name: message.ruleId,
                                message: message.message,
                                file_path: fileResult.filePath,
                                line_number: message.line,
                                column_number: message.column,
                                code: message.ruleId,
                                fixable: message.fix !== undefined,
                            });
                        }
                    }
                }
            }
        } catch {
            // Fallback to parsing text output
            const lines = stdout.split('\n').filter((line) => line.trim());
            for (const line of lines) {
                // Parse ESLint output: file:line:column message (rule)
                const match = line.match(/^(.+?):(\d+):(\d+):\s+(.+?)\s+\((.+?)\)$/);
                if (match) {
                    const [, filePath, lineNum, colNum, message, rule] = match;
                    issues.push({
                        severity: 'warning', // Default to warning for text output
                        rule_id: rule,
                        rule_name: rule,
                        message: message.trim(),
                        file_path: filePath,
                        line_number: parseInt(lineNum, 10),
                        column_number: parseInt(colNum, 10),
                        code: rule,
                        fixable: false, // Can't determine from text output
                    });
                }
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
                fixable_issues: issues.filter((i) => i.fixable).length,
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

/**
 * TypeScript Compiler Adapter
 */
export class TypeScriptCompilerAdapter extends BaseTypeScriptTool {
    readonly name = 'tsc';
    version?: string;

    async runCheck(
        targetPath: string,
        config?: QualityToolConfig
    ): Promise<QualityToolResult> {
        const startTime = Date.now();
        const cfg = config || this.getDefaultConfig();

        // Use npm run build:check if available, otherwise direct tsc --noEmit
        let args: string[];
        let useNpm = false;
        let scriptName: string | undefined;

        try {
            const packageJsonPath = path.join(this.projectRoot, 'package.json');
            const packageJson = JSON.parse(
                await fs.readFile(packageJsonPath, 'utf-8')
            );
            if (packageJson.scripts?.['build:check'] || packageJson.scripts?.typecheck) {
                useNpm = true;
                scriptName = packageJson.scripts['build:check'] ? 'build:check' : 'typecheck';
                args = ['run', scriptName];
            } else {
                args = ['--noEmit'];
            }
        } catch {
            args = ['--noEmit'];
        }

        try {
            let result: { exitCode: number; stdout: string; stderr: string };
            if (useNpm && scriptName) {
                result = await this.executeNpmScript(scriptName, {
                    timeout: cfg.timeout_ms || 300000,
                });
            } else {
                result = await this.executeCommand(args, {
                    timeout: cfg.timeout_ms || 300000,
                });
            }

            const executionTime = Date.now() - startTime;
            return this.parseOutput(result.stdout, result.stderr, result.exitCode, executionTime);
        } catch (error: any) {
            const executionTime = Date.now() - startTime;
            return this.createErrorResult(error, targetPath, executionTime);
        }
    }

    getDefaultConfig(): QualityToolConfig {
        return {
            enabled: true,
            options: {
                skipLibCheck: true,
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
        const output = stdout || stderr;
        const lines = output.split('\n').filter((line) => line.trim());

        for (const line of lines) {
            // Parse TypeScript output: file(line,col): error TS####: message
            const match = line.match(/^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/);
            if (match) {
                const [, filePath, lineNum, colNum, severity, code, message] = match;
                issues.push({
                    severity: severity === 'error' ? 'error' : 'warning',
                    rule_id: code,
                    rule_name: code,
                    message: message.trim(),
                    file_path: filePath,
                    line_number: parseInt(lineNum, 10),
                    column_number: parseInt(colNum, 10),
                    code,
                    fixable: false, // TypeScript errors typically need manual fixes
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
