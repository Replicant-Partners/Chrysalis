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

// SCM Components (Pattern 12: SHARED CONVERSATION MIDDLEWARE)
export {
  SharedConversationMiddleware,
  createSCM,
  createSCMContext,
} from './SharedConversationMiddleware';
export type {
  SCMIntentType,
  SCMGateResult,
  SCMContext,
  SCMPlanResult,
  SCMStyleResult,
} from './SharedConversationMiddleware';

export {
  AgentArbiter,
  createArbiter,
  createCandidate,
} from './AgentArbiter';
export type {
  ArbiterCandidate,
  CandidateRanking,
  ArbiterResult,
  ArbiterConfig,
  ArbiterMetrics,
} from './AgentArbiter';

export { routeWithSCM } from './SCMRouting';

// Behavior Components (Pattern 13: AGENT BEHAVIOR CONFIG)
export {
  TriggerEvaluator,
  createTriggerEvaluator,
  createSystemContext,
} from './TriggerEvaluator';
export type {
  SystemContext,
  TriggerResult,
  CooldownState,
} from './TriggerEvaluator';

export {
  OpenerSelector,
  createOpenerSelector,
  createSelectionContext,
  getTimeOfDay,
} from './OpenerSelector';
export type {
  SelectionContext,
  OpenerSelection,
} from './OpenerSelector';

export {
  IdiomRegistry,
  createIdiomRegistry,
  createIdiomContext,
} from './IdiomRegistry';
export type {
  IdiomContext,
  IdiomSelection,
  IdiomUsageStats,
} from './IdiomRegistry';

export {
  BehaviorLoader,
  createBehaviorLoader,
  loadBehaviorsFromConfigs,
} from './BehaviorLoader';
export type {
  BehaviorEvaluation,
  BehaviorLoaderConfig,
} from './BehaviorLoader';

// Types from EvaluationCoordinator (backwards compatibility)
export type {
  PersonaOutput,
  ForecastRecord,
  EvaluationContext,
  CalibrationStats,
} from './EvaluationCoordinator';

// Types from extracted modules
export type { DetectedConflict, ConflictResolutionResult } from './ConflictResolver';

// SCM Policy and Behavior Config Types
export type {
  SCMPolicy,
  InitiativePolicy,
  TurnTakingPolicy,
  RepairPolicy,
  CoachingPolicy,
  CreativityPolicy,
  CoordinationPolicy,
  BehaviorConfig,
  JobDefinition,
  JobSchedule,
  ConversationTrigger,
  OpenerDefinition,
  OpenerVariation,
  IdiomDefinition,
  IdiomPhrase,
  InitiativeTrigger,
  RepairSignal,
  CoordinationTag,
  CoachingStyle,
  CreativityTechnique,
  TriggerConditionType,
} from './types';

export { DEFAULT_SCM_POLICY } from './types';

// SCM Routing (enhanced)
export {
  SCMRouter,
  createSCMRouter,
  createRoutingContext,
} from './SCMRouting';
export type {
  SCMRoutingContext,
  SCMRoutingResult,
  SCMRouterConfig,
} from './SCMRouting';

// Shared Utilities
export {
  weightedRandomSelect,
  UsageTracker,
  SlidingWindowTracker,
  TTLCache,
  getTimeOfDay as getTimeOfDayUtil,
  getCurrentMonth,
  formatDuration,
  PRIORITY_VALUES,
  comparePriority,
  generateId,
  deepMerge,
} from './utils';
export type {
  Clearable,
  MetricsProvider,
  Configurable,
  CooldownState as CooldownStateUtil,
  PriorityLevel,
} from './utils';

// Full Integration Service
export {
  SystemAgentChatService,
  createSystemAgentChatService,
  createMockChatService,
} from './SystemAgentChatService';
export type {
  SystemAgentChatServiceConfig,
  ChatMessage,
  AgentResponse,
  ChatRoutingResult,
} from './SystemAgentChatService';