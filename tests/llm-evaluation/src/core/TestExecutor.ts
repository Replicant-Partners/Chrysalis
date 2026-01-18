/**
 * Test Execution Engine
 * 
 * Orchestrates test case execution, manages state, and coordinates
 * validation and scoring workflows.
 */

import {
  TestCase,
  TestResult,
  ExecutionConfig,
  ModeNumber,
  TelemetryEvent,
  ExecutionSummary
} from '../types/schemas';
import { ModelAdapter } from './ModelAdapter';
import { ScoringEngine } from './ScoringEngine';
import { ValidationFramework } from './ValidationFramework';
import { StateManager } from './StateManager';
import { TelemetryCollector } from './TelemetryCollector';

export interface ExecutorOptions {
  modelAdapter: ModelAdapter;
  scoringEngine: ScoringEngine;
  validationFramework: ValidationFramework;
  stateManager: StateManager;
  telemetryCollector: TelemetryCollector;
}

export class TestExecutor {
  private modelAdapter: ModelAdapter;
  private scoringEngine: ScoringEngine;
  private validationFramework: ValidationFramework;
  private stateManager: StateManager;
  private telemetryCollector: TelemetryCollector;
  
  constructor(options: ExecutorOptions) {
    this.modelAdapter = options.modelAdapter;
    this.scoringEngine = options.scoringEngine;
    this.validationFramework = options.validationFramework;
    this.stateManager = options.stateManager;
    this.telemetryCollector = options.telemetryCollector;
  }

  /**
   * Execute a single test case
   */
  async executeTest(
    testCase: TestCase,
    config: ExecutionConfig
  ): Promise<TestResult> {
    const executionId = config.execution_id;
    const startTime = Date.now();
    
    // Emit test started event
    this.telemetryCollector.emit({
      event_id: `${executionId}_${testCase.test_id}_start`,
      event_type: 'test_started',
      timestamp: new Date().toISOString(),
      execution_id: executionId,
      test_id: testCase.test_id,
      model_id: config.model_id,
      data: {
        mode: testCase.mode,
        category: testCase.category,
        complexity: testCase.complexity
      },
      performance: {}
    });

    try {
      // Check if test has dependencies
      const priorOutputs = await this.resolveDependencies(
        testCase,
        executionId
      );

      // Prepare input with prior outputs if needed
      const enrichedInput = {
        ...testCase.input,
        prior_outputs: priorOutputs
      };

      // Detect context switch
      const previousMode = this.stateManager.getCurrentMode(executionId);
      const contextSwitch = previousMode !== null && previousMode !== testCase.mode;
      
      if (contextSwitch) {
        this.telemetryCollector.emit({
          event_id: `${executionId}_mode_switch`,
          event_type: 'mode_switched',
          timestamp: new Date().toISOString(),
          execution_id: executionId,
          test_id: testCase.test_id,
          model_id: config.model_id,
          data: {
            from_mode: previousMode,
            to_mode: testCase.mode
          },
          performance: {}
        });
      }

      // Update current mode
      this.stateManager.setCurrentMode(executionId, testCase.mode);

      // Execute LLM inference
      const inferenceStart = Date.now();
      const response = await this.modelAdapter.infer({
        prompt: enrichedInput.prompt,
        context: enrichedInput.context,
        config: config.model_config,
        timeout: config.settings.timeout_ms
      });
      const inferenceLatency = Date.now() - inferenceStart;

      // Validate response
      const validationResult = await this.validationFramework.validate({
        testCase,
        response: response.text,
        structuredData: response.structured_data
      });

      // Score the result
      const scoringResult = await this.scoringEngine.score({
        testCase,
        response: response.text,
        structuredData: response.structured_data,
        validationResult,
        performance: {
          latency_ms: inferenceLatency,
          cold_start: response.cold_start,
          context_switch_from: contextSwitch ? previousMode ?? undefined : undefined,
          tokens_per_second: response.tokens_out / (inferenceLatency / 1000)
        }
      });

      // Create test result
      const testResult: TestResult = {
        test_id: testCase.test_id,
        execution_id: executionId,
        model_id: config.model_id,
        timestamp: new Date().toISOString(),
        
        input_captured: {
          prompt: enrichedInput.prompt,
          context: enrichedInput.context,
          tokens_in: response.tokens_in
        },
        
        output_captured: {
          response: response.text,
          structured_data: response.structured_data,
          tokens_out: response.tokens_out
        },
        
        performance: {
          latency_ms: inferenceLatency,
          cold_start: response.cold_start,
          context_switch_from: contextSwitch ? previousMode ?? undefined : undefined,
          memory_used_mb: response.memory_used_mb,
          tokens_per_second: response.tokens_out / (inferenceLatency / 1000)
        },
        
        scoring: {
          automated_scores: scoringResult.metrics,
          final_score: scoringResult.final_score,
          passed: scoringResult.passed
        },
        
        validation_details: {
          schema_valid: validationResult.schema_valid,
          ground_truth_match: validationResult.ground_truth_match,
          rule_violations: validationResult.rule_violations
        }
      };

      // Store result
      await this.stateManager.storeResult(testResult);

      // Emit completion event
      this.telemetryCollector.emit({
        event_id: `${executionId}_${testCase.test_id}_complete`,
        event_type: 'test_completed',
        timestamp: new Date().toISOString(),
        execution_id: executionId,
        test_id: testCase.test_id,
        model_id: config.model_id,
        data: {
          passed: testResult.scoring.passed,
          score: testResult.scoring.final_score
        },
        performance: {
          latency_ms: inferenceLatency,
          memory_mb: response.memory_used_mb
        }
      });

      return testResult;

    } catch (error) {
      // Handle test execution error
      const errorResult = this.createErrorResult(
        testCase,
        config,
        error as Error,
        startTime
      );

      await this.stateManager.storeResult(errorResult);

      this.telemetryCollector.emit({
        event_id: `${executionId}_${testCase.test_id}_failed`,
        event_type: 'test_failed',
        timestamp: new Date().toISOString(),
        execution_id: executionId,
        test_id: testCase.test_id,
        model_id: config.model_id,
        data: {
          error: (error as Error).message,
          stack: (error as Error).stack
        },
        performance: {
          latency_ms: Date.now() - startTime
        }
      });

      return errorResult;
    }
  }

