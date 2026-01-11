/**
 * Quality Integration
 *
 * Exports for quality system integration.
 */

export {
    QualityPatternIntegration,
    QualityPatternIntegrationResult,
} from './QualityPatternIntegration';

export { AdaptationIntegration } from './AdaptationIntegration';

export {
    IQualityEventObserver,
    QualityEvent,
    QualityEventSubject,
    QualityEventType,
    QualityEventData,
    AdaptationOutcomeEventData,
    QualityCheckCompleteEventData,
    PatternLearnedEventData,
    PatternMatchedEventData,
    AutoFixAppliedEventData,
    QualityImprovementEventData,
} from './QualityEventObserver';

export { PatternRecognizerObserver } from './observers/PatternRecognizerObserver';
