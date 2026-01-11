/**
 * Adaptation Integration
 *
 * Integrates quality pattern recognition with AI Lead Adaptation System.
 *
 * Design Pattern: Adapter Pattern (GoF, p. 139) + Observer Pattern (GoF, p. 293)
 * - Adapts quality events to adaptation system format
 * - Observes adaptation outcomes for pattern learning
 *
 * References:
 * - Gamma, E., Helm, R., Johnson, R., & Vlissides, J. (1994). Design Patterns: Elements of Reusable Object-Oriented Software. Addison-Wesley. p. 139, 293.
 */

import { LearningLoop } from '../../adaptation/LearningLoop';
import { AdaptationTracker, AdaptationOutcome } from '../../adaptation/AdaptationTracker';
import { QualityPatternRecognizer } from '../patterns/QualityPatternRecognizer';
import { PatternLearningContext } from '../patterns/QualityPattern';
import { QualityIssue } from '../tools/QualityToolInterface';

/**
 * Adaptation Integration
 *
 * Integrates quality pattern recognition with AI Lead Adaptation System.
 */
export class AdaptationIntegration {
    private learningLoop: LearningLoop;
    private adaptationTracker: AdaptationTracker;
    private patternRecognizer: QualityPatternRecognizer;

    constructor(
        learningLoop: LearningLoop,
        adaptationTracker: AdaptationTracker,
        patternRecognizer: QualityPatternRecognizer
    ) {
        this.learningLoop = learningLoop;
        this.adaptationTracker = adaptationTracker;
        this.patternRecognizer = patternRecognizer;
    }

    /**
     * Learn patterns from adaptation outcomes
     */
    async learnPatternsFromAdaptation(
        outcome: AdaptationOutcome,
        qualityIssues?: QualityIssue[]
    ): Promise<void> {
        // Create learning context from adaptation outcome
        const learningContext: PatternLearningContext = {
            issues: qualityIssues || [],
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
            quality_issues_count: qualityIssues?.length || 0,
            quality_errors_count: qualityIssues?.filter((i) => i.severity === 'error').length || 0,
            quality_warnings_count: qualityIssues?.filter((i) => i.severity === 'warning').length || 0,
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
        // This is a placeholder for integration
        console.log('Tracking quality improvement:', outcome.change_proposal_id);
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
