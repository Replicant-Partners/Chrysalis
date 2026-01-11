/**
 * Semantic Diff Analyzer for AI-Led Adaptive Maintenance
 * 
 * Analyzes changes between versions to identify semantic impact on adapters.
 * Goes beyond textual diffs to understand API surface changes, breaking changes,
 * schema migrations, and behavioral modifications.
 */

import {
  RepositoryChange,
  SemanticDiff,
  BreakingChange,
  ImpactLevel,
  PatternSeverity,
  APIChange,
  SchemaChange,
  Addition,
  Deprecation,
  Removal,
} from './types';
import { AgentFramework } from '../adapters/protocol-types';

// ============================================================================
// Types for Semantic Analysis
// ============================================================================

/**
 * Represents an API endpoint or function signature
 */
export interface APISignature {
  name: string;
  path?: string;
  method?: string;
  parameters: ParameterSignature[];
  returnType?: string;
  deprecated?: boolean;
  deprecationMessage?: string;
  version?: string;
}

/**
 * Parameter in an API signature
 */
export interface ParameterSignature {
  name: string;
  type: string;
  required: boolean;
  default?: unknown;
  description?: string;
}

/**
 * Schema definition for validation
 */
export interface SchemaDefinition {
  name: string;
  version: string;
  fields: SchemaField[];
  required: string[];
}

/**
 * Individual field in a schema
 */
export interface SchemaField {
  name: string;
  type: string;
  nullable?: boolean;
  enum?: string[];
  nested?: SchemaField[];
}

/**
 * Result of comparing two API surfaces
 */
export interface APISurfaceComparison {
  added: APISignature[];
  removed: APISignature[];
  modified: APIModification[];
  deprecated: APISignature[];
  undeprecated: APISignature[];
}

/**
 * Modification to an existing API
 */
export interface APIModification {
  before: APISignature;
  after: APISignature;
  changes: APIChangeDetail[];
  isBreaking: boolean;
}

/**
 * Specific change within an API modification
 */
export interface APIChangeDetail {
  type: 'parameter_added' | 'parameter_removed' | 'parameter_type_changed' 
      | 'return_type_changed' | 'path_changed' | 'method_changed'
      | 'required_changed' | 'default_changed';
  field: string;
  before?: unknown;
  after?: unknown;
  isBreaking: boolean;
  reason?: string;
}

/**
 * Result of comparing two schemas
 */
export interface SchemaComparison {
  added: SchemaField[];
  removed: SchemaField[];
  modified: FieldModification[];
  isCompatible: boolean;
  migrationRequired: boolean;
}

/**
 * Modification to a schema field
 */
export interface FieldModification {
  field: string;
  before: SchemaField;
  after: SchemaField;
  isBreaking: boolean;
  reason: string;
}

/**
 * Configuration for the semantic diff analyzer
 */
export interface SemanticDiffConfig {
  strictMode: boolean;
  detectBehavioralChanges: boolean;
  includeDocumentationChanges: boolean;
  ignorePatterns: string[];
  breakingChangeThreshold: number;
}

/**
 * Behavioral change that may not be visible in signatures
 */
export interface BehavioralChange {
  type: 'error_handling' | 'timeout' | 'retry' | 'authentication' | 'logging' | 'other';
  description: string;
  file: string;
  isPotentiallyBreaking: boolean;
  confidence: number;
  suggestedAction: string;
}

/**
 * File content change for analysis
 */
export interface FileContentChange {
  path: string;
  before?: string;
  after?: string;
}

/**
 * Extended analysis result
 */
export interface ExtendedAnalysisResult {
  repositoryId: string;
  changeId: string;
  analyzedAt: string;
  analysisTimeMs: number;
  
  // Detailed analysis
  apiSurfaceChanges: APISurfaceComparison;
  schemaComparison: SchemaComparison;
  behavioralChanges: BehavioralChange[];
  
  // Standard SemanticDiff fields
  semanticDiff: SemanticDiff;
  
  // Summary
  impactScore: number;
  summary: string;
  affectedAdapters: string[];
  recommendedActions: string[];
}

// ============================================================================
// Semantic Diff Analyzer Implementation
// ============================================================================

/**
 * Analyzes changes semantically to understand their impact on adapters
 */
export class SemanticDiffAnalyzer {
  private config: SemanticDiffConfig;
  private knownAPIs: Map<AgentFramework, APISignature[]> = new Map();
  private knownSchemas: Map<AgentFramework, SchemaDefinition[]> = new Map();
  private changeIdCounter = 0;

  constructor(config: Partial<SemanticDiffConfig> = {}) {
    this.config = {
      strictMode: true,
      detectBehavioralChanges: true,
      includeDocumentationChanges: false,
      ignorePatterns: ['*.test.*', '*.spec.*', '**/test/**', '**/tests/**'],
      breakingChangeThreshold: 0.7,
      ...config,
    };
  }

