/**
 * Pattern Matchers Unit Tests
 *
 * Tests for the Strategy Pattern implementation of condition matchers.
 *
 * Design Pattern: Strategy Pattern (GoF, p. 315)
 * - Tests each concrete matcher strategy
 * - Tests the registry's ability to find and use matchers
 */

import {
    IConditionMatcher,
    ConditionMatcherRegistry,
    EqualsConditionMatcher,
    ContainsConditionMatcher,
    StartsWithConditionMatcher,
    EndsWithConditionMatcher,
    RegexConditionMatcher,
    createDefaultRegistry,
} from '../../src/quality/patterns/matchers';
import { PatternCondition } from '../../src/quality/patterns/QualityPattern';

describe('ConditionMatchers', () => {
    describe('EqualsConditionMatcher', () => {
        let matcher: IConditionMatcher;

        beforeEach(() => {
            matcher = new EqualsConditionMatcher();
        });

        test('should support equals operator', () => {
            expect(matcher.supports('equals')).toBe(true);
            expect(matcher.supports('contains')).toBe(false);
        });

        test('should match equal strings (case-insensitive)', () => {
            const condition: PatternCondition = {
                field: 'message',
                operator: 'equals',
                value: 'Test Error',
            };
            expect(matcher.evaluate(condition, 'test error')).toBe(true);
            expect(matcher.evaluate(condition, 'TEST ERROR')).toBe(true);
            expect(matcher.evaluate(condition, 'Test Error')).toBe(true);
        });

        test('should not match different strings', () => {
            const condition: PatternCondition = {
                field: 'message',
                operator: 'equals',
                value: 'error',
            };
            expect(matcher.evaluate(condition, 'warning')).toBe(false);
            expect(matcher.evaluate(condition, 'error message')).toBe(false);
        });

        test('should respect negate flag', () => {
            const condition: PatternCondition = {
                field: 'message',
                operator: 'equals',
                value: 'error',
                negate: true,
            };
            expect(matcher.evaluate(condition, 'error')).toBe(false);
            expect(matcher.evaluate(condition, 'warning')).toBe(true);
        });

        test('should handle numeric values', () => {
            const condition: PatternCondition = {
                field: 'line_number',
                operator: 'equals',
                value: '42',
            };
            expect(matcher.evaluate(condition, 42)).toBe(true);
            expect(matcher.evaluate(condition, '42')).toBe(true);
            expect(matcher.evaluate(condition, 43)).toBe(false);
        });
    });

    describe('ContainsConditionMatcher', () => {
        let matcher: IConditionMatcher;

        beforeEach(() => {
            matcher = new ContainsConditionMatcher();
        });

        test('should support contains operator', () => {
            expect(matcher.supports('contains')).toBe(true);
            expect(matcher.supports('equals')).toBe(false);
        });

        test('should match substrings (case-insensitive)', () => {
            const condition: PatternCondition = {
                field: 'message',
                operator: 'contains',
                value: 'error',
            };
            expect(matcher.evaluate(condition, 'This is an error message')).toBe(true);
            expect(matcher.evaluate(condition, 'ERROR occurred')).toBe(true);
            expect(matcher.evaluate(condition, 'An Error Happened')).toBe(true);
        });

        test('should not match when substring not present', () => {
            const condition: PatternCondition = {
                field: 'message',
                operator: 'contains',
                value: 'error',
            };
            expect(matcher.evaluate(condition, 'warning')).toBe(false);
            expect(matcher.evaluate(condition, 'success')).toBe(false);
        });

        test('should respect negate flag', () => {
            const condition: PatternCondition = {
                field: 'message',
                operator: 'contains',
                value: 'error',
                negate: true,
            };
            expect(matcher.evaluate(condition, 'success message')).toBe(true);
            expect(matcher.evaluate(condition, 'error occurred')).toBe(false);
        });
    });

    describe('StartsWithConditionMatcher', () => {
        let matcher: IConditionMatcher;

        beforeEach(() => {
            matcher = new StartsWithConditionMatcher();
        });

        test('should support starts_with operator', () => {
            expect(matcher.supports('starts_with')).toBe(true);
            expect(matcher.supports('equals')).toBe(false);
        });

        test('should match prefix (case-insensitive)', () => {
            const condition: PatternCondition = {
                field: 'message',
                operator: 'starts_with',
                value: 'Error:',
            };
            expect(matcher.evaluate(condition, 'Error: something went wrong')).toBe(true);
            expect(matcher.evaluate(condition, 'error: unexpected input')).toBe(true);
        });

        test('should not match when prefix absent', () => {
            const condition: PatternCondition = {
                field: 'message',
                operator: 'starts_with',
                value: 'Error:',
            };
            expect(matcher.evaluate(condition, 'Warning: something')).toBe(false);
            expect(matcher.evaluate(condition, 'Something Error:')).toBe(false);
        });
    });

    describe('EndsWithConditionMatcher', () => {
        let matcher: IConditionMatcher;

        beforeEach(() => {
            matcher = new EndsWithConditionMatcher();
        });

        test('should support ends_with operator', () => {
            expect(matcher.supports('ends_with')).toBe(true);
            expect(matcher.supports('contains')).toBe(false);
        });

        test('should match suffix (case-insensitive)', () => {
            const condition: PatternCondition = {
                field: 'file_path',
                operator: 'ends_with',
                value: '.py',
            };
            expect(matcher.evaluate(condition, 'test.py')).toBe(true);
            expect(matcher.evaluate(condition, 'module.PY')).toBe(true);
        });

        test('should not match when suffix absent', () => {
            const condition: PatternCondition = {
                field: 'file_path',
                operator: 'ends_with',
                value: '.py',
            };
            expect(matcher.evaluate(condition, 'test.js')).toBe(false);
            expect(matcher.evaluate(condition, 'test.pyx')).toBe(false);
        });
    });

    describe('RegexConditionMatcher', () => {
        let matcher: IConditionMatcher;

        beforeEach(() => {
            matcher = new RegexConditionMatcher();
        });

        test('should support matches and regex operators', () => {
            expect(matcher.supports('matches')).toBe(true);
            expect(matcher.supports('regex')).toBe(true);
            expect(matcher.supports('equals')).toBe(false);
        });

        test('should match regex pattern', () => {
            const condition: PatternCondition = {
                field: 'rule_id',
                operator: 'matches',
                value: '^E\\d{3}$',
            };
            expect(matcher.evaluate(condition, 'E501')).toBe(true);
            expect(matcher.evaluate(condition, 'E123')).toBe(true);
            expect(matcher.evaluate(condition, 'W501')).toBe(false);
            expect(matcher.evaluate(condition, 'E5010')).toBe(false);
        });

        test('should handle invalid regex gracefully', () => {
            const condition: PatternCondition = {
                field: 'message',
                operator: 'regex',
                value: '[invalid(regex',
            };
            expect(matcher.evaluate(condition, 'anything')).toBe(false);
        });

        test('should accept RegExp objects', () => {
            const condition: PatternCondition = {
                field: 'message',
                operator: 'matches',
                value: /line\s+\d+/i,
            };
            expect(matcher.evaluate(condition, 'Error at line 42')).toBe(true);
        });

        test('should respect negate flag', () => {
            const condition: PatternCondition = {
                field: 'rule_id',
                operator: 'regex',
                value: '^W\\d+',
                negate: true,
            };
            expect(matcher.evaluate(condition, 'E501')).toBe(true);
            expect(matcher.evaluate(condition, 'W501')).toBe(false);
        });
    });

    describe('ConditionMatcherRegistry', () => {
        let registry: ConditionMatcherRegistry;

        beforeEach(() => {
            registry = new ConditionMatcherRegistry();
        });

        test('should register and find matchers', () => {
            const equalsMatcher = new EqualsConditionMatcher();
            registry.register(equalsMatcher);

            expect(registry.hasMatcherFor('equals')).toBe(true);
            expect(registry.findMatcher('equals')).toBe(equalsMatcher);
            expect(registry.hasMatcherFor('contains')).toBe(false);
        });

        test('should register multiple matchers', () => {
            registry.registerAll([
                new EqualsConditionMatcher(),
                new ContainsConditionMatcher(),
                new RegexConditionMatcher(),
            ]);

            expect(registry.getMatcherCount()).toBe(3);
            expect(registry.hasMatcherFor('equals')).toBe(true);
            expect(registry.hasMatcherFor('contains')).toBe(true);
            expect(registry.hasMatcherFor('matches')).toBe(true);
        });

        test('should evaluate conditions using appropriate matcher', () => {
            registry.registerAll([
                new EqualsConditionMatcher(),
                new ContainsConditionMatcher(),
            ]);

            const equalsCondition: PatternCondition = {
                field: 'severity',
                operator: 'equals',
                value: 'error',
            };
            expect(registry.evaluate(equalsCondition, 'error')).toBe(true);

            const containsCondition: PatternCondition = {
                field: 'message',
                operator: 'contains',
                value: 'import',
            };
            expect(registry.evaluate(containsCondition, 'missing import')).toBe(true);
        });

        test('should return false for unsupported operator', () => {
            registry.register(new EqualsConditionMatcher());

            const condition: PatternCondition = {
                field: 'message',
                operator: 'contains',
                value: 'error',
            };
            expect(registry.evaluate(condition, 'error message')).toBe(false);
        });

        test('should get all supported operators', () => {
            const defaultRegistry = createDefaultRegistry();
            const operators = defaultRegistry.getSupportedOperators();

            expect(operators).toContain('equals');
            expect(operators).toContain('contains');
            expect(operators).toContain('starts_with');
            expect(operators).toContain('ends_with');
            expect(operators).toContain('matches');
            expect(operators).toContain('regex');
        });

        test('should clear all matchers', () => {
            registry.registerAll([
                new EqualsConditionMatcher(),
                new ContainsConditionMatcher(),
            ]);
            expect(registry.getMatcherCount()).toBe(2);

            registry.clear();
            expect(registry.getMatcherCount()).toBe(0);
        });
    });

    describe('createDefaultRegistry', () => {
        test('should create registry with all standard matchers', () => {
            const registry = createDefaultRegistry();

            expect(registry.hasMatcherFor('equals')).toBe(true);
            expect(registry.hasMatcherFor('contains')).toBe(true);
            expect(registry.hasMatcherFor('starts_with')).toBe(true);
            expect(registry.hasMatcherFor('ends_with')).toBe(true);
            expect(registry.hasMatcherFor('matches')).toBe(true);
            expect(registry.hasMatcherFor('regex')).toBe(true);
            expect(registry.getMatcherCount()).toBe(5); // 5 matchers (regex shares with matches)
        });
    });
});

describe('PatternMatcher with Registry', () => {
    const { PatternMatcher } = require('../../src/quality/patterns/PatternMatcher');

    test('should use default registry', () => {
        const matcher = new PatternMatcher();
        const operators = matcher.getSupportedOperators();

        expect(operators).toContain('equals');
        expect(operators).toContain('contains');
    });

    test('should accept custom registry', () => {
        const registry = new ConditionMatcherRegistry();
        registry.register(new EqualsConditionMatcher());

        const matcher = new PatternMatcher(registry);
        const operators = matcher.getSupportedOperators();

        expect(operators).toContain('equals');
        expect(operators).not.toContain('contains');
    });
});
