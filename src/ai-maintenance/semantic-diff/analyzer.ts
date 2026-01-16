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
} from '../types';
import { AgentFramework } from '../../adapters/protocol-types';

import type {
  APISignature,
  SchemaDefinition,
  APISurfaceComparison,
  APIModification,
  APIChangeDetail,
  SchemaComparison,
  FieldModification,
  SemanticDiffConfig,
  BehavioralChange,
  FileContentChange,
  ExtendedAnalysisResult,
} from './types';

import {
  parseAPIsFromContent,
  parseSchema,
  createFileChangesFromPaths,
  shouldIgnoreFile,
  isAPIRelatedFile,
  isSchemaFile,
  getDefaultConfig,
} from './parsers';

import {
  apiSignaturesMatch,
  apiSignaturesEqual,
  compareAPISignatures,
  compareSchemas,
} from './comparators';

import {
  detectErrorHandlingChanges,
  detectTimeoutChanges,
  detectAuthenticationChanges,
} from './behavioral-detectors';

/**
 * Analyzes changes semantically to understand their impact on adapters
 */
export class SemanticDiffAnalyzer {
  private config: SemanticDiffConfig;
  private knownAPIs: Map<AgentFramework, APISignature[]> = new Map();
  private knownSchemas: Map<AgentFramework, SchemaDefinition[]> = new Map();
  private changeIdCounter = 0;

  constructor(config: Partial<SemanticDiffConfig> = {}) {
    this.config = getDefaultConfig(config);
  }

  private generateChangeId(): string {
    return `change-${Date.now()}-${++this.changeIdCounter}`;
  }

