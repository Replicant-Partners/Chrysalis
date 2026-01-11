/**
 * Condition Matcher Registry
 *
 * Manages collection of condition matchers and provides evaluation services.
 *
 * Design Pattern: Registry Pattern + Strategy Pattern
 * - Manages collection of strategy implementations
 * - Allows runtime registration of new matchers
 * - Provides unified evaluation interface
 *
 * References:
 * - Gamma, E., Helm, R., Johnson, R., & Vlissides, J. (1994). Design Patterns. p. 315.
 * - Fowler, M. (2002). Patterns of Enterprise Application Architecture. Registry Pattern.
 */

import { IConditionMatcher } from './IConditionMatcher';
import { PatternCondition } from '../QualityPattern';

/**
 * Condition Matcher Registry
 *
 * Central registry for condition matchers.
 * Follows Open/Closed Principle - open for extension (add new matchers),
 * closed for modification (no changes needed to add new operators).
 */
export class ConditionMatcherRegistry {
    private matchers: IConditionMatcher[] = [];

    /**
     * Register a condition matcher
     *
     * @param matcher - The matcher to register
     */
    register(matcher: IConditionMatcher): void {
        // Avoid duplicate registrations
        const operators = matcher.getSupportedOperators();
        const existing = this.matchers.find((m) =>
            m.getSupportedOperators().some((op) => operators.includes(op))
        );

        if (existing) {
            console.warn(
                `Matcher for operators [${operators.join(', ')}] already registered. Replacing.`
            );
            this.unregister(existing);
        }

        this.matchers.push(matcher);
    }

    /**
     * Register multiple matchers
     *
     * @param matchers - Array of matchers to register
     */
    registerAll(matchers: IConditionMatcher[]): void {
        for (const matcher of matchers) {
            this.register(matcher);
        }
    }

    /**
     * Unregister a matcher
     *
     * @param matcher - The matcher to remove
     */
    unregister(matcher: IConditionMatcher): void {
        const index = this.matchers.indexOf(matcher);
        if (index !== -1) {
            this.matchers.splice(index, 1);
        }
    }

    /**
     * Find matcher for operator
     *
     * @param operator - The operator to find a matcher for
     * @returns The matcher if found, undefined otherwise
     */
    findMatcher(operator: string): IConditionMatcher | undefined {
        return this.matchers.find((m) => m.supports(operator));
    }

    /**
     * Check if an operator is supported
     *
     * @param operator - The operator to check
     * @returns true if a matcher exists for this operator
     */
    hasMatcherFor(operator: string): boolean {
        return this.findMatcher(operator) !== undefined;
    }

    /**
     * Evaluate condition using appropriate matcher
     *
     * @param condition - The condition to evaluate
     * @param value - The value to test against
     * @returns true if condition matches, false otherwise
     */
    evaluate(condition: PatternCondition, value: string | number): boolean {
        const matcher = this.findMatcher(condition.operator);

        if (!matcher) {
            console.warn(`No matcher found for operator: ${condition.operator}`);
            return false;
        }

        return matcher.evaluate(condition, value);
    }

    /**
     * Get all supported operators
     *
     * @returns Array of all supported operator names
     */
    getSupportedOperators(): string[] {
        const operators: string[] = [];
        for (const matcher of this.matchers) {
            operators.push(...matcher.getSupportedOperators());
        }
        return Array.from(new Set(operators)); // Deduplicate
    }

    /**
     * Get number of registered matchers
     */
    getMatcherCount(): number {
        return this.matchers.length;
    }

    /**
     * Clear all registered matchers
     */
    clear(): void {
        this.matchers = [];
    }
}
