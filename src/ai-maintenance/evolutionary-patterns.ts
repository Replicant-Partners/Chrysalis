/**
 * AI-Led Adaptive Maintenance System - Known Evolutionary Patterns Registry
 * 
 * Registry of known patterns for dependency updates, API changes, security
 * vulnerabilities, and other evolutionary events that require adapter adaptation.
 * 
 * @module ai-maintenance/evolutionary-patterns
 * @version 1.0.0
 */

import {
  EvolutionaryPattern,
  PatternCategory,
  PatternSeverity,
  PatternFrequency,
  AutomationLevel,
  DetectionHeuristic,
  TriggerCondition,
  AnticipatoryStructure,
  RemediationStrategy,
  PatternMatch
} from './types';

// ============================================================================
// Pattern Registry
// ============================================================================

/**
 * Registry of known evolutionary patterns.
 */
class EvolutionaryPatternRegistry {
  private patterns: Map<string, EvolutionaryPattern> = new Map();
  private patternsByCategory: Map<PatternCategory, Set<string>> = new Map();

  constructor() {
    this.initializeDefaultPatterns();
  }

  /**
   * Initialize the registry with default patterns.
   */
  private initializeDefaultPatterns(): void {
    const defaultPatterns: EvolutionaryPattern[] = [
      PATTERN_EXTERNAL_DEPENDENCY_UPDATE,
      PATTERN_API_DEPRECATION_CASCADE,
      PATTERN_SCHEMA_MIGRATION,
      PATTERN_PROTOCOL_EXTENSION,
      PATTERN_SECURITY_VULNERABILITY_RESPONSE,
      PATTERN_PERFORMANCE_DEGRADATION
    ];

    for (const pattern of defaultPatterns) {
      this.registerPattern(pattern);
    }
  }

  /**
   * Register a new pattern.
   */
  registerPattern(pattern: EvolutionaryPattern): void {
    this.patterns.set(pattern.patternId, pattern);
    
    // Index by category
    if (!this.patternsByCategory.has(pattern.category)) {
      this.patternsByCategory.set(pattern.category, new Set());
    }
    this.patternsByCategory.get(pattern.category)!.add(pattern.patternId);
  }

  /**
   * Get a pattern by ID.
   */
  getPattern(patternId: string): EvolutionaryPattern | undefined {
    return this.patterns.get(patternId);
  }

  /**
   * Get all patterns in a category.
   */
  getPatternsByCategory(category: PatternCategory): EvolutionaryPattern[] {
    const patternIds = this.patternsByCategory.get(category);
    if (!patternIds) return [];
    return Array.from(patternIds)
      .map(id => this.patterns.get(id)!)
      .filter(p => p !== undefined);
  }

  /**
   * Get all active patterns.
   */
  getActivePatterns(): EvolutionaryPattern[] {
    return Array.from(this.patterns.values()).filter(p => p.active);
  }

