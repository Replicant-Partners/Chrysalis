/**
 * AI-Led Adaptive Maintenance System - Evolutionary Patterns
 *
 * DEPRECATED: This file is now a facade re-exporting from the decomposed modules.
 * Import directly from './patterns' instead.
 *
 * @deprecated Import from './patterns' for new code
 * @module ai-maintenance/evolutionary-patterns
 * @version 2.0.0
 */

import {
  EvolutionaryPattern,
  PatternCategory,
  PatternMatch
} from './types';

// Re-export from patterns module
export { PatternMatchContext } from './patterns/context';
export {
  PATTERN_EXTERNAL_DEPENDENCY_UPDATE,
  PATTERN_API_DEPRECATION_CASCADE,
  PATTERN_SCHEMA_MIGRATION,
  PATTERN_PROTOCOL_EXTENSION,
  PATTERN_SECURITY_VULNERABILITY_RESPONSE,
  PATTERN_PERFORMANCE_DEGRADATION,
} from './patterns/definitions';
export { EvolutionaryPatternRegistry } from './patterns/registry';

// Re-export PatternMatchContext type for convenience
import { PatternMatchContext } from './patterns/context';
import { EvolutionaryPatternRegistry } from './patterns/registry';

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