  /**
   * Generate unique change ID
   */
  private generateChangeId(): string {
    return `change-${Date.now()}-${++this.changeIdCounter}`;
  }

  /**
   * Analyze a repository change and produce semantic diff
   */
  async analyzeChange(
    change: RepositoryChange,
    fileContents?: FileContentChange[]
  ): Promise<ExtendedAnalysisResult> {
    const startTime = Date.now();

    // Parse the changes based on file types
    const apiChanges = await this.extractAPIChanges(change, fileContents);
    const schemaComparison = await this.extractSchemaChanges(change, fileContents);
    const behavioralChanges = this.config.detectBehavioralChanges
      ? await this.detectBehavioralChanges(change, fileContents)
      : [];

    // Convert to standard types
    const breakingChanges = this.convertToBreakingChanges(
      apiChanges,
      schemaComparison,
      behavioralChanges
    );

    const additions = this.convertToAdditions(apiChanges, schemaComparison);
    const deprecations = this.convertToDeprecations(apiChanges);
    const removals = this.convertToRemovals(apiChanges, schemaComparison);
    const apiChangesList = this.convertToAPIChanges(apiChanges);
    const schemaChangesList = this.convertToSchemaChanges(schemaComparison);

    // Calculate impact
    const impactLevel = this.calculateImpactLevel(breakingChanges, change);
    const impactScore = this.calculateImpactScore(breakingChanges, change);

    // Build standard SemanticDiff
    const semanticDiff: SemanticDiff = {
      diffId: `diff-${change.changeId}`,
      sourceId: change.repositoryId,
      fromVersion: change.previousVersion || 'unknown',
      toVersion: change.currentVersion,
      impact: impactLevel,
      breakingChanges,
      additions,
      deprecations,
      removals,
      apiChanges: apiChangesList,
      schemaChanges: schemaChangesList,
      analyzedAt: new Date().toISOString(),
    };

    // Generate summary
    const summary = this.generateSummary(apiChanges, schemaComparison, breakingChanges);
    const affectedAdapters = this.identifyAffectedAdapters(change, breakingChanges);
    const recommendedActions = this.generateRecommendedActions(breakingChanges);

    return {
      repositoryId: change.repositoryId,
      changeId: change.changeId,
      analyzedAt: new Date().toISOString(),
      analysisTimeMs: Date.now() - startTime,
      
      apiSurfaceChanges: apiChanges,
      schemaComparison,
      behavioralChanges,
      
      semanticDiff,
      
      impactScore,
      summary,
      affectedAdapters,
      recommendedActions,
    };
  }

  /**
   * Extract API changes from repository change
   */
  private async extractAPIChanges(
    change: RepositoryChange,
    fileContents?: FileContentChange[]
  ): Promise<APISurfaceComparison> {
    const result: APISurfaceComparison = {
      added: [],
      removed: [],
      modified: [],
      deprecated: [],
      undeprecated: [],
    };

    // Use provided file contents or create empty analysis
    const files = fileContents || this.createFileChangesFromPaths(change.changedPaths || []);

    // Analyze each changed file
    for (const file of files) {
      // Skip ignored patterns
      if (this.shouldIgnoreFile(file.path)) continue;

      // Only analyze relevant file types
      if (!this.isAPIRelatedFile(file.path)) continue;

      const beforeAPIs = this.parseAPIsFromContent(file.before || '', file.path);
      const afterAPIs = this.parseAPIsFromContent(file.after || '', file.path);

      // Find added APIs
      for (const api of afterAPIs) {
        const existing = beforeAPIs.find(b => this.apiSignaturesMatch(b, api));
        if (!existing) {
          result.added.push(api);
        }
      }

      // Find removed APIs
      for (const api of beforeAPIs) {
        const stillExists = afterAPIs.find(a => this.apiSignaturesMatch(a, api));
        if (!stillExists) {
          result.removed.push(api);
        }
      }

      // Find modified APIs
      for (const beforeAPI of beforeAPIs) {
        const afterAPI = afterAPIs.find(a => a.name === beforeAPI.name);
        if (afterAPI && !this.apiSignaturesEqual(beforeAPI, afterAPI)) {
          const changes = this.compareAPISignatures(beforeAPI, afterAPI);
          result.modified.push({
            before: beforeAPI,
            after: afterAPI,
            changes,
            isBreaking: changes.some(c => c.isBreaking),
          });
        }
      }

      // Track deprecation changes
      for (const api of afterAPIs) {
        const beforeAPI = beforeAPIs.find(b => b.name === api.name);
        if (api.deprecated && (!beforeAPI || !beforeAPI.deprecated)) {
          result.deprecated.push(api);
        }
        if (!api.deprecated && beforeAPI?.deprecated) {
          result.undeprecated.push(api);
        }
      }
    }

    return result;
  }