  /**
   * Get all patterns.
   */
  getAllPatterns(): EvolutionaryPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Match patterns against a change context.
   */
  matchPatterns(context: PatternMatchContext): PatternMatch[] {
    const matches: PatternMatch[] = [];

    for (const pattern of this.getActivePatterns()) {
      const match = this.evaluatePattern(pattern, context);
      if (match && match.confidence > 0.5) {
        matches.push(match);
      }
    }

    // Sort by confidence descending
    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Evaluate a single pattern against context.
   */
  private evaluatePattern(
    pattern: EvolutionaryPattern,
    context: PatternMatchContext
  ): PatternMatch | null {
    const evidence: string[] = [];
    let totalWeight = 0;
    let matchedWeight = 0;

    // Evaluate each heuristic
    for (const heuristic of pattern.detectionHeuristics) {
      if (!heuristic.enabled) continue;
      
      totalWeight += heuristic.weight;
      const heuristicMatch = this.evaluateHeuristic(heuristic, context);
      
      if (heuristicMatch.matched) {
        matchedWeight += heuristic.weight;
        evidence.push(`${heuristic.name}: ${heuristicMatch.evidence}`);
      }
    }

    // Calculate confidence
    const confidence = totalWeight > 0 ? matchedWeight / totalWeight : 0;

    if (confidence < 0.3) {
      return null;
    }

    return {
      patternId: pattern.patternId,
      confidence,
      evidence,
      recommendedStrategies: pattern.remediationStrategies.map(s => s.strategyId)
    };
  }

  /**
   * Evaluate a detection heuristic.
   */
  private evaluateHeuristic(
    heuristic: DetectionHeuristic,
    context: PatternMatchContext
  ): { matched: boolean; evidence: string } {
    switch (heuristic.type) {
      case 'semver-comparison':
        return this.evaluateSemverHeuristic(heuristic, context);
      
      case 'changelog-analysis':
        return this.evaluateChangelogHeuristic(heuristic, context);
      
      case 'api-surface-diff':
        return this.evaluateAPISurfaceHeuristic(heuristic, context);
      
      case 'deprecation-scan':
        return this.evaluateDeprecationHeuristic(heuristic, context);
      
      case 'security-advisory':
        return this.evaluateSecurityHeuristic(heuristic, context);
      
      case 'metrics-anomaly':
        return this.evaluateMetricsHeuristic(heuristic, context);
      
      case 'pattern-match':
        return this.evaluatePatternMatchHeuristic(heuristic, context);
      
      case 'schema-diff':
        return this.evaluateSchemaDiffHeuristic(heuristic, context);
      
      default:
        return { matched: false, evidence: 'Unknown heuristic type' };
    }
  }

  private evaluateSemverHeuristic(
    heuristic: DetectionHeuristic,
    context: PatternMatchContext
  ): { matched: boolean; evidence: string } {
    if (!context.versionChange) {
      return { matched: false, evidence: 'No version change' };
    }

    const { from, to } = context.versionChange;
    const breakingChange = this.isSemverBreakingChange(from, to);
    
    if (breakingChange) {
      return {
        matched: true,
        evidence: `Breaking version change: ${from} → ${to}`
      };
    }

    const minorChange = this.isSemverMinorChange(from, to);
    if (minorChange && heuristic.config.includeMinor) {
      return {
        matched: true,
        evidence: `Minor version change: ${from} → ${to}`
      };
    }

    return { matched: false, evidence: 'Non-breaking version change' };
  }

  private evaluateChangelogHeuristic(
    heuristic: DetectionHeuristic,
    context: PatternMatchContext
  ): { matched: boolean; evidence: string } {
    if (!context.changelog) {
      return { matched: false, evidence: 'No changelog available' };
    }

    const breakingKeywords = ['breaking', 'removed', 'deprecated', 'migration required'];
    const changelog = context.changelog.toLowerCase();
    
    for (const keyword of breakingKeywords) {
      if (changelog.includes(keyword)) {
        return {
          matched: true,
          evidence: `Changelog contains "${keyword}"`
        };
      }
    }

    return { matched: false, evidence: 'No breaking changes in changelog' };
  }

  private evaluateAPISurfaceHeuristic(
    heuristic: DetectionHeuristic,
    context: PatternMatchContext
  ): { matched: boolean; evidence: string } {
    if (!context.apiChanges || context.apiChanges.length === 0) {
      return { matched: false, evidence: 'No API changes detected' };
    }

    const breakingChanges = context.apiChanges.filter(c => c.breaking);
    if (breakingChanges.length > 0) {
      return {
        matched: true,
        evidence: `${breakingChanges.length} breaking API changes detected`
      };
    }

    return { matched: false, evidence: 'No breaking API changes' };
  }

  private evaluateDeprecationHeuristic(
    heuristic: DetectionHeuristic,
    context: PatternMatchContext
  ): { matched: boolean; evidence: string } {
    if (!context.deprecations || context.deprecations.length === 0) {
      return { matched: false, evidence: 'No deprecations detected' };
    }

    return {
      matched: true,
      evidence: `${context.deprecations.length} deprecation(s) detected`
    };
  }

  private evaluateSecurityHeuristic(
    heuristic: DetectionHeuristic,
    context: PatternMatchContext
  ): { matched: boolean; evidence: string } {
    if (!context.securityAdvisories || context.securityAdvisories.length === 0) {
      return { matched: false, evidence: 'No security advisories' };
    }

    const critical = context.securityAdvisories.filter(
      a => a.severity === 'critical' || a.severity === 'high'
    );

    if (critical.length > 0) {
      return {
        matched: true,
        evidence: `${critical.length} critical/high security advisory`
      };
    }

    return { matched: false, evidence: 'No critical security advisories' };
  }

  private evaluateMetricsHeuristic(
    heuristic: DetectionHeuristic,
    context: PatternMatchContext
  ): { matched: boolean; evidence: string } {
    if (!context.metrics) {
      return { matched: false, evidence: 'No metrics available' };
    }

    const thresholds = heuristic.config.thresholds as Record<string, number> | undefined;
    if (!thresholds) {
      return { matched: false, evidence: 'No thresholds configured' };
    }

    for (const [metric, threshold] of Object.entries(thresholds)) {
      if (context.metrics[metric] !== undefined && context.metrics[metric] > threshold) {
        return {
          matched: true,
          evidence: `${metric} exceeded threshold: ${context.metrics[metric]} > ${threshold}`
        };
      }
    }

    return { matched: false, evidence: 'All metrics within thresholds' };
  }

  private evaluatePatternMatchHeuristic(
    heuristic: DetectionHeuristic,
    context: PatternMatchContext
  ): { matched: boolean; evidence: string } {
    if (!context.rawContent) {
      return { matched: false, evidence: 'No content to match' };
    }

    const patterns = heuristic.config.patterns as string[] | undefined;
    if (!patterns) {
      return { matched: false, evidence: 'No patterns configured' };
    }

    for (const pattern of patterns) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(context.rawContent)) {
        return {
          matched: true,
          evidence: `Content matches pattern: ${pattern}`
        };
      }
    }

