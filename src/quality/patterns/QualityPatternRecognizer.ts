/**
 * Quality Pattern Recognizer
 *
 * Orchestrates pattern matching and learning.
 *
 * Design Pattern: Facade Pattern (GoF, p. 185)
 * - Provides unified interface for pattern recognition
 * - Hides complexity of pattern matching and learning
 *
 * References:
 * - Gamma, E., Helm, R., Johnson, R., & Vlissides, J. (1994). Design Patterns: Elements of Reusable Object-Oriented Software. Addison-Wesley. p. 185.
 */

import { QualityIssue } from '../tools/QualityToolInterface';
import {
    QualityPattern,
    PatternType,
    PatternMatchResult,
    PatternLearningContext,
    PatternRecognitionConfig,
} from './QualityPattern';
import { QualityPatternDatabase } from './QualityPatternDatabase';
import { PatternMatcher } from './PatternMatcher';
import { PatternLearner } from './PatternLearner';

/**
 * Quality Pattern Recognizer
 *
 * Main orchestrator for pattern recognition, matching, and learning.
 */
export class QualityPatternRecognizer {
    private database: QualityPatternDatabase;
    private matcher: PatternMatcher;
    private learner: PatternLearner;
    private config: PatternRecognitionConfig;

    constructor(
        database?: QualityPatternDatabase,
        config?: PatternRecognitionConfig
    ) {
        this.config = {
            min_confidence: 0.5,
            min_frequency: 3,
            enable_learning: true,
            enable_auto_fix: false,
            ...config,
        };

        this.database = database || new QualityPatternDatabase(
            this.config.pattern_storage_path
        );
        this.matcher = new PatternMatcher();
        this.learner = new PatternLearner(
            this.database,
            this.config.min_frequency || 3,
            this.config.min_confidence || 0.5
        );
    }

    /**
     * Initialize (load patterns from storage)
     */
    async initialize(): Promise<void> {
        await this.database.load();
    }

    /**
     * Recognize patterns in issues
     */
    async recognizePatterns(issues: QualityIssue[]): Promise<PatternMatchResult[]> {
        const allPatterns = this.database.getAllPatterns();
        const results: PatternMatchResult[] = [];

        for (const issue of issues) {
            const matches = this.matcher.matchAgainstPatterns(issue, allPatterns);
            results.push(...matches);
        }

        // Update pattern frequencies
        for (const result of results) {
            await this.database.incrementPatternFrequency(result.pattern.pattern_id);
        }

        return results;
    }

    /**
     * Learn patterns from issues and context
     */
    async learnPatterns(context: PatternLearningContext): Promise<QualityPattern[]> {
        if (!this.config.enable_learning) {
            return [];
        }

        const patterns = await this.learner.learnPatterns(context);
        return patterns;
    }

    /**
     * Match a single issue against patterns
     */
    matchIssue(issue: QualityIssue): PatternMatchResult[] {
        const allPatterns = this.database.getAllPatterns();
        return this.matcher.matchAgainstPatterns(issue, allPatterns);
    }

    /**
     * Get pattern by ID
     */
    getPattern(patternId: string): QualityPattern | undefined {
        return this.database.getPattern(patternId);
    }

    /**
     * Get all patterns
     */
    getAllPatterns(): QualityPattern[] {
        return this.database.getAllPatterns();
    }

    /**
     * Get patterns by type
     */
    getPatternsByType(type: PatternType): QualityPattern[] {
        return this.database.getPatternsByType(type);
    }

    /**
     * Get patterns by severity
     */
    getPatternsBySeverity(severity: 'error' | 'warning' | 'info'): QualityPattern[] {
        return this.database.getPatternsBySeverity(severity);
    }

    /**
     * Search patterns
     */
    searchPatterns(query: string): QualityPattern[] {
        return this.database.searchPatterns(query);
    }

    /**
     * Add or update a pattern
     */
    async addPattern(pattern: QualityPattern): Promise<void> {
        await this.database.addPattern(pattern);
    }

    /**
     * Delete a pattern
     */
    async deletePattern(patternId: string): Promise<boolean> {
        return await this.database.deletePattern(patternId);
    }

    /**
     * Get statistics
     */
    getStatistics() {
        return this.database.getStatistics();
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<PatternRecognitionConfig>): void {
        this.config = { ...this.config, ...config };
        this.learner = new PatternLearner(
            this.database,
            this.config.min_frequency || 3,
            this.config.min_confidence || 0.5
        );
    }

    /**
     * Get configuration
     */
    getConfig(): PatternRecognitionConfig {
        return { ...this.config };
    }
}
