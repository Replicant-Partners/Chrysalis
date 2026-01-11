/**
 * Auto Fixer
 *
 * Unified system for automatically fixing quality issues.
 *
 * Design Pattern: Facade Pattern (GoF, p. 185)
 * - Provides unified interface for auto-fixing quality issues
 * - Hides complexity of multiple tool integrations
 *
 * References:
 * - Gamma, E., Helm, R., Johnson, R., & Vlissides, J. (1994). Design Patterns: Elements of Reusable Object-Oriented Software. Addison-Wesley. p. 185.
 */

import {
    IQualityTool,
    QualityToolResult,
    QualityToolConfig,
} from '../tools/QualityToolInterface';
import { QualityToolOrchestrator } from '../tools/QualityToolOrchestrator';
import { QualityResultAggregator } from '../tools/QualityResultAggregator';

/**
 * Auto Fix Result
 */
export interface AutoFixResult {
    success: boolean;
    tools_executed: number;
    tools_succeeded: number;
    tools_failed: number;
    files_fixed: number;
    total_execution_time_ms: number;
    results: QualityToolResult[];
    errors: string[];
    timestamp: string;
}

/**
 * Auto Fix Options
 */
export interface AutoFixOptions {
    parallel?: boolean;
    timeout_ms?: number;
    continue_on_error?: boolean;
    config?: Record<string, QualityToolConfig>;
    tools?: string[]; // Specific tools to run, or all if not specified
}

/**
 * Auto Fixer
 *
 * Orchestrates automatic fixing of quality issues across multiple tools.
 */
export class AutoFixer {
    private orchestrator: QualityToolOrchestrator;
    private aggregator: QualityResultAggregator;

    constructor(orchestrator?: QualityToolOrchestrator) {
        this.orchestrator = orchestrator || new QualityToolOrchestrator({
            parallel: true,
            timeout_ms: 300000,
            continue_on_error: true,
        });
        this.aggregator = new QualityResultAggregator();
    }

    /**
     * Apply fixes for all registered tools that support auto-fix
     */
    async applyFixes(
        targetPath: string,
        options?: AutoFixOptions
    ): Promise<AutoFixResult> {
        const startTime = Date.now();
        const opts = options || {};

        // Get all tools that support applyFixes
        const allTools = this.orchestrator.getTools();
        const fixableTools = allTools.filter(tool => tool.applyFixes !== undefined);

        // Filter by requested tools if specified
        const toolsToRun = opts.tools
            ? fixableTools.filter(tool => opts.tools!.includes(tool.name))
            : fixableTools;

        if (toolsToRun.length === 0) {
            return {
                success: false,
                tools_executed: 0,
                tools_succeeded: 0,
                tools_failed: 0,
                files_fixed: 0,
                total_execution_time_ms: Date.now() - startTime,
                results: [],
                errors: ['No tools with auto-fix capability found'],
                timestamp: new Date().toISOString(),
            };
        }

        // Execute fixes
        const results: QualityToolResult[] = [];
        const errors: string[] = [];
        let toolsSucceeded = 0;
        let toolsFailed = 0;

        for (const tool of toolsToRun) {
            try {
                if (!tool.applyFixes) {
                    continue;
                }

                const config = opts.config?.[tool.name];
                const result = await tool.applyFixes(targetPath, config);

                results.push(result);

                if (result.success) {
                    toolsSucceeded++;
                } else {
                    toolsFailed++;
                    if (result.errors.length > 0) {
                        errors.push(`${tool.name}: ${result.errors[0].message}`);
                    }
                }

                if (!opts.continue_on_error && !result.success) {
                    break;
                }
            } catch (error: any) {
                toolsFailed++;
                errors.push(`${tool.name}: ${error.message || 'Fix execution failed'}`);

                if (!opts.continue_on_error) {
                    break;
                }
            }
        }

        // Estimate files fixed (based on fixable issues before fix)
        const filesFixed = results.reduce((count, result) => {
            // For now, estimate: if success and had issues, assume files were fixed
            if (result.success && result.metrics.fixable_issues > 0) {
                return count + result.metrics.files_with_issues;
            }
            return count;
        }, 0);

        return {
            success: opts.continue_on_error ? toolsSucceeded > 0 : toolsFailed === 0,
            tools_executed: toolsToRun.length,
            tools_succeeded: toolsSucceeded,
            tools_failed: toolsFailed,
            files_fixed: filesFixed,
            total_execution_time_ms: Date.now() - startTime,
            results,
            errors,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Check which tools support auto-fix
     */
    getFixableTools(): string[] {
        const allTools = this.orchestrator.getTools();
        return allTools
            .filter(tool => tool.applyFixes !== undefined)
            .map(tool => tool.name);
    }

    /**
     * Check if a specific tool supports auto-fix
     */
    isFixable(toolName: string): boolean {
        const tool = this.orchestrator.getTool(toolName);
        return tool !== undefined && tool.applyFixes !== undefined;
    }

    /**
     * Get orchestrator instance
     */
    getOrchestrator(): QualityToolOrchestrator {
        return this.orchestrator;
    }

    /**
     * Register a tool with the orchestrator
     */
    registerTool(tool: IQualityTool): void {
        this.orchestrator.registerTool(tool);
    }

    /**
     * Register multiple tools
     */
    registerTools(tools: IQualityTool[]): void {
        this.orchestrator.registerTools(tools);
    }
}
