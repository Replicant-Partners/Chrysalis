/**
 * Evolutionary Patterns Module
 *
 * Barrel export file for the evolutionary patterns subsystem.
 * Provides pattern definitions, registry, and matching capabilities.
 *
 * @module ai-maintenance/patterns
 * @version 1.0.0
 */

// Context
export { PatternMatchContext } from './context';

// Definitions
export {
  PATTERN_EXTERNAL_DEPENDENCY_UPDATE,
  PATTERN_API_DEPRECATION_CASCADE,
  PATTERN_SCHEMA_MIGRATION,
  PATTERN_PROTOCOL_EXTENSION,
  PATTERN_SECURITY_VULNERABILITY_RESPONSE,
  PATTERN_PERFORMANCE_DEGRADATION,
} from './definitions';

// Registry
export { EvolutionaryPatternRegistry } from './registry';
