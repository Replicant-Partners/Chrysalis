/**
 * Quality Tool Orchestrator
 *
 * Orchestrates execution of multiple quality tools with parallel execution support.
 *
 * Design Pattern: Facade Pattern (GoF, p. 185)
 * - Provides unified interface for orchestrating multiple quality tools
 * - Hides complexity of tool execution and coordination
 *
 * References:
 * - Gamma, E., Helm, R., Johnson, R., & Vlissides, J. (1994). Design Patterns: Elements of Reusable Object-Oriented Software. Addison-Wesley. p. 185.
 */

import {
    IQualityTool,
    QualityToolResult,
    QualityToolConfig,
    QualityToolExecutionResult,
    QualityToolExecutionOptions,
} from './QualityToolInterface';

/**
 * Quality Tool Orchestration Result
 */
export interface QualityOrchestrationResult {
    success: boolean;
    tools_executed: number;
    tools_succeeded: number;
    tools_failed: number;
    total_execution_time_ms: number;
    results: QualityToolExecutionResult[];
    aggregated_metrics: {
        total_issues: number;
        total_errors: number;
        total_warnings: number;
        total_fixable_issues: number;
        files_checked: number;
        files_with_issues: number;
    };
    errors: string[];
    timestamp: string;
}

/**
 * Quality Tool Orchestrator
 *
 * Orchestrates execution of multiple quality tools.
 */
export class QualityToolOrchestrator {
    private tools: Map<string, IQualityTool> = new Map();
    private defaultOptions: QualityToolExecutionOptions;

    constructor(options?: QualityToolExecutionOptions) {
        this.defaultOptions = {
            parallel: true,
            timeout_ms: 300000, // 5 minutes default
            continue_on_error: true,
            success_policy: 'any',
            config: {},
            ...options,
        };
    }

    /**
     * Register a quality tool
     */
    registerTool(tool: IQualityTool): void {
        this.tools.set(tool.name, tool);
    }

    /**
     * Register multiple quality tools
     */
    registerTools(tools: IQualityTool[]): void {
        for (const tool of tools) {
            this.registerTool(tool);
        }
    }

    /**
     * Unregister a quality tool
     */
    unregisterTool(toolName: string): void {
        this.tools.delete(toolName);
    }

    /**
     * Get registered tool
     */
    getTool(toolName: string): IQualityTool | undefined {
        return this.tools.get(toolName);
    }

    /**
     * Get all registered tools
     */
    getTools(): IQualityTool[] {
        return Array.from(this.tools.values());
    }

