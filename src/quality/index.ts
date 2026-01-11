/**
 * Quality System Module
 *
 * Main entry point for the Quality System.
 * Exports all public components for quality analysis and pattern recognition.
 *
 * ## Architecture Overview
 *
 * The Quality System follows a layered architecture:
 *
 * 1. **Tools Layer**: Adapters for quality tools (flake8, ESLint, etc.)
 * 2. **Patterns Layer**: Pattern recognition and learning
 * 3. **Integration Layer**: Connects tools with patterns and adaptation
 * 4. **DI Layer**: Dependency injection container
 *
 * ## Design Patterns Used
 *
 * - **Adapter Pattern**: Tool adapters (PythonToolsAdapter, TypeScriptToolsAdapter)
 * - **Strategy Pattern**: Condition matchers (IConditionMatcher implementations)
 * - **Facade Pattern**: QualityPatternRecognizer, QualityPatternIntegration
 * - **Repository Pattern**: QualityPatternDatabase
 * - **Null Object Pattern**: NullQualityPattern, NullPatternMatchResult
 * - **Result Pattern**: Result type for error handling
 * - **Dependency Injection**: Container with factory registration
 */

// Tools
export {
    IQualityTool,
    QualityToolResult,
    QualityIssue,
    QualityMetrics,
    QualityToolConfig,
    QualityToolExecutionOptions,
} from './tools/QualityToolInterface';

export {
    Flake8Adapter,
    BlackAdapter,
    MyPyAdapter,
} from './tools/PythonToolsAdapter';

export {
    ESLintAdapter,
    TypeScriptCompilerAdapter,
} from './tools/TypeScriptToolsAdapter';

export {
    QualityToolOrchestrator,
    QualityOrchestrationResult,
} from './tools/QualityToolOrchestrator';

export { QualityToolExecutionResult } from './tools/QualityToolInterface';

export { QualityResultAggregator } from './tools/QualityResultAggregator';

export { Result, ResultUtils, isSuccess, isFailure, getError, getValue } from './tools/Result';

// Patterns
export {
    QualityPattern,
    PatternType,
    PatternCondition,
    PatternAction,
    PatternMetadata,
    PatternMatchResult,
    PatternLearningContext,
    PatternRecognitionConfig,
    QualityPatternDatabase,
    PatternMatcher,
    PatternLearner,
    QualityPatternRecognizer,
    NullQualityPattern,
    NullPatternMatchResult,
    isNullPattern,
    isNullMatchResult,
    getPatternOrNull,
    getMatchResultOrNull,
    IConditionMatcher,
    ConditionMatcherRegistry,
    createDefaultRegistry,
} from './patterns';

// Integration
export { QualityPatternIntegration } from './integration/QualityPatternIntegration';
export { AdaptationIntegration } from './integration/AdaptationIntegration';

// DI
export {
    Container,
    QualityTokens,
    setupQualityContainer,
    createQualityContainer,
    type QualityConfig,
    type Factory,
    type QualityToken,
} from './di';
