/**
 * Cross-cutting AI Adaptation Module
 *
 * Barrel export file for the cross-cutting AI adaptation subsystem.
 * This module provides pattern detection, change propagation, and
 * self-modification capabilities for the adapter ecosystem.
 *
 * @module ai-maintenance/cross-cutting
 * @version 1.0.0
 */

// Types
export * from './types';

// Pattern Detection
export { PatternDetectionInstrumentor } from './pattern-detection-instrumentor';
export type { PatternDetection, PatternDetectionConfig } from './pattern-detection-instrumentor';

// Change Propagation
export { ChangePropagationSystem } from './change-propagation-system';

// Self-Modification
export { SelfModificationInterface } from './self-modification-interface';
export type { ModificationExecution } from './self-modification-interface';

// Controller and Global Instances
export {
  CrossCuttingController,
  crossCuttingController,
  patternDetectionInstrumentor,
  changePropagationSystem,
  selfModificationInterface,
} from './cross-cutting-controller';

// Default export for convenience
export { default } from './cross-cutting-controller';