    return { matched: false, evidence: 'No pattern matches' };
  }

  private evaluateSchemaDiffHeuristic(
    heuristic: DetectionHeuristic,
    context: PatternMatchContext
  ): { matched: boolean; evidence: string } {
    if (!context.schemaChanges || context.schemaChanges.length === 0) {
      return { matched: false, evidence: 'No schema changes' };
    }

    const breakingSchemaChanges = context.schemaChanges.filter(c => 
      c.type === 'field-removed' || 
      c.type === 'type-changed' ||
      c.requiredChange
    );

    if (breakingSchemaChanges.length > 0) {
      return {
        matched: true,
        evidence: `${breakingSchemaChanges.length} breaking schema changes`
      };
    }

    return { matched: false, evidence: 'No breaking schema changes' };
  }

  // Semver utilities
  private isSemverBreakingChange(from: string, to: string): boolean {
    const fromParts = this.parseSemver(from);
    const toParts = this.parseSemver(to);
    
    if (!fromParts || !toParts) return false;
    
    // Major version change is breaking
    return toParts.major > fromParts.major;
  }

  private isSemverMinorChange(from: string, to: string): boolean {
    const fromParts = this.parseSemver(from);
    const toParts = this.parseSemver(to);
    
    if (!fromParts || !toParts) return false;
    
    // Same major but different minor
    return toParts.major === fromParts.major && toParts.minor > fromParts.minor;
  }

  private parseSemver(version: string): { major: number; minor: number; patch: number } | null {
    const match = version.match(/^v?(\d+)\.(\d+)\.(\d+)/);
    if (!match) return null;
    
    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10)
    };
  }
}

// ============================================================================
// Pattern Match Context
// ============================================================================

/**
 * Context for pattern matching.
 */
export interface PatternMatchContext {
  /** Version change if applicable */
  versionChange?: {
    from: string;
    to: string;
  };
  /** Changelog content */
  changelog?: string;
  /** API changes */
  apiChanges?: Array<{
    type: string;
    element: string;
    breaking: boolean;
  }>;
  /** Deprecation notices */
  deprecations?: Array<{
    element: string;
    replacement?: string;
  }>;
  /** Security advisories */
  securityAdvisories?: Array<{
    id: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
  }>;
  /** Metrics */
  metrics?: Record<string, number>;
  /** Schema changes */
  schemaChanges?: Array<{
    type: 'field-added' | 'field-removed' | 'field-modified' | 'type-changed';
    fieldPath?: string;
    requiredChange?: boolean;
  }>;
  /** Raw content for pattern matching */
  rawContent?: string;
  /** Additional context */
  additional?: Record<string, unknown>;
}

// ============================================================================
// Pattern 1: External Dependency Update
// ============================================================================

const PATTERN_EXTERNAL_DEPENDENCY_UPDATE: EvolutionaryPattern = {
  patternId: 'pattern-external-dependency-update',
  patternName: 'External Dependency Update',
  category: 'dependency-management',
  description: `
    Detects when an external framework or protocol releases a new version that 
    may require adapter modifications. This is the most common evolutionary 
    pattern, occurring frequently as the ecosystem evolves.
  `.trim(),
  version: '1.0.0',

  detectionHeuristics: [
    {
      heuristicId: 'semver-major-change',
      name: 'Semantic Version Major Change',
      type: 'semver-comparison',
      config: { 
        includeMinor: false,
        includePatch: false 
      },
      weight: 0.4,
      enabled: true
    },
    {
      heuristicId: 'changelog-breaking',
      name: 'Changelog Breaking Changes',
      type: 'changelog-analysis',
      config: {
        keywords: ['breaking', 'removed', 'deprecated', 'migration']
      },
      weight: 0.3,
      enabled: true
    },
    {
      heuristicId: 'api-surface-diff',
      name: 'API Surface Diff',
      type: 'api-surface-diff',
      config: {},
      weight: 0.3,
      enabled: true
    }
  ],

  triggerConditions: [
    {
      conditionId: 'version-released',
      type: 'version-change',
      active: true
    },
    {
      conditionId: 'breaking-detected',
      type: 'breaking-change',
      active: true
    }
  ],

  anticipatoryStructures: [
    {
      structureId: 'version-negotiation',
      name: 'Version Negotiation Layer',
      type: 'version-negotiation',
      locations: ['src/adapters/*'],
      prerequisites: ['protocol-types.ts', 'protocol-registry.ts'],
      effortHours: 4
    },
    {
      structureId: 'compatibility-layer',
      name: 'Compatibility Shim Generator',
      type: 'compatibility-layer',
      locations: ['src/adapters/shims/*'],
      effortHours: 8
    }
  ],

  remediationStrategies: [
    {
      strategyId: 'update-adapter-contract',
      name: 'Update Adapter Contract',
      type: 'generate-adapter',
      automationLevel: 'semi-automatic',
      steps: [
        {
          order: 1,
          description: 'Analyze new API surface',
          action: 'invoke-llm',
          parameters: { agent: 'analysis-agent' },
          optional: false
        },
        {
          order: 2,
          description: 'Generate adapter modifications',
          action: 'invoke-llm',
          parameters: { agent: 'generation-agent' },
          optional: false
        },
        {
          order: 3,
          description: 'Run type check',
          action: 'execute-command',
          parameters: { command: 'npx tsc --noEmit' },
          optional: false
        },
        {
          order: 4,
          description: 'Run tests',
          action: 'run-tests',
          parameters: { suite: 'adapter-tests' },
          optional: false
        },
        {
          order: 5,
          description: 'Await human review',
          action: 'await-approval',
          parameters: {},
          optional: false
        },
        {
          order: 6,
          description: 'Deploy changes',
          action: 'deploy-staged',
          parameters: { strategy: 'canary' },
          optional: false
        }
      ],
      estimatedDurationMinutes: 60,
      rollbackProcedure: 'git revert and redeploy previous version',
      successCriteria: [
        'All tests pass',
        'Type check succeeds',
        'Canary deployment stable for 10 minutes'
      ]
    }
  ],

  severity: 'medium',
  frequency: 'weekly',
  automationLevel: 'semi-automatic',
  confidence: 0.85,
  applicableTo: ['mcp', 'a2a', 'anp', 'langchain', 'openai', 'autogen', 'crewai'],
  relatedPatterns: ['pattern-api-deprecation-cascade'],

  examples: [
    {
      title: 'LangChain v0.1 to v0.2 Migration',
      description: 'Major version update with breaking changes to chain APIs',
      occurredAt: '2024-03-15',
      before: `
        import { LLMChain } from 'langchain/chains';
        const chain = new LLMChain({ llm, prompt });
      `,
      after: `
        import { RunnableSequence } from '@langchain/core/runnables';
        const chain = RunnableSequence.from([prompt, llm]);
      `,
      lessonsLearned: [
        'Monitor @langchain/core for changes',
        'Keep adapter abstraction layer thin',
        'Maintain backward compatibility shims'
      ]
    }
  ],

  active: true,
  createdAt: '2025-01-11T00:00:00Z',
  updatedAt: '2025-01-11T00:00:00Z'
};

