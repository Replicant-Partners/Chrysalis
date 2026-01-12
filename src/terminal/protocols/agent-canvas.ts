/**
 * AgentCanvas Protocol Types
 * 
 * Protocol definitions for the Agent Canvas - an open canvas
 * for storing, managing, and awakening Chrysalis Agents in uSA format.
 * 
 * Key concepts:
 * - Open Canvas: No encryption, visible to all participants
 * - uSA Format: Uniform Semantic Agent v2 specification
 * - Wake/Sleep: Agent lifecycle management
 * - Data Resources: Links to secure storage (Phase 9)
 * 
 * @module terminal/protocols/agent-canvas
 */

import { CanvasState, WidgetNode, ParticipantId } from './types';

// ============================================================================
// Agent State
// ============================================================================

/**
 * Agent lifecycle states
 */
export type AgentState = 
  | 'dormant'    // Stored on canvas, not active
  | 'waking'     // Transitioning to awake
  | 'awake'      // Active, can chat and process
  | 'sleeping'   // Transitioning to dormant
  | 'error';     // Wake/sleep failed

/**
 * Source format for imported agents
 */
export type AgentSourceFormat = 
  | 'usa'        // Native uSA v1/v2 format
  | 'eliza'      // ElizaOS persona format
  | 'crewai'     // CrewAI agent config
  | 'replicant'  // Replicants/legends JSON format
  | 'unknown';   // Unrecognized format

// ============================================================================
// Agent Canvas Types
// ============================================================================

/**
 * Agent canvas metadata - extends open canvas concept
 */
export interface AgentCanvasMetadata {
  id: string;
  name: string;
  type: 'agent-canvas';
  createdAt: number;
  updatedAt: number;
  createdBy: ParticipantId;
  description?: string;
  tags?: string[];
  
  // Agent tracking
  agentCount: number;
  awakeAgentIds: string[];
  
  // Import history
  lastImportAt?: number;
  importCount: number;
}

/**
 * Agent canvas state - extends standard CanvasState
 */
export interface AgentCanvasState extends Omit<CanvasState, 'metadata'> {
  metadata: AgentCanvasMetadata;
  agents: CanvasAgent[];
}

// ============================================================================
// Canvas Agent
// ============================================================================

/**
 * Agent stored on the canvas
 */
export interface CanvasAgent {
  id: string;
  
  // uSA specification
  spec: AgentSpecSummary;
  
  // Full spec stored separately for efficiency
  fullSpecPath?: string;
  
  // Lifecycle
  state: AgentState;
  stateChangedAt: number;
  
  // Import info
  sourceFormat: AgentSourceFormat;
  originalSource?: string;  // For debugging
  importedAt: number;
  importedBy: ParticipantId;
  
  // Session tracking
  lastAwakeAt?: number;
  totalAwakeTime: number;    // Cumulative milliseconds
  sessionCount: number;
  
  // Canvas position
  position: AgentPosition;
  
  // Data resources
  dataResources: DataResourceLink[];
  
  // Error info
  lastError?: AgentError;
  
  // Convenience aliases (derived from spec)
  /** Alias for spec.name */
  name?: string;
  /** Alias for importedAt */
  createdAt?: number;
  /** Alias for lastAwakeAt - when agent last became awake */
  lastWakeTime?: number;
  /** When agent last went to sleep */
  lastSleepTime?: number;
}

/**
 * Summary of agent spec for display (not full uSA)
 */
export interface AgentSpecSummary {
  apiVersion: string;       // 'usa/v1' or 'usa/v2'
  name: string;
  version: string;
  role: string;
  goal: string;
  backstory?: string;
  
  // Capabilities summary
  capabilities: string[];   // List of capability names
  toolCount: number;
  skillCount: number;
  
  // Memory config
  hasMemory: boolean;
  memoryTiers?: MemoryTierConfig;
  
  // Protocol support
  protocols: AgentProtocolInfo[];
  
  // Visual
  avatar?: AgentAvatar;
  
  // Tags from original spec
  tags: string[];
  
  // Extended info (optional)
  /** Identity section from USA spec */
  identity?: {
    role: string;
    goal: string;
    backstory?: string;
  };
  /** List of tools/capabilities */
  tools?: Array<{ name: string; description?: string }>;
  /** List of skills */
  skills?: Array<{ name: string; description?: string }>;
  /** Import metadata for debugging */
  _import_metadata?: Record<string, unknown>;
}

/**
 * Memory tier configuration summary
 */
export interface MemoryTierConfig {
  working: boolean;
  episodic: boolean;
  semantic: boolean;
  procedural: boolean;
  core: boolean;
}

/**
 * Agent protocol info
 */
export interface AgentProtocolInfo {
  type: 'mcp' | 'a2a' | 'agent_protocol';
  enabled: boolean;
  role?: string;
}

