/**
 * Starts With Condition Matcher
 *
 * Concrete Strategy for prefix matching.
 *
 * Design Pattern: Strategy Pattern (GoF, p. 315)
 */

import { PatternCondition } from '../QualityPattern';
import { IConditionMatcher } from './IConditionMatcher';

/**
 * Starts With Condition Matcher
 *
 * Matches when value starts with the condition value (case-insensitive).
 */
export class StartsWithConditionMatcher implements IConditionMatcher {
    supports(operator: string): boolean {
        return operator === 'starts_with';
    }

    getSupportedOperators(): string[] {
        return ['starts_with'];
    }

    evaluate(condition: PatternCondition, value: string | number): boolean {
        const valueStr = String(value).toLowerCase();
        const conditionValue = typeof condition.value === 'string'
            ? condition.value.toLowerCase()
            : String(condition.value).toLowerCase();

        const matches = valueStr.startsWith(conditionValue);
        return condition.negate ? !matches : matches;
    }
}