// ============================================================================
// Pattern 2: API Deprecation Cascade
// ============================================================================

const PATTERN_API_DEPRECATION_CASCADE: EvolutionaryPattern = {
  patternId: 'pattern-api-deprecation-cascade',
  patternName: 'API Deprecation Cascade',
  category: 'interface-evolution',
  description: `
    Triggered when an upstream dependency deprecates APIs that Chrysalis adapters
    use. This pattern tracks deprecation timelines and orchestrates gradual 
    migration to replacement APIs before removal deadlines.
  `.trim(),
  version: '1.0.0',

  detectionHeuristics: [
    {
      heuristicId: 'deprecation-annotation',
      name: 'Deprecation Annotation Scan',
      type: 'deprecation-scan',
      config: {
        annotations: ['@deprecated', '@obsolete', 'DEPRECATED'],
        ignorePatterns: ['test/*', '*.test.ts']
      },
      weight: 0.4,
      enabled: true
    },
    {
      heuristicId: 'changelog-deprecation',
      name: 'Changelog Deprecation Notices',
      type: 'changelog-analysis',
      config: {
        keywords: ['deprecated', 'will be removed', 'use instead']
      },
      weight: 0.3,
      enabled: true
    },
    {
      heuristicId: 'warning-logs',
      name: 'Deprecation Warning Logs',
      type: 'pattern-match',
      config: {
        patterns: [
          'DeprecationWarning',
          'deprecated.*will be removed',
          'use.*instead'
        ]
      },
      weight: 0.3,
      enabled: true
    }
  ],

  triggerConditions: [
    {
      conditionId: 'deprecation-detected',
      type: 'deprecation-notice',
      active: true
    }
  ],

  anticipatoryStructures: [
    {
      structureId: 'deprecation-wrapper',
      name: 'Deprecation Wrapper',
      type: 'compatibility-layer',
      template: `
        // Wraps deprecated API with logging and future migration path
        function deprecationWrapper<T>(
          deprecated: () => T,
          replacement: () => T,
          deadline: Date
        ): T {
          if (new Date() > deadline) {
            return replacement();
          }
          console.warn(\`Using deprecated API, migrate by \${deadline.toISOString()}\`);
          return deprecated();
        }
      `,
      locations: ['src/adapters/compat/*'],
      effortHours: 2
    }
  ],

  remediationStrategies: [
    {
      strategyId: 'gradual-migration',
      name: 'Gradual Migration Strategy',
      type: 'migrate-schema',
      automationLevel: 'assisted',
      steps: [
        {
          order: 1,
          description: 'Identify deprecated API usages',
          action: 'execute-command',
          parameters: { 
            command: 'grep -r "@deprecated" src/adapters/' 
          },
          optional: false
        },
        {
          order: 2,
          description: 'Map deprecated APIs to replacements',
          action: 'invoke-llm',
          parameters: { 
            agent: 'analysis-agent',
            task: 'deprecation-mapping'
          },
          optional: false
        },
        {
          order: 3,
          description: 'Create migration timeline',
          action: 'create-file',
          parameters: { 
            path: 'docs/migrations/deprecation-timeline.md' 
          },
          optional: false
        },
        {
          order: 4,
          description: 'Generate replacement code',
          action: 'invoke-llm',
          parameters: { agent: 'generation-agent' },
          optional: false
        },
        {
          order: 5,
          description: 'Create backward-compatible wrappers',
          action: 'modify-file',
          parameters: {},
          optional: true,
          condition: 'deprecation.deadline > now + 30days'
        },
        {
          order: 6,
          description: 'Notify team of migration timeline',
          action: 'send-notification',
          parameters: { 
            channel: 'engineering' 
          },
          optional: false
        }
      ],
      estimatedDurationMinutes: 120,
      rollbackProcedure: 'Revert to deprecated API usage with wrapper',
      successCriteria: [
        'Migration path documented',
        'Timeline established',
        'Team notified'
      ]
    }
  ],

  severity: 'medium',
  frequency: 'monthly',
  automationLevel: 'assisted',
  confidence: 0.80,
  applicableTo: ['mcp', 'a2a', 'anp', 'langchain', 'openai'],
  relatedPatterns: ['pattern-external-dependency-update'],

  examples: [
    {
      title: 'OpenAI API Model Deprecation',
      description: 'text-davinci-003 deprecated in favor of gpt-3.5-turbo',
      occurredAt: '2024-01-04',
      before: `model: 'text-davinci-003'`,
      after: `model: 'gpt-3.5-turbo'`,
      lessonsLearned: [
        'Monitor OpenAI deprecation announcements',
        'Use model aliases in config',
        'Implement model fallback chain'
      ]
    }
  ],

  active: true,
  createdAt: '2025-01-11T00:00:00Z',
  updatedAt: '2025-01-11T00:00:00Z'
};