    /**
     * Execute all registered tools
     */
    async executeAll(
        targetPath: string,
        options?: QualityToolExecutionOptions
    ): Promise<QualityOrchestrationResult> {
        const opts = { ...this.defaultOptions, ...options };
        const startTime = Date.now();
        const toolsToExecute = this.getTools();

        // Check tool availability
        const availableTools: IQualityTool[] = [];
        for (const tool of toolsToExecute) {
            const available = await tool.isAvailable();
            if (available) {
                availableTools.push(tool);
            }
        }

        if (availableTools.length === 0) {
            return {
                success: false,
                tools_executed: 0,
                tools_succeeded: 0,
                tools_failed: 0,
                total_execution_time_ms: Date.now() - startTime,
                results: [],
                aggregated_metrics: {
                    total_issues: 0,
                    total_errors: 0,
                    total_warnings: 0,
                    total_fixable_issues: 0,
                    files_checked: 0,
                    files_with_issues: 0,
                },
                errors: ['No quality tools available'],
                timestamp: new Date().toISOString(),
            };
        }

        // Execute tools
        let results: QualityToolExecutionResult[] = [];
        if (opts.parallel) {
            results = await this.executeParallel(availableTools, targetPath, opts);
        } else {
            results = await this.executeSequential(availableTools, targetPath, opts);
        }

        // Aggregate results
        const succeeded = results.filter((r) => r.result.success).length;
        const failed = results.filter((r) => !r.result.success).length;
        const errors: string[] = [];
        for (const result of results) {
            if (!result.result.success && result.result.errors.length > 0) {
                errors.push(
                    `${result.tool.name}: ${result.result.errors[0].message}`
                );
            }
        }

        const aggregatedMetrics = this.aggregateMetrics(results);

        const totalExecutionTime = Date.now() - startTime;

        const success = this.resolveSuccess(
            opts.success_policy || 'any',
            opts.continue_on_error ?? true,
            succeeded,
            failed
        );

        return {
            success,
            tools_executed: results.length,
            tools_succeeded: succeeded,
            tools_failed: failed,
            total_execution_time_ms: totalExecutionTime,
            results,
            aggregated_metrics: aggregatedMetrics,
            errors,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Resolve success based on policy
     */
    private resolveSuccess(
        policy: 'all' | 'any',
        continueOnError: boolean,
        succeeded: number,
        failed: number
    ): boolean {
        if (policy === 'all') {
            return failed === 0;
        }

        // policy === 'any'
        return continueOnError ? succeeded > 0 : failed === 0;
    }

    /**
     * Execute specific tools
     */
    async executeTools(
        toolNames: string[],
        targetPath: string,
        options?: QualityToolExecutionOptions
    ): Promise<QualityOrchestrationResult> {
        const opts = { ...this.defaultOptions, ...options };
        const tools: IQualityTool[] = [];

        for (const toolName of toolNames) {
            const tool = this.tools.get(toolName);
            if (tool) {
                const available = await tool.isAvailable();
                if (available) {
                    tools.push(tool);
                }
            }
        }

        if (tools.length === 0) {
            return {
                success: false,
                tools_executed: 0,
                tools_succeeded: 0,
                tools_failed: 0,
                total_execution_time_ms: 0,
                results: [],
                aggregated_metrics: {
                    total_issues: 0,
                    total_errors: 0,
                    total_warnings: 0,
                    total_fixable_issues: 0,
                    files_checked: 0,
                    files_with_issues: 0,
                },
                errors: [`No tools found: ${toolNames.join(', ')}`],
                timestamp: new Date().toISOString(),
            };
        }

        const startTime = Date.now();
        let results: QualityToolExecutionResult[] = [];

        if (opts.parallel) {
            results = await this.executeParallel(tools, targetPath, opts);
        } else {
            results = await this.executeSequential(tools, targetPath, opts);
        }

        const succeeded = results.filter((r) => r.result.success).length;
        const failed = results.filter((r) => !r.result.success).length;
        const errors: string[] = [];
        for (const result of results) {
            if (!result.result.success && result.result.errors.length > 0) {
                errors.push(
                    `${result.tool.name}: ${result.result.errors[0].message}`
                );
            }
        }

        const aggregatedMetrics = this.aggregateMetrics(results);

        return {
            success: opts.continue_on_error ? succeeded > 0 : failed === 0,
            tools_executed: results.length,
            tools_succeeded: succeeded,
            tools_failed: failed,
            total_execution_time_ms: Date.now() - startTime,
            results,
            aggregated_metrics: aggregatedMetrics,
            errors,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Execute tools in parallel
     */
    private async executeParallel(
        tools: IQualityTool[],
        targetPath: string,
        options: QualityToolExecutionOptions
    ): Promise<QualityToolExecutionResult[]> {
        const promises = tools.map(async (tool) => {
            const startTime = Date.now();
            try {
                const config = options.config?.[tool.name];
                const result = await tool.runCheck(targetPath, config);
                const executionTime = Date.now() - startTime;

                return {
                    tool,
                    result,
                    execution_time_ms: executionTime,
                } as QualityToolExecutionResult;
            } catch (error: any) {
                const executionTime = Date.now() - startTime;
                return {
                    tool,
                    result: {
                        tool_name: tool.name,
                        success: false,
                        errors: [
                            {
                                severity: 'error' as const,
                                message: error.message || 'Tool execution failed',
                                file_path: targetPath,
                            },
                        ],
                        warnings: [],
                        metrics: {
                            total_issues: 1,
                            errors: 1,
                            warnings: 0,
                            info: 0,
                            fixable_issues: 0,
                            files_checked: 0,
                            files_with_issues: 0,
                        },
                        execution_time_ms: executionTime,
                        timestamp: new Date().toISOString(),
                        error_output: error.message,
                    },
                    execution_time_ms: executionTime,
                } as QualityToolExecutionResult;
            }
        });

        return Promise.all(promises);
    }

    /**
     * Execute tools sequentially
     */
    private async executeSequential(
        tools: IQualityTool[],
        targetPath: string,
        options: QualityToolExecutionOptions
    ): Promise<QualityToolExecutionResult[]> {
        const results: QualityToolExecutionResult[] = [];

        for (const tool of tools) {
            const startTime = Date.now();
            try {
                const config = options.config?.[tool.name];
                const result = await tool.runCheck(targetPath, config);
                const executionTime = Date.now() - startTime;

                results.push({
                    tool,
                    result,
                    execution_time_ms: executionTime,
                });

                if (!options.continue_on_error && !result.success) {
                    break;
                }
            } catch (error: any) {
                const executionTime = Date.now() - startTime;
                results.push({
                    tool,
                    result: {
                        tool_name: tool.name,
                        success: false,
                        errors: [
                            {
                                severity: 'error' as const,
                                message: error.message || 'Tool execution failed',
                                file_path: targetPath,
                            },
                        ],
                        warnings: [],
                        metrics: {
                            total_issues: 1,
                            errors: 1,
                            warnings: 0,
                            info: 0,
                            fixable_issues: 0,
                            files_checked: 0,
                            files_with_issues: 0,
                        },
                        execution_time_ms: executionTime,
                        timestamp: new Date().toISOString(),
                        error_output: error.message,
                    },
                    execution_time_ms: executionTime,
                });

                if (!options.continue_on_error) {
                    break;
                }
            }
        }

        return results;
    }

    /**
     * Aggregate metrics from all tool results
     */
    private aggregateMetrics(
        results: QualityToolExecutionResult[]
    ): {
        total_issues: number;
        total_errors: number;
        total_warnings: number;
        total_fixable_issues: number;
        files_checked: number;
        files_with_issues: number;
    } {
        let totalIssues = 0;
        let totalErrors = 0;
        let totalWarnings = 0;
        let totalFixable = 0;
        let filesChecked = 0;
        const filesWithIssues = new Set<string>();

        for (const { result } of results) {
            totalIssues += result.metrics.total_issues;
            totalErrors += result.metrics.errors;
            totalWarnings += result.metrics.warnings;
            totalFixable += result.metrics.fixable_issues;
            filesChecked += result.metrics.files_checked || 0;

            // Collect files with issues
            for (const error of result.errors) {
                filesWithIssues.add(error.file_path);
            }
            for (const warning of result.warnings) {
                filesWithIssues.add(warning.file_path);
            }
        }

        return {
            total_issues: totalIssues,
            total_errors: totalErrors,
            total_warnings: totalWarnings,
            total_fixable_issues: totalFixable,
            files_checked: filesChecked,
            files_with_issues: filesWithIssues.size,
        };
    }
}
