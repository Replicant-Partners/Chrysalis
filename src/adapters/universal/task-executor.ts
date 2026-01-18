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
import type { UniversalAdapter, TranslationResult, MorphingResult } from './adapter';
import type { ValidationResult, ProtocolCapabilities } from './types';
import { logger } from '../../observability';
import * as path from 'path';

const log = logger('task-executor');

// ============================================================================
// Task Definition Types
// ============================================================================

export type TaskType = 'translate' | 'morph' | 'validate' | 'discover' | 'batch' | 'evaluate';

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

export interface EvaluateTask extends BaseTask {
  type: 'evaluate';

  /** Evaluation prompt to send to LLM */
  prompt: string;

  /** Model configuration */
  model: {
    /** Model provider (ollama, anthropic, openai, etc.) */
    provider: string;
    
    /** Model name/identifier */
    name: string;
    
    /** API endpoint (optional, defaults based on provider) */
    endpoint?: string;
    
    /** API key if required */
    apiKey?: string;
  };

  /** LLM parameters */
  parameters?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    stopSequences?: string[];
  };

  /** Evaluation options */
  options?: {
    /** Output file path for response (markdown format) */
    outputPath?: string;
    
    /** Include response metadata */
    includeMetadata?: boolean;
    
    /** Timeout in milliseconds */
    timeoutMs?: number;
  };
}

export type Task = TranslateTask | MorphTask | ValidateTask | DiscoverTask | BatchTask | EvaluateTask;

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

export interface EvaluationResult {
  /** LLM response text */
  response: string;

  /** Input tokens */
  tokensIn: number;

  /** Output tokens */
  tokensOut: number;

  /** Latency in milliseconds */
  latencyMs: number;

  /** Finish reason */
  finishReason: string;

  /** Model used */
  model: string;

  /** Provider used */
  provider: string;
}

// ============================================================================
// Task Executor
// ============================================================================

export class UniversalAdapterTaskExecutor {
  private adapter: UniversalAdapter;

