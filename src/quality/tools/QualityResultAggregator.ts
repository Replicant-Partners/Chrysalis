/**
 * Quality Result Aggregator
 *
 * Aggregates results from multiple quality tools into unified reports.
 *
 * Design Pattern: Facade Pattern (GoF, p. 185)
 * - Provides unified interface for aggregating quality results
 * - Hides complexity of result aggregation and analysis
 *
 * References:
 * - Gamma, E., Helm, R., Johnson, R., & Vlissides, J. (1994). Design Patterns: Elements of Reusable Object-Oriented Software. Addison-Wesley. p. 185.
 */

import {
    QualityToolResult,
    QualityIssue,
    QualityMetrics,
    QualityToolExecutionResult,
} from './QualityToolInterface';

/**
 * Aggregated Quality Report
 */
export interface AggregatedQualityReport {
    summary: QualitySummary;
    by_tool: Map<string, QualityToolResult>;
    by_file: Map<string, FileQualityReport>;
    by_severity: {
        errors: QualityIssue[];
        warnings: QualityIssue[];
        info: QualityIssue[];
    };
    metrics: AggregatedMetrics;
    timestamp: string;
}

/**
 * Quality Summary
 */
export interface QualitySummary {
    total_tools: number;
    tools_succeeded: number;
    tools_failed: number;
    total_issues: number;
    total_errors: number;
    total_warnings: number;
    total_fixable_issues: number;
    files_checked: number;
    files_with_issues: number;
    overall_success: boolean;
}

/**
 * File Quality Report
 */
export interface FileQualityReport {
    file_path: string;
    issues: QualityIssue[];
    errors: QualityIssue[];
    warnings: QualityIssue[];
    info: QualityIssue[];
    fixable_issues: QualityIssue[];
    tools_checked: string[];
}

/**
 * Aggregated Metrics
 */
export interface AggregatedMetrics extends QualityMetrics {
    average_execution_time_ms: number;
    slowest_tool?: string;
    fastest_tool?: string;
    tool_metrics: Map<string, QualityMetrics>;
}

/**
 * Quality Result Aggregator
 *
 * Aggregates results from multiple quality tools.
 */
