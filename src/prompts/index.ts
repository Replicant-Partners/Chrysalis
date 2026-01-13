/**
 * Prompt Registry - Centralized Prompt Template Management
 * 
 * Provides a single source of truth for all LLM prompts used across Chrysalis.
 * Supports template interpolation, versioning, and A/B testing hooks.
 * 
 * @module prompts
 * @see plans/CHRYSALIS_DEVELOPMENT_STREAMLINING_PLAN.md - Item H-1
 * 
 * Usage:
 *   import { PromptRegistry, prompts } from './prompts';
 *   
 *   // Use pre-registered prompts
 *   const prompt = prompts.render('agent.morph', { sourceFramework: 'elizaos' });
 *   
 *   // Register custom prompts
 *   PromptRegistry.register('custom.prompt', { template: '...' });
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Prompt template definition
 */
export interface PromptTemplate {
  /** Template string with {{variable}} placeholders */
  template: string;
  /** Optional description for documentation */
  description?: string;
  /** Template version for tracking changes */
  version?: string;
  /** Required variables that must be provided */
  requiredVars?: string[];
  /** Default values for optional variables */
  defaults?: Record<string, string>;
  /** Tags for categorization */
  tags?: string[];
}

/**
 * Rendered prompt result
 */
export interface RenderedPrompt {
  content: string;
  templateId: string;
  version: string;
  variables: Record<string, string>;
  timestamp: Date;
}

/**
 * Prompt registry options
 */
export interface PromptRegistryOptions {
  /** Enable strict mode (throws on missing variables) */
  strict: boolean;
  /** Enable logging of prompt renders */
  enableLogging: boolean;
  /** Custom variable pattern (default: {{varName}}) */
  variablePattern?: RegExp;
}

// =============================================================================
// Prompt Registry Class
// =============================================================================

/**
 * Centralized prompt registry
 */
class PromptRegistryImpl {
  private templates: Map<string, PromptTemplate> = new Map();
  private options: PromptRegistryOptions;
  private renderHistory: RenderedPrompt[] = [];

  constructor(options?: Partial<PromptRegistryOptions>) {
    this.options = {
      strict: options?.strict ?? true,
      enableLogging: options?.enableLogging ?? false,
      variablePattern: options?.variablePattern ?? /\{\{(\w+)\}\}/g,
    };

    // Register built-in prompts
    this.registerBuiltins();
  }

  /**
   * Register a prompt template
   */
  register(id: string, template: PromptTemplate): void {
    if (this.templates.has(id)) {
      console.warn(`[PromptRegistry] Overwriting template: ${id}`);
    }
    this.templates.set(id, {
      ...template,
      version: template.version ?? '1.0.0',
    });
  }

  /**
   * Get a template by ID
   */
  get(id: string): PromptTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Check if template exists
   */
  has(id: string): boolean {
    return this.templates.has(id);
  }

