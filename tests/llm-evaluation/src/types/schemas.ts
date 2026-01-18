/**
 * LLM Evaluation Framework - Core Type Definitions
 * 
 * Comprehensive type system for the neurosymbolic continuous improvement
 * evaluation framework.
 */

// ============================================================================
// Test Case Definitions
// ============================================================================

export type ModeNumber = 1 | 2 | 3 | 4;

export type TestCategory = 'atomic' | 'compound' | 'integration' | 'adversarial';

export type TestComplexity = 'low' | 'medium' | 'high';

export type OutputType = 'structured' | 'free_form' | 'mixed';

export type ScoringMethod = 
  | 'exact_match' 
  | 'fuzzy_match' 
  | 'expert_review' 
  | 'automated_metrics';

export interface ValidationRule {
  rule_id: string;
  type: 'regex' | 'schema' | 'custom' | 'semantic';
  description: string;
  validator: string; // Reference to validator function or regex pattern
  severity: 'critical' | 'high' | 'medium' | 'low';
  weight: number; // 0-1, contribution to final score
}

export interface TestCase {
  test_id: string;
  mode: ModeNumber;
  category: TestCategory;
  complexity: TestComplexity;
  depends_on?: string[]; // Test IDs this depends on
  
  input: {
    prompt: string;
    context: Record<string, any>;
    prior_outputs?: Record<string, any>; // From dependent tests
  };
  
  expected_output: {
    type: OutputType;
    schema?: object; // JSON Schema for structured outputs
    ground_truth?: any; // For exact/fuzzy matching
    validation_rules?: ValidationRule[];
  };
  
  scoring: {
    method: ScoringMethod;
    threshold?: number; // Minimum score to pass (0-1)
    weights?: Record<string, number>; // Metric weights
    metrics?: string[]; // Which metrics to apply
  };
  
  constraints: {
    max_latency_ms?: number;
    max_tokens?: number;
    requires_external_data?: boolean;
  };
  
  metadata: {
    created: string; // ISO timestamp
    author: string;
    tags: string[];
    difficulty: number; // 1-10 scale
    description?: string;
  };
}

// ============================================================================
// Test Result Definitions
// ============================================================================

export interface TestResult {
  test_id: string;
  execution_id: string;
  model_id: string;
  timestamp: string; // ISO format
  
  input_captured: {
    prompt: string;
    context: Record<string, any>;
    tokens_in: number;
  };
  
  output_captured: {
    response: string;
    structured_data?: any;
    tokens_out: number;
  };
  
  performance: {
    latency_ms: number;
    cold_start: boolean;
    context_switch_from?: ModeNumber; // Previous mode
    memory_used_mb?: number;
    tokens_per_second?: number;
  };
  
  scoring: {
    automated_scores: Record<string, number>;
    expert_scores?: Record<string, number>;
    final_score: number; // 0-10 scale
    passed: boolean;
  };
  
  validation_details: {
    schema_valid?: boolean;
    ground_truth_match?: number; // 0-1 similarity
    rule_violations?: Array<{
      rule_id: string;
      description: string;
      severity: string;
    }>;
    expert_feedback?: string;
  };
  
  errors?: Array<{
    type: string;
    message: string;
    stack?: string;
  }>;
}

// ============================================================================
// Model Profile Definitions
// ============================================================================

export type ModelType = 'local_slm' | 'cloud_llm' | 'hybrid';

export interface ModelProfile {
  model_id: string;
  name: string;
  version: string;
  
  characteristics: {
    type: ModelType;
    parameters: string; // e.g., "7B", "13B"
    quantization?: string; // e.g., "Q4_K_M"
    context_window: number;
    family?: string; // e.g., "llama", "mistral", "gemma"
  };
  
  deployment: {
    provider: string; // "ollama", "anthropic", "openai", etc.
    endpoint?: string;
    api_key_required: boolean;
    model_name: string; // Provider-specific model identifier
  };
  
  test_results?: {
    mode1_avg_score: number;
    mode2_avg_score: number;
    mode3_avg_score: number;
    mode4_avg_score: number;
    overall_avg_score: number;
    
    avg_latency_ms: number;
    avg_tokens_out: number;
    
    pass_rate: number; // 0-1
    tests_completed: number;
    last_updated: string; // ISO timestamp
  };
}

// ============================================================================
// Test Suite Definitions
// ============================================================================

export interface TestSuite {
  suite_id: string;
  name: string;
  description: string;
  version: string;
  
  test_cases: string[]; // Array of test_ids
  execution_order: 'sequential' | 'parallel' | 'dependency_graph';
  
  filters?: {
    modes?: ModeNumber[];
    categories?: TestCategory[];
    complexity?: TestComplexity[];
    tags?: string[];
  };
  
  metadata: {
    created: string;
    author: string;
    last_modified: string;
  };
}

// ============================================================================
// Execution Configuration
// ============================================================================

export interface ExecutionConfig {
  execution_id: string;
  suite_id: string;
  model_id: string;
  
