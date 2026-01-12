/**
 * Quality Tool Interface
 *
 * Unified interface for all quality tools (Python and TypeScript).
 *
 * Design Pattern: Adapter Pattern (GoF, p. 139) + Strategy Pattern (GoF, p. 315)
 * - Adapts different quality tools to unified interface
 * - Allows switching between tools via strategy pattern
 *
 * References:
 * - Gamma, E., Helm, R., Johnson, R., & Vlissides, J. (1994). Design Patterns: Elements of Reusable Object-Oriented Software. Addison-Wesley. p. 139, 315.
 */

/**
 * Quality Tool Result
 */
export interface QualityToolResult {
    tool_name: string;
    tool_version?: string;
    success: boolean;
    errors: QualityIssue[];
    warnings: QualityIssue[];
    metrics: QualityMetrics;
    execution_time_ms: number;
    timestamp: string;
    output?: string;
    error_output?: string;
}

/**
 * Quality Issue
 */
export interface QualityIssue {
    severity: 'error' | 'warning' | 'info';
    rule_id?: string;
    rule_name?: string;
    message: string;
    file_path: string;
    line_number?: number;
    column_number?: number;
    code?: string;
    fixable?: boolean;
    fix_suggestion?: string;
}

/**
 * Quality Metrics
 */
export interface QualityMetrics {
    total_issues: number;
    errors: number;
    warnings: number;
    info: number;
    fixable_issues: number;
    files_checked: number;
    files_with_issues: number;
    coverage_percentage?: number;
    complexity_score?: number;
    technical_debt_minutes?: number;
    [key: string]: any; // Allow additional metrics
}

/**
 * Quality Tool Configuration
 */
export interface QualityToolConfig {
    enabled: boolean;
    options?: Record<string, any>;
    exclude_patterns?: string[];
    include_patterns?: string[];
    timeout_ms?: number;
    max_issues?: number;
}

/**
 * Quality Tool Interface
 *
 * Unified interface for all quality tools.
 */
export interface IQualityTool {
    /**
     * Tool name
     */
    readonly name: string;

    /**
     * Tool version
     */
    readonly version?: string;

    /**
     * Check if tool is available
     */
    isAvailable(): Promise<boolean>;

    /**
     * Run quality check
     */
    runCheck(
        targetPath: string,
        config?: QualityToolConfig
    ): Promise<QualityToolResult>;

    /**
     * Apply automatic fixes (if supported)
     */
    applyFixes?(
        targetPath: string,
        config?: QualityToolConfig
    ): Promise<QualityToolResult>;

    /**
     * Get default configuration
     */
    getDefaultConfig(): QualityToolConfig;

    /**
     * Validate configuration
     */
    validateConfig(config: QualityToolConfig): boolean;
}

/**
 * Quality Tool Execution Result
 */
export interface QualityToolExecutionResult {
    tool: IQualityTool;
    result: QualityToolResult;
    execution_time_ms: number;
}

/**
 * Quality Tool Execution Options
 */
export interface QualityToolExecutionOptions {
    parallel?: boolean;
    timeout_ms?: number;
    continue_on_error?: boolean;
    config?: Record<string, QualityToolConfig>;
}
