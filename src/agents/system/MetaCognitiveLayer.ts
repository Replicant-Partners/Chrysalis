/**
 * Meta-Cognitive Layer
 *
 * Integrates context condensation, stuck detection, and code execution
 * into the System Agent Middleware pipeline.
 *
 * This layer sits between the raw conversation and the SCM Gate,
 * providing:
 * - Context compression before LLM calls (token budget management)
 * - Loop detection and prevention (stuck detection)
 * - Code execution capabilities for system agents
 *
 * @module agents/system/MetaCognitiveLayer
 * @see https://github.com/OpenHands/software-agent-sdk (condenser, stuck patterns)
 * @see https://github.com/openinterpreter/open-interpreter (code executor)
 */

import { EventEmitter } from 'events';
import {
  Condenser,
  CondenserMessage,
  CondensationResult,
  WindowCondenser,
  PipelineCondenser,
  ImportanceCondenser,
  LLMSummarizer,
  SummarizingCondenser,
} from '../../experience/ContextCondenser';
import {
  StuckDetector,
  StuckAnalysis,
  ActionRecord,
  DEFAULT_STUCK_CONFIG,
  StuckDetectorConfig,
} from '../../experience/StuckDetector';
import {
  CodeExecutor,
  ExecutionRequest,
  ExecutionResult,
  CodeExecutorConfig,
  PermissionHandler,
} from './tools/CodeExecutor';

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for the meta-cognitive layer
 */
export interface MetaCognitiveConfig {
  /** Enable context condensation */
  enableCondensation: boolean;
  /** Enable stuck detection */
  enableStuckDetection: boolean;
  /** Enable code execution */
  enableCodeExecution: boolean;

  /** Max tokens to target after condensation */
  maxContextTokens: number;
  /** Condenser type to use */
  condenserType: 'window' | 'importance' | 'summarizing' | 'pipeline';
  /** Window size for window condenser */
  windowSize: number;

  /** Stuck detector configuration */
  stuckDetectorConfig: Partial<StuckDetectorConfig>;

  /** Code executor configuration */
  codeExecutorConfig: Partial<CodeExecutorConfig>;
}

/**
 * Default meta-cognitive configuration
 */
export const DEFAULT_META_CONFIG: MetaCognitiveConfig = {
  enableCondensation: true,
  enableStuckDetection: true,
  enableCodeExecution: true,

  maxContextTokens: 8000,
  condenserType: 'pipeline',
  windowSize: 50,

  stuckDetectorConfig: DEFAULT_STUCK_CONFIG,
  codeExecutorConfig: {
    autoRun: false,
    defaultTimeout: 30000,
  },
};

/**
 * Result from meta-cognitive processing
 */
export interface MetaCognitiveResult {
  /** Condensed messages (if condensation enabled) */
  condensedMessages?: CondenserMessage[];
  /** Condensation stats */
  condensationResult?: CondensationResult;
  /** Stuck analysis (if detection enabled) */
  stuckAnalysis?: StuckAnalysis;
  /** Whether processing should continue */
  shouldProceed: boolean;
  /** Warning messages */
  warnings: string[];
  /** Suggestions for agent */
  suggestions: string[];
}

/**
 * Code execution request for agents
 */
export interface AgentCodeExecutionRequest extends ExecutionRequest {
  agentId: string;
  reason?: string;
}

// =============================================================================
// Meta-Cognitive Layer
// =============================================================================

/**
 * Provides meta-cognitive capabilities for system agents
 */
export class MetaCognitiveLayer extends EventEmitter {
  private config: MetaCognitiveConfig;
  private condenser: Condenser;
  private stuckDetector: StuckDetector;
  private codeExecutor: CodeExecutor;
  private llmSummarizer?: LLMSummarizer;