  settings: {
    max_retries: number;
    retry_delay_ms: number;
    timeout_ms: number;
    parallel_execution: boolean;
    max_parallel_tests: number;
    capture_intermediate_steps: boolean;
    enable_telemetry: boolean;
  };
  
  model_config: {
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    stop_sequences?: string[];
    system_prompt?: string;
  };
  
  started_at?: string;
  completed_at?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
}

// ============================================================================
// Scoring and Metrics
// ============================================================================

export interface ModeMetrics {
  mode: ModeNumber;
  metrics: {
    // Mode 1: Process Manager
    decision_correctness?: number; // 0-1
    false_positive_rate?: number; // 0-1
    false_negative_rate?: number; // 0-1
    calibration_accuracy?: number; // 0-1
    
    // Mode 2: Compliance Evaluator
    retrieval_completeness?: number; // 0-1
    precision?: number; // 0-1
    recall?: number; // 0-1
    actionability?: number; // 0-1
    
    // Mode 3: Root Cause Analyst
    causal_chain_validity?: number; // 0-10
    discovery_rate?: number; // 0-1
    reasoning_depth?: number; // count
    source_quality_improvement?: number; // 0-10
    
    // Mode 4: Meta-Process Designer
    synthesis_coherence?: number; // 0-10
    design_creativity?: number; // 0-10
    practical_feasibility?: number; // 0-10
    meta_cognitive_quality?: number; // 0-10
    root_cause_alignment?: number; // 0-10
  };
}

export interface ScoringResult {
  test_id: string;
  mode: ModeNumber;
  metrics: ModeMetrics['metrics'];
  mode_score: number; // 0-10
  overall_score: number; // 0-10
  
  adjustments: {
    integration_bonus?: number;
    context_switch_penalty?: number;
    calibration_bonus?: number;
    total_adjustment: number;
  };
  
  percentile_rank?: number; // 0-100
  passed: boolean;
}

// ============================================================================
// Comparative Analysis
// ============================================================================

export interface ModelComparison {
  comparison_id: string;
  models: string[]; // Array of model_ids
  suite_id: string;
  
  scores_by_model: Record<string, {
    overall: number;
    mode1: number;
    mode2: number;
    mode3: number;
    mode4: number;
    pass_rate: number;
  }>;
  
  performance_by_model: Record<string, {
    avg_latency_ms: number;
    p50_latency_ms: number;
    p95_latency_ms: number;
    p99_latency_ms: number;
    avg_tokens_out: number;
  }>;
  
  rankings: {
    overall: Array<{ model_id: string; score: number; rank: number }>;
    by_mode: Record<ModeNumber, Array<{ model_id: string; score: number; rank: number }>>;
    by_performance: Array<{ model_id: string; latency_ms: number; rank: number }>;
  };
  
  statistical_analysis?: {
    confidence_intervals: Record<string, { lower: number; upper: number }>;
    significance_tests: Array<{
      model_a: string;
      model_b: string;
      p_value: number;
      significant: boolean;
    }>;
  };
  
  timestamp: string;
}

// ============================================================================
// Expert Review Interface
// ============================================================================

export interface ExpertReviewRequest {
  review_id: string;
  test_result_id: string;
  test_id: string;
  model_id: string;
  
  review_criteria: {
    metric: string;
    description: string;
    scale: string; // e.g., "0-10", "0-1"
    guidance: string;
  }[];
  
  test_context: {
    prompt: string;
    expected_output: any;
    actual_output: any;
  };
  
  status: 'pending' | 'in_progress' | 'completed';
  assigned_to?: string;
  created_at: string;
  due_date?: string;
}

export interface ExpertReview {
  review_id: string;
  reviewer: string;
  
  scores: Record<string, number>; // metric -> score
  comments: string;
  
  flags: {
    requires_attention: boolean;
    exceptional_performance: boolean;
    unexpected_behavior: boolean;
    notes?: string;
  };
  
  completed_at: string;
}

// ============================================================================
// Telemetry and Observability
// ============================================================================

export interface TelemetryEvent {
  event_id: string;
  event_type: 
    | 'test_started'
    | 'test_completed'
    | 'test_failed'
    | 'mode_switched'
    | 'validation_performed'
    | 'expert_review_requested'
    | 'score_calculated';
  
  timestamp: string;
  execution_id: string;
  test_id?: string;
  model_id: string;
  
  data: Record<string, any>;
  
  performance: {
    latency_ms?: number;
    memory_mb?: number;
    cpu_percent?: number;
  };
}

export interface ExecutionSummary {
  execution_id: string;
  suite_id: string;
  model_id: string;
  
  summary: {
    total_tests: number;
    tests_passed: number;
    tests_failed: number;
    tests_skipped: number;
    
    avg_score: number;
    mode_scores: Record<ModeNumber, number>;
    
    total_duration_ms: number;
    avg_test_duration_ms: number;
  };
  
  performance: {
    total_tokens_in: number;
    total_tokens_out: number;
    avg_latency_ms: number;
    max_latency_ms: number;
    min_latency_ms: number;
  };
  