// ============================================================================
// Pattern 3: Schema Migration
// ============================================================================

const PATTERN_SCHEMA_MIGRATION: EvolutionaryPattern = {
  patternId: 'pattern-schema-migration',
  patternName: 'Schema Migration',
  category: 'data-evolution',
  description: `
    Handles changes to message formats, data structures, or serialization 
    protocols. This includes Protocol Buffer updates, JSON schema changes,
    and type definition modifications that affect adapter message handling.
  `.trim(),
  version: '1.0.0',

  detectionHeuristics: [
    {
      heuristicId: 'schema-diff',
      name: 'Schema Diff Analysis',
      type: 'schema-diff',
      config: {
        schemaFormats: ['json-schema', 'protobuf', 'typescript']
      },
      weight: 0.4,
      enabled: true
    },
    {
      heuristicId: 'type-signature-change',
      name: 'Type Signature Change',
      type: 'api-surface-diff',
      config: {
        focus: 'types'
      },
      weight: 0.3,
      enabled: true
    },
    {
      heuristicId: 'serialization-error',
      name: 'Serialization Error Detection',
      type: 'pattern-match',
      config: {
        patterns: [
          'SerializationError',
          'ValidationError.*schema',
          'TypeError.*property',
          'required.*missing'
        ]
      },
      weight: 0.3,
      enabled: true
    }
  ],

  triggerConditions: [
    {
      conditionId: 'schema-changed',
      type: 'schema-change',
      active: true
    }
  ],

  anticipatoryStructures: [
    {
      structureId: 'versioned-schemas',
      name: 'Versioned Schema Registry',
      type: 'schema-migration',
      template: `
        interface SchemaVersion {
          version: string;
          schema: JSONSchema;
          transformer?: (data: unknown) => unknown;
        }
        
        const schemaRegistry = new Map<string, SchemaVersion[]>();
      `,
      locations: ['src/adapters/schemas/*'],
      effortHours: 4
    },
    {
      structureId: 'transformation-layer',
      name: 'Data Transformation Layer',
      type: 'schema-migration',
      locations: ['src/adapters/transform/*'],
      effortHours: 6
    }
  ],

  remediationStrategies: [
    {
      strategyId: 'versioned-schema-migration',
      name: 'Versioned Schema Migration',
      type: 'migrate-schema',
      automationLevel: 'semi-automatic',
      steps: [
        {
          order: 1,
          description: 'Capture current schema version',
          action: 'execute-command',
          parameters: { 
            command: 'npm run schema:snapshot' 
          },
          optional: false
        },
        {
          order: 2,
          description: 'Diff schemas',
          action: 'invoke-llm',
          parameters: { 
            agent: 'analysis-agent',
            task: 'schema-diff'
          },
          optional: false
        },
        {
          order: 3,
          description: 'Generate transformer functions',
          action: 'invoke-llm',
          parameters: { 
            agent: 'generation-agent',
            task: 'schema-transformer'
          },
          optional: false
        },
        {
          order: 4,
          description: 'Update type definitions',
          action: 'modify-file',
          parameters: { 
            path: 'src/adapters/protocol-messages.ts' 
          },
          optional: false
        },
        {
          order: 5,
          description: 'Add backward compatibility',
          action: 'create-file',
          parameters: { 
            path: 'src/adapters/compat/schema-v{version}.ts' 
          },
          optional: true,
          condition: 'requiresBackwardCompat'
        },
        {
          order: 6,
          description: 'Run validation tests',
          action: 'run-tests',
          parameters: { suite: 'schema-validation' },
          optional: false
        }
      ],
      estimatedDurationMinutes: 90,
      rollbackProcedure: 'Restore previous schema version from snapshot',
      successCriteria: [
        'Schema validates correctly',
        'Transformation tests pass',
        'Backward compatibility maintained'
      ]
    }
  ],

  severity: 'high',
  frequency: 'quarterly',
  automationLevel: 'semi-automatic',
  confidence: 0.75,
  applicableTo: ['mcp', 'a2a', 'anp', 'fipa', 'jade'],

  examples: [
    {
      title: 'MCP Message Format Update',
      description: 'MCP 2024.12 changed tool result format',
      occurredAt: '2024-12-01',
      before: `{ result: string }`,
      after: `{ content: Array<TextContent | ImageContent> }`,
      lessonsLearned: [
        'Schema versioning is essential',
        'Use unions for backward compatibility',
        'Add transformation layer early'
      ]
    }
  ],

  active: true,
  createdAt: '2025-01-11T00:00:00Z',
  updatedAt: '2025-01-11T00:00:00Z'
};