  /**
   * Extract schema changes from repository change
   */
  private async extractSchemaChanges(
    change: RepositoryChange,
    fileContents?: FileContentChange[]
  ): Promise<SchemaComparison> {
    const result: SchemaComparison = {
      added: [],
      removed: [],
      modified: [],
      isCompatible: true,
      migrationRequired: false,
    };

    const files = fileContents || this.createFileChangesFromPaths(change.changedPaths || []);

    for (const file of files) {
      if (this.shouldIgnoreFile(file.path)) continue;
      if (!this.isSchemaFile(file.path)) continue;

      const beforeSchema = this.parseSchema(file.before || '', file.path);
      const afterSchema = this.parseSchema(file.after || '', file.path);

      // Compare schemas
      const comparison = this.compareSchemas(beforeSchema, afterSchema);
      
      result.added.push(...comparison.added);
      result.removed.push(...comparison.removed);
      result.modified.push(...comparison.modified);
      
      if (!comparison.isCompatible) {
        result.isCompatible = false;
      }
      if (comparison.migrationRequired) {
        result.migrationRequired = true;
      }
    }

    return result;
  }

  /**
   * Detect behavioral changes that might not be visible in signatures
   */
  private async detectBehavioralChanges(
    change: RepositoryChange,
    fileContents?: FileContentChange[]
  ): Promise<BehavioralChange[]> {
    const changes: BehavioralChange[] = [];
    const files = fileContents || this.createFileChangesFromPaths(change.changedPaths || []);

    for (const file of files) {
      if (this.shouldIgnoreFile(file.path)) continue;

      // Look for specific behavioral patterns
      const errorHandlingChanges = this.detectErrorHandlingChanges(
        file.before || '',
        file.after || ''
      );
      if (errorHandlingChanges.length > 0) {
        changes.push(...errorHandlingChanges.map(c => ({
          ...c,
          file: file.path,
        })));
      }

      // Detect timeout/retry changes
      const timeoutChanges = this.detectTimeoutChanges(
        file.before || '',
        file.after || ''
      );
      if (timeoutChanges.length > 0) {
        changes.push(...timeoutChanges.map(c => ({
          ...c,
          file: file.path,
        })));
      }

      // Detect authentication changes
      const authChanges = this.detectAuthenticationChanges(
        file.before || '',
        file.after || ''
      );
      if (authChanges.length > 0) {
        changes.push(...authChanges.map(c => ({
          ...c,
          file: file.path,
        })));
      }
    }

    return changes;
  }

  /**
   * Convert analysis results to standard BreakingChange format
   */
  private convertToBreakingChanges(
    apiChanges: APISurfaceComparison,
    schemaComparison: SchemaComparison,
    behavioralChanges: BehavioralChange[]
  ): BreakingChange[] {
    const breakingChanges: BreakingChange[] = [];

    // API removals are always breaking
    for (const removed of apiChanges.removed) {
      breakingChanges.push({
        changeId: this.generateChangeId(),
        description: `API '${removed.name}' has been removed`,
        location: removed.path,
        severity: 'critical',
        migrationPath: this.suggestMigrationForRemovedAPI(removed),
      });
    }

    // Modified APIs with breaking changes
    for (const modified of apiChanges.modified.filter(m => m.isBreaking)) {
      for (const change of modified.changes.filter(c => c.isBreaking)) {
        breakingChanges.push({
          changeId: this.generateChangeId(),
          description: `API '${modified.after.name}': ${change.reason || change.type}`,
          location: modified.after.path,
          severity: this.assessChangeSeverity(change),
          migrationPath: this.suggestMigrationForModifiedAPI(modified, change),
        });
      }
    }

    // Schema breaking changes
    for (const fieldMod of schemaComparison.modified.filter(m => m.isBreaking)) {
      breakingChanges.push({
        changeId: this.generateChangeId(),
        description: `Schema field '${fieldMod.field}': ${fieldMod.reason}`,
        severity: 'high',
        migrationPath: this.suggestMigrationForSchemaChange(fieldMod),
      });
    }

    // Removed schema fields
    for (const removed of schemaComparison.removed) {
      breakingChanges.push({
        changeId: this.generateChangeId(),
        description: `Schema field '${removed.name}' has been removed`,
        severity: 'high',
        migrationPath: 'Remove references to this field in adapters',
      });
    }

    // Behavioral changes that could be breaking
    for (const behavioral of behavioralChanges.filter(b => b.isPotentiallyBreaking)) {
      breakingChanges.push({
        changeId: this.generateChangeId(),
        description: behavioral.description,
        location: behavioral.file,
        severity: 'medium',
        migrationPath: behavioral.suggestedAction,
      });
    }

    return breakingChanges;
  }

