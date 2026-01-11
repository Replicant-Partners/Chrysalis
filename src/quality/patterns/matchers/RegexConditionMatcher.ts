/**
 * Regex Condition Matcher
 *
 * Concrete Strategy for regular expression matching.
 *
 * Design Pattern: Strategy Pattern (GoF, p. 315)
 */

import { PatternCondition } from '../QualityPattern';
import { IConditionMatcher } from './IConditionMatcher';

/**
 * Regex Condition Matcher
 *
 * Matches when value matches the condition value as a regular expression.
 * Supports both 'matches' and 'regex' operators.
 */
export class RegexConditionMatcher implements IConditionMatcher {
    supports(operator: string): boolean {
        return operator === 'matches' || operator === 'regex';
    }

    getSupportedOperators(): string[] {
        return ['matches', 'regex'];
    }

    evaluate(condition: PatternCondition, value: string | number): boolean {
        try {
            const regex = condition.value instanceof RegExp
                ? condition.value
                : new RegExp(String(condition.value), 'i');

            const matches = regex.test(String(value));
            return condition.negate ? !matches : matches;
        } catch {
            // Invalid regex - return based on negate flag
            return condition.negate ? true : false;
        }
    }
}