  /**
   * List all registered template IDs
   */
  list(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * List templates by tag
   */
  listByTag(tag: string): string[] {
    return Array.from(this.templates.entries())
      .filter(([_, t]) => t.tags?.includes(tag))
      .map(([id]) => id);
  }

  /**
   * Render a prompt template with variables
   */
  render(id: string, variables: Record<string, string> = {}): string {
    const template = this.templates.get(id);
    if (!template) {
      throw new Error(`[PromptRegistry] Template not found: ${id}`);
    }

    // Merge with defaults
    const mergedVars = { ...template.defaults, ...variables };

    // Check required variables
    if (this.options.strict && template.requiredVars) {
      const missing = template.requiredVars.filter(v => !(v in mergedVars));
      if (missing.length > 0) {
        throw new Error(
          `[PromptRegistry] Missing required variables for ${id}: ${missing.join(', ')}`
        );
      }
    }

    // Interpolate
    let result = template.template;
    result = result.replace(this.options.variablePattern!, (match, varName) => {
      if (varName in mergedVars) {
        return mergedVars[varName];
      }
      if (this.options.strict) {
        throw new Error(`[PromptRegistry] Undefined variable: ${varName} in template ${id}`);
      }
      return match;
    });

    // Record render
    const rendered: RenderedPrompt = {
      content: result,
      templateId: id,
      version: template.version ?? '1.0.0',
      variables: mergedVars,
      timestamp: new Date(),
    };

    if (this.options.enableLogging) {
      this.renderHistory.push(rendered);
    }

    return result;
  }

  /**
   * Get render history (for debugging/analytics)
   */
  getHistory(): RenderedPrompt[] {
    return [...this.renderHistory];
  }

  /**
   * Clear render history
   */
  clearHistory(): void {
    this.renderHistory = [];
  }

  /**
   * Export all templates as JSON
   */
  export(): Record<string, PromptTemplate> {
    const result: Record<string, PromptTemplate> = {};
    for (const [id, template] of this.templates) {
      result[id] = template;
    }
    return result;
  }

  /**
   * Import templates from JSON
   */
  import(templates: Record<string, PromptTemplate>): void {
    for (const [id, template] of Object.entries(templates)) {
      this.register(id, template);
    }
  }

  /**
   * Register built-in Chrysalis prompts
   */
  private registerBuiltins(): void {
    // =========================================================================
    // Agent Transformation Prompts
    // =========================================================================
    
    this.register('agent.morph.analyze', {
      template: `Analyze the following agent definition for morphing from {{sourceFramework}} to {{targetFramework}}.

Agent Definition:
{{agentDefinition}}

Identify:
1. Core capabilities and roles
2. Memory structure and state
3. Tool/action bindings
4. Communication patterns
5. Framework-specific features that need translation

Provide a structured analysis for the morphing process.`,
      description: 'Analyze agent for cross-framework morphing',
      version: '1.0.0',
      requiredVars: ['sourceFramework', 'targetFramework', 'agentDefinition'],
      tags: ['agent', 'morph', 'analysis'],
    });

    this.register('agent.morph.transform', {
      template: `Transform the following Uniform Semantic Agent representation to {{targetFramework}} format.

USA Representation:
{{usaDefinition}}

Target Framework: {{targetFramework}}
Target Version: {{targetVersion}}

Apply the following transformation rules:
{{transformationRules}}

Generate valid {{targetFramework}} agent configuration.`,
      description: 'Transform USA to target framework',
      version: '1.0.0',
      requiredVars: ['usaDefinition', 'targetFramework'],
      defaults: {
        targetVersion: 'latest',
        transformationRules: 'Use default semantic mappings',
      },
      tags: ['agent', 'morph', 'transform'],
    });

    // =========================================================================
    // Memory Prompts
    // =========================================================================

    this.register('memory.summarize', {
      template: `Summarize the following memory entries for long-term storage:

Entries:
{{entries}}

Create a concise summary that preserves:
- Key facts and relationships
- Temporal context
- Importance rankings
- Actionable insights

Maximum length: {{maxLength}} tokens.`,
      description: 'Summarize memories for consolidation',
      version: '1.0.0',
      requiredVars: ['entries'],
      defaults: { maxLength: '500' },
      tags: ['memory', 'summarize'],
    });

    this.register('memory.retrieve', {
      template: `Given the current context, retrieve relevant memories.

Current Context:
{{context}}

Query: {{query}}

Memory Types to Search: {{memoryTypes}}

Return the most relevant memories with confidence scores.`,
      description: 'Memory retrieval prompt',
      version: '1.0.0',
      requiredVars: ['context', 'query'],
      defaults: { memoryTypes: 'episodic, semantic' },
      tags: ['memory', 'retrieval'],
    });

    // =========================================================================
    // Code Analysis Prompts
    // =========================================================================

    this.register('code.review', {
      template: `Review the following code changes:

File: {{filename}}
Language: {{language}}

```{{language}}
{{code}}
```

Review for:
{{reviewCriteria}}

Provide specific, actionable feedback.`,
      description: 'Code review prompt',
      version: '1.0.0',
      requiredVars: ['filename', 'language', 'code'],
      defaults: {
        reviewCriteria: '- Correctness\n- Performance\n- Security\n- Maintainability',
      },
      tags: ['code', 'review'],
    });

    this.register('code.explain', {
      template: `Explain the following code:

```{{language}}
{{code}}
```

Provide:
1. High-level purpose
2. Step-by-step breakdown
3. Key patterns used
4. Potential improvements

Target audience: {{audience}}`,
      description: 'Code explanation prompt',
      version: '1.0.0',
      requiredVars: ['language', 'code'],
      defaults: { audience: 'intermediate developer' },
      tags: ['code', 'explain'],
    });

    // =========================================================================
    // System Prompts
    // =========================================================================

    this.register('system.chrysalis', {
      template: `You are a Chrysalis agent - a framework-transcendent AI assistant built on universal semantic patterns.

Your capabilities:
- Cross-framework agent morphing
- Tiered cognitive memory (working, episodic, semantic, core)
- Distributed coordination via gossip protocols
- Real-time skill accumulation

Current Mode: {{mode}}
Agent ID: {{agentId}}

{{additionalContext}}

Respond thoughtfully and accurately.`,
      description: 'Base Chrysalis system prompt',
      version: '1.0.0',
      requiredVars: [],
      defaults: {
        mode: 'default',
        agentId: 'chrysalis-primary',
        additionalContext: '',
      },
      tags: ['system', 'core'],
    });

    this.register('system.error', {
      template: `An error occurred during {{operation}}.

Error: {{errorMessage}}
Code: {{errorCode}}

Context:
{{context}}

Suggest recovery strategies and explain what went wrong.`,
      description: 'Error handling prompt',
      version: '1.0.0',
      requiredVars: ['operation', 'errorMessage'],
      defaults: { errorCode: 'UNKNOWN', context: 'No additional context' },
      tags: ['system', 'error'],
    });

    // =========================================================================
    // Skill Synthesis Prompts
    // =========================================================================

    this.register('skill.synthesize', {
      template: `Synthesize the following skill observations into a reusable skill:

Observations:
{{observations}}

Domain: {{domain}}
Complexity: {{complexity}}

Generate:
1. Skill name and description
2. Prerequisites
3. Input/output specifications
4. Step-by-step procedure
5. Quality criteria`,
      description: 'Skill synthesis prompt',
      version: '1.0.0',
      requiredVars: ['observations', 'domain'],
      defaults: { complexity: 'medium' },
      tags: ['skill', 'synthesis'],
    });
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

/**
 * Global prompt registry instance
 */
export const PromptRegistry = new PromptRegistryImpl();

/**
 * Convenience alias for common operations
 */
export const prompts = {
  render: (id: string, vars?: Record<string, string>) => PromptRegistry.render(id, vars),
  get: (id: string) => PromptRegistry.get(id),
  list: () => PromptRegistry.list(),
  register: (id: string, template: PromptTemplate) => PromptRegistry.register(id, template),
};