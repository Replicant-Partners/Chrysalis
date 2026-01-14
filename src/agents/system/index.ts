/**
 * System Agents Module
 *
 * This module provides the runtime integration for the System Agents Layer (Horizontal 2).
 * It bridges the JSON persona configurations to the TypeScript chat pane system.
 *
 * @module agents/system
 *
 * Architecture:
 * - SystemAgentLoader: Loads persona configs and instantiates bindings
 * - MentionParser: Parses @-mentions in user messages for routing
 * - EvaluationCoordinator: Orchestrates multi-agent evaluation pipeline
 * - ForecastTracker: Brier score calibration for Phil
 * - ConflictResolver: Conflict detection and resolution
 *
 * Pipeline Flow (DAG):
 *   Ada (Pattern) ─┬─► Lea (Implementation) ─┬─► Phil (Forecast) ─┬─► David (Meta)
 *                  │                         │                    │
 *                  └─────────────────────────┴────────────────────┘
 *
 * Theoretical Foundations:
 * - Delphi Method: Iterative expert consensus
 * - Tetlock Superforecasting: Brier scores, calibration
 * - Dunning-Kruger: Metacognitive bias detection
 */

// Types
export * from './types';

// Core components
export { SystemAgentLoader, getSystemAgentLoader, loadSystemAgents, getSystemAgent, resetSystemAgentLoader } from './SystemAgentLoader';
export { MentionParser, getMentionParser, parseMessage, hasMentions, extractPersonaFromMention, resetMentionParser } from './MentionParser';
export {
  EvaluationCoordinator,
  CONFLICT_THRESHOLDS,
  ESCALATION_RISK_BOUNDARIES,
} from './EvaluationCoordinator';
export {
  PromptTemplateLoader,
  createPromptTemplateLoader,
  DEFAULT_TEMPLATES,
} from './PromptTemplateLoader';
export {
  WebSocketService,
  createWebSocketService,
  MockWebSocketServer,
  WS_DEFAULT_CONFIG,
} from './WebSocketService';

// Extracted modules (SRP refactoring)
export {
  ForecastTracker,
  createForecastTracker,
  DEFAULT_BRIER_SCORE,
} from './ForecastTracker';
export {
  ConflictResolver,
  createConflictResolver,
} from './ConflictResolver';

// Types from EvaluationCoordinator (backwards compatibility)
export type {
  PersonaOutput,
  ForecastRecord,
  EvaluationContext,
  CalibrationStats,
} from './EvaluationCoordinator';

// Types from extracted modules
export type { DetectedConflict, ConflictResolutionResult } from './ConflictResolver';
