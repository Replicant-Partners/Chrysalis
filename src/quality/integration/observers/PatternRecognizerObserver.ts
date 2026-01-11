/**
 * Pattern Recognizer Observer
 *
 * Observer implementation for pattern recognition events.
 *
 * Design Pattern: Observer Pattern (GoF, p. 293)
 * - Observes quality events and triggers pattern learning
 *
 * References:
 * - Gamma, E., Helm, R., Johnson, R., & Vlissides, J. (1994). Design Patterns: Elements of Reusable Object-Oriented Software. Addison-Wesley. p. 293-303.
 */

import {
    IQualityEventObserver,
    QualityEvent,
    AdaptationOutcomeEventData,
} from '../QualityEventObserver';
import { QualityPatternRecognizer } from '../../patterns/QualityPatternRecognizer';
import { PatternLearningContext } from '../../patterns/QualityPattern';
import { LearningLoop } from '../../../adaptation/LearningLoop';

/**
 * Pattern Recognizer Observer
 *
 * Observes adaptation outcomes and triggers pattern learning.
 */
export class PatternRecognizerObserver implements IQualityEventObserver {
    private recognizer: QualityPatternRecognizer;
    private learningLoop: LearningLoop;

    constructor(
        recognizer: QualityPatternRecognizer,
        learningLoop: LearningLoop
    ) {
        this.recognizer = recognizer;
        this.learningLoop = learningLoop;
    }

    /**
     * Handle quality event
     */
    async onQualityEvent(event: QualityEvent): Promise<void> {
        if (event.type === 'adaptation_outcome') {
            await this.handleAdaptationOutcome(event.data as AdaptationOutcomeEventData);
        }
    }

    /**
     * Handle adaptation outcome
     */
    private async handleAdaptationOutcome(
        data: AdaptationOutcomeEventData
    ): Promise<void> {
        const { outcome, quality_issues } = data;

        // Create learning context
        const learningContext: PatternLearningContext = {
            issues: quality_issues || [],
            fixes_applied: outcome.implemented ? [outcome] : [],
            outcomes: [outcome],
            metadata: {
                source: 'adaptation',
                change_proposal_id: outcome.change_proposal_id,
                task_id: outcome.task_id,
                success: outcome.success,
            },
        };

        // Learn patterns
        await this.recognizer.learnPatterns(learningContext);

        // Feed to learning loop
        await this.learningLoop.collectExperience(outcome, {
            quality_issues_count: quality_issues?.length || 0,
            quality_errors_count:
                quality_issues?.filter((i) => i.severity === 'error').length || 0,
            quality_warnings_count:
                quality_issues?.filter((i) => i.severity === 'warning').length || 0,
        });
    }
}
