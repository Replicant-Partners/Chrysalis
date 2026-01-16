/**
 * Canvas-Widget Binding Types
 *
 * Defines the protocol for attaching widgets to canvases:
 * - Widget whitelists per canvas type
 * - Connection rules (which widgets can connect to which)
 * - Binding lifecycle
 */

import type { CanvasKind, CanvasNode, CanvasEdge } from '../core/types';
import type { WidgetTypeId, WidgetDefinition } from '../widgets/types';

// =============================================================================
// Widget Whitelist Configuration
// =============================================================================

/**
 * Defines which widgets are allowed on a specific canvas type.
 * Can be configured as allowlist (only these) or denylist (all except these).
 */
export interface CanvasWidgetPolicy {
  /** Canvas type this policy applies to */
  canvasKind: CanvasKind;

  /**
   * Policy mode:
   * - 'allowlist': Only widgets in the list are permitted
   * - 'denylist': All widgets EXCEPT those in the list are permitted
   */
  mode: 'allowlist' | 'denylist';

  /** Widget type IDs for the policy */
  widgetTypes: WidgetTypeId[];

  /** Maximum number of widgets of each type (optional) */
  maxPerType?: Record<WidgetTypeId, number>;

  /** Maximum total widgets on canvas (optional) */
  maxTotal?: number;
}

/**
 * Default policies for each canvas type.
 * These define the character of each canvas.
 */
export const DEFAULT_CANVAS_POLICIES: Record<CanvasKind, CanvasWidgetPolicy> = {
  settings: {
    canvasKind: 'settings',
    mode: 'allowlist',
    widgetTypes: [
      'api-key-editor',
      'config-form',
      'feature-flag',
      'budget-control',
      'audit-log',
      'service-status',
    ],
    maxTotal: 50,
  },

  board: {
    canvasKind: 'board',
    mode: 'denylist',
    widgetTypes: [
      // Deny system-only widgets on general board
      'api-key-editor',
      'audit-log',
    ],
    maxTotal: 500,
  },

  scrapbook: {
    canvasKind: 'scrapbook',
    mode: 'allowlist',
    widgetTypes: [
      'image',
      'video',
      'audio',
      'text-note',
      'link',
      'file',
      'group',
      'tag',
    ],
    maxTotal: 1000,
  },

  research: {
    canvasKind: 'research',
    mode: 'allowlist',
    widgetTypes: [
      'markdown-editor',
      'citation',
      'reference',
      'outline',
      'text-note',
      'link',
      'image',
      'embed',
      'group',
    ],
    maxTotal: 500,
  },

  'terminal-browser': {
    canvasKind: 'terminal-browser',
    mode: 'allowlist',
    widgetTypes: [
      'terminal',
      'browser-tab',
      'split-pane',
      'file-tree',
      'output-viewer',
    ],
    maxPerType: {
      'terminal': 10,
      'browser-tab': 20,
    },
    maxTotal: 50,
  },
};

// =============================================================================
// Connection Rules
// =============================================================================

/**
 * Defines what types of connections are allowed between widgets.
 */
export interface ConnectionRule {
  /** Source widget type (or '*' for any) */
  sourceType: WidgetTypeId | '*';

  /** Target widget type (or '*' for any) */
  targetType: WidgetTypeId | '*';

  /** Is this connection allowed? */
  allowed: boolean;

  /** Maximum connections from a single source (optional) */
  maxFromSource?: number;

  /** Maximum connections to a single target (optional) */
  maxToTarget?: number;

  /** Is this a bidirectional rule? */
  bidirectional?: boolean;
}

/**
 * Connection policy for a canvas type.
 */
export interface CanvasConnectionPolicy {
  canvasKind: CanvasKind;

  /** Default: are connections allowed? */
  defaultAllow: boolean;

  /** Specific rules that override the default */
  rules: ConnectionRule[];
}

export const DEFAULT_CONNECTION_POLICIES: Record<CanvasKind, CanvasConnectionPolicy> = {
  settings: {
    canvasKind: 'settings',
    defaultAllow: false,
    rules: [],
  },

  board: {
    canvasKind: 'board',
    defaultAllow: true,
    rules: [],
  },

  scrapbook: {
    canvasKind: 'scrapbook',
    defaultAllow: true,
    rules: [
      { sourceType: 'tag', targetType: '*', allowed: true, bidirectional: false },
    ],
  },

  research: {
    canvasKind: 'research',
    defaultAllow: true,
    rules: [
      { sourceType: 'citation', targetType: 'reference', allowed: true },
      { sourceType: 'outline', targetType: '*', allowed: true },
    ],
  },

  'terminal-browser': {
    canvasKind: 'terminal-browser',
    defaultAllow: false,
    rules: [
      { sourceType: 'terminal', targetType: 'output-viewer', allowed: true },
      { sourceType: 'browser-tab', targetType: 'terminal', allowed: true },
    ],
  },
};

// =============================================================================
// Binding Events
// =============================================================================

export type BindingEventType =
  | 'widget:attached'
  | 'widget:detached'
  | 'widget:rejected'
  | 'connection:created'
  | 'connection:removed'
  | 'connection:rejected'
  | 'policy:violation';

export interface BindingEvent<T = unknown> {
  type: BindingEventType;
  canvasId: string;
  timestamp: number;
  payload: T;
}

export interface WidgetAttachedPayload {
  nodeId: string;
  widgetType: WidgetTypeId;
}

export interface WidgetRejectedPayload {
  widgetType: WidgetTypeId;
  reason: string;
}

export interface ConnectionRejectedPayload {
  sourceId: string;
  targetId: string;
  reason: string;
}

export interface PolicyViolationPayload {
  type: 'widget_limit' | 'type_limit' | 'connection_limit' | 'not_allowed';
  details: string;
}

// =============================================================================
// Binding Validation Result
// =============================================================================

export interface BindingValidationResult {
  valid: boolean;
  reason?: string;
  suggestions?: string[];
}