  issues: Array<{
    test_id: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
  }>;
  
  completed_at: string;
}

// ============================================================================
// Integration with Chrysalis
// ============================================================================

export interface ChrysalisIntegration {
  gateway_config: {
    endpoint: string;
    agent_id: string;
    model_tier: 'local_slm' | 'cloud_llm' | 'hybrid';
    enable_caching: boolean;
    enable_rate_limiting: boolean;
  };
  
  memory_config?: {
    beads_enabled: boolean;
    fireproof_enabled: boolean;
    zep_endpoint?: string;
    letta_endpoint?: string;
  };
  
  system_agents?: {
    ada_enabled: boolean;
    lea_enabled: boolean;
    phil_enabled: boolean;
    david_enabled: boolean;
    milton_enabled: boolean;
  };
}

// ============================================================================
// Validation Schemas (JSON Schema format)
// ============================================================================

export const TEST_CASE_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['test_id', 'mode', 'category', 'complexity', 'input', 'expected_output', 'scoring', 'constraints', 'metadata'],
  properties: {
    test_id: { type: 'string', pattern: '^[a-z0-9_-]+$' },
    mode: { type: 'integer', minimum: 1, maximum: 4 },
    category: { type: 'string', enum: ['atomic', 'compound', 'integration', 'adversarial'] },
    complexity: { type: 'string', enum: ['low', 'medium', 'high'] },
    depends_on: { type: 'array', items: { type: 'string' } },
    input: {
      type: 'object',
      required: ['prompt', 'context'],
      properties: {
        prompt: { type: 'string', minLength: 10 },
        context: { type: 'object' },
        prior_outputs: { type: 'object' }
      }
    },
    expected_output: {
      type: 'object',
      required: ['type'],
      properties: {
        type: { type: 'string', enum: ['structured', 'free_form', 'mixed'] },
        schema: { type: 'object' },
        ground_truth: {},
        validation_rules: {
          type: 'array',
          items: {
            type: 'object',
            required: ['rule_id', 'type', 'description', 'validator', 'severity', 'weight'],
            properties: {
              rule_id: { type: 'string' },
              type: { type: 'string', enum: ['regex', 'schema', 'custom', 'semantic'] },
              description: { type: 'string' },
              validator: { type: 'string' },
              severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
              weight: { type: 'number', minimum: 0, maximum: 1 }
            }
          }
        }
      }
    },
    scoring: {
      type: 'object',
      required: ['method'],
      properties: {
        method: { type: 'string', enum: ['exact_match', 'fuzzy_match', 'expert_review', 'automated_metrics'] },
        threshold: { type: 'number', minimum: 0, maximum: 1 },
        weights: { type: 'object' },
        metrics: { type: 'array', items: { type: 'string' } }
      }
    },
    constraints: {
      type: 'object',
      properties: {
        max_latency_ms: { type: 'integer', minimum: 0 },
        max_tokens: { type: 'integer', minimum: 0 },
        requires_external_data: { type: 'boolean' }
      }
    },
    metadata: {
      type: 'object',
      required: ['created', 'author', 'tags', 'difficulty'],
      properties: {
        created: { type: 'string', format: 'date-time' },
        author: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        difficulty: { type: 'integer', minimum: 1, maximum: 10 },
        description: { type: 'string' }
      }
    }
  }
} as const;

export const MODEL_PROFILE_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['model_id', 'name', 'version', 'characteristics', 'deployment'],
  properties: {
    model_id: { type: 'string', pattern: '^[a-z0-9_-]+$' },
    name: { type: 'string' },
    version: { type: 'string' },
    characteristics: {
      type: 'object',
      required: ['type', 'parameters', 'context_window'],
      properties: {
        type: { type: 'string', enum: ['local_slm', 'cloud_llm', 'hybrid'] },
        parameters: { type: 'string' },
        quantization: { type: 'string' },
        context_window: { type: 'integer', minimum: 1 },
        family: { type: 'string' }
      }
    },
    deployment: {
      type: 'object',
      required: ['provider', 'api_key_required', 'model_name'],
      properties: {
        provider: { type: 'string' },
        endpoint: { type: 'string', format: 'uri' },
        api_key_required: { type: 'boolean' },
        model_name: { type: 'string' }
      }
    },
    test_results: {
      type: 'object',
      properties: {
        mode1_avg_score: { type: 'number', minimum: 0, maximum: 10 },
        mode2_avg_score: { type: 'number', minimum: 0, maximum: 10 },
        mode3_avg_score: { type: 'number', minimum: 0, maximum: 10 },
        mode4_avg_score: { type: 'number', minimum: 0, maximum: 10 },
        overall_avg_score: { type: 'number', minimum: 0, maximum: 10 },
        avg_latency_ms: { type: 'number', minimum: 0 },
        avg_tokens_out: { type: 'number', minimum: 0 },
        pass_rate: { type: 'number', minimum: 0, maximum: 1 },
        tests_completed: { type: 'integer', minimum: 0 },
        last_updated: { type: 'string', format: 'date-time' }
      }
    }
  }
} as const;
