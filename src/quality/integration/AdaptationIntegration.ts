/**
 * Adaptation Integration
 *
 * Integrates quality pattern recognition with AI Lead Adaptation System.
 *
 * Design Pattern: Adapter Pattern (GoF, p. 139)
 * - Adapts quality events to adaptation system format
 * - Bridges quality pattern recognition with AI Lead Adaptation components
 *
 * References:
 * - Gamma, E., Helm, R., Johnson, R., & Vlissides, J. (1994). Design Patterns: Elements of Reusable Object-Oriented Software. Addison-Wesley. p. 139.
 */

import { LearningLoop } from '../../adaptation/LearningLoop';
import { AdaptationTracker, AdaptationOutcome } from '../../adaptation/AdaptationTracker';
import { NotImplementedError } from '../../adaptation/agents/QualityAnalysisAgent';
import { QualityPatternRecognizer } from '../patterns/QualityPatternRecognizer';
import { PatternLearningContext } from '../patterns/QualityPattern';
import { QualityIssue } from '../tools/QualityToolInterface';
import {
    IQualityEventObserver,
    QualityEvent,
    QualityEventSubject,
    AdaptationOutcomeEventData,
} from './QualityEventObserver';

/**
 * Adaptation Integration
 *
 * Integrates quality pattern recognition with AI Lead Adaptation System.
 *
 * Implements Observer pattern explicitly for quality events.
 */
export class AdaptationIntegration implements IQualityEventObserver {
    private learningLoop: LearningLoop;
    private adaptationTracker: AdaptationTracker;
    private patternRecognizer: QualityPatternRecognizer;
    private eventSubject: QualityEventSubject;

    constructor(
        learningLoop: LearningLoop,
        adaptationTracker: AdaptationTracker,
        patternRecognizer: QualityPatternRecognizer,
        eventSubject?: QualityEventSubject
    ) {
        this.learningLoop = learningLoop;
        this.adaptationTracker = adaptationTracker;
        this.patternRecognizer = patternRecognizer;
        this.eventSubject = eventSubject || new QualityEventSubject();

        // Register self as observer
        this.eventSubject.attach(this);
    }

    /**
     * Handle quality event (Observer pattern)
     */
    async onQualityEvent(event: QualityEvent): Promise<void> {
        switch (event.type) {
            case 'adaptation_outcome':
                await this.handleAdaptationOutcome(event.data as AdaptationOutcomeEventData);
                break;
            case 'quality_check_complete':
                // Handle quality check completion if needed
                break;
            case 'pattern_learned':
                // Handle pattern learning if needed
                break;
            case 'pattern_matched':
                // Handle pattern matching if needed
                break;
            case 'auto_fix_applied':
                // Handle auto-fix if needed
                break;
            case 'quality_improvement':
                // Handle quality improvement if needed
                break;
        }
    }

    /**
     * Get event subject for external observers
     */
    getEventSubject(): QualityEventSubject {
        return this.eventSubject;
    }

    /**
     * Learn patterns from adaptation outcomes
     *
     * Now uses explicit Observer pattern via event notification.
     */
    async learnPatternsFromAdaptation(
        outcome: AdaptationOutcome,
        qualityIssues?: QualityIssue[]
    ): Promise<void> {
        // Notify observers via event subject (Observer pattern)
        const event: QualityEvent = {
            type: 'adaptation_outcome',
            timestamp: new Date().toISOString(),
            data: {
                outcome,
                quality_issues: qualityIssues,
            } as AdaptationOutcomeEventData,
        };

        // Notify all observers (including self)
        await this.eventSubject.notify(event);
    }

    /**
     * Handle adaptation outcome event (private handler)
     */
    private async handleAdaptationOutcome(
        data: AdaptationOutcomeEventData
    ): Promise<void> {
        const { outcome, quality_issues } = data;

        // Create learning context from adaptation outcome
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
        await this.patternRecognizer.learnPatterns(learningContext);

        // Also feed to learning loop using adaptation outcome
        // LearningLoop.collectExperience expects AdaptationOutcome
        await this.learningLoop.collectExperience(outcome, {
            quality_issues_count: quality_issues?.length || 0,
            quality_errors_count: quality_issues?.filter((i) => i.severity === 'error').length || 0,
            quality_warnings_count: quality_issues?.filter((i) => i.severity === 'warning').length || 0,
        });
    }

    /**
     * Get adaptation insights from quality patterns
     */
    async getAdaptationInsights(
        qualityIssues: QualityIssue[]
    ): Promise<{
        recognized_patterns: number;
        suggestions: string[];
        auto_fixable_patterns: string[];
    }> {
        // Recognize patterns in issues
        const matches = await this.patternRecognizer.recognizePatterns(qualityIssues);

        // Extract suggestions
        const suggestions: string[] = [];
        const autoFixablePatterns: string[] = [];

        for (const match of matches) {
            for (const action of match.pattern.actions) {
                if (action.type === 'suggest_fix' || action.type === 'warn') {
                    suggestions.push(action.description);
                }
                if (action.auto_fixable) {
                    autoFixablePatterns.push(match.pattern.pattern_id);
                }
            }
        }

        return {
            recognized_patterns: matches.length,
            suggestions,
            auto_fixable_patterns: autoFixablePatterns,
        };
    }

    /**
     * Track quality improvement from adaptation
     */
    async trackQualityImprovement(
        changeProposalId: string,
        metricsBefore: Record<string, number>,
        metricsAfter: Record<string, number>
    ): Promise<void> {
        // Create adaptation outcome for quality improvement
        const outcome: AdaptationOutcome = {
            change_proposal_id: changeProposalId,
            task_id: `quality_${Date.now()}`,
            implemented: true,
            success: this.calculateSuccess(metricsBefore, metricsAfter),
            metrics_before: metricsBefore,
            metrics_after: metricsAfter,
            implemented_at: new Date().toISOString(),
        };

        // Track in adaptation tracker (if method exists)
        // Note: AdaptationTracker may use different method signature
        throw new NotImplementedError('AdaptationTracker integration - tracking quality improvement');
    }

    /**
     * Calculate success based on metrics improvement
     */
    private calculateSuccess(
        before: Record<string, number>,
        after: Record<string, number>
    ): boolean {
        // Success if quality metrics improved (errors/warnings reduced)
        const errorsBefore = before.total_errors || 0;
        const errorsAfter = after.total_errors || 0;
        const warningsBefore = before.total_warnings || 0;
        const warningsAfter = after.total_warnings || 0;

        return errorsAfter <= errorsBefore && warningsAfter <= warningsBefore;
    }
}