  /**
   * Convert to standard Addition format
   */
  private convertToAdditions(
    apiChanges: APISurfaceComparison,
    schemaComparison: SchemaComparison
  ): Addition[] {
    const additions: Addition[] = [];

    for (const api of apiChanges.added) {
      additions.push({
        additionId: this.generateChangeId(),
        description: `New API '${api.name}' added`,
        type: 'api',
        location: api.path,
        optional: true,
      });
    }

    for (const field of schemaComparison.added) {
      additions.push({
        additionId: this.generateChangeId(),
        description: `New schema field '${field.name}' added`,
        type: 'other',
        optional: field.nullable || false,
      });
    }

    return additions;
  }

  /**
   * Convert to standard Deprecation format
   */
  private convertToDeprecations(apiChanges: APISurfaceComparison): Deprecation[] {
    return apiChanges.deprecated.map(api => ({
      deprecationId: this.generateChangeId(),
      description: `API '${api.name}' is deprecated`,
      since: api.version || 'unknown',
      replacement: api.deprecationMessage,
    }));
  }

  /**
   * Convert to standard Removal format
   */
  private convertToRemovals(
    apiChanges: APISurfaceComparison,
    schemaComparison: SchemaComparison
  ): Removal[] {
    const removals: Removal[] = [];

    for (const api of apiChanges.removed) {
      removals.push({
        removalId: this.generateChangeId(),
        description: `API '${api.name}' removed`,
        removedInVersion: api.version || 'current',
      });
    }

    for (const field of schemaComparison.removed) {
      removals.push({
        removalId: this.generateChangeId(),
        description: `Schema field '${field.name}' removed`,
        removedInVersion: 'current',
      });
    }

    return removals;
  }

  /**
   * Convert to standard APIChange format
   */
  private convertToAPIChanges(apiChanges: APISurfaceComparison): APIChange[] {
    const changes: APIChange[] = [];

    for (const api of apiChanges.added) {
      changes.push({
        changeId: this.generateChangeId(),
        type: 'added',
        element: api.name,
        kind: 'method',
        after: this.formatAPISignature(api),
        breaking: false,
      });
    }

    for (const api of apiChanges.removed) {
      changes.push({
        changeId: this.generateChangeId(),
        type: 'removed',
        element: api.name,
        kind: 'method',
        before: this.formatAPISignature(api),
        breaking: true,
      });
    }

    for (const modified of apiChanges.modified) {
      changes.push({
        changeId: this.generateChangeId(),
        type: 'modified',
        element: modified.after.name,
        kind: 'method',
        before: this.formatAPISignature(modified.before),
        after: this.formatAPISignature(modified.after),
        breaking: modified.isBreaking,
      });
    }

    for (const api of apiChanges.deprecated) {
      changes.push({
        changeId: this.generateChangeId(),
        type: 'deprecated',
        element: api.name,
        kind: 'method',
        after: this.formatAPISignature(api),
        breaking: false,
      });
    }

    return changes;
  }

  /**
   * Convert to standard SchemaChange format
   */
  private convertToSchemaChanges(schemaComparison: SchemaComparison): SchemaChange[] {
    const changes: SchemaChange[] = [];

    for (const field of schemaComparison.added) {
      changes.push({
        changeId: this.generateChangeId(),
        schemaName: 'schema',
        type: 'field-added',
        fieldPath: field.name,
        after: field.type,
      });
    }

    for (const field of schemaComparison.removed) {
      changes.push({
        changeId: this.generateChangeId(),
        schemaName: 'schema',
        type: 'field-removed',
        fieldPath: field.name,
        before: field.type,
      });
    }

    for (const mod of schemaComparison.modified) {
      changes.push({
        changeId: this.generateChangeId(),
        schemaName: 'schema',
        type: mod.before.type !== mod.after.type ? 'type-changed' : 'field-modified',
        fieldPath: mod.field,
        before: mod.before.type,
        after: mod.after.type,
        migration: mod.reason,
      });
    }

    return changes;
  }

  /**
   * Format API signature as string
   */
  private formatAPISignature(api: APISignature): string {
    const params = api.parameters.map(p => `${p.name}: ${p.type}`).join(', ');
    return `${api.name}(${params})${api.returnType ? `: ${api.returnType}` : ''}`;
  }

  /**
   * Calculate overall impact level
   */
  private calculateImpactLevel(
    breakingChanges: BreakingChange[],
    _change: RepositoryChange
  ): ImpactLevel {
    if (breakingChanges.length === 0) return 'none';
    
    const criticalCount = breakingChanges.filter(bc => bc.severity === 'critical').length;
    const highCount = breakingChanges.filter(bc => bc.severity === 'high').length;

    if (criticalCount > 2 || highCount > 5) return 'critical';
    if (criticalCount > 0 || highCount > 2) return 'significant';
    if (highCount > 0) return 'moderate';
    return 'minimal';
  }

