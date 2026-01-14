/**
 * Universal Quality Tool Adapter
 *
 * A single adapter that runs ANY quality tool by:
 * 1. Looking up tool specification from registry
 * 2. Building CLI command from spec
 * 3. Using LLM to parse output (handles any format)
 * 4. Returning normalized quality issues
 *
 * This replaces N separate tool adapters with one LLM-delegated adapter.
 *
 * @module quality/tools/universal/adapter
 * @version 1.0.0
 */

import { spawn } from 'child_process';
import {
  QualityToolEntry,
  QUALITY_TOOL_REGISTRY,
  getTool,
  listTools,
  getToolsByLanguage,
} from './registry';
import { buildOutputParsePrompt, buildAggregationPrompt } from './prompts';

// ============================================================================
// Types
// ============================================================================

/**
 * Normalized quality issue
 */
export interface QualityIssue {
  file: string;
  line: number;
  column?: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  code: string;
  tool: string;
  category: string;
}

/**
 * Quality check result
 */
export interface QualityResult {
  tool: string;
  success: boolean;
  issues: QualityIssue[];
  summary: {
    totalIssues: number;
    byCategory: Record<string, number>;
    byFile: Record<string, number>;
  };
  rawOutput?: string;
  exitCode: number;
  parseError?: string;
}

/**
 * LLM provider interface (minimal)
 */
export interface LLMProvider {
  complete(prompt: string): Promise<Record<string, unknown>>;
}

// ============================================================================
// Universal Adapter
// ============================================================================

/**
 * Universal Quality Tool Adapter
 *
 * One adapter for all quality tools, using registry + LLM pattern.
 */
export class UniversalQualityAdapter {
  private llm: LLMProvider;
  private projectRoot: string;

  constructor(llm: LLMProvider, projectRoot: string) {
    this.llm = llm;
    this.projectRoot = projectRoot;
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Run a quality check using any registered tool
   */
  async check(toolId: string, targetPath: string): Promise<QualityResult> {
    const tool = getTool(toolId);
    if (!tool) {
      throw new Error(`Unknown tool: ${toolId}. Available: ${listTools().map(t => t.id).join(', ')}`);
    }

    // 1. Check tool availability
    const available = await this.isAvailable(tool);
    if (!available) {
      return {
        tool: toolId,
        success: false,
        issues: [],
        summary: { totalIssues: 0, byCategory: {}, byFile: {} },
        exitCode: -1,
        parseError: `Tool ${tool.name} not found. Install with: ${this.getInstallHint(tool)}`,
      };
    }

    // 2. Build command
    const args = this.buildCheckArgs(tool, targetPath);

    // 3. Execute tool
    const { stdout, stderr, exitCode } = await this.execute(tool.cli.command, args);
    const rawOutput = stdout || stderr;

    // 4. Check if exit code indicates success
    const isSuccess = tool.cli.successExitCodes.includes(exitCode);

    // 5. Parse output using LLM
    const parseResult = await this.parseOutput(tool, rawOutput, exitCode);

    return {
      tool: toolId,
      success: isSuccess && !parseResult.parseError,
      issues: parseResult.issues as QualityIssue[],
      summary: parseResult.summary as QualityResult['summary'],
      rawOutput,
      exitCode,
      parseError: parseResult.parseError as string | undefined,
    };
  }

  /**
   * Run multiple tools and aggregate results
   */
  async checkMultiple(
    toolIds: string[],
    targetPath: string
  ): Promise<{
    results: QualityResult[];
    aggregated: {
      issues: QualityIssue[];
      healthScore: number;
      summary: Record<string, unknown>;
    };
  }> {
    // Run all tools in parallel
    const results = await Promise.all(
      toolIds.map(id => this.check(id, targetPath))
    );

    // Aggregate using LLM
    const toolResults = results.map(r => ({
      tool: r.tool,
      issues: r.issues,
    }));

    const aggregatePrompt = buildAggregationPrompt(toolResults);
    const aggregateResult = await this.llm.complete(aggregatePrompt);

    return {
      results,
      aggregated: {
        issues: (aggregateResult.aggregatedIssues || []) as QualityIssue[],
        healthScore: (aggregateResult.healthScore || 0) as number,
        summary: aggregateResult.summary as Record<string, unknown>,
      },
    };
  }

  /**
   * Check if a tool is available
   */
  async isAvailable(toolOrId: QualityToolEntry | string): Promise<boolean> {
    const tool = typeof toolOrId === 'string' ? getTool(toolOrId) : toolOrId;
    if (!tool) return false;

    try {
      const { exitCode } = await this.execute(
        tool.cli.command,
        [tool.cli.versionFlag],
        { timeout: 5000 }
      );
      return exitCode === 0;
    } catch {
      return false;
    }
  }

  /**
   * List available tools
   */
  listTools() {
    return listTools();
  }

  /**
   * Get tools for a specific language
   */
  getToolsForLanguage(language: QualityToolEntry['language']) {
    return getToolsByLanguage(language);
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Build check command arguments
   */
  private buildCheckArgs(tool: QualityToolEntry, targetPath: string): string[] {
    return tool.cli.checkArgs.map(arg =>
      arg.replace('{{TARGET}}', targetPath)
    );
  }

  /**
   * Execute a command
   */
  private execute(
    command: string,
    args: string[],
    options?: { timeout?: number }
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        cwd: this.projectRoot,
        shell: true,
        timeout: options?.timeout,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('error', (err) => {
        reject(err);
      });

      proc.on('close', (code) => {
        resolve({
          stdout,
          stderr,
          exitCode: code ?? -1,
        });
      });
    });
  }

