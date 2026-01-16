/**
 * Evolutionary Pattern Registry
 *
 * Central registry for evolutionary patterns that detect and respond to
 * dependency updates, API changes, security vulnerabilities, schema migrations,
 * and other evolutionary events requiring adapter adaptation.
 *
 * The registry maintains an indexed collection of patterns, supports pattern
 * matching against change contexts, and provides weighted heuristic evaluation
 * to determine pattern applicability with confidence scores.
 *
 * @module ai-maintenance/patterns/registry
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
} from '../types';

import { PatternMatchContext } from './context';

import {
  PATTERN_EXTERNAL_DEPENDENCY_UPDATE,
  PATTERN_API_DEPRECATION_CASCADE,
  PATTERN_SCHEMA_MIGRATION,
  PATTERN_PROTOCOL_EXTENSION,
  PATTERN_SECURITY_VULNERABILITY_RESPONSE,
  PATTERN_PERFORMANCE_DEGRADATION
} from './definitions';

/**
 * Registry of known evolutionary patterns.
 */
export class EvolutionaryPatternRegistry {
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

    for (const heuristic of pattern.detectionHeuristics) {
      if (!heuristic.enabled) continue;

      totalWeight += heuristic.weight;
      const heuristicMatch = this.evaluateHeuristic(heuristic, context);

      if (heuristicMatch.matched) {
        matchedWeight += heuristic.weight;
        evidence.push(`${heuristic.name}: ${heuristicMatch.evidence}`);
      }
    }

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

  private isSemverBreakingChange(from: string, to: string): boolean {
    const fromParts = this.parseSemver(from);
    const toParts = this.parseSemver(to);

    if (!fromParts || !toParts) return false;

    // Major version change is always breaking
    if (toParts.major > fromParts.major) return true;

    // For pre-1.0 packages (0.x), minor version changes are considered breaking
    // per semantic versioning convention
    if (fromParts.major === 0 && toParts.major === 0 && toParts.minor > fromParts.minor) {
      return true;
    }

    return false;
  }

  private isSemverMinorChange(from: string, to: string): boolean {
    const fromParts = this.parseSemver(from);
    const toParts = this.parseSemver(to);

    if (!fromParts || !toParts) return false;

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