/**
 * Agent avatar for visual display
 */
export interface AgentAvatar {
  type: 'url' | 'emoji' | 'initials' | 'generated';
  value: string;
  backgroundColor?: string;
}

/**
 * Agent position on canvas
 */
export interface AgentPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Agent error information
 */
export interface AgentError {
  code: AgentErrorCode;
  message: string;
  timestamp: number;
  details?: Record<string, unknown>;
  recoverable: boolean;
}

/**
 * Agent error codes
 */
export type AgentErrorCode =
  | 'WAKE_FAILED'
  | 'SLEEP_FAILED'
  | 'BRIDGE_ERROR'
  | 'MEMORY_ERROR'
  | 'DATA_RESOURCE_ERROR'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN_ERROR';

// ============================================================================
// Data Resource Links
// ============================================================================

/**
 * Link to a secure data resource
 */
export interface DataResourceLink {
  id: string;
  resourceId: string;    // Reference ID for the resource
  type: DataResourceType;
  name: string;
  
  // Storage reference (not actual data)
  storageLocation: string;
  storageType: 'secure-canvas' | 'file' | 'external';
  
  // Connection status
  isConnected: boolean;
  lastConnectedAt?: number;
  connectionError?: string;
  
  // Access control
  requiresAuth: boolean;
  
  // Metadata
  createdAt: number;
  updatedAt: number;
  size?: number;         // Bytes
  itemCount?: number;    // For collections
}

/**
 * Types of data resources
 */
export type DataResourceType =
  | 'memory'         // Agent memory state
  | 'knowledge'      // Knowledge base
  | 'skills'         // Skill definitions
  | 'credentials'    // API keys, tokens (encrypted)
  | 'context'        // Conversation context
  | 'artifacts'      // Generated outputs
  | 'api'            // External API connections
  | 'database'       // Database connections
  | 'vector_db'      // Vector database (embeddings)
  | 'file_storage'   // File storage systems
  | 'knowledge_base'; // Extended knowledge base

// ============================================================================
// Agent Node Widget
// ============================================================================

/**
 * Agent node widget props - displayed on canvas
 */
export interface AgentNodeWidgetProps {
  agentId: string;
  name: string;
  role: string;
  goal: string;
  state: AgentState;
  
  // Visual
  avatar?: AgentAvatar;
  stateIndicatorColor: string;
  
  // Summary info
  capabilities: string[];
  sourceFormat: AgentSourceFormat;
  dataResourceCount: number;
  
  // Session info
  lastAwakeAt?: number;
  sessionCount: number;
}

/**
 * Agent node widget state
 */
export interface AgentNodeWidgetState {
  isExpanded: boolean;
  showDetails: boolean;
  showDataResources: boolean;
  connectionStatus: AgentConnectionStatus;
  wakeProgress?: number;    // 0-100 during waking
  sleepProgress?: number;   // 0-100 during sleeping
}

/**
 * Agent connection status
 */
export type AgentConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

/**
 * Agent node widget definition
 */
export interface AgentNodeWidget extends WidgetNode {
  widgetType: 'agent-node';
  props: AgentNodeWidgetProps;
  state: AgentNodeWidgetState;
}

// ============================================================================
// Agent Canvas Events
// ============================================================================

/**
 * Agent canvas event types
 */
export type AgentCanvasEventType =
  // Agent CRUD
  | 'agent:imported'
  | 'agent:removed'
  | 'agent:updated'
  // Lifecycle
  | 'agent:wake:started'
  | 'agent:wake:completed'
  | 'agent:wake:failed'
  | 'agent:sleep:started'
  | 'agent:sleep:completed'
  | 'agent:sleep:failed'
  // Data resources
  | 'resource:connected'
  | 'resource:disconnected'
  | 'resource:error'
  // Memory
  | 'memory:loaded'
  | 'memory:persisted'
  | 'memory:error';

/**
 * Agent canvas event
 */
export interface AgentCanvasEvent {
  type: AgentCanvasEventType;
  canvasId: string;
  agentId: string;
  timestamp: number;
  payload: unknown;
}

/**
 * Event handler type
 */
export type AgentCanvasEventHandler = (event: AgentCanvasEvent) => void | Promise<void>;

// ============================================================================
// Import Types
// ============================================================================

/**
 * Agent import result
 */
export interface AgentImportResult {
  success: boolean;
  agent?: CanvasAgent;
  sourceFormat: AgentSourceFormat;
  
  // Conversion info
  wasConverted: boolean;
  conversionNotes?: string[];
  
  // Validation
  validationPassed: boolean;
  validationWarnings?: string[];
  
  // Errors
  errors?: string[];
}

/**
 * Format detection result
 */
export interface FormatDetectionResult {
  format: AgentSourceFormat;
  confidence: number;       // 0-1
  indicators: string[];     // What led to this detection
  canConvert: boolean;
  conversionWarnings?: string[];
}

