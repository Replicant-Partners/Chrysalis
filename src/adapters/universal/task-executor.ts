/**
 * Universal Adapter Task Executor
 * 
 * Executes well-formed task definitions using the Universal Adapter.
 * Supports translation, morphing, validation, and capability discovery tasks.
 * Returns results with comprehensive telemetry and metadata.
 * 
 * @module adapters/universal/task-executor
 */

import { getSharedAdapter } from './gateway-bridge';
import type { UniversalAdapterV2, TranslationResultV2, MorphingResult } from './adapter-v2';
import type { ValidationResult, ProtocolCapabilities } from './types';
import { createLogger } from '../../shared/logger';

const log = createLogger('task-executor');

// ============================================================================
// Task Definition Types
// ============================================================================

export type TaskType = 'translate' | 'morph' | 'validate' | 'discover' | 'batch';

export interface BaseTask {
  /** Task type */
  type: TaskType;
  
  /** Task ID (auto-generated if not provided) */
  id?: string;
  
  /** Task name/description */
  name?: string;
  
  /** Task metadata */
  metadata?: Record<string, unknown>;
}

export interface TranslateTask extends BaseTask {
  type: 'translate';
  
  /** Source protocol */
  sourceProtocol: string;
  
  /** Target protocol */
  targetProtocol: string;
  
  /** Agent to translate */
  agent: Record<string, unknown>;
  
  /** Translation options */
  options?: {
    includeConfidence?: boolean;
    timeoutMs?: number;
  };
}

export interface MorphTask extends BaseTask {
  type: 'morph';
  
  /** Source protocol */
  sourceProtocol: string;
  
  /** Target protocol */
  targetProtocol: string;
  
  /** Agent to morph */
  agent: Record<string, unknown>;
  
  /** Morphing options */
  options?: {
    preserveExtensions?: boolean;
    targetCapabilities?: string[];
    customMappings?: Record<string, string>;
  };
}

export interface ValidateTask extends BaseTask {
  type: 'validate';
  
  /** Protocol to validate against */
  protocol: string;
  
  /** Agent to validate */
  agent: Record<string, unknown>;
}

export interface DiscoverTask extends BaseTask {
  type: 'discover';
  
  /** Protocol to discover capabilities for */
  protocol: string;
}

export interface BatchTask extends BaseTask {
  type: 'batch';
  
  /** Subtasks to execute */
  tasks: Task[];
  
  /** Whether to stop on first error */
  stopOnError?: boolean;
}

export type Task = TranslateTask | MorphTask | ValidateTask | DiscoverTask | BatchTask;

// ============================================================================
// Task Result Types
// ============================================================================

export interface TaskTelemetry {
  /** Task execution start time */
  startTime: string;
  
  /** Task execution end time */
  endTime: string;
  
  /** Total duration in milliseconds */
  durationMs: number;
  
  /** LLM calls made */
  llmCalls: number;
  
  /** Total tokens used (if available) */
  tokensUsed?: number;
  
  /** Cache hits */
  cacheHits: {
    spec: number;
    mapping: number;
  };
  
  /** Errors encountered */
  errors: Array<{
    message: string;
    timestamp: string;
    context?: string;
  }>;
  
  /** Warnings generated */
  warnings: string[];
}

export interface TaskResult<T = unknown> {
  /** Task ID */
  taskId: string;
  
  /** Task type */
  taskType: TaskType;
  
  /** Task name */
  taskName?: string;
  
  /** Success status */
  success: boolean;
  
  /** Result data */
  result?: T;
  
  /** Error if failed */
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
  
  /** Task telemetry */
  telemetry: TaskTelemetry;
  
  /** Result metadata */
  metadata: Record<string, unknown>;
}

export interface BatchTaskResult extends TaskResult<TaskResult[]> {
  /** Summary of batch execution */
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

// ============================================================================
// Task Executor
// ============================================================================

export class UniversalAdapterTaskExecutor {
  private adapter: UniversalAdapterV2;
  
