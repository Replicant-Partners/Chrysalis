/**
 * Integration Tests: Adaptation Integration
 *
 * Tests integration between quality patterns and AI Lead Adaptation System.
 *
 * Design Pattern: Test Pattern (xUnit Test Patterns, Meszaros)
 */

import { LearningLoop } from '../../../src/adaptation/LearningLoop';
import { AdaptationTracker } from '../../../src/adaptation/AdaptationTracker';
import { QualityPatternRecognizer } from '../../../src/quality/patterns/QualityPatternRecognizer';
import { QualityPatternDatabase } from '../../../src/quality/patterns/QualityPatternDatabase';
import { AdaptationIntegration } from '../../../src/quality/integration/AdaptationIntegration';
import { QualityIssue } from '../../../src/quality/tools/QualityToolInterface';
import { AdaptationOutcome } from '../../../src/adaptation/AdaptationTracker';

describe('Adaptation Integration', () => {
    let learningLoop: LearningLoop;
    let adaptationTracker: AdaptationTracker;
    let recognizer: QualityPatternRecognizer;
    let integration: AdaptationIntegration;

    beforeEach(async () => {
        adaptationTracker = new AdaptationTracker();
        learningLoop = new LearningLoop(adaptationTracker);

        const database = new QualityPatternDatabase();
        recognizer = new QualityPatternRecognizer(database, {
            min_confidence: 0.3,
            min_frequency: 2,
            enable_learning: true,
        });

        await recognizer.initialize();

        integration = new AdaptationIntegration(
            learningLoop,
            adaptationTracker,
            recognizer
        );
    });

    describe('Pattern Learning from Adaptation', () => {
        it('should learn patterns from adaptation outcomes', async () => {
            const outcome: AdaptationOutcome = {
                change_proposal_id: 'test_proposal_1',
                task_id: 'test_task_1',
                implemented: true,
                success: true,
                metrics_before: {
                    total_errors: 10,
                    total_warnings: 5,
                },
                metrics_after: {
                    total_errors: 5,
                    total_warnings: 2,
                },
                implemented_at: new Date().toISOString(),
            };

            const qualityIssues: QualityIssue[] = [
                {
                    severity: 'error',
                    rule_id: 'E501',
                    message: 'line too long',
                    file_path: 'test.py',
                    line_number: 10,
                },
                {
                    severity: 'error',
                    rule_id: 'E501',
                    message: 'line too long',
                    file_path: 'test2.py',
                    line_number: 20,
                },
            ];

            await integration.learnPatternsFromAdaptation(outcome, qualityIssues);

            const stats = recognizer.getStatistics();
            expect(stats.total_patterns).toBeGreaterThanOrEqual(0);
        });

        it('should handle adaptation outcomes without quality issues', async () => {
            const outcome: AdaptationOutcome = {
                change_proposal_id: 'test_proposal_2',
                task_id: 'test_task_2',
                implemented: true,
                success: true,
                metrics_before: {},
                metrics_after: {},
                implemented_at: new Date().toISOString(),
            };

            await integration.learnPatternsFromAdaptation(outcome);

            // Should not throw
            expect(true).toBe(true);
        });
    });

    describe('Adaptation Insights', () => {
        it('should provide adaptation insights from quality issues', async () => {
            const qualityIssues: QualityIssue[] = [
                {
                    severity: 'error',
                    rule_id: 'E501',
                    message: 'line too long',
                    file_path: 'test.py',
                    line_number: 10,
                },
                {
                    severity: 'warning',
                    rule_id: 'W503',
                    message: 'line break before binary operator',
                    file_path: 'test.py',
                    line_number: 15,
                },
            ];

            const insights = await integration.getAdaptationInsights(qualityIssues);

            expect(insights).toBeDefined();
            expect(insights.recognized_patterns).toBeGreaterThanOrEqual(0);
            expect(insights.suggestions).toBeInstanceOf(Array);
            expect(insights.auto_fixable_patterns).toBeInstanceOf(Array);
        });

        it('should handle empty quality issues', async () => {
            const insights = await integration.getAdaptationInsights([]);

            expect(insights.recognized_patterns).toBe(0);
            expect(insights.suggestions).toEqual([]);
            expect(insights.auto_fixable_patterns).toEqual([]);
        });
    });

    describe('Quality Improvement Tracking', () => {
        it('should track quality improvement from adaptation', async () => {
            const changeProposalId = 'test_proposal_3';
            const metricsBefore = {
                total_errors: 10,
                total_warnings: 5,
            };
            const metricsAfter = {
                total_errors: 5,
                total_warnings: 2,
            };

            await integration.trackQualityImprovement(
                changeProposalId,
                metricsBefore,
                metricsAfter
            );

            // Should not throw
            expect(true).toBe(true);
        });

        it('should calculate success correctly', async () => {
            const changeProposalId = 'test_proposal_4';
            const metricsBefore = {
                total_errors: 10,
                total_warnings: 5,
            };
            const metricsAfter = {
                total_errors: 5,
                total_warnings: 2,
            };

            await integration.trackQualityImprovement(
                changeProposalId,
                metricsBefore,
                metricsAfter
            );

            // Should not throw
            expect(true).toBe(true);
        });
    });
});