// ============================================================================
// Pattern 4: Protocol Extension
// ============================================================================

const PATTERN_PROTOCOL_EXTENSION: EvolutionaryPattern = {
  patternId: 'pattern-protocol-extension',
  patternName: 'Protocol Extension',
  category: 'protocol-evolution',
  description: `
    Handles new capabilities added to existing protocols. This includes new 
    message types, endpoints, feature flags, and optional enhancements that 
    don't break existing functionality but provide new opportunities.
  `.trim(),
  version: '1.0.0',

  detectionHeuristics: [
    {
      heuristicId: 'new-endpoints',
      name: 'New Endpoint Detection',
      type: 'api-surface-diff',
      config: {
        focus: 'additions'
      },
      weight: 0.35,
      enabled: true
    },
    {
      heuristicId: 'capability-flags',
      name: 'Capability Flag Detection',
      type: 'pattern-match',
      config: {
        patterns: [
          'supports.*capability',
          'feature.*enabled',
          'experimental.*feature'
        ]
      },
      weight: 0.35,
      enabled: true
    },
    {
      heuristicId: 'changelog-features',
      name: 'Changelog New Features',
      type: 'changelog-analysis',
      config: {
        keywords: ['new feature', 'added', 'introducing', 'now supports']
      },
      weight: 0.3,
      enabled: true
    }
  ],

  triggerConditions: [
    {
      conditionId: 'capability-added',
      type: 'capability-change',
      active: true
    }
  ],

  anticipatoryStructures: [
    {
      structureId: 'feature-flags',
      name: 'Feature Flag System',
      type: 'feature-flag',
      template: `
        interface FeatureFlags {
          [featureId: string]: {
            enabled: boolean;
            version: string;
            fallback?: () => unknown;
          };
        }
      `,
      locations: ['src/adapters/features/*'],
      effortHours: 3
    },
    {
      structureId: 'capability-negotiation',
      name: 'Capability Negotiation',
      type: 'version-negotiation',
      locations: ['src/adapters/capabilities/*'],
      prerequisites: ['protocol-capabilities.ts'],
      effortHours: 4
    }
  ],

  remediationStrategies: [
    {
      strategyId: 'optional-enhancement',
      name: 'Optional Enhancement Integration',
      type: 'configure-feature',
      automationLevel: 'fully-automatic',
      steps: [
        {
          order: 1,
          description: 'Detect new capabilities',
          action: 'invoke-llm',
          parameters: { 
            agent: 'analysis-agent',
            task: 'capability-detection'
          },
          optional: false
        },
        {
          order: 2,
          description: 'Update capability matrix',
          action: 'modify-file',
          parameters: { 
            path: 'src/adapters/protocol-capabilities.ts' 
          },
          optional: false
        },
        {
          order: 3,
          description: 'Add feature flag',
          action: 'modify-file',
          parameters: { 
            path: 'src/adapters/features/flags.ts' 
          },
          optional: false
        },
        {
          order: 4,
          description: 'Generate adapter extension',
          action: 'invoke-llm',
          parameters: { 
            agent: 'generation-agent',
            task: 'capability-implementation'
          },
          optional: true,
          condition: 'capability.autoImplement === true'
        },
        {
          order: 5,
          description: 'Document new capability',
          action: 'create-file',
          parameters: { 
            path: 'docs/capabilities/{capabilityId}.md' 
          },
          optional: false
        }
      ],
      estimatedDurationMinutes: 30,
      rollbackProcedure: 'Disable feature flag',
      successCriteria: [
        'Capability registered',
        'Feature flag available',
        'Documentation created'
      ]
    }
  ],

  severity: 'low',
  frequency: 'monthly',
  automationLevel: 'fully-automatic',
  confidence: 0.90,
  applicableTo: ['mcp', 'a2a', 'anp', 'openai-agents'],

  examples: [
    {
      title: 'MCP Prompts Capability',
      description: 'MCP added prompts as new primitive alongside tools and resources',
      occurredAt: '2024-11-01',
      lessonsLearned: [
        'Keep adapter primitives extensible',
        'Use capability negotiation',
        'Feature flags for gradual rollout'
      ]
    }
  ],

  active: true,
  createdAt: '2025-01-11T00:00:00Z',
  updatedAt: '2025-01-11T00:00:00Z'
};

// ============================================================================
// Pattern 5: Security Vulnerability Response
// ============================================================================