  /**
   * Execute multiple test cases in sequence or parallel
   */
  async executeTests(
    testCases: TestCase[],
    config: ExecutionConfig
  ): Promise<TestResult[]> {
    if (config.settings.parallel_execution) {
      return this.executeParallel(testCases, config);
    } else {
      return this.executeSequential(testCases, config);
    }
  }

  /**
   * Execute tests sequentially
   */
  private async executeSequential(
    testCases: TestCase[],
    config: ExecutionConfig
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];
    
    for (const testCase of testCases) {
      const result = await this.executeTest(testCase, config);
      results.push(result);
      
      // Check if should continue after failure
      if (!result.scoring.passed && !config.settings.max_retries) {
        break;
      }
    }
    
    return results;
  }

  /**
   * Execute tests in parallel with concurrency limit
   */
  private async executeParallel(
    testCases: TestCase[],
    config: ExecutionConfig
  ): Promise<TestResult[]> {
    const maxParallel = config.settings.max_parallel_tests;
    const results: TestResult[] = [];
    
    // Group tests that can run in parallel (no dependencies)
    const independentTests = testCases.filter(tc => !tc.depends_on || tc.depends_on.length === 0);
    const dependentTests = testCases.filter(tc => tc.depends_on && tc.depends_on.length > 0);
    
    // Execute independent tests in batches
    for (let i = 0; i < independentTests.length; i += maxParallel) {
      const batch = independentTests.slice(i, i + maxParallel);
      const batchResults = await Promise.all(
        batch.map(tc => this.executeTest(tc, config))
      );
      results.push(...batchResults);
    }
    
    // Execute dependent tests sequentially
    for (const testCase of dependentTests) {
      const result = await this.executeTest(testCase, config);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Resolve test dependencies by fetching prior outputs
   */
  private async resolveDependencies(
    testCase: TestCase,
    executionId: string
  ): Promise<Record<string, any> | undefined> {
    if (!testCase.depends_on || testCase.depends_on.length === 0) {
      return undefined;
    }

    const priorOutputs: Record<string, any> = {};
    
    for (const dependencyTestId of testCase.depends_on) {
      const dependencyResult = await this.stateManager.getResult(
        executionId,
        dependencyTestId
      );
      
      if (!dependencyResult) {
        throw new Error(
          `Dependency test ${dependencyTestId} has not been executed yet`
        );
      }
      
      priorOutputs[dependencyTestId] = {
        response: dependencyResult.output_captured.response,
        structured_data: dependencyResult.output_captured.structured_data,
        score: dependencyResult.scoring.final_score
      };
    }
    
    return priorOutputs;
  }

  /**
   * Create error result for failed test execution
   */
  private createErrorResult(
    testCase: TestCase,
    config: ExecutionConfig,
    error: Error,
    startTime: number
  ): TestResult {
    return {
      test_id: testCase.test_id,
      execution_id: config.execution_id,
      model_id: config.model_id,
      timestamp: new Date().toISOString(),
      
      input_captured: {
        prompt: testCase.input.prompt,
        context: testCase.input.context,
        tokens_in: 0
      },
      
      output_captured: {
        response: '',
        tokens_out: 0
      },
      
      performance: {
        latency_ms: Date.now() - startTime,
        cold_start: false
      },
      
      scoring: {
        automated_scores: {},
        final_score: 0,
        passed: false
      },
      
      validation_details: {},
      
      errors: [{
        type: error.name,
        message: error.message,
        stack: error.stack
      }]
    };
  }

  /**
   * Generate execution summary
   */
  async generateSummary(
    executionId: string,
    config: ExecutionConfig
  ): Promise<ExecutionSummary> {
    const results = await this.stateManager.getAllResults(executionId);
    
    const summary: ExecutionSummary = {
      execution_id: executionId,
      suite_id: config.suite_id,
      model_id: config.model_id,
      
      summary: {
        total_tests: results.length,
        tests_passed: results.filter(r => r.scoring.passed).length,
        tests_failed: results.filter(r => !r.scoring.passed && !r.errors).length,
        tests_skipped: 0,
        
        avg_score: this.calculateAverage(results.map(r => r.scoring.final_score)),
        mode_scores: this.calculateModeScores(results),
        
        total_duration_ms: results.reduce((sum, r) => sum + r.performance.latency_ms, 0),
        avg_test_duration_ms: this.calculateAverage(results.map(r => r.performance.latency_ms))
      },
      
      performance: {
        total_tokens_in: results.reduce((sum, r) => sum + r.input_captured.tokens_in, 0),
        total_tokens_out: results.reduce((sum, r) => sum + r.output_captured.tokens_out, 0),
        avg_latency_ms: this.calculateAverage(results.map(r => r.performance.latency_ms)),
        max_latency_ms: Math.max(...results.map(r => r.performance.latency_ms)),
        min_latency_ms: Math.min(...results.map(r => r.performance.latency_ms))
      },
      
      issues: this.identifyIssues(results),
      
      completed_at: new Date().toISOString()
    };
    
    return summary;
  }

  /**
   * Calculate average of numeric array
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculate mode-specific average scores
   */
  private calculateModeScores(results: TestResult[]): Record<ModeNumber, number> {
    const modeScores: Record<ModeNumber, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0
    };
    
    const modeCounts: Record<ModeNumber, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0
    };
    
    // This would require accessing test case mode info
    // For now, return placeholder
    return modeScores;
  }

  /**
   * Identify issues from test results
   */
  private identifyIssues(results: TestResult[]): Array<{
    test_id: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
  }> {
    const issues: Array<{
      test_id: string;
      severity: 'critical' | 'high' | 'medium' | 'low';
      description: string;
    }> = [];
    
    for (const result of results) {
      // Test failures
      if (!result.scoring.passed) {
        issues.push({
          test_id: result.test_id,
          severity: 'high',
          description: `Test failed with score ${result.scoring.final_score.toFixed(2)}`
        });
      }
      
      // Errors
      if (result.errors && result.errors.length > 0) {
        issues.push({
          test_id: result.test_id,
          severity: 'critical',
          description: `Execution error: ${result.errors[0].message}`
        });
      }
      
      // Validation violations
      if (result.validation_details.rule_violations && result.validation_details.rule_violations.length > 0) {
        const criticalViolations = result.validation_details.rule_violations.filter(
          v => v.severity === 'critical'
        );
        if (criticalViolations.length > 0) {
          issues.push({
            test_id: result.test_id,
            severity: 'critical',
            description: `Critical validation violations: ${criticalViolations.length}`
          });
        }
      }
      
      // Performance issues
      if (result.performance.latency_ms > 5000) {
        issues.push({
          test_id: result.test_id,
          severity: 'medium',
          description: `High latency: ${result.performance.latency_ms}ms`
        });
      }
    }
    
    return issues;
  }
}