  constructor(adapter?: UniversalAdapterV2) {
    this.adapter = adapter || getSharedAdapter();
  }
  
  /**
   * Execute a single task
   */
  async executeTask(task: Task): Promise<TaskResult> {
    const taskId = task.id || this.generateTaskId();
    const startTime = new Date();
    const telemetry: TaskTelemetry = {
      startTime: startTime.toISOString(),
      endTime: '',
      durationMs: 0,
      llmCalls: 0,
      cacheHits: { spec: 0, mapping: 0 },
      errors: [],
      warnings: []
    };
    
    try {
      log.info('Executing task', { taskId, type: task.type, name: task.name });
      
      let result: unknown;
      
      switch (task.type) {
        case 'translate':
          result = await this.executeTranslateTask(task, telemetry);
          break;
        
        case 'morph':
          result = await this.executeMorphTask(task, telemetry);
          break;
        
        case 'validate':
          result = await this.executeValidateTask(task, telemetry);
          break;
        
        case 'discover':
          result = await this.executeDiscoverTask(task, telemetry);
          break;
        
        case 'batch':
          return await this.executeBatchTask(task);
        
        default:
          throw new Error(`Unknown task type: ${(task as Task).type}`);
      }
      
      const endTime = new Date();
      telemetry.endTime = endTime.toISOString();
      telemetry.durationMs = endTime.getTime() - startTime.getTime();
      
      return {
        taskId,
        taskType: task.type,
        taskName: task.name,
        success: true,
        result,
        telemetry,
        metadata: {
          ...task.metadata,
          executedAt: startTime.toISOString(),
          version: '1.0.0'
        }
      };
      
    } catch (error) {
      const endTime = new Date();
      telemetry.endTime = endTime.toISOString();
      telemetry.durationMs = endTime.getTime() - startTime.getTime();
      telemetry.errors.push({
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
        context: 'task-execution'
      });
      
      log.error('Task execution failed', { taskId, error });
      
      return {
        taskId,
        taskType: task.type,
        taskName: task.name,
        success: false,
        error: {
          message: (error as Error).message,
          code: 'TASK_EXECUTION_ERROR',
          details: error
        },
        telemetry,
        metadata: {
          ...task.metadata,
          executedAt: startTime.toISOString(),
          version: '1.0.0'
        }
      };
    }
  }
  
  /**
   * Execute translate task
   */
  private async executeTranslateTask(
    task: TranslateTask,
    telemetry: TaskTelemetry
  ): Promise<TranslationResultV2> {
    telemetry.llmCalls++;
    
    const result = await this.adapter.translate(
      task.agent,
      task.sourceProtocol,
      task.targetProtocol,
      task.options
    );
    
    // Update telemetry from result
    if (result.cacheHits.specCache) telemetry.cacheHits.spec++;
    if (result.cacheHits.mappingCache) telemetry.cacheHits.mapping++;
    telemetry.warnings.push(...result.warnings);
    
    return result;
  }
  
  /**
   * Execute morph task
   */
  private async executeMorphTask(
    task: MorphTask,
    telemetry: TaskTelemetry
  ): Promise<MorphingResult> {
    telemetry.llmCalls++;
    
    const result = await this.adapter.morph(
      task.agent,
      task.sourceProtocol,
      task.targetProtocol,
      task.options
    );
    
    // Update telemetry
    if (result.cacheHits.specCache) telemetry.cacheHits.spec++;
    if (result.cacheHits.mappingCache) telemetry.cacheHits.mapping++;
    telemetry.warnings.push(...result.warnings);
    
    return result;
  }
  