export class QualityResultAggregator {
    /**
     * Aggregate results from multiple tools
     */
    aggregateResults(
        results: QualityToolExecutionResult[]
    ): AggregatedQualityReport {
        const byTool = new Map<string, QualityToolResult>();
        const byFile = new Map<string, FileQualityReport>();
        const bySeverity = {
            errors: [] as QualityIssue[],
            warnings: [] as QualityIssue[],
            info: [] as QualityIssue[],
        };
        const toolMetrics = new Map<string, QualityMetrics>();

        let totalTools = 0;
        let toolsSucceeded = 0;
        let toolsFailed = 0;
        let totalIssues = 0;
        let totalErrors = 0;
        let totalWarnings = 0;
        let totalFixable = 0;
        let filesChecked = 0;
        const filesWithIssues = new Set<string>();
        let totalExecutionTime = 0;
        let slowestTool: string | undefined;
        let fastestTool: string | undefined;
        let slowestTime = 0;
        let fastestTime = Number.MAX_SAFE_INTEGER;

        // Process each tool result
        for (const { tool, result, execution_time_ms } of results) {
            totalTools++;
            if (result.success) {
                toolsSucceeded++;
            } else {
                toolsFailed++;
            }

            byTool.set(tool.name, result);
            toolMetrics.set(tool.name, result.metrics);

            totalIssues += result.metrics.total_issues;
            totalErrors += result.metrics.errors;
            totalWarnings += result.metrics.warnings;
            totalFixable += result.metrics.fixable_issues;
            filesChecked += result.metrics.files_checked || 0;
            totalExecutionTime += execution_time_ms;

            if (execution_time_ms > slowestTime) {
                slowestTime = execution_time_ms;
                slowestTool = tool.name;
            }
            if (execution_time_ms < fastestTime) {
                fastestTime = execution_time_ms;
                fastestTool = tool.name;
            }

            // Aggregate issues by file
            const allIssues = [...result.errors, ...result.warnings];
            for (const issue of allIssues) {
                filesWithIssues.add(issue.file_path);

                // Add to severity buckets
                if (issue.severity === 'error') {
                    bySeverity.errors.push(issue);
                } else if (issue.severity === 'warning') {
                    bySeverity.warnings.push(issue);
                } else {
                    bySeverity.info.push(issue);
                }

                // Add to file report
                let fileReport = byFile.get(issue.file_path);
                if (!fileReport) {
                    fileReport = {
                        file_path: issue.file_path,
                        issues: [],
                        errors: [],
                        warnings: [],
                        info: [],
                        fixable_issues: [],
                        tools_checked: [],
                    };
                    byFile.set(issue.file_path, fileReport);
                }

                fileReport.issues.push(issue);
                if (issue.severity === 'error') {
                    fileReport.errors.push(issue);
                } else if (issue.severity === 'warning') {
                    fileReport.warnings.push(issue);
                } else {
                    fileReport.info.push(issue);
                }

                if (issue.fixable) {
                    fileReport.fixable_issues.push(issue);
                }

                if (!fileReport.tools_checked.includes(tool.name)) {
                    fileReport.tools_checked.push(tool.name);
                }
            }
        }

        const summary: QualitySummary = {
            total_tools: totalTools,
            tools_succeeded: toolsSucceeded,
            tools_failed: toolsFailed,
            total_issues: totalIssues,
            total_errors: totalErrors,
            total_warnings: totalWarnings,
            total_fixable_issues: totalFixable,
            files_checked: filesChecked,
            files_with_issues: filesWithIssues.size,
            overall_success: toolsFailed === 0 && totalErrors === 0,
        };

        const metrics: AggregatedMetrics = {
            total_issues: totalIssues,
            errors: totalErrors,
            warnings: totalWarnings,
            info: bySeverity.info.length,
            fixable_issues: totalFixable,
            files_checked: filesChecked,
            files_with_issues: filesWithIssues.size,
            average_execution_time_ms:
                totalTools > 0 ? totalExecutionTime / totalTools : 0,
            slowest_tool: slowestTool,
            fastest_tool: fastestTool,
            tool_metrics: toolMetrics,
        };

        return {
            summary,
            by_tool: byTool,
            by_file: byFile,
            by_severity: bySeverity,
            metrics,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Get summary statistics
     */
    getSummary(report: AggregatedQualityReport): QualitySummary {
        return report.summary;
    }

    /**
     * Get issues for a specific file
     */
    getFileIssues(
        report: AggregatedQualityReport,
        filePath: string
    ): FileQualityReport | undefined {
        return report.by_file.get(filePath);
    }

    /**
     * Get issues by severity
     */
    getIssuesBySeverity(report: AggregatedQualityReport): {
        errors: QualityIssue[];
        warnings: QualityIssue[];
        info: QualityIssue[];
    } {
        return report.by_severity;
    }

    /**
     * Get fixable issues
     */
    getFixableIssues(report: AggregatedQualityReport): QualityIssue[] {
        const fixable: QualityIssue[] = [];
        for (const fileReport of Array.from(report.by_file.values())) {
            fixable.push(...fileReport.fixable_issues);
        }
        return fixable;
    }

    /**
     * Get issues by tool
     */
    getIssuesByTool(
        report: AggregatedQualityReport,
        toolName: string
    ): QualityToolResult | undefined {
        return report.by_tool.get(toolName);
    }

    /**
     * Generate formatted report (JSON)
     */
    generateJSONReport(report: AggregatedQualityReport): string {
        // Convert Maps to objects for JSON serialization
        const byToolObj: Record<string, any> = {};
        for (const [key, value] of Array.from(report.by_tool.entries())) {
            byToolObj[key] = value;
        }

        const byFileObj: Record<string, any> = {};
        for (const [key, value] of Array.from(report.by_file.entries())) {
            byFileObj[key] = value;
        }

        const toolMetricsObj: Record<string, any> = {};
        for (const [key, value] of Array.from(report.metrics.tool_metrics.entries())) {
            toolMetricsObj[key] = value;
        }

        return JSON.stringify(
            {
                ...report,
                by_tool: byToolObj,
                by_file: byFileObj,
                metrics: {
                    ...report.metrics,
                    tool_metrics: toolMetricsObj,
                },
            },
            null,
            2
        );
    }
}