/**
 * Import options
 */
export interface AgentImportOptions {
  // Position
  position?: { x: number; y: number };
  
  // Auto-wake after import
  autoWake?: boolean;
  
  // Skip validation
  skipValidation?: boolean;
  
  // Custom ID
  customId?: string;
  
  // Tags to add
  additionalTags?: string[];
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default agent node dimensions
 */
export const DEFAULT_AGENT_NODE_SIZE = {
  width: 280,
  height: 180,
  minWidth: 200,
  minHeight: 140,
  maxWidth: 400,
  maxHeight: 600
};

/**
 * Agent state colors for UI
 */
export const AGENT_STATE_COLORS: Record<AgentState, string> = {
  dormant: '#6B7280',   // Gray
  waking: '#F59E0B',    // Amber
  awake: '#10B981',     // Green
  sleeping: '#3B82F6',  // Blue
  error: '#EF4444'      // Red
};

/**
 * Source format labels for UI
 */
export const SOURCE_FORMAT_LABELS: Record<AgentSourceFormat, string> = {
  usa: 'Uniform Semantic Agent',
  eliza: 'ElizaOS Persona',
  crewai: 'CrewAI Agent',
  replicant: 'Replicant Persona',
  unknown: 'Unknown Format'
};

/**
 * Data resource type icons
 */
export const DATA_RESOURCE_ICONS: Record<DataResourceType, string> = {
  memory: '🧠',
  knowledge: '📚',
  skills: '⚡',
  credentials: '🔐',
  context: '💬',
  artifacts: '📦',
  api: '🔌',
  database: '🗄️',
  vector_db: '📊',
  file_storage: '📁',
  knowledge_base: '📖',
};

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a canvas state is an agent canvas
 */
export function isAgentCanvas(state: CanvasState): state is AgentCanvasState {
  return (state.metadata as AgentCanvasMetadata)?.type === 'agent-canvas';
}

/**
 * Check if a widget is an agent node
 */
export function isAgentNodeWidget(widget: WidgetNode): widget is AgentNodeWidget {
  return widget.widgetType === 'agent-node';
}

/**
 * Check if an agent is awakeable
 */
export function isAgentAwakeable(agent: CanvasAgent): boolean {
  return agent.state === 'dormant' && !agent.lastError?.code;
}

/**
 * Check if an agent is sleepable
 */
export function isAgentSleepable(agent: CanvasAgent): boolean {
  return agent.state === 'awake';
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create default agent canvas metadata
 */
export function createAgentCanvasMetadata(
  name: string,
  createdBy: ParticipantId
): AgentCanvasMetadata {
  const now = Date.now();
  return {
    id: `agent-canvas-${now}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    type: 'agent-canvas',
    createdAt: now,
    updatedAt: now,
    createdBy,
    agentCount: 0,
    awakeAgentIds: [],
    importCount: 0
  };
}

/**
 * Create default agent position
 */
export function createDefaultAgentPosition(
  x: number = 100,
  y: number = 100
): AgentPosition {
  return {
    x,
    y,
    width: DEFAULT_AGENT_NODE_SIZE.width,
    height: DEFAULT_AGENT_NODE_SIZE.height
  };
}

/**
 * Create empty agent canvas state
 */
export function createEmptyAgentCanvasState(
  name: string,
  createdBy: ParticipantId
): AgentCanvasState {
  return {
    id: `canvas-${Date.now()}`,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    selectedNodes: [],
    selectedEdges: [],
    metadata: createAgentCanvasMetadata(name, createdBy),
    agents: []
  };
}

/**
 * Create a canvas agent from spec
 */
export function createCanvasAgent(
  spec: AgentSpecSummary,
  importedBy: ParticipantId,
  options: Partial<{
    sourceFormat: AgentSourceFormat;
    position: AgentPosition;
    customId: string;
  }> = {}
): CanvasAgent {
  const now = Date.now();
  const id = options.customId || `agent-${now}-${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    id,
    spec,
    state: 'dormant',
    stateChangedAt: now,
    sourceFormat: options.sourceFormat || 'usa',
    importedAt: now,
    importedBy,
    totalAwakeTime: 0,
    sessionCount: 0,
    position: options.position || createDefaultAgentPosition(),
    dataResources: [],
  };
}

/**
 * Canvas constants
 */
export const AGENT_CANVAS_CONSTANTS = {
  MAX_AGENTS_PER_CANVAS: 50,
  MAX_DATA_RESOURCES_PER_AGENT: 20,
  DEFAULT_WAKE_TIMEOUT_MS: 30000,
  DEFAULT_SLEEP_TIMEOUT_MS: 10000,
  MIN_NODE_DISTANCE: 20,
  GRID_SIZE: 20,
  VERSION: '1.0.0',
} as const;