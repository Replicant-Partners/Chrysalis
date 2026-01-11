/**
 * Equals Condition Matcher
 *
 * Concrete Strategy for exact value matching.
 *
 * Design Pattern: Strategy Pattern (GoF, p. 315)
 */

import { PatternCondition } from '../QualityPattern';
import { IConditionMatcher } from './IConditionMatcher';

/**
 * Equals Condition Matcher
 *
 * Matches when value exactly equals the condition value (case-insensitive).
 */
export class EqualsConditionMatcher implements IConditionMatcher {
    supports(operator: string): boolean {
        return operator === 'equals';
    }

    getSupportedOperators(): string[] {
        return ['equals'];
    }

    evaluate(condition: PatternCondition, value: string | number): boolean {
        const valueStr = String(value).toLowerCase();
        const conditionValue = typeof condition.value === 'string'
            ? condition.value.toLowerCase()
            : String(condition.value).toLowerCase();

        const matches = valueStr === conditionValue;
        return condition.negate ? !matches : matches;
    }
}