  /**
   * Calculate overall impact score (0-1)
   */
  private calculateImpactScore(
    breakingChanges: BreakingChange[],
    change: RepositoryChange
  ): number {
    if (breakingChanges.length === 0) return 0;

    // Weight by severity
    const severityWeights: Record<PatternSeverity, number> = {
      critical: 1.0,
      high: 0.7,
      medium: 0.4,
      low: 0.1,
      info: 0.0,
    };

    const weightedSum = breakingChanges.reduce((sum, bc) => {
      return sum + severityWeights[bc.severity];
    }, 0);

    // Normalize to 0-1 range
    const maxPossible = breakingChanges.length * 1.0;
    const normalized = weightedSum / maxPossible;

    // Factor in change scope
    const changedPathsCount = change.changedPaths?.length || 0;
    const scopeMultiplier = Math.min(1.5, 1 + (changedPathsCount / 20));

    return Math.min(1.0, normalized * scopeMultiplier);
  }

  /**
   * Generate human-readable summary
   */
  private generateSummary(
    apiChanges: APISurfaceComparison,
    schemaComparison: SchemaComparison,
    breakingChanges: BreakingChange[]
  ): string {
    const parts: string[] = [];

    if (apiChanges.added.length > 0) {
      parts.push(`${apiChanges.added.length} new API(s) added`);
    }
    if (apiChanges.removed.length > 0) {
      parts.push(`${apiChanges.removed.length} API(s) removed`);
    }
    if (apiChanges.modified.length > 0) {
      parts.push(`${apiChanges.modified.length} API(s) modified`);
    }
    if (apiChanges.deprecated.length > 0) {
      parts.push(`${apiChanges.deprecated.length} API(s) deprecated`);
    }

    if (schemaComparison.added.length > 0) {
      parts.push(`${schemaComparison.added.length} schema field(s) added`);
    }
    if (schemaComparison.removed.length > 0) {
      parts.push(`${schemaComparison.removed.length} schema field(s) removed`);
    }

    const criticalCount = breakingChanges.filter(bc => bc.severity === 'critical').length;
    const highCount = breakingChanges.filter(bc => bc.severity === 'high').length;

    if (criticalCount > 0 || highCount > 0) {
      parts.push(`⚠️ ${criticalCount} critical, ${highCount} high severity breaking changes`);
    }

    return parts.length > 0 
      ? parts.join('; ') 
      : 'No significant changes detected';
  }

  /**
   * Identify which adapters are affected by the changes
   */
  private identifyAffectedAdapters(
    change: RepositoryChange,
    _breakingChanges: BreakingChange[]
  ): string[] {
    // Map repository to adapter
    const repoToAdapter: Record<string, string[]> = {
      'anthropics/anthropic-sdk-npm': ['mcp'],
      'modelcontextprotocol/typescript-sdk': ['mcp'],
      'google/a2a-sdk': ['a2a'],
      'agent-network-protocol/anp-sdk': ['anp'],
      'langchain-ai/langchainjs': ['langchain'],
      'microsoft/semantic-kernel': ['semantic-kernel'],
      'openai/openai-node': ['openai', 'openai-agents'],
    };

    const affected = new Set<string>();
    
    // Check repository mapping
    const directlyAffected = repoToAdapter[change.repositoryId] || [];
    directlyAffected.forEach(a => affected.add(a));

    return Array.from(affected);
  }

