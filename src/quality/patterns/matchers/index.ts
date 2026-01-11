/**
 * Condition Matchers Module
 *
 * Exports all condition matcher implementations.
 *
 * Design Pattern: Strategy Pattern (GoF, p. 315)
 * - IConditionMatcher: Strategy interface
 * - Concrete matchers: Strategy implementations
 * - ConditionMatcherRegistry: Context that uses strategies
 */

export { IConditionMatcher } from './IConditionMatcher';
export { ConditionMatcherRegistry } from './ConditionMatcherRegistry';
export { EqualsConditionMatcher } from './EqualsConditionMatcher';
export { ContainsConditionMatcher } from './ContainsConditionMatcher';
export { StartsWithConditionMatcher } from './StartsWithConditionMatcher';
export { EndsWithConditionMatcher } from './EndsWithConditionMatcher';
export { RegexConditionMatcher } from './RegexConditionMatcher';

/**
 * Create default registry with all standard matchers
 */
import { ConditionMatcherRegistry } from './ConditionMatcherRegistry';
import { EqualsConditionMatcher } from './EqualsConditionMatcher';
import { ContainsConditionMatcher } from './ContainsConditionMatcher';
import { StartsWithConditionMatcher } from './StartsWithConditionMatcher';
import { EndsWithConditionMatcher } from './EndsWithConditionMatcher';
import { RegexConditionMatcher } from './RegexConditionMatcher';

/**
 * Create a registry with all default matchers pre-registered
 *
 * @returns ConditionMatcherRegistry with standard matchers
 */
export function createDefaultRegistry(): ConditionMatcherRegistry {
    const registry = new ConditionMatcherRegistry();
    registry.registerAll([
        new EqualsConditionMatcher(),
        new ContainsConditionMatcher(),
        new StartsWithConditionMatcher(),
        new EndsWithConditionMatcher(),
        new RegexConditionMatcher(),
    ]);
    return registry;
}
