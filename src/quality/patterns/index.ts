/**
 * Quality Patterns Module
 *
 * Exports all pattern-related types, classes, and utilities.
 */

// Core types
export {
    QualityPattern,
    PatternType,
    PatternCondition,
    PatternAction,
    PatternMetadata,
    PatternMatchResult,
    PatternLearningContext,
    PatternRecognitionConfig,
} from './QualityPattern';

// Pattern database
export { QualityPatternDatabase } from './QualityPatternDatabase';

// Pattern matching
export { PatternMatcher } from './PatternMatcher';
export { PatternLearner } from './PatternLearner';
export { QualityPatternRecognizer } from './QualityPatternRecognizer';

// Null Object pattern
export {
    NullQualityPattern,
    NullPatternMatchResult,
    isNullPattern,
    isNullMatchResult,
    getPatternOrNull,
    getMatchResultOrNull,
} from './NullQualityPattern';

// Condition matchers (Strategy pattern)
export {
    IConditionMatcher,
    ConditionMatcherRegistry,
    EqualsConditionMatcher,
    ContainsConditionMatcher,
    StartsWithConditionMatcher,
    EndsWithConditionMatcher,
    RegexConditionMatcher,
    createDefaultRegistry,
} from './matchers';
