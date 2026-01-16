/**
 * Quality Pattern Integration
 *
 * Integrates quality pattern recognition with quality tools and results.
 *
 * Design Pattern: Facade Pattern (GoF, p. 185) + Adapter Pattern (GoF, p. 139)
 * - Provides unified interface for pattern recognition integration
 * - Adapts quality results to pattern learning format
 *
 * References:
 * - Gamma, E., Helm, R., Johnson, R., & Vlissides, J. (1994). Design Patterns: Elements of Reusable Object-Oriented Software. Addison-Wesley. p. 139, 185.
 */

import { QualityToolOrchestrator, QualityOrchestrationResult } from '../tools/QualityToolOrchestrator';
import { QualityResultAggregator } from '../tools/QualityResultAggregator';
import { QualityIssue, QualityToolResult } from '../tools/QualityToolInterface';
import { QualityPatternRecognizer } from '../patterns/QualityPatternRecognizer';
import { PatternMatchResult } from '../patterns/QualityPattern';
import { NotImplementedError } from '../../mcp-server/chrysalis-tools';

/**
 * Quality Pattern Integration Result
 */
export interface QualityPatternIntegrationResult {
    quality_results: QualityOrchestrationResult;
    pattern_matches: PatternMatchResult[];
    learned_patterns: string[]; // Pattern IDs
    suggestions: string[];
    timestamp: string;
}

/**
 * Quality Pattern Integration
 *
 * Integrates quality pattern recognition with quality tools.
 */
export class QualityPatternIntegration {
    private orchestrator: QualityToolOrchestrator;
    private aggregator: QualityResultAggregator;
    private recognizer: QualityPatternRecognizer;

    constructor(
        orchestrator: QualityToolOrchestrator,
        recognizer: QualityPatternRecognizer
    ) {
        this.orchestrator = orchestrator;
        this.aggregator = new QualityResultAggregator();
        this.recognizer = recognizer;
    }

    /**
     * Run quality checks with pattern recognition
     */
    async runQualityChecksWithPatterns(
        targetPath: string,
        options?: {
            parallel?: boolean;
            timeout_ms?: number;
            continue_on_error?: boolean;
            enable_learning?: boolean;
        }
    ): Promise<QualityPatternIntegrationResult> {
        // Run quality checks
        const qualityResults = await this.orchestrator.executeAll(targetPath, {
            parallel: options?.parallel ?? true,
            timeout_ms: options?.timeout_ms ?? 300000,
            continue_on_error: options?.continue_on_error ?? true,
        });

        // Extract issues from results
        const allIssues: QualityIssue[] = [];
        for (const result of qualityResults.results) {
            allIssues.push(...result.result.errors, ...result.result.warnings);
        }

        // Recognize patterns in issues
        const patternMatches = await this.recognizer.recognizePatterns(allIssues);

        // Learn patterns if enabled
        let learnedPatterns: string[] = [];
        if (options?.enable_learning !== false) {
            throw new NotImplementedError(
                'Pattern learning requires integration with auto-fix and adaptation outcome systems'
            );
        }

        // Generate suggestions from patterns
        const suggestions = this.generateSuggestions(patternMatches);

        return {
            quality_results: qualityResults,
            pattern_matches: patternMatches,
            learned_patterns: learnedPatterns,
            suggestions,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Generate suggestions from pattern matches
     */
    private generateSuggestions(matches: PatternMatchResult[]): string[] {
        const suggestions: string[] = [];

        for (const match of matches) {
            for (const action of match.pattern.actions) {
                if (action.type === 'suggest_fix' || action.type === 'warn') {
                    suggestions.push(
                        `${match.pattern.name}: ${action.description}`
                    );
                }
            }
        }

        return suggestions;
    }

    /**
     * Get pattern insights for a specific issue
     */
    async getPatternInsights(issue: QualityIssue): Promise<PatternMatchResult[]> {
        return this.recognizer.matchIssue(issue);
    }

    /**
     * Get quality pattern statistics
     */
    getPatternStatistics() {
        return this.recognizer.getStatistics();
    }
}
