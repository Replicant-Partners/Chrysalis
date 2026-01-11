/**
 * Ends With Condition Matcher
 *
 * Concrete Strategy for suffix matching.
 *
 * Design Pattern: Strategy Pattern (GoF, p. 315)
 */

import { PatternCondition } from '../QualityPattern';
import { IConditionMatcher } from './IConditionMatcher';

/**
 * Ends With Condition Matcher
 *
 * Matches when value ends with the condition value (case-insensitive).
 */
export class EndsWithConditionMatcher implements IConditionMatcher {
    supports(operator: string): boolean {
        return operator === 'ends_with';
    }

    getSupportedOperators(): string[] {
        return ['ends_with'];
    }

    evaluate(condition: PatternCondition, value: string | number): boolean {
        const valueStr = String(value).toLowerCase();
        const conditionValue = typeof condition.value === 'string'
            ? condition.value.toLowerCase()
            : String(condition.value).toLowerCase();

        const matches = valueStr.endsWith(conditionValue);
        return condition.negate ? !matches : matches;
    }
}