  async analyzeChange(
    change: RepositoryChange,
    fileContents?: FileContentChange[]
  ): Promise<ExtendedAnalysisResult> {
    const startTime = Date.now();

    const apiChanges = await this.extractAPIChanges(change, fileContents);
    const schemaComparison = await this.extractSchemaChanges(change, fileContents);
    const behavioralChanges = this.config.detectBehavioralChanges
      ? await this.detectBehavioralChanges(change, fileContents)
      : [];

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

    const impactLevel = this.calculateImpactLevel(breakingChanges, change);
    const impactScore = this.calculateImpactScore(breakingChanges, change);

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

    const files = fileContents || createFileChangesFromPaths(change.changedPaths || []);

    for (const file of files) {
      if (shouldIgnoreFile(file.path, this.config.ignorePatterns)) continue;
      if (!isAPIRelatedFile(file.path)) continue;

      const beforeAPIs = parseAPIsFromContent(file.before || '', file.path);
      const afterAPIs = parseAPIsFromContent(file.after || '', file.path);

      for (const api of afterAPIs) {
        const existing = beforeAPIs.find((b) => apiSignaturesMatch(b, api));
        if (!existing) {
          result.added.push(api);
        }
      }

      for (const api of beforeAPIs) {
        const stillExists = afterAPIs.find((a) => apiSignaturesMatch(a, api));
        if (!stillExists) {
          result.removed.push(api);
        }
      }

      for (const beforeAPI of beforeAPIs) {
        const afterAPI = afterAPIs.find((a) => a.name === beforeAPI.name);
        if (afterAPI && !apiSignaturesEqual(beforeAPI, afterAPI)) {
          const changes = compareAPISignatures(beforeAPI, afterAPI);
          result.modified.push({
            before: beforeAPI,
            after: afterAPI,
            changes,
            isBreaking: changes.some((c) => c.isBreaking),
          });
        }
      }

      for (const api of afterAPIs) {
        const beforeAPI = beforeAPIs.find((b) => b.name === api.name);
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

    const files = fileContents || createFileChangesFromPaths(change.changedPaths || []);

    for (const file of files) {
      if (shouldIgnoreFile(file.path, this.config.ignorePatterns)) continue;
      if (!isSchemaFile(file.path)) continue;

      const beforeSchema = parseSchema(file.before || '', file.path);
      const afterSchema = parseSchema(file.after || '', file.path);

      const comparison = compareSchemas(beforeSchema, afterSchema);

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

  private async detectBehavioralChanges(
    change: RepositoryChange,
    fileContents?: FileContentChange[]
  ): Promise<BehavioralChange[]> {
    const changes: BehavioralChange[] = [];
    const files = fileContents || createFileChangesFromPaths(change.changedPaths || []);

    for (const file of files) {
      if (shouldIgnoreFile(file.path, this.config.ignorePatterns)) continue;

      const errorHandlingChanges = detectErrorHandlingChanges(file.before || '', file.after || '');
      if (errorHandlingChanges.length > 0) {
        changes.push(
          ...errorHandlingChanges.map((c) => ({
            ...c,
            file: file.path,
          }))
        );
      }

      const timeoutChanges = detectTimeoutChanges(file.before || '', file.after || '');
      if (timeoutChanges.length > 0) {
        changes.push(
          ...timeoutChanges.map((c) => ({
            ...c,
            file: file.path,
          }))
        );
      }

      const authChanges = detectAuthenticationChanges(file.before || '', file.after || '');
      if (authChanges.length > 0) {
        changes.push(
          ...authChanges.map((c) => ({
            ...c,
            file: file.path,
          }))
        );
      }
    }

    return changes;
  }

  private convertToBreakingChanges(
    apiChanges: APISurfaceComparison,
    schemaComparison: SchemaComparison,
    behavioralChanges: BehavioralChange[]
  ): BreakingChange[] {
    const breakingChanges: BreakingChange[] = [];

    for (const removed of apiChanges.removed) {
      breakingChanges.push({
        changeId: this.generateChangeId(),
        description: `API '${removed.name}' has been removed`,
        location: removed.path,
        severity: 'critical',
        migrationPath: this.suggestMigrationForRemovedAPI(removed),
      });
    }

    for (const modified of apiChanges.modified.filter((m) => m.isBreaking)) {
      for (const change of modified.changes.filter((c) => c.isBreaking)) {
        breakingChanges.push({
          changeId: this.generateChangeId(),
          description: `API '${modified.after.name}': ${change.reason || change.type}`,
          location: modified.after.path,
          severity: this.assessChangeSeverity(change),
          migrationPath: this.suggestMigrationForModifiedAPI(modified, change),
        });
      }
    }

    for (const fieldMod of schemaComparison.modified.filter((m) => m.isBreaking)) {
      breakingChanges.push({
        changeId: this.generateChangeId(),
        description: `Schema field '${fieldMod.field}': ${fieldMod.reason}`,
        severity: 'high',
        migrationPath: this.suggestMigrationForSchemaChange(fieldMod),
      });
    }

    for (const removed of schemaComparison.removed) {
      breakingChanges.push({
        changeId: this.generateChangeId(),
        description: `Schema field '${removed.name}' has been removed`,
        severity: 'high',
        migrationPath: 'Remove references to this field in adapters',
      });
    }

    for (const behavioral of behavioralChanges.filter((b) => b.isPotentiallyBreaking)) {
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

  private convertToDeprecations(apiChanges: APISurfaceComparison): Deprecation[] {
    return apiChanges.deprecated.map((api) => ({
      deprecationId: this.generateChangeId(),
      description: `API '${api.name}' is deprecated`,
      since: api.version || 'unknown',
      replacement: api.deprecationMessage,
    }));
  }

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

  private formatAPISignature(api: APISignature): string {
    const params = api.parameters.map((p) => `${p.name}: ${p.type}`).join(', ');
    return `${api.name}(${params})${api.returnType ? `: ${api.returnType}` : ''}`;
  }

  private calculateImpactLevel(
    breakingChanges: BreakingChange[],
    change: RepositoryChange
  ): ImpactLevel {
    // First check semver-based impact from version change
    const semverImpact = this.calculateSemverImpact(change);

    // Then check file-based breaking changes
    if (breakingChanges.length === 0 && semverImpact === 'none') return 'none';

    const criticalCount = breakingChanges.filter((bc) => bc.severity === 'critical').length;
    const highCount = breakingChanges.filter((bc) => bc.severity === 'high').length;

    // Combine breaking change severity with semver impact
    if (criticalCount > 2 || highCount > 5 || semverImpact === 'critical') return 'critical';
    if (criticalCount > 0 || highCount > 2 || semverImpact === 'significant') return 'significant';
    if (highCount > 0 || semverImpact === 'moderate') return 'moderate';
    if (breakingChanges.length > 0 || semverImpact === 'minimal') return 'minimal';
    return 'none';
  }

  /**
   * Calculate impact level based purely on semantic versioning rules.
   * Major version bumps and 0.x → 0.y changes are considered breaking.
   */
  private calculateSemverImpact(change: RepositoryChange): ImpactLevel {
    if (!change.previousVersion || !change.currentVersion) {
      return 'none';
    }

    const from = change.previousVersion;
    const to = change.currentVersion;

    // Parse version parts - handle both v-prefixed and non-prefixed versions
    const fromMatch = from.match(/^v?(\d+)\.(\d+)\.(\d+)/);
    const toMatch = to.match(/^v?(\d+)\.(\d+)\.(\d+)/);

    if (!fromMatch || !toMatch) {
      // Handle non-semver versions (e.g., "2024.11" → "2025.01")
      // These are typically significant as they're date-based releases
      const fromYear = parseInt(from.split('.')[0]);
      const toYear = parseInt(to.split('.')[0]);
      if (!isNaN(fromYear) && !isNaN(toYear) && toYear > fromYear) {
        return 'significant';
      }
      return 'none';
    }

    const [, fromMajor, fromMinor] = fromMatch.map(Number);
    const [, toMajor, toMinor] = toMatch.map(Number);

    // Major version change is always breaking
    if (toMajor > fromMajor) {
      return 'significant';
    }

    // For pre-1.0 packages (0.x), minor version changes are considered breaking
    // per semantic versioning convention
    if (fromMajor === 0 && toMajor === 0 && toMinor > fromMinor) {
      return 'significant';
    }

    // Minor version change in stable releases (1.x+) is typically additive
    if (toMinor > fromMinor) {
      return 'moderate';
    }

    // Patch version only
    return 'minimal';
  }

  private calculateImpactScore(
    breakingChanges: BreakingChange[],
    change: RepositoryChange
  ): number {
    if (breakingChanges.length === 0) return 0;

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

    const maxPossible = breakingChanges.length * 1.0;
    const normalized = weightedSum / maxPossible;

    const changedPathsCount = change.changedPaths?.length || 0;
    const scopeMultiplier = Math.min(1.5, 1 + changedPathsCount / 20);

    return Math.min(1.0, normalized * scopeMultiplier);
  }

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

    const criticalCount = breakingChanges.filter((bc) => bc.severity === 'critical').length;
    const highCount = breakingChanges.filter((bc) => bc.severity === 'high').length;

    if (criticalCount > 0 || highCount > 0) {
      parts.push(`⚠️ ${criticalCount} critical, ${highCount} high severity breaking changes`);
    }

    return parts.length > 0 ? parts.join('; ') : 'No significant changes detected';
  }

  private identifyAffectedAdapters(
    change: RepositoryChange,
    _breakingChanges: BreakingChange[]
  ): string[] {
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

    const directlyAffected = repoToAdapter[change.repositoryId] || [];
    directlyAffected.forEach((a) => affected.add(a));

    return Array.from(affected);
  }

  private generateRecommendedActions(breakingChanges: BreakingChange[]): string[] {
    const actions: string[] = [];

    if (breakingChanges.length === 0) {
      actions.push('No immediate action required');
      return actions;
    }

    const critical = breakingChanges.filter((bc) => bc.severity === 'critical');
    const high = breakingChanges.filter((bc) => bc.severity === 'high');

    if (critical.length > 0) {
      actions.push(`URGENT: Address ${critical.length} critical breaking change(s) immediately`);
      critical.forEach((bc) => {
        actions.push(`  - ${bc.description}: ${bc.migrationPath}`);
      });
    }

    if (high.length > 0) {
      actions.push(`HIGH PRIORITY: Address ${high.length} high-severity change(s)`);
    }

    return actions;
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

  registerKnownAPIs(protocol: AgentFramework, apis: APISignature[]): void {
    this.knownAPIs.set(protocol, apis);
  }

  registerKnownSchemas(protocol: AgentFramework, schemas: SchemaDefinition[]): void {
    this.knownSchemas.set(protocol, schemas);
  }
}

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