const PATTERN_SECURITY_VULNERABILITY_RESPONSE: EvolutionaryPattern = {
  patternId: 'pattern-security-vulnerability-response',
  patternName: 'Security Vulnerability Response',
  category: 'security',
  description: `
    Triggered by CVE publications, security advisories, or penetration test 
    findings affecting adapters or dependencies. This pattern prioritizes 
    rapid response while maintaining stability.
  `.trim(),
  version: '1.0.0',

  detectionHeuristics: [
    {
      heuristicId: 'cve-database',
      name: 'CVE Database Monitoring',
      type: 'security-advisory',
      config: {
        sources: ['nvd', 'github-advisories', 'snyk'],
        minSeverity: 'medium'
      },
      weight: 0.5,
      enabled: true
    },
    {
      heuristicId: 'npm-audit',
      name: 'NPM Audit',
      type: 'security-advisory',
      config: {
        command: 'npm audit --json'
      },
      weight: 0.3,
      enabled: true
    },
    {
      heuristicId: 'security-patterns',
      name: 'Security Anti-Pattern Detection',
      type: 'pattern-match',
      config: {
        patterns: [
          'eval\\(',
          'innerHTML\\s*=',
          'dangerouslySetInnerHTML',
          'exec\\(',
          'child_process'
        ]
      },
      weight: 0.2,
      enabled: true
    }
  ],

  triggerConditions: [
    {
      conditionId: 'cve-published',
      type: 'security-alert',
      active: true
    },
    {
      conditionId: 'audit-failure',
      type: 'security-alert',
      threshold: 'high',
      active: true
    }
  ],

  anticipatoryStructures: [
    {
      structureId: 'security-middleware',
      name: 'Security Middleware Layer',
      type: 'circuit-breaker',
      locations: ['src/adapters/security/*'],
      effortHours: 6
    },
    {
      structureId: 'input-sanitization',
      name: 'Input Sanitization Layer',
      type: 'adapter-interface',
      locations: ['src/adapters/sanitize/*'],
      effortHours: 4
    }
  ],

  remediationStrategies: [
    {
      strategyId: 'emergency-patch',
      name: 'Emergency Security Patch',
      type: 'apply-patch',
      automationLevel: 'semi-automatic',
      steps: [
        {
          order: 1,
          description: 'Assess vulnerability impact',
          action: 'invoke-llm',
          parameters: { 
            agent: 'analysis-agent',
            task: 'security-impact'
          },
          optional: false
        },
        {
          order: 2,
          description: 'Check for available patches',
          action: 'execute-command',
          parameters: { 
            command: 'npm outdated --json' 
          },
          optional: false
        },
        {
          order: 3,
          description: 'Apply patch or workaround',
          action: 'invoke-llm',
          parameters: { 
            agent: 'generation-agent',
            task: 'security-patch'
          },
          optional: false
        },
        {
          order: 4,
          description: 'Security scan',
          action: 'execute-command',
          parameters: { 
            command: 'npm audit' 
          },
          optional: false
        },
        {
          order: 5,
          description: 'Fast-track human review',
          action: 'await-approval',
          parameters: { 
            priority: 'high',
            timeoutMinutes: 30
          },
          optional: false
        },
        {
          order: 6,
          description: 'Emergency deployment',
          action: 'deploy-staged',
          parameters: { 
            strategy: 'direct',
            skipCanary: true
          },
          optional: false
        },
        {
          order: 7,
          description: 'Notify security team',
          action: 'send-notification',
          parameters: { 
            channel: 'security',
            priority: 'high'
          },
          optional: false
        }
      ],
      estimatedDurationMinutes: 60,
      rollbackProcedure: 'Immediate rollback and disable affected functionality',
      successCriteria: [
        'Vulnerability patched',
        'Security scan passes',
        'No regression in functionality'
      ]
    }
  ],

  severity: 'critical',
  frequency: 'rare',
  automationLevel: 'semi-automatic',
  confidence: 0.95,
  applicableTo: ['mcp', 'a2a', 'anp', 'langchain', 'openai', 'autogen', 'crewai'],

  examples: [
    {
      title: 'Prototype Pollution in lodash',
      description: 'CVE-2019-10744 affecting lodash < 4.17.12',
      occurredAt: '2019-07-09',
      lessonsLearned: [
        'Automated dependency scanning is essential',
        'Keep dependencies minimal',
        'Have emergency response playbook ready'
      ]
    }
  ],

  active: true,
  createdAt: '2025-01-11T00:00:00Z',
  updatedAt: '2025-01-11T00:00:00Z'
};

// ============================================================================
// Pattern 6: Performance Degradation
// ============================================================================