  constructor(
    config: Partial<MetaCognitiveConfig> = {},
    llmSummarizer?: LLMSummarizer
  ) {
    super();
    this.config = { ...DEFAULT_META_CONFIG, ...config };
    this.llmSummarizer = llmSummarizer;

    // Initialize condenser based on type
    this.condenser = this.createCondenser();

    // Initialize stuck detector
    this.stuckDetector = new StuckDetector(this.config.stuckDetectorConfig);

    // Initialize code executor
    this.codeExecutor = new CodeExecutor(this.config.codeExecutorConfig);

    // Forward code executor events
    this.codeExecutor.on('permission_request', (req) => {
      this.emit('code:permission_request', req);
    });
    this.codeExecutor.on('stdout', (data) => {
      this.emit('code:stdout', data);
    });
    this.codeExecutor.on('stderr', (data) => {
      this.emit('code:stderr', data);
    });
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Process messages through meta-cognitive layer before SCM
   */
  async process(
    messages: CondenserMessage[],
    agentId: string
  ): Promise<MetaCognitiveResult> {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let shouldProceed = true;

    // Step 1: Stuck Detection
    let stuckAnalysis: StuckAnalysis | undefined;
    if (this.config.enableStuckDetection) {
      // Record last message as action/observation
      const lastMsg = messages[messages.length - 1];
      if (lastMsg) {
        this.stuckDetector.record({
          type: lastMsg.role === 'user' ? 'user_input' : 'action',
          content: lastMsg.content,
          agentId,
        });
      }

      stuckAnalysis = this.stuckDetector.analyze();

      if (stuckAnalysis.isStuck) {
        warnings.push(`Stuck detected: ${stuckAnalysis.patternDescription}`);
        suggestions.push(stuckAnalysis.suggestion);

        // Critical/terminal stuck = halt processing
        if (stuckAnalysis.severity === 'terminal') {
          shouldProceed = false;
        }

        this.emit('stuck:detected', { agentId, analysis: stuckAnalysis });
      }
    }

    // Step 2: Context Condensation
    let condensedMessages = messages;
    let condensationResult: CondensationResult | undefined;

    if (this.config.enableCondensation && shouldProceed) {
      condensationResult = await this.condenser.condense(messages, {
        maxTokens: this.config.maxContextTokens,
        maxMessages: this.config.windowSize,
        preserveSystemMessages: true,
      });
      condensedMessages = condensationResult.messages;

      if (condensationResult.estimatedTokensSaved > 0) {
        this.emit('context:condensed', {
          agentId,
          saved: condensationResult.estimatedTokensSaved,
          strategy: condensationResult.strategy,
        });
      }
    }

    return {
      condensedMessages,
      condensationResult,
      stuckAnalysis,
      shouldProceed,
      warnings,
      suggestions,
    };
  }

  /**
   * Execute code on behalf of an agent
   */
  async executeCode(request: AgentCodeExecutionRequest): Promise<ExecutionResult> {
    if (!this.config.enableCodeExecution) {
      return {
        success: false,
        stdout: '',
        stderr: 'Code execution is disabled',
        exitCode: null,
        duration: 0,
        timedOut: false,
        killed: false,
        error: 'Code execution disabled in meta-cognitive config',
      };
    }

    this.emit('code:execution_start', {
      agentId: request.agentId,
      language: request.language,
      reason: request.reason,
    });

    const result = await this.codeExecutor.execute(request);

    this.emit('code:execution_complete', {
      agentId: request.agentId,
      success: result.success,
      duration: result.duration,
    });

    // Record execution for stuck detection
    if (this.config.enableStuckDetection) {
      if (result.success) {
        this.stuckDetector.record({
          type: 'observation',
          content: `Code executed: ${result.stdout.slice(0, 100)}`,
          agentId: request.agentId,
        });
      } else {
        this.stuckDetector.record({
          type: 'error',
          content: result.stderr || result.error || 'Unknown error',
          agentId: request.agentId,
        });
      }
    }

    return result;
  }

  /**
   * Record an error (for stuck detection)
   */
  recordError(error: string, agentId?: string): void {
    if (this.config.enableStuckDetection) {
      this.stuckDetector.record({
        type: 'error',
        content: error,
        agentId,
      });
    }
  }

  /**
   * Record user input (breaks monologue detection)
   */
  recordUserInput(input: string): void {
    if (this.config.enableStuckDetection) {
      this.stuckDetector.record({
        type: 'user_input',
        content: input,
      });
    }
  }

  /**
   * Check if currently stuck
   */
  isStuck(): boolean {
    if (!this.config.enableStuckDetection) return false;
    return this.stuckDetector.isStuck();
  }

  /**
   * Get current stuck analysis
   */
  getStuckAnalysis(): StuckAnalysis | null {
    if (!this.config.enableStuckDetection) return null;
    return this.stuckDetector.analyze();
  }

  /**
   * Reset meta-cognitive state
   */
  reset(): void {
    this.stuckDetector.reset();
    this.codeExecutor.killAll();
  }

  /**
   * Set permission handler for code execution
   */
  setCodePermissionHandler(handler: PermissionHandler): void {
    this.codeExecutor.configure({ permissionHandler: handler });
  }

  /**
   * Set auto-run mode for code execution
   */
  setCodeAutoRun(enabled: boolean): void {
    this.codeExecutor.setAutoRun(enabled);
  }

  /**
   * Update configuration
   */
  configure(config: Partial<MetaCognitiveConfig>): void {
    this.config = { ...this.config, ...config };

    // Recreate condenser if type changed
    if (config.condenserType) {
      this.condenser = this.createCondenser();
    }

    // Update stuck detector config
    if (config.stuckDetectorConfig) {
      this.stuckDetector = new StuckDetector({
        ...this.config.stuckDetectorConfig,
        ...config.stuckDetectorConfig,
      });
    }

    // Update code executor config
    if (config.codeExecutorConfig) {
      this.codeExecutor.configure(config.codeExecutorConfig);
    }
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Create condenser based on configured type
   */
  private createCondenser(): Condenser {
    switch (this.config.condenserType) {
      case 'window':
        return new WindowCondenser(this.config.windowSize);

      case 'importance':
        return new ImportanceCondenser(0.3);

      case 'summarizing':
        if (!this.llmSummarizer) {
          console.warn('SummarizingCondenser requires LLM, falling back to window');
          return new WindowCondenser(this.config.windowSize);
        }
        return new SummarizingCondenser(this.llmSummarizer, 15, 800);

      case 'pipeline':
      default:
        // Default pipeline: importance → window
        const stages: Condenser[] = [
          new ImportanceCondenser(0.3),
          new WindowCondenser(this.config.windowSize),
        ];

        // Add summarization if LLM available
        if (this.llmSummarizer) {
          stages.push(new SummarizingCondenser(this.llmSummarizer, 15, 800));
        }

        return new PipelineCondenser(stages);
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create meta-cognitive layer with default configuration
 */
export function createMetaCognitiveLayer(
  config?: Partial<MetaCognitiveConfig>,
  llmSummarizer?: LLMSummarizer
): MetaCognitiveLayer {
  return new MetaCognitiveLayer(config, llmSummarizer);
}

/**
 * Create minimal meta-cognitive layer (no summarization)
 */
export function createMinimalMetaCognitiveLayer(): MetaCognitiveLayer {
  return new MetaCognitiveLayer({
    condenserType: 'window',
    windowSize: 30,
    enableCodeExecution: false,
  });
}

// =============================================================================
// (Exports are inline with class definitions above)
// =============================================================================
