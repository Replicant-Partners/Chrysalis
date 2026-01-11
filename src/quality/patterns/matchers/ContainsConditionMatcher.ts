/**
 * Contains Condition Matcher
 *
 * Concrete Strategy for substring matching.
 *
 * Design Pattern: Strategy Pattern (GoF, p. 315)
 */

import { PatternCondition } from '../QualityPattern';
import { IConditionMatcher } from './IConditionMatcher';

/**
 * Contains Condition Matcher
 *
 * Matches when value contains the condition value as a substring (case-insensitive).
 */
export class ContainsConditionMatcher implements IConditionMatcher {
    supports(operator: string): boolean {
        return operator === 'contains';
    }

    getSupportedOperators(): string[] {
        return ['contains'];
    }

    evaluate(condition: PatternCondition, value: string | number): boolean {
        const valueStr = String(value).toLowerCase();
        const conditionValue = typeof condition.value === 'string'
            ? condition.value.toLowerCase()
            : String(condition.value).toLowerCase();

        const matches = valueStr.includes(conditionValue);
        return condition.negate ? !matches : matches;
    }
}
