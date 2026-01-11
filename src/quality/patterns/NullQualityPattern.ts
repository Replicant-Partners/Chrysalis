/**
 * Null Quality Pattern
 *
 * Design Pattern: Null Object Pattern (Woolf)
 * - Provides a non-null, neutral object as a substitute for null
 * - Eliminates the need for null checks throughout the codebase
 * - Maintains behavioral consistency
 *
 * References:
 * - Woolf, B. (1996). "Null Object". Pattern Languages of Program Design 3. Addison-Wesley.
 * - Martin, R. C. (2002). Agile Software Development. Chapter 17.
 */

import {
    QualityPattern,
    PatternType,
    PatternCondition,
    PatternAction,
    PatternMetadata,
    PatternMatchResult,
} from './QualityPattern';
import { QualityIssue } from '../tools/QualityToolInterface';

/**
 * Null Quality Pattern
 *
 * A neutral pattern object that can be used in place of null/undefined.
 * All operations return sensible defaults without throwing errors.
 */
export class NullQualityPattern implements QualityPattern {
    readonly pattern_id: string = 'null_pattern';
    readonly pattern_type: PatternType = 'custom';
    readonly name: string = 'Null Pattern';
    readonly description: string = 'A neutral pattern object representing no pattern';
    readonly severity: 'error' | 'warning' | 'info' = 'info';
    readonly frequency: number = 0;
    readonly confidence: number = 0;
    readonly conditions: PatternCondition[] = [];
    readonly actions: PatternAction[] = [];
    readonly metadata: PatternMetadata = {
        source: 'null',
        tags: [],
    };
    readonly created_at: string = new Date(0).toISOString();
    readonly updated_at: string = new Date(0).toISOString();

    /**
     * Singleton instance
     */
    private static instance: NullQualityPattern;

    /**
     * Private constructor for singleton
     */
    private constructor() {}

    /**
     * Get the singleton instance
     */
    static getInstance(): NullQualityPattern {
        if (!NullQualityPattern.instance) {
            NullQualityPattern.instance = new NullQualityPattern();
        }
        return NullQualityPattern.instance;
    }

    /**
     * Check if this is a null pattern
     */
    isNull(): boolean {
        return true;
    }
}

/**
 * Type guard to check if a pattern is a NullQualityPattern
 */
export function isNullPattern(pattern: QualityPattern | null | undefined): boolean {
    return pattern instanceof NullQualityPattern || (pattern !== null && pattern !== undefined && 'isNull' in pattern && typeof (pattern as any).isNull === 'function' && (pattern as any).isNull());
}

/**
 * Null Pattern Match Result
 *
 * Represents a non-match result without requiring null.
 */
export class NullPatternMatchResult implements PatternMatchResult {
    readonly pattern: QualityPattern = NullQualityPattern.getInstance();
    readonly match_score: number = 0;
    readonly matched_conditions: PatternCondition[] = [];
    readonly matched_issue?: QualityIssue;
    readonly suggestions: string[] = [];

    private static instance: NullPatternMatchResult;

    private constructor() {}

    static getInstance(): NullPatternMatchResult {
        if (!NullPatternMatchResult.instance) {
            NullPatternMatchResult.instance = new NullPatternMatchResult();
        }
        return NullPatternMatchResult.instance;
    }

    isNull(): boolean {
        return true;
    }
}

/**
 * Type guard to check if result is a NullPatternMatchResult
 */
export function isNullMatchResult(result: PatternMatchResult | null | undefined): boolean {
    return result instanceof NullPatternMatchResult || (result !== null && result !== undefined && 'isNull' in result && typeof (result as any).isNull === 'function' && (result as any).isNull());
}

/**
 * Get a pattern or the null pattern if not found
 *
 * Utility function for safe pattern access.
 *
 * @param pattern - The pattern to check
 * @returns The pattern if it exists, otherwise the NullQualityPattern
 */
export function getPatternOrNull(pattern: QualityPattern | null | undefined): QualityPattern {
    return pattern ?? NullQualityPattern.getInstance();
}

/**
 * Get a match result or the null result if not found
 *
 * @param result - The result to check
 * @returns The result if it exists, otherwise the NullPatternMatchResult
 */
export function getMatchResultOrNull(result: PatternMatchResult | null | undefined): PatternMatchResult {
    return result ?? NullPatternMatchResult.getInstance();
}
