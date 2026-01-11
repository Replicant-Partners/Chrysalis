/**
 * Integration Tests: Quality Tool Orchestrator
 *
 * Tests interaction between QualityToolOrchestrator and tool adapters.
 *
 * Design Pattern: Test Pattern (xUnit Test Patterns, Meszaros)
 */

import {
    QualityToolOrchestrator,
    QualityOrchestrationResult,
} from '../../../src/quality/tools/QualityToolOrchestrator';
import { Flake8Adapter } from '../../../src/quality/tools/PythonToolsAdapter';
import { ESLintAdapter } from '../../../src/quality/tools/TypeScriptToolsAdapter';
import {
    IQualityTool,
    QualityToolResult,
    QualityToolConfig,
} from '../../../src/quality/tools/QualityToolInterface';
import * as path from 'path';

describe('QualityToolOrchestrator Integration', () => {
    let orchestrator: QualityToolOrchestrator;
    const projectRoot = path.resolve(__dirname, '../../../');

    beforeEach(() => {
        orchestrator = new QualityToolOrchestrator({
            parallel: false, // Use sequential for deterministic tests
            timeout_ms: 60000,
            continue_on_error: true,
        });
    });

    describe('Tool Registration', () => {
        it('should register a single tool', async () => {
            const adapter = new Flake8Adapter(projectRoot);
            orchestrator.registerTool(adapter);

            const registeredTool = orchestrator.getTool('flake8');
            expect(registeredTool).toBeDefined();
            expect(registeredTool?.name).toBe('flake8');
        });

        it('should register multiple tools', () => {
            const flake8 = new Flake8Adapter(projectRoot);
            const eslint = new ESLintAdapter(projectRoot);

            orchestrator.registerTools([flake8, eslint]);

            expect(orchestrator.getTool('flake8')).toBeDefined();
            expect(orchestrator.getTool('eslint')).toBeDefined();
            expect(orchestrator.getTools().length).toBe(2);
        });

        it('should unregister a tool', () => {
            const adapter = new Flake8Adapter(projectRoot);
            orchestrator.registerTool(adapter);

            orchestrator.unregisterTool('flake8');

            expect(orchestrator.getTool('flake8')).toBeUndefined();
        });
    });

    describe('Tool Execution (Sequential)', () => {
        it('should execute a single tool', async () => {
            const adapter = new Flake8Adapter(projectRoot);
            orchestrator.registerTool(adapter);

            const result = await orchestrator.executeTools(
                ['flake8'],
                projectRoot,
                { parallel: false }
            );

            expect(result).toBeDefined();
            expect(result.tools_executed).toBeGreaterThanOrEqual(0);
            expect(result.results.length).toBeGreaterThanOrEqual(0);
        }, 120000); // Extended timeout for tool execution

        it('should execute multiple tools sequentially', async () => {
            const flake8 = new Flake8Adapter(projectRoot);
            const eslint = new ESLintAdapter(projectRoot);

            orchestrator.registerTools([flake8, eslint]);

            const result = await orchestrator.executeTools(
                ['flake8', 'eslint'],
                projectRoot,
                { parallel: false }
            );

            expect(result).toBeDefined();
            expect(result.tools_executed).toBe(2);
            expect(result.results.length).toBe(2);
            expect(result.results[0].tool.name).toBe('flake8');
            expect(result.results[1].tool.name).toBe('eslint');
        }, 120000);

        it('should handle tool execution errors gracefully', async () => {
            // Create a mock tool that always fails
            class FailingTool implements IQualityTool {
                readonly name = 'failing-tool';
                readonly version?: string;

                async isAvailable(): Promise<boolean> {
                    return true;
                }

                async runCheck(
                    targetPath: string,
                    config?: QualityToolConfig
                ): Promise<QualityToolResult> {
                    throw new Error('Tool execution failed');
                }

                async applyFixes?(
                    targetPath: string,
                    config?: QualityToolConfig
                ): Promise<QualityToolResult> {
                    throw new Error('Not implemented');
                }

                getDefaultConfig(): QualityToolConfig {
                    return { enabled: true, options: {}, timeout_ms: 30000 };
                }

                validateConfig(config: QualityToolConfig): boolean {
                    return true;
                }
            }

            const failingTool = new FailingTool();
            orchestrator.registerTool(failingTool);

            const result = await orchestrator.executeTools(
                ['failing-tool'],
                projectRoot,
                { parallel: false, continue_on_error: true }
            );

            expect(result.tools_executed).toBe(1);
            expect(result.tools_failed).toBe(1);
            expect(result.results[0].result.success).toBe(false);
        }, 120000);
    });

    describe('Result Aggregation', () => {
        it('should aggregate metrics from multiple tools', async () => {
            const flake8 = new Flake8Adapter(projectRoot);
            const eslint = new ESLintAdapter(projectRoot);

            orchestrator.registerTools([flake8, eslint]);

            const result = await orchestrator.executeTools(
                ['flake8', 'eslint'],
                projectRoot,
                { parallel: false }
            );

            expect(result.aggregated_metrics).toBeDefined();
            expect(result.aggregated_metrics.total_issues).toBeGreaterThanOrEqual(0);
            expect(result.aggregated_metrics.total_errors).toBeGreaterThanOrEqual(0);
            expect(result.aggregated_metrics.total_warnings).toBeGreaterThanOrEqual(0);
        }, 120000);
    });

    describe('Error Handling', () => {
        it('should continue on error when configured', async () => {
            class FailingTool implements IQualityTool {
                readonly name = 'failing-tool';
                async isAvailable() {
                    return true;
                }
                async runCheck(
                    targetPath: string,
                    config?: import('../../../src/quality/tools/QualityToolInterface').QualityToolConfig
                ): Promise<QualityToolResult> {
                    throw new Error('Failed');
                }
                async applyFixes?(
                    targetPath: string,
                    config?: import('../../../src/quality/tools/QualityToolInterface').QualityToolConfig
                ): Promise<QualityToolResult> {
                    throw new Error('Not implemented');
                }
                getDefaultConfig(): import('../../../src/quality/tools/QualityToolInterface').QualityToolConfig {
                    return { enabled: true, options: {}, timeout_ms: 30000 };
                }
                validateConfig(config: import('../../../src/quality/tools/QualityToolInterface').QualityToolConfig): boolean {
                    return true;
                }
            }

            const flake8 = new Flake8Adapter(projectRoot);
            const failingTool = new FailingTool();

            orchestrator.registerTools([flake8, failingTool]);

            const result = await orchestrator.executeTools(
                ['flake8', 'failing-tool'],
                projectRoot,
                { parallel: false, continue_on_error: true }
            );

            expect(result.tools_executed).toBe(2);
            expect(result.errors.length).toBeGreaterThan(0);
        }, 120000);

        it('should stop on error when continue_on_error is false', async () => {
            class FailingTool implements IQualityTool {
                readonly name = 'failing-tool';
                async isAvailable() {
                    return true;
                }
                async runCheck(
                    targetPath: string,
                    config?: import('../../../src/quality/tools/QualityToolInterface').QualityToolConfig
                ): Promise<QualityToolResult> {
                    throw new Error('Failed');
                }
                async applyFixes?(
                    targetPath: string,
                    config?: import('../../../src/quality/tools/QualityToolInterface').QualityToolConfig
                ): Promise<QualityToolResult> {
                    throw new Error('Not implemented');
                }
                getDefaultConfig(): import('../../../src/quality/tools/QualityToolInterface').QualityToolConfig {
                    return { enabled: true, options: {}, timeout_ms: 30000 };
                }
                validateConfig(config: import('../../../src/quality/tools/QualityToolInterface').QualityToolConfig): boolean {
                    return true;
                }
            }

            const failingTool = new FailingTool();
            const flake8 = new Flake8Adapter(projectRoot);

            orchestrator.registerTools([failingTool, flake8]);

            const result = await orchestrator.executeTools(
                ['failing-tool', 'flake8'],
                projectRoot,
                { parallel: false, continue_on_error: false }
            );

            // Should stop after first failure
            expect(result.tools_executed).toBe(1);
        }, 120000);
    });
});