  constructor(adapter?: UniversalAdapter) {
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

        case 'evaluate':
          result = await this.executeEvaluateTask(task, telemetry);
          break;

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
  ): Promise<TranslationResult> {
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

    // Convert warnings to strings if they're objects
    if (result.warnings) {
      const warningStrings = result.warnings.map(w =>
        typeof w === 'string' ? w : (w as any).message || String(w)
      );
      telemetry.warnings.push(...warningStrings);
    }

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
   * Execute evaluate task
   */
  private async executeEvaluateTask(
    task: EvaluateTask,
    telemetry: TaskTelemetry
  ): Promise<EvaluationResult> {
    telemetry.llmCalls++;

    const startTime = Date.now();
    let response: string;
    let tokensIn = 0;
    let tokensOut = 0;
    let finishReason = 'stop';

    try {
      switch (task.model.provider.toLowerCase()) {
        case 'ollama':
          ({ response, tokensIn, tokensOut, finishReason } = await this.callOllama(task));
          break;
        
        case 'anthropic':
          ({ response, tokensIn, tokensOut, finishReason } = await this.callAnthropic(task));
          break;
        
        case 'openai':
        case 'openrouter':
          ({ response, tokensIn, tokensOut, finishReason } = await this.callOpenAI(task));
          break;
        
        default:
          throw new Error(`Unsupported provider: ${task.model.provider}`);
      }

      const latencyMs = Date.now() - startTime;
      telemetry.tokensUsed = tokensIn + tokensOut;

      // Save response to file if outputPath specified
      if (task.options?.outputPath) {
        const fs = await import('fs/promises');
        await fs.mkdir(path.dirname(task.options.outputPath), { recursive: true });
        const outputContent = task.options.includeMetadata
          ? this.formatResponseWithMetadata(response, {
              model: task.model.name,
              provider: task.model.provider,
              latencyMs,
              tokensIn,
              tokensOut,
              timestamp: new Date().toISOString()
            })
          : response;
        
        await fs.writeFile(task.options.outputPath, outputContent, 'utf-8');
      }

      return {
        response,
        tokensIn,
        tokensOut,
        latencyMs,
        finishReason,
        model: task.model.name,
        provider: task.model.provider
      };

    } catch (error) {
      telemetry.errors.push({
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
        context: 'evaluate-task'
      });
      throw error;
    }
  }

  /**
   * Call Ollama API
   */
  private async callOllama(task: EvaluateTask): Promise<{
    response: string;
    tokensIn: number;
    tokensOut: number;
    finishReason: string;
  }> {
    const endpoint = task.model.endpoint || 'http://localhost:11434';
    const envTimeout = typeof process !== 'undefined' ? Number(process.env.OLLAMA_TIMEOUT_MS) : NaN;
    const timeout = Number.isFinite(envTimeout)
      ? envTimeout
      : (task.options?.timeoutMs || 30000);

    log.info('Ollama request starting', {
      model: task.model.name,
      endpoint,
      timeout,
      promptLength: task.prompt.length,
      maxTokens: task.parameters?.maxTokens
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      log.warn('Ollama request timeout triggered', {
        model: task.model.name,
        timeout,
        elapsed: timeout
      });
      controller.abort();
    }, timeout);

    const requestStart = Date.now();

    try {
      const envMaxTokens = typeof process !== 'undefined' ? Number(process.env.OLLAMA_MAX_TOKENS) : NaN;
      const maxTokens = Number.isFinite(envMaxTokens)
        ? envMaxTokens
        : (task.parameters?.maxTokens ?? 2048);

      const requestPayload = {
        model: task.model.name,
        prompt: task.prompt,
        stream: false,
        options: {
          temperature: task.parameters?.temperature ?? 0.7,
          top_p: task.parameters?.topP ?? 0.9,
          num_predict: maxTokens,
          stop: task.parameters?.stopSequences
        }
      };

      log.debug('Ollama request payload', requestPayload);

      const fetchStart = Date.now();
      const response = await fetch(`${endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
        signal: controller.signal
      });

      const fetchDuration = Date.now() - fetchStart;
      log.info('Ollama fetch completed', {
        model: task.model.name,
        fetchDuration,
        status: response.status,
        statusText: response.statusText
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        log.error('Ollama API error response', {
          model: task.model.name,
          status: response.status,
          statusText: response.statusText,
          errorText
        });
        throw new Error(`Ollama API error: ${response.statusText} - ${errorText}`);
      }

      const parseStart = Date.now();
      const data = await response.json();
      const parseDuration = Date.now() - parseStart;

      const totalDuration = Date.now() - requestStart;

      log.info('Ollama request completed', {
        model: task.model.name,
        totalDuration,
        fetchDuration,
        parseDuration,
        tokensIn: data.prompt_eval_count ?? 0,
        tokensOut: data.eval_count ?? 0,
        responseLength: data.response?.length ?? 0,
        done: data.done
      });

      return {
        response: data.response,
        tokensIn: data.prompt_eval_count ?? 0,
        tokensOut: data.eval_count ?? 0,
        finishReason: data.done ? 'stop' : 'error'
      };
    } catch (error) {
      clearTimeout(timeoutId);
      const totalDuration = Date.now() - requestStart;

      if ((error as Error).name === 'AbortError') {
        log.error('Ollama request aborted (timeout)', {
          model: task.model.name,
          timeout,
          elapsed: totalDuration
        });
        throw new Error(`Ollama request timeout after ${timeout}ms`);
      }

      log.error('Ollama request failed', {
        model: task.model.name,
        elapsed: totalDuration,
        error: (error as Error).message,
        errorType: (error as Error).name
      });
      throw error;
    }
  }

  /**
   * Call Anthropic API
   */
  private async callAnthropic(task: EvaluateTask): Promise<{
    response: string;
    tokensIn: number;
    tokensOut: number;
    finishReason: string;
  }> {
    if (!task.model.apiKey) {
      throw new Error('Anthropic API key required');
    }

    const endpoint = task.model.endpoint || 'https://api.anthropic.com/v1';
    const timeout = task.options?.timeoutMs || 60000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${endpoint}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': task.model.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: task.model.name,
          messages: [{ role: 'user', content: task.prompt }],
          max_tokens: task.parameters?.maxTokens ?? 4096,
          temperature: task.parameters?.temperature ?? 1.0,
          top_p: task.parameters?.topP,
          stop_sequences: task.parameters?.stopSequences
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Anthropic API error: ${errorData.error?.message ?? response.statusText}`);
      }

      const data = await response.json();

      return {
        response: data.content[0].text,
        tokensIn: data.usage.input_tokens,
        tokensOut: data.usage.output_tokens,
        finishReason: data.stop_reason === 'end_turn' ? 'stop' : data.stop_reason
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as Error).name === 'AbortError') {
        throw new Error(`Anthropic request timeout after ${timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(task: EvaluateTask): Promise<{
    response: string;
    tokensIn: number;
    tokensOut: number;
    finishReason: string;
  }> {
    if (!task.model.apiKey) {
      throw new Error('OpenAI API key required');
    }

    const provider = task.model.provider.toLowerCase();
    const endpoint = task.model.endpoint || (
      provider === 'openrouter'
        ? 'https://openrouter.ai/api/v1'
        : 'https://api.openai.com/v1'
    );
    const isOpenRouter = endpoint.includes('openrouter.ai');
    const timeout = task.options?.timeoutMs || 60000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const useMaxCompletionTokens = task.model.name.startsWith('gpt-5') && !isOpenRouter;
      const maxTokens = task.parameters?.maxTokens;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${task.model.apiKey}`
      };
      if (isOpenRouter) {
        const referer = typeof process !== 'undefined'
          ? (process.env.OPENROUTER_HTTP_REFERER || process.env.OPENROUTER_REFERER)
          : undefined;
        const title = typeof process !== 'undefined'
          ? (process.env.OPENROUTER_X_TITLE || process.env.OPENROUTER_APP_NAME || process.env.OPENROUTER_TITLE)
          : undefined;
        if (referer) {
          headers['HTTP-Referer'] = referer;
        }
        if (title) {
          headers['X-Title'] = title;
        }
      }

      const response = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: task.model.name,
          messages: [{ role: 'user', content: task.prompt }],
          temperature: task.parameters?.temperature ?? 0.7,
          top_p: task.parameters?.topP,
          max_tokens: useMaxCompletionTokens ? undefined : maxTokens,
          max_completion_tokens: useMaxCompletionTokens ? maxTokens : undefined,
          stop: task.parameters?.stopSequences
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API error: ${errorData.error?.message ?? response.statusText}`);
      }

      const data = await response.json();

      return {
        response: data.choices[0].message.content,
        tokensIn: data.usage.prompt_tokens,
        tokensOut: data.usage.completion_tokens,
        finishReason: data.choices[0].finish_reason
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as Error).name === 'AbortError') {
        throw new Error(`OpenAI request timeout after ${timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Format response with metadata for markdown output
   */
  private formatResponseWithMetadata(
    response: string,
    metadata: {
      model: string;
      provider: string;
      latencyMs: number;
      tokensIn: number;
      tokensOut: number;
      timestamp: string;
    }
  ): string {
    return `# LLM Evaluation Response

## Metadata

- **Model**: ${metadata.model}
- **Provider**: ${metadata.provider}
- **Timestamp**: ${metadata.timestamp}
- **Latency**: ${metadata.latencyMs}ms
- **Tokens In**: ${metadata.tokensIn}
- **Tokens Out**: ${metadata.tokensOut}
- **Tokens/Second**: ${(metadata.tokensOut / (metadata.latencyMs / 1000)).toFixed(2)}

---

## Response

${response}
`;
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
export function createTaskExecutor(adapter?: UniversalAdapter): UniversalAdapterTaskExecutor {
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