  /**
   * Generate recommended actions based on breaking changes
   */
  private generateRecommendedActions(breakingChanges: BreakingChange[]): string[] {
    const actions: string[] = [];

    if (breakingChanges.length === 0) {
      actions.push('No immediate action required');
      return actions;
    }

    const critical = breakingChanges.filter(bc => bc.severity === 'critical');
    const high = breakingChanges.filter(bc => bc.severity === 'high');

    if (critical.length > 0) {
      actions.push(`URGENT: Address ${critical.length} critical breaking change(s) immediately`);
      critical.forEach(bc => {
        actions.push(`  - ${bc.description}: ${bc.migrationPath}`);
      });
    }

    if (high.length > 0) {
      actions.push(`HIGH PRIORITY: Address ${high.length} high-severity change(s)`);
    }

    return actions;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private createFileChangesFromPaths(paths: string[]): FileContentChange[] {
    // Create placeholder file changes from paths
    // In real implementation, would fetch content from repository
    return paths.map(path => ({
      path,
      before: undefined,
      after: undefined,
    }));
  }

  private shouldIgnoreFile(path: string): boolean {
    return this.config.ignorePatterns.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(path);
    });
  }

  private isAPIRelatedFile(path: string): boolean {
    const apiPatterns = [
      /\.ts$/,
      /\.js$/,
      /\.py$/,
      /openapi\./,
      /swagger\./,
      /api\./,
      /schema\./,
    ];
    return apiPatterns.some(p => p.test(path));
  }

  private isSchemaFile(path: string): boolean {
    const schemaPatterns = [
      /schema\.json$/,
      /schema\.yaml$/,
      /\.schema\./,
      /types\.ts$/,
      /models\.ts$/,
      /\.proto$/,
    ];
    return schemaPatterns.some(p => p.test(path));
  }

  private parseAPIsFromContent(content: string, filePath: string): APISignature[] {
    const apis: APISignature[] = [];

    // Parse TypeScript/JavaScript function exports
    const exportFunctionRegex = /export\s+(async\s+)?function\s+(\w+)\s*(<[^>]+>)?\s*\(([^)]*)\)\s*:\s*([^{;]+)/g;
    let match;
    while ((match = exportFunctionRegex.exec(content)) !== null) {
      const [, , name, , params, returnType] = match;
      apis.push({
        name,
        parameters: this.parseParameters(params),
        returnType: returnType.trim(),
      });
    }

    // Parse class methods
    const methodRegex = /(?:public|async|static|\s)+(\w+)\s*(<[^>]+>)?\s*\(([^)]*)\)\s*:\s*([^{;]+)/g;
    while ((match = methodRegex.exec(content)) !== null) {
      const [, name, , params, returnType] = match;
      if (!['constructor', 'if', 'for', 'while', 'switch'].includes(name)) {
        apis.push({
          name,
          parameters: this.parseParameters(params),
          returnType: returnType.trim(),
        });
      }
    }

    // Parse OpenAPI paths if JSON/YAML
    if (filePath.includes('openapi') || filePath.includes('swagger')) {
      try {
        const spec = JSON.parse(content);
        if (spec.paths) {
          for (const [path, methods] of Object.entries(spec.paths)) {
            for (const [method, def] of Object.entries(methods as Record<string, unknown>)) {
              const definition = def as { operationId?: string; parameters?: unknown[]; deprecated?: boolean };
              if (definition.operationId) {
                apis.push({
                  name: definition.operationId,
                  path,
                  method: method.toUpperCase(),
                  parameters: this.parseOpenAPIParameters(definition.parameters || []),
                  deprecated: definition.deprecated,
                });
              }
            }
          }
        }
      } catch {
        // Not valid JSON, skip
      }
    }

    return apis;
  }

  private parseParameters(paramString: string): ParameterSignature[] {
    if (!paramString.trim()) return [];

    const params: ParameterSignature[] = [];
    const paramParts = paramString.split(',');

    for (const part of paramParts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // Handle TypeScript parameter syntax: name: Type = default
      const match = trimmed.match(/(\w+)\??:\s*([^=]+)(?:=\s*(.+))?/);
      if (match) {
        const [, name, type, defaultValue] = match;
        params.push({
          name,
          type: type.trim(),
          required: !trimmed.includes('?'),
          default: defaultValue?.trim(),
        });
      }
    }

    return params;
  }

  private parseOpenAPIParameters(params: unknown[]): ParameterSignature[] {
    return params.map((p: unknown) => {
      const param = p as { name: string; schema?: { type: string }; required?: boolean; default?: unknown };
      return {
        name: param.name,
        type: param.schema?.type || 'unknown',
        required: param.required || false,
        default: param.default,
      };
    });
  }

  private parseSchema(content: string, filePath: string): SchemaDefinition {
    const schema: SchemaDefinition = {
      name: filePath,
      version: '1.0.0',
      fields: [],
      required: [],
    };

    // Parse JSON Schema
    if (filePath.endsWith('.json')) {
      try {
        const parsed = JSON.parse(content);
        if (parsed.properties) {
          schema.fields = this.extractSchemaFields(parsed.properties);
          schema.required = parsed.required || [];
        }
      } catch {
        // Invalid JSON
      }
    }

    // Parse TypeScript interfaces
    const interfaceRegex = /interface\s+(\w+)\s*{([^}]+)}/g;
    let match;
    while ((match = interfaceRegex.exec(content)) !== null) {
      const [, name, body] = match;
      schema.name = name;
      schema.fields.push(...this.parseTypeScriptFields(body));
    }

    return schema;
  }

  private extractSchemaFields(properties: Record<string, unknown>): SchemaField[] {
    return Object.entries(properties).map(([name, def]) => {
      const definition = def as { type?: string; nullable?: boolean; enum?: string[] };
      return {
        name,
        type: definition.type || 'unknown',
        nullable: definition.nullable,
        enum: definition.enum,
      };
    });
  }

  private parseTypeScriptFields(body: string): SchemaField[] {
    const fields: SchemaField[] = [];
    const fieldRegex = /(\w+)\??:\s*([^;]+);/g;
    let match;
    while ((match = fieldRegex.exec(body)) !== null) {
      const [fullMatch, name, type] = match;
      fields.push({
        name,
        type: type.trim(),
        nullable: fullMatch.includes('?'),
      });
    }
    return fields;
  }

  private apiSignaturesMatch(a: APISignature, b: APISignature): boolean {
    // Match by name and path/method for REST APIs
    if (a.path && b.path) {
      return a.path === b.path && a.method === b.method;
    }
    return a.name === b.name;
  }

  private apiSignaturesEqual(a: APISignature, b: APISignature): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  private compareAPISignatures(before: APISignature, after: APISignature): APIChangeDetail[] {
    const changes: APIChangeDetail[] = [];

    // Check parameters
    const beforeParams = new Map(before.parameters.map(p => [p.name, p]));
    const afterParams = new Map(after.parameters.map(p => [p.name, p]));

    // Added parameters
    afterParams.forEach((param, name) => {
      if (!beforeParams.has(name)) {
        changes.push({
          type: 'parameter_added',
          field: name,
          after: param,
          isBreaking: param.required && param.default === undefined,
          reason: param.required
            ? `Required parameter '${name}' added without default`
            : `Optional parameter '${name}' added`,
        });
      }
    });

    // Removed parameters
    beforeParams.forEach((param, name) => {
      if (!afterParams.has(name)) {
        changes.push({
          type: 'parameter_removed',
          field: name,
          before: param,
          isBreaking: true,
          reason: `Parameter '${name}' removed`,
        });
      }
    });

    // Modified parameters
    beforeParams.forEach((beforeParam, name) => {
      const afterParam = afterParams.get(name);
      if (afterParam) {
        if (beforeParam.type !== afterParam.type) {
          changes.push({
            type: 'parameter_type_changed',
            field: name,
            before: beforeParam.type,
            after: afterParam.type,
            isBreaking: true,
            reason: `Parameter '${name}' type changed from ${beforeParam.type} to ${afterParam.type}`,
          });
        }
        if (beforeParam.required !== afterParam.required) {
          changes.push({
            type: 'required_changed',
            field: name,
            before: beforeParam.required,
            after: afterParam.required,
            isBreaking: !beforeParam.required && afterParam.required,
            reason: afterParam.required
              ? `Parameter '${name}' became required`
              : `Parameter '${name}' became optional`,
          });
        }
      }
    });

    // Return type change
    if (before.returnType !== after.returnType) {
      changes.push({
        type: 'return_type_changed',
        field: 'returnType',
        before: before.returnType,
        after: after.returnType,
        isBreaking: true,
        reason: `Return type changed from ${before.returnType} to ${after.returnType}`,
      });
    }

    return changes;
  }

  private compareSchemas(before: SchemaDefinition, after: SchemaDefinition): SchemaComparison {
    const result: SchemaComparison = {
      added: [],
      removed: [],
      modified: [],
      isCompatible: true,
      migrationRequired: false,
    };

    const beforeFields = new Map(before.fields.map(f => [f.name, f]));
    const afterFields = new Map(after.fields.map(f => [f.name, f]));

    // Added fields
    afterFields.forEach((field, name) => {
      if (!beforeFields.has(name)) {
        result.added.push(field);
        if (after.required.includes(name)) {
          result.isCompatible = false;
          result.migrationRequired = true;
        }
      }
    });

    // Removed fields
    beforeFields.forEach((field, name) => {
      if (!afterFields.has(name)) {
        result.removed.push(field);
        result.isCompatible = false;
        result.migrationRequired = true;
      }
    });

    // Modified fields
    beforeFields.forEach((beforeField, name) => {
      const afterField = afterFields.get(name);
      if (afterField && JSON.stringify(beforeField) !== JSON.stringify(afterField)) {
        const isBreaking = beforeField.type !== afterField.type;
        result.modified.push({
          field: name,
          before: beforeField,
          after: afterField,
          isBreaking,
          reason: isBreaking
            ? `Type changed from ${beforeField.type} to ${afterField.type}`
            : 'Field properties modified',
        });
        if (isBreaking) {
          result.isCompatible = false;
          result.migrationRequired = true;
        }
      }
    });

    return result;
  }

  private detectErrorHandlingChanges(before: string, after: string): BehavioralChange[] {
    const changes: BehavioralChange[] = [];

    // Detect try-catch pattern changes
    const beforeCatches = (before.match(/catch\s*\(/g) || []).length;
    const afterCatches = (after.match(/catch\s*\(/g) || []).length;

    if (beforeCatches !== afterCatches) {
      changes.push({
        type: 'error_handling',
        description: `Error handling changed: ${beforeCatches} → ${afterCatches} catch blocks`,
        file: '',
        isPotentiallyBreaking: afterCatches < beforeCatches,
        confidence: 0.6,
        suggestedAction: 'Review error handling changes for compatibility',
      });
    }

    return changes;
  }

  private detectTimeoutChanges(before: string, after: string): BehavioralChange[] {
    const changes: BehavioralChange[] = [];

    // Detect timeout value changes
    const timeoutRegex = /timeout[:\s=]+(\d+)/gi;
    const beforeTimeouts: number[] = [];
    const afterTimeouts: number[] = [];
    
    let match;
    while ((match = timeoutRegex.exec(before)) !== null) {
      beforeTimeouts.push(parseInt(match[1]));
    }
    timeoutRegex.lastIndex = 0; // Reset regex state
    while ((match = timeoutRegex.exec(after)) !== null) {
      afterTimeouts.push(parseInt(match[1]));
    }

    if (beforeTimeouts.length > 0 && afterTimeouts.length > 0) {
      const avgBefore = beforeTimeouts.reduce((a, b) => a + b, 0) / beforeTimeouts.length;
      const avgAfter = afterTimeouts.reduce((a, b) => a + b, 0) / afterTimeouts.length;

      if (Math.abs(avgBefore - avgAfter) > avgBefore * 0.2) {
        changes.push({
          type: 'timeout',
          description: `Timeout values changed significantly: avg ${avgBefore}ms → ${avgAfter}ms`,
          file: '',
          isPotentiallyBreaking: avgAfter < avgBefore,
          confidence: 0.5,
          suggestedAction: 'Review timeout changes and adjust adapter timeouts accordingly',
        });
      }
    }

    return changes;
  }

  private detectAuthenticationChanges(before: string, after: string): BehavioralChange[] {
    const changes: BehavioralChange[] = [];

    // Look for auth-related patterns
    const authPatterns = [
      /bearer/i,
      /api[_-]?key/i,
      /authorization/i,
      /oauth/i,
      /jwt/i,
    ];

    const beforeAuthCount = authPatterns.reduce(
      (count, pattern) => count + (pattern.test(before) ? 1 : 0),
      0
    );
    const afterAuthCount = authPatterns.reduce(
      (count, pattern) => count + (pattern.test(after) ? 1 : 0),
      0
    );

    if (afterAuthCount > beforeAuthCount) {
      changes.push({
        type: 'authentication',
        description: 'New authentication mechanisms detected',
        file: '',
        isPotentiallyBreaking: true,
        confidence: 0.7,
        suggestedAction: 'Update adapter authentication to support new mechanisms',
      });
    }

    return changes;
  }

  private assessChangeSeverity(change: APIChangeDetail): PatternSeverity {
    if (change.type === 'return_type_changed') return 'critical';
    if (change.type === 'parameter_removed') return 'high';
    if (change.type === 'parameter_type_changed') return 'high';
    if (change.type === 'required_changed' && change.isBreaking) return 'high';
    if (change.type === 'parameter_added' && change.isBreaking) return 'medium';
    return 'low';
  }

  private suggestMigrationForRemovedAPI(api: APISignature): string {
    return `Find replacement API for '${api.name}' in updated documentation`;
  }

  private suggestMigrationForModifiedAPI(mod: APIModification, change: APIChangeDetail): string {
    switch (change.type) {
      case 'parameter_removed':
        return `Remove '${change.field}' parameter from calls to '${mod.after.name}'`;
      case 'parameter_type_changed':
        return `Update '${change.field}' type from ${change.before} to ${change.after}`;
      case 'return_type_changed':
        return `Update handling of '${mod.after.name}' return value to match new type ${change.after}`;
      case 'required_changed':
        return `Ensure '${change.field}' parameter is always provided to '${mod.after.name}'`;
      default:
        return `Update '${mod.after.name}' call to match new signature`;
    }
  }

  private suggestMigrationForSchemaChange(mod: FieldModification): string {
    return `Update '${mod.field}' field handling: ${mod.reason}`;
  }

  /**
   * Register known APIs for a protocol for comparison
   */
  registerKnownAPIs(protocol: AgentFramework, apis: APISignature[]): void {
    this.knownAPIs.set(protocol, apis);
  }

  /**
   * Register known schemas for a protocol
   */
  registerKnownSchemas(protocol: AgentFramework, schemas: SchemaDefinition[]): void {
    this.knownSchemas.set(protocol, schemas);
  }
}

// ============================================================================
// Factory and Utilities
// ============================================================================

/**
 * Create a pre-configured semantic diff analyzer
 */
export function createSemanticDiffAnalyzer(
  config?: Partial<SemanticDiffConfig>
): SemanticDiffAnalyzer {
  return new SemanticDiffAnalyzer(config);
}

/**
 * Quick analysis utility
 */
export async function analyzeRepositoryChange(
  change: RepositoryChange,
  fileContents?: FileContentChange[],
  config?: Partial<SemanticDiffConfig>
): Promise<ExtendedAnalysisResult> {
  const analyzer = createSemanticDiffAnalyzer(config);
  return analyzer.analyzeChange(change, fileContents);
}