const PATTERN_PERFORMANCE_DEGRADATION: EvolutionaryPattern = {
  patternId: 'pattern-performance-degradation',
  patternName: 'Performance Degradation',
  category: 'operational',
  description: `
    Detects when adapter performance degrades below acceptable thresholds.
    This can be caused by increased payload sizes, inefficient code paths,
    resource leaks, or upstream service slowdowns.
  `.trim(),
  version: '1.0.0',

  detectionHeuristics: [
    {
      heuristicId: 'latency-anomaly',
      name: 'Latency Anomaly Detection',
      type: 'metrics-anomaly',
      config: {
        thresholds: {
          p50LatencyMs: 100,
          p95LatencyMs: 500,
          p99LatencyMs: 1000
        }
      },
      weight: 0.35,
      enabled: true
    },
    {
      heuristicId: 'throughput-drop',
      name: 'Throughput Drop Detection',
      type: 'metrics-anomaly',
      config: {
        thresholds: {
          throughputDropPercent: 20
        }
      },
      weight: 0.35,
      enabled: true
    },
    {
      heuristicId: 'error-rate-spike',
      name: 'Error Rate Spike',
      type: 'metrics-anomaly',
      config: {
        thresholds: {
          errorRatePercent: 5
        }
      },
      weight: 0.3,
      enabled: true
    }
  ],

  triggerConditions: [
    {
      conditionId: 'metrics-breach',
      type: 'metrics-breach',
      threshold: 'any',
      timeWindowMs: 300000, // 5 minutes
      minOccurrences: 3,
      active: true
    }
  ],

  anticipatoryStructures: [
    {
      structureId: 'circuit-breaker',
      name: 'Circuit Breaker',
      type: 'circuit-breaker',
      template: `
        class CircuitBreaker {
          private failures = 0;
          private lastFailure?: Date;
          private state: 'closed' | 'open' | 'half-open' = 'closed';
          
          async execute<T>(fn: () => Promise<T>): Promise<T> {
            if (this.state === 'open') {
              throw new CircuitOpenError();
            }
            try {
              const result = await fn();
              this.onSuccess();
              return result;
            } catch (error) {
              this.onFailure();
              throw error;
            }
          }
        }
      `,
      locations: ['src/adapters/resilience/*'],
      effortHours: 4
    },
    {
      structureId: 'retry-policy',
      name: 'Retry Policy',
      type: 'retry-policy',
      locations: ['src/adapters/resilience/*'],
      effortHours: 2
    }
  ],

  remediationStrategies: [
    {
      strategyId: 'performance-optimization',
      name: 'Performance Optimization',
      type: 'update-dependency',
      automationLevel: 'assisted',
      steps: [
        {
          order: 1,
          description: 'Collect performance profile',
          action: 'execute-command',
          parameters: { 
            command: 'npm run profile:adapters' 
          },
          optional: false
        },
        {
          order: 2,
          description: 'Identify bottlenecks',
          action: 'invoke-llm',
          parameters: { 
            agent: 'analysis-agent',
            task: 'performance-analysis'
          },
          optional: false
        },
        {
          order: 3,
          description: 'Generate optimizations',
          action: 'invoke-llm',
          parameters: { 
            agent: 'generation-agent',
            task: 'performance-optimization'
          },
          optional: false
        },
        {
          order: 4,
          description: 'Enable caching if beneficial',
          action: 'modify-file',
          parameters: {},
          optional: true,
          condition: 'analysis.cacheable === true'
        },
        {
          order: 5,
          description: 'Run performance tests',
          action: 'run-tests',
          parameters: { 
            suite: 'performance' 
          },
          optional: false
        },
        {
          order: 6,
          description: 'A/B deploy for comparison',
          action: 'deploy-staged',
          parameters: { 
            strategy: 'canary',
            canaryPercent: 10
          },
          optional: false
        }
      ],
      estimatedDurationMinutes: 180,
      rollbackProcedure: 'Revert optimization and scale horizontally',
      successCriteria: [
        'P95 latency reduced by 20%',
        'No increase in error rate',
        'Memory usage stable'
      ]
    }
  ],

  severity: 'medium',
  frequency: 'monthly',
  automationLevel: 'assisted',
  confidence: 0.70,
  applicableTo: ['mcp', 'a2a', 'anp', 'langchain', 'openai'],

  examples: [
    {
      title: 'Memory Leak in Message Queue',
      description: 'Unbounded queue growth causing GC pressure',
      lessonsLearned: [
        'Implement bounded queues',
        'Monitor memory metrics',
        'Add backpressure mechanisms'
      ]
    }
  ],

  active: true,
  createdAt: '2025-01-11T00:00:00Z',
  updatedAt: '2025-01-11T00:00:00Z'
};

// ============================================================================
// Registry Export
// ============================================================================

/**
 * Singleton pattern registry instance.
 */
export const patternRegistry = new EvolutionaryPatternRegistry();

/**
 * Get all registered patterns.
 */
export function getAllPatterns(): EvolutionaryPattern[] {
  return patternRegistry.getAllPatterns();
}

/**
 * Get pattern by ID.
 */
export function getPattern(patternId: string): EvolutionaryPattern | undefined {
  return patternRegistry.getPattern(patternId);
}

/**
 * Match patterns against context.
 */
export function matchPatterns(context: PatternMatchContext): PatternMatch[] {
  return patternRegistry.matchPatterns(context);
}

/**
 * Register a custom pattern.
 */
export function registerPattern(pattern: EvolutionaryPattern): void {
  patternRegistry.registerPattern(pattern);
}

/**
 * Get patterns by category.
 */
export function getPatternsByCategory(category: PatternCategory): EvolutionaryPattern[] {
  return patternRegistry.getPatternsByCategory(category);
}

// Export individual patterns for direct access
export {
  PATTERN_EXTERNAL_DEPENDENCY_UPDATE,
  PATTERN_API_DEPRECATION_CASCADE,
  PATTERN_SCHEMA_MIGRATION,
  PATTERN_PROTOCOL_EXTENSION,
  PATTERN_SECURITY_VULNERABILITY_RESPONSE,
  PATTERN_PERFORMANCE_DEGRADATION
};