  /**
   * Execute validate task
   */
  private async executeValidateTask(
    task: ValidateTask,
    telemetry: TaskTelemetry
  ): Promise<ValidationResult> {
    telemetry.llmCalls++;
    
    const result = await this.adapter.validate(
      task.agent,
      task.protocol
    );
    
    telemetry.warnings.push(
      ...(result.warnings || []).map((w) => {
        if (typeof w === 'string') return w;
        if (w && typeof w === 'object' && 'message' in w && typeof (w as any).message === 'string') {
          return (w as any).message;
        }
        return JSON.stringify(w);
      })
    );
    
    return result;
  }
  
  /**
   * Execute discover task
   */
  private async executeDiscoverTask(
    task: DiscoverTask,
    telemetry: TaskTelemetry
  ): Promise<ProtocolCapabilities> {
    telemetry.llmCalls++;
    
    const result = await this.adapter.discoverCapabilities(task.protocol);
    
    return result;
  }
  
  /**
   * Execute batch task
   */
  private async executeBatchTask(task: BatchTask): Promise<BatchTaskResult> {
    const taskId = task.id || this.generateTaskId();
    const startTime = new Date();
    const results: TaskResult[] = [];
    
    let successful = 0;
    let failed = 0;
    
    for (const subtask of task.tasks) {
      const result = await this.executeTask(subtask);
      results.push(result);
      
      if (result.success) {
        successful++;
      } else {
        failed++;
        if (task.stopOnError) {
          break;
        }
      }
    }
    
    const endTime = new Date();
    
    return {
      taskId,
      taskType: 'batch',
      taskName: task.name,
      success: failed === 0,
      result: results,
      summary: {
        total: task.tasks.length,
        successful,
        failed
      },
      telemetry: {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationMs: endTime.getTime() - startTime.getTime(),
        llmCalls: results.reduce((sum, r) => sum + r.telemetry.llmCalls, 0),
        cacheHits: {
          spec: results.reduce((sum, r) => sum + r.telemetry.cacheHits.spec, 0),
          mapping: results.reduce((sum, r) => sum + r.telemetry.cacheHits.mapping, 0)
        },
        errors: results.flatMap(r => r.telemetry.errors),
        warnings: results.flatMap(r => r.telemetry.warnings)
      },
      metadata: {
        ...task.metadata,
        executedAt: startTime.toISOString(),
        version: '1.0.0'
      }
    };
  }
  
  /**
   * Execute task from JSON string
   */
  async executeTaskFromJson(json: string): Promise<TaskResult> {
    const task = JSON.parse(json) as Task;
    return this.executeTask(task);
  }
  
  /**
   * Execute task and save result to file
   */
  async executeAndSave(task: Task, outputPath: string): Promise<TaskResult> {
    const result = await this.executeTask(task);
    
    // Save to file
    const fs = await import('fs/promises');
    await fs.writeFile(outputPath, JSON.stringify(result, null, 2), 'utf-8');
    
    log.info('Task result saved', { outputPath, success: result.success });
    
    return result;
  }
  
  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// Factory & Helpers
// ============================================================================

/**
 * Create task executor instance
 */
export function createTaskExecutor(adapter?: UniversalAdapterV2): UniversalAdapterTaskExecutor {
  return new UniversalAdapterTaskExecutor(adapter);
}

/**
 * Execute a task with default executor
 */
export async function executeTask(task: Task): Promise<TaskResult> {
  const executor = createTaskExecutor();
  return executor.executeTask(task);
}

/**
 * Execute task from JSON file
 */
export async function executeTaskFromFile(filePath: string, outputPath?: string): Promise<TaskResult> {
  const fs = await import('fs/promises');
  const json = await fs.readFile(filePath, 'utf-8');
  
  const executor = createTaskExecutor();
  const task = JSON.parse(json) as Task;
  
  const result = await executor.executeTask(task);
  
  if (outputPath) {
    await fs.writeFile(outputPath, JSON.stringify(result, null, 2), 'utf-8');
  }
  
  return result;
}

export default UniversalAdapterTaskExecutor;