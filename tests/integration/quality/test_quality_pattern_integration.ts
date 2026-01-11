/**
 * Integration Tests: Quality Pattern Integration
 *
 * Tests integration between quality tools and pattern recognition.
 *
 * Design Pattern: Test Pattern (xUnit Test Patterns, Meszaros)
 */

import {
    QualityToolOrchestrator,
} from '../../../src/quality/tools/QualityToolOrchestrator';
import { QualityPatternRecognizer } from '../../../src/quality/patterns/QualityPatternRecognizer';
import { QualityPatternDatabase } from '../../../src/quality/patterns/QualityPatternDatabase';
import { QualityPatternIntegration } from '../../../src/quality/integration/QualityPatternIntegration';
import { Flake8Adapter } from '../../../src/quality/tools/PythonToolsAdapter';
import { ESLintAdapter } from '../../../src/quality/tools/TypeScriptToolsAdapter';
import * as path from 'path';

describe('Quality Pattern Integration', () => {
    let orchestrator: QualityToolOrchestrator;
    let recognizer: QualityPatternRecognizer;
    let integration: QualityPatternIntegration;
    const projectRoot = path.resolve(__dirname, '../../../');

    beforeEach(async () => {
        orchestrator = new QualityToolOrchestrator({
            parallel: false,
            timeout_ms: 60000,
            continue_on_error: true,
        });

        const database = new QualityPatternDatabase();
        recognizer = new QualityPatternRecognizer(database, {
            min_confidence: 0.3,
            min_frequency: 2,
            enable_learning: true,
        });

        await recognizer.initialize();

        integration = new QualityPatternIntegration(orchestrator, recognizer);
    });

    describe('Quality Checks with Pattern Recognition', () => {
        it('should run quality checks and recognize patterns', async () => {
            const flake8 = new Flake8Adapter(projectRoot);
            const eslint = new ESLintAdapter(projectRoot);

            orchestrator.registerTools([flake8, eslint]);

            const result = await integration.runQualityChecksWithPatterns(
                projectRoot,
                {
                    parallel: false,
                    enable_learning: false, // Disable learning for faster tests
                }
            );

            expect(result).toBeDefined();
            expect(result.quality_results).toBeDefined();
            expect(result.pattern_matches).toBeInstanceOf(Array);
            expect(result.suggestions).toBeInstanceOf(Array);
            expect(result.timestamp).toBeDefined();
        }, 120000);

        it('should learn patterns from quality issues', async () => {
            const flake8 = new Flake8Adapter(projectRoot);

            orchestrator.registerTool(flake8);

            const result = await integration.runQualityChecksWithPatterns(
                projectRoot,
                {
                    parallel: false,
                    enable_learning: true,
                }
            );

            expect(result.learned_patterns).toBeInstanceOf(Array);
        }, 120000);

        it('should generate suggestions from pattern matches', async () => {
            const flake8 = new Flake8Adapter(projectRoot);

            orchestrator.registerTool(flake8);

            const result = await integration.runQualityChecksWithPatterns(
                projectRoot,
                {
                    parallel: false,
                    enable_learning: false,
                }
            );

            expect(result.suggestions).toBeInstanceOf(Array);
        }, 120000);
    });

    describe('Pattern Insights', () => {
        it('should provide pattern insights for issues', async () => {
            const issue = {
                severity: 'error' as const,
                rule_id: 'E501',
                rule_name: 'line-too-long',
                message: 'line too long (120 > 127 characters)',
                file_path: 'test.py',
                line_number: 10,
            };

            const insights = await integration.getPatternInsights(issue);

            expect(insights).toBeInstanceOf(Array);
        });
    });

    describe('Pattern Statistics', () => {
        it('should provide pattern statistics', () => {
            const stats = integration.getPatternStatistics();

            expect(stats).toBeDefined();
            expect(stats.total_patterns).toBeGreaterThanOrEqual(0);
            expect(stats.by_type).toBeDefined();
            expect(stats.by_severity).toBeDefined();
        });
    });
});