  /**
   * Parse tool output using LLM
   */
  private async parseOutput(
    tool: QualityToolEntry,
    rawOutput: string,
    exitCode: number
  ): Promise<{
    issues: unknown[];
    summary: unknown;
    parseError?: string;
  }> {
    // For JSON output, try direct parsing first
    if (tool.output.format === 'json' && rawOutput.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(rawOutput);
        return this.normalizeJsonOutput(tool, parsed);
      } catch {
        // Fall through to LLM parsing
      }
    }

    // Use LLM for complex/text output
    const prompt = buildOutputParsePrompt(tool, rawOutput, exitCode);
    const result = await this.llm.complete(prompt);

    return {
      issues: (result.issues || []) as unknown[],
      summary: result.summary || { totalIssues: 0, byCategory: {}, byFile: {} },
      parseError: result.parseError as string | undefined,
    };
  }

  /**
   * Normalize JSON output using field mappings
   */
  private normalizeJsonOutput(
    tool: QualityToolEntry,
    parsed: Record<string, unknown>
  ): { issues: unknown[]; summary: unknown; parseError?: string } {
    const mappings = tool.output.fieldMappings;
    if (!mappings) {
      return { issues: [], summary: {}, parseError: 'No field mappings defined' };
    }

    // Get issues array
    let rawIssues: unknown[];
    if (tool.output.jsonIssuePath) {
      rawIssues = this.getNestedValue(parsed, tool.output.jsonIssuePath) as unknown[] || [];
    } else if (Array.isArray(parsed)) {
      rawIssues = parsed;
    } else {
      rawIssues = [];
    }

    // Map to normalized format
    const issues = rawIssues.map((issue: any) => ({
      file: this.getNestedValue(issue, mappings.file),
      line: this.getNestedValue(issue, mappings.line),
      column: mappings.column ? this.getNestedValue(issue, mappings.column) : undefined,
      severity: this.mapSeverity(tool, String(this.getNestedValue(issue, mappings.severity))),
      message: this.getNestedValue(issue, mappings.message),
      code: mappings.code ? this.getNestedValue(issue, mappings.code) : undefined,
      tool: tool.id,
      category: tool.category,
    }));

    // Build summary
    const summary = {
      totalIssues: issues.length,
      byCategory: {} as Record<string, number>,
      byFile: {} as Record<string, number>,
    };

    for (const issue of issues) {
      summary.byCategory[issue.severity] = (summary.byCategory[issue.severity] || 0) + 1;
      summary.byFile[issue.file] = (summary.byFile[issue.file] || 0) + 1;
    }

    return { issues, summary };
  }

  /**
   * Get nested value from object (supports dot notation)
   */
  private getNestedValue(obj: any, path: string): unknown {
    return path.split('.').reduce((o, k) => o?.[k], obj);
  }

  /**
   * Map tool-specific severity to normalized severity
   */
  private mapSeverity(tool: QualityToolEntry, severity: string): 'error' | 'warning' | 'info' {
    // Check direct mapping
    if (tool.severityMap[severity]) {
      return tool.severityMap[severity];
    }

    // Check prefix mapping (for codes like E501, W503)
    const prefix = severity.charAt(0);
    if (tool.severityMap[prefix]) {
      return tool.severityMap[prefix];
    }

    // Default
    return 'warning';
  }

  /**
   * Get install hint for a tool
   */
  private getInstallHint(tool: QualityToolEntry): string {
    switch (tool.language) {
      case 'python':
        return `pip install ${tool.id}`;
      case 'typescript':
      case 'javascript':
        return `npm install -D ${tool.id}`;
      case 'go':
        return `go install ${tool.docsUrl}`;
      default:
        return `See ${tool.docsUrl}`;
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a universal quality adapter
 */
export function createUniversalQualityAdapter(
  llm: LLMProvider,
  projectRoot: string
): UniversalQualityAdapter {
  return new UniversalQualityAdapter(llm, projectRoot);
}

// ============================================================================
// Exports
// ============================================================================

export default UniversalQualityAdapter;
