/**
 * Integration Tests: Quality Result Aggregator
 *
 * Tests QualityResultAggregator integration with orchestrator results.
 *
 * Design Pattern: Test Pattern (xUnit Test Patterns, Meszaros)
 */

import { QualityResultAggregator } from '../../../src/quality/tools/QualityResultAggregator';
import { QualityToolOrchestrator } from '../../../src/quality/tools/QualityToolOrchestrator';
import { Flake8Adapter } from '../../../src/quality/tools/PythonToolsAdapter';
import { ESLintAdapter } from '../../../src/quality/tools/TypeScriptToolsAdapter';
import { QualityIssue } from '../../../src/quality/tools/QualityToolInterface';
import * as path from 'path';

describe('QualityResultAggregator Integration', () => {
    let aggregator: QualityResultAggregator;
    let orchestrator: QualityToolOrchestrator;
    const projectRoot = path.resolve(__dirname, '../../../');

    beforeEach(() => {
        aggregator = new QualityResultAggregator();
        orchestrator = new QualityToolOrchestrator({
            parallel: false,
            timeout_ms: 60000,
            continue_on_error: true,
        });
    });

    describe('Result Aggregation', () => {
        it('should aggregate results from multiple tools', async () => {
            const flake8 = new Flake8Adapter(projectRoot);
            const eslint = new ESLintAdapter(projectRoot);

            orchestrator.registerTools([flake8, eslint]);

            const orchestrationResult = await orchestrator.executeTools(
                ['flake8', 'eslint'],
                projectRoot,
                { parallel: false }
            );

            const report = aggregator.aggregateResults(orchestrationResult.results);

            expect(report).toBeDefined();
            expect(report.summary).toBeDefined();
            expect(report.summary.total_tools).toBe(2);
            expect(report.by_tool.size).toBe(2);
            expect(report.by_file.size).toBeGreaterThanOrEqual(0);
        }, 120000);

        it('should generate summary statistics', async () => {
            const flake8 = new Flake8Adapter(projectRoot);
            orchestrator.registerTool(flake8);

            const orchestrationResult = await orchestrator.executeTools(
                ['flake8'],
                projectRoot,
                { parallel: false }
            );

            const report = aggregator.aggregateResults(orchestrationResult.results);
            const summary = aggregator.getSummary(report);

            expect(summary).toBeDefined();
            expect(summary.total_tools).toBeGreaterThanOrEqual(1);
            expect(summary.total_issues).toBeGreaterThanOrEqual(0);
            expect(summary.total_errors).toBeGreaterThanOrEqual(0);
            expect(summary.total_warnings).toBeGreaterThanOrEqual(0);
            expect(summary.files_with_issues).toBeGreaterThanOrEqual(0);
        }, 120000);

        it('should group issues by severity', async () => {
            const flake8 = new Flake8Adapter(projectRoot);
            orchestrator.registerTool(flake8);

            const orchestrationResult = await orchestrator.executeTools(
                ['flake8'],
                projectRoot,
                { parallel: false }
            );

            const report = aggregator.aggregateResults(orchestrationResult.results);
            const issuesBySeverity = aggregator.getIssuesBySeverity(report);

            expect(issuesBySeverity).toBeDefined();
            expect(issuesBySeverity.errors).toBeInstanceOf(Array);
            expect(issuesBySeverity.warnings).toBeInstanceOf(Array);
            expect(issuesBySeverity.info).toBeInstanceOf(Array);
        }, 120000);
    });

    describe('File-Level Reports', () => {
        it('should generate file-level quality reports', async () => {
            const flake8 = new Flake8Adapter(projectRoot);
            orchestrator.registerTool(flake8);

            const orchestrationResult = await orchestrator.executeTools(
                ['flake8'],
                projectRoot,
                { parallel: false }
            );

            const report = aggregator.aggregateResults(orchestrationResult.results);

            // Check if any files have issues
            if (report.by_file.size > 0) {
                const firstFile = Array.from(report.by_file.keys())[0];
                const fileReport = aggregator.getFileIssues(report, firstFile);

                expect(fileReport).toBeDefined();
                expect(fileReport?.file_path).toBe(firstFile);
                expect(fileReport?.issues).toBeInstanceOf(Array);
                expect(fileReport?.errors).toBeInstanceOf(Array);
                expect(fileReport?.warnings).toBeInstanceOf(Array);
            }
        }, 120000);
    });

    describe('Tool-Level Reports', () => {
        it('should retrieve tool-specific results', async () => {
            const flake8 = new Flake8Adapter(projectRoot);
            orchestrator.registerTool(flake8);

            const orchestrationResult = await orchestrator.executeTools(
                ['flake8'],
                projectRoot,
                { parallel: false }
            );

            const report = aggregator.aggregateResults(orchestrationResult.results);
            const toolResult = aggregator.getIssuesByTool(report, 'flake8');

            expect(toolResult).toBeDefined();
            expect(toolResult?.tool_name).toBe('flake8');
        }, 120000);
    });

    describe('JSON Serialization', () => {
        it('should generate valid JSON report', async () => {
            const flake8 = new Flake8Adapter(projectRoot);
            orchestrator.registerTool(flake8);

            const orchestrationResult = await orchestrator.executeTools(
                ['flake8'],
                projectRoot,
                { parallel: false }
            );

            const report = aggregator.aggregateResults(orchestrationResult.results);
            const jsonReport = aggregator.generateJSONReport(report);

            expect(jsonReport).toBeDefined();
            expect(() => JSON.parse(jsonReport)).not.toThrow();
        }, 120000);
    });
});
