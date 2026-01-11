/**
 * Condition Matcher Interface
 *
 * Design Pattern: Strategy Pattern (GoF, p. 315)
 * - Defines interface for condition matching algorithms
 * - Allows new operators without modifying existing code
 * - Encapsulates matching algorithms for interchangeability
 *
 * References:
 * - Gamma, E., Helm, R., Johnson, R., & Vlissides, J. (1994). Design Patterns: Elements of Reusable Object-Oriented Software. Addison-Wesley. p. 315.
 */

import { PatternCondition } from '../QualityPattern';

/**
 * Condition Matcher Interface
 *
 * Strategy interface for condition matching algorithms.
 * Each concrete matcher implements a specific operator (equals, contains, etc.).
 */
export interface IConditionMatcher {
    /**
     * Check if this matcher supports the given operator
     *
     * @param operator - The operator to check (e.g., 'equals', 'contains')
     * @returns true if this matcher handles the operator
     */
    supports(operator: string): boolean;

    /**
     * Evaluate the condition against a value
     *
     * @param condition - The pattern condition to evaluate
     * @param value - The value to test against
     * @returns true if the condition matches the value
     */
    evaluate(condition: PatternCondition, value: string | number): boolean;

    /**
     * Get the operator(s) this matcher supports
     */
    getSupportedOperators(): string[];
}
