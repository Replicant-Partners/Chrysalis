/**
 * Pattern Matcher
 *
 * Matches quality issues against patterns.
 *
 * Design Pattern: Strategy Pattern (GoF, p. 315)
 * - Uses ConditionMatcherRegistry to delegate condition evaluation
 * - Encapsulates pattern matching algorithms
 * - Open/Closed Principle: new operators can be added without modification
 *
 * References:
 * - Gamma, E., Helm, R., Johnson, R., & Vlissides, J. (1994). Design Patterns: Elements of Reusable Object-Oriented Software. Addison-Wesley. p. 315.
 */

import {
    QualityPattern,
    PatternCondition,
    PatternMatchResult,
} from './QualityPattern';
import { QualityIssue } from '../tools/QualityToolInterface';
import { ConditionMatcherRegistry, createDefaultRegistry } from './matchers';

/**
 * Pattern Matcher
 *
 * Matches quality issues against patterns using pluggable condition matchers.
 */
export class PatternMatcher {
    private registry: ConditionMatcherRegistry;

    /**
     * Create a pattern matcher
     *
     * @param registry - Optional custom registry. Defaults to standard matchers.
     */
    constructor(registry?: ConditionMatcherRegistry) {
        this.registry = registry || createDefaultRegistry();
    }

    /**
     * Match an issue against a pattern
     */
    matchIssue(
        issue: QualityIssue,
        pattern: QualityPattern
    ): PatternMatchResult | null {
        const matchedConditions: PatternCondition[] = [];
        let totalScore = 0;
        let matchedCount = 0;

        for (const condition of pattern.conditions) {
            const fieldValue = this.getFieldValue(issue, condition.field);
            if (fieldValue === undefined) {
                continue; // Skip conditions for fields that don't exist
            }

            const matches = this.evaluateCondition(condition, fieldValue);
            if (matches) {
                matchedConditions.push(condition);
                matchedCount++;
                totalScore += 1.0 / pattern.conditions.length; // Each condition contributes equally
            }
        }

        // Require at least one condition to match
        if (matchedCount === 0) {
            return null;
        }

        // Calculate match score (weighted by confidence)
        const baseScore = totalScore;
        const matchScore = baseScore * pattern.confidence;

        // Consider it a match if score is above threshold
        if (matchScore < 0.3) {
            // Low threshold for partial matches
            return null;
        }

        return {
            pattern,
            match_score: matchScore,
            matched_conditions: matchedConditions,
            matched_issue: issue,
            suggestions: pattern.actions
                .filter((a) => a.type === 'suggest_fix')
                .map((a) => a.description),
        };
    }

    /**
     * Match multiple issues against a pattern
     */
    matchIssues(
        issues: QualityIssue[],
        pattern: QualityPattern
    ): PatternMatchResult[] {
        const results: PatternMatchResult[] = [];

        for (const issue of issues) {
            const result = this.matchIssue(issue, pattern);
            if (result) {
                results.push(result);
            }
        }

        return results;
    }

    /**
     * Match an issue against multiple patterns
     */
    matchAgainstPatterns(
        issue: QualityIssue,
        patterns: QualityPattern[]
    ): PatternMatchResult[] {
        const results: PatternMatchResult[] = [];

        for (const pattern of patterns) {
            const result = this.matchIssue(issue, pattern);
            if (result) {
                results.push(result);
            }
        }

        // Sort by match score (descending)
        return results.sort((a, b) => b.match_score - a.match_score);
    }

    /**
     * Get the condition matcher registry
     */
    getRegistry(): ConditionMatcherRegistry {
        return this.registry;
    }

    /**
     * Get supported operators
     */
    getSupportedOperators(): string[] {
        return this.registry.getSupportedOperators();
    }

    /**
     * Get field value from issue
     */
    private getFieldValue(issue: QualityIssue, field: string): string | number | undefined {
        switch (field) {
            case 'rule_id':
                return issue.rule_id;
            case 'rule_name':
                return issue.rule_name;
            case 'message':
                return issue.message;
            case 'file_path':
                return issue.file_path;
            case 'severity':
                return issue.severity;
            case 'code':
                return issue.code;
            case 'line_number':
                return issue.line_number;
            case 'column_number':
                return issue.column_number;
            default:
                return (issue as any)[field];
        }
    }

    /**
     * Evaluate a condition against a value
     *
     * Delegates to the registered condition matcher for the operator.
     */
    private evaluateCondition(
        condition: PatternCondition,
        value: string | number
    ): boolean {
        return this.registry.evaluate(condition, value);
    }
}
