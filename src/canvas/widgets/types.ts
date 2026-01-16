/**
 * Widget Architecture Types
 *
 * Defines the pluggable widget system:
 * - Widget interface contracts
 * - Dependency injection
 * - Registry types
 * - Lifecycle hooks
 */

import type { ComponentType } from 'react';
import type { CanvasKind, BaseNodeData, Dimensions } from '../core/types';

// =============================================================================
// Widget Identity
// =============================================================================

/** Unique identifier for a widget type (e.g., 'terminal', 'markdown-editor', 'api-key-form') */
export type WidgetTypeId = string;

/** Widget version following semver */
export type WidgetVersion = string;

/** Widget categories for organization */
export type WidgetCategory =
  | 'input'       // Forms, text fields, file pickers
  | 'display'     // Read-only content, viewers
  | 'interactive' // Terminals, browsers, editors
  | 'layout'      // Groups, containers, tabs
  | 'system'      // Settings, config, internal
  | 'custom';     // Third-party

// =============================================================================
// Widget Capabilities (what a widget can do)
// =============================================================================

export interface WidgetCapabilities {
  /** Can this widget be resized by the user? */
  resizable: boolean;

  /** Can this widget be connected to other widgets via edges? */
  connectable: boolean;

  /** Can this widget contain other widgets (nested)? */
  nestable: boolean;

  /** Does this widget need to run in background when canvas is hidden? */
  backgroundExecution: boolean;

  /** Can this widget's state be serialized/restored? */
  persistable: boolean;

  /** Does this widget need keyboard focus? */
  focusable: boolean;
}

export const DEFAULT_CAPABILITIES: WidgetCapabilities = {
  resizable: true,
  connectable: true,
  nestable: false,
  backgroundExecution: false,
  persistable: true,
  focusable: false,
};

// =============================================================================
// Widget Dependencies (services the widget needs)
// =============================================================================

/** Available services that can be injected into widgets */
export type ServiceType =
  | 'memory'        // Memory system access
  | 'llm'           // LLM client
  | 'fileSystem'    // File read/write
  | 'terminal'      // PTY/terminal access
  | 'network'       // HTTP/WebSocket
  | 'storage'       // Local/session storage
  | 'clipboard'     // Copy/paste
  | 'notifications' // User notifications
  | 'canvas'        // Parent canvas reference
  | 'events';       // Event bus

/** Dependency declaration */
export interface WidgetDependency {
  service: ServiceType;
  required: boolean;
  config?: Record<string, unknown>;
}

// =============================================================================
// Widget Props (what the canvas passes to the widget)
// =============================================================================

/** Services provided to widgets via dependency injection */
export interface WidgetServices {
  memory?: {
    recall: (query: string) => Promise<unknown[]>;
    store: (content: string) => Promise<string>;
  };
  llm?: {
    chat: (messages: Array<{ role: string; content: string }>) => Promise<string>;
  };
  fileSystem?: {
    read: (path: string) => Promise<string>;
    write: (path: string, content: string) => Promise<void>;
    list: (path: string) => Promise<string[]>;
  };
  terminal?: {
    spawn: (command?: string) => Promise<string>; // Returns session ID
    write: (sessionId: string, data: string) => void;
    onData: (sessionId: string, callback: (data: string) => void) => void;
    kill: (sessionId: string) => void;
  };
  network?: {
    fetch: typeof fetch;
    createWebSocket: (url: string) => WebSocket;
  };
  storage?: {
    get: (key: string) => string | null;
    set: (key: string, value: string) => void;
    remove: (key: string) => void;
  };
  clipboard?: {
    read: () => Promise<string>;
    write: (text: string) => Promise<void>;
  };
  notifications?: {
    show: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  };
  canvas?: {
    id: string;
    kind: CanvasKind;
    emit: (event: string, payload: unknown) => void;
  };
  events?: {
    on: (event: string, handler: (payload: unknown) => void) => void;
    off: (event: string, handler: (payload: unknown) => void) => void;
    emit: (event: string, payload: unknown) => void;
  };
}

/** Base props that every widget receives */
export interface WidgetBaseProps<TData = unknown> {
  /** Unique node ID on the canvas */
  nodeId: string;

  /** Widget-specific data stored in the node */
  data: TData;

  /** Current dimensions */
  width: number;
  height: number;

  /** Is this widget currently selected? */
  selected: boolean;

  /** Is this widget being dragged? */
  dragging: boolean;

  /** Injected services based on widget's declared dependencies */
  services: WidgetServices;

  /** Update widget data (triggers node:data-changed event) */
  onDataChange: (data: Partial<TData>) => void;

  /** Request resize */
  onResize: (dimensions: Dimensions) => void;
}

// =============================================================================
// Widget Lifecycle
// =============================================================================

export interface WidgetLifecycle<TData = unknown> {
  /** Called when widget is first added to canvas */
  onMount?: (props: WidgetBaseProps<TData>) => void | Promise<void>;

  /** Called when widget is removed from canvas */
  onUnmount?: () => void | Promise<void>;

  /** Called when canvas goes to background (widget still alive) */
  onBackground?: () => void | Promise<void>;

  /** Called when canvas returns to foreground */
  onForeground?: () => void | Promise<void>;

  /** Called before canvas saves state - return data to persist */
  onSave?: () => TData | Promise<TData>;

  /** Called after canvas restores state */
  onRestore?: (data: TData) => void | Promise<void>;
}

// =============================================================================
// Widget Definition (what developers provide to register a widget)
// =============================================================================

export interface WidgetDefinition<TData = unknown> {
  /** Unique widget type identifier */
  typeId: WidgetTypeId;

  /** Human-readable name */
  name: string;

  /** Description for documentation */
  description: string;

  /** Version (semver) */
  version: WidgetVersion;

  /** Category for organization */
  category: WidgetCategory;

  /** Which canvas types can use this widget */
  allowedCanvases: CanvasKind[] | '*';

  /** Widget capabilities */
  capabilities: WidgetCapabilities;

  /** Required and optional service dependencies */
  dependencies: WidgetDependency[];

  /** Default dimensions when created */
  defaultSize: Dimensions;

  /** Minimum dimensions (for resizing) */
  minSize?: Dimensions;

  /** Maximum dimensions (for resizing) */
  maxSize?: Dimensions;

  /** The React component that renders this widget */
  component: ComponentType<WidgetBaseProps<TData>>;

  /** Lifecycle hooks */
  lifecycle?: WidgetLifecycle<TData>;

  /** Default data when widget is created */
  defaultData: () => TData;

  /** JSON schema for data validation (optional) */
  dataSchema?: Record<string, unknown>;

  /** Author/publisher information */
  author?: {
    name: string;
    url?: string;
  };

  /** Documentation URL */
  documentationUrl?: string;

  /** Icon (URL or component) */
  icon?: string | ComponentType;
}

// =============================================================================
// Widget Instance (runtime representation)
// =============================================================================

export interface WidgetInstance<TData = unknown> {
  /** Node ID on canvas */
  nodeId: string;

  /** Reference to the definition */
  definition: WidgetDefinition<TData>;

  /** Current data state */
  data: TData;

  /** Resolved services based on dependencies */
  services: WidgetServices;

  /** Lifecycle state */
  state: 'mounting' | 'mounted' | 'background' | 'unmounting' | 'unmounted';
}

// =============================================================================
// Widget Node Data (extends BaseNodeData for canvas nodes)
// =============================================================================

export interface WidgetNodeData<TData = unknown> extends BaseNodeData {
  widgetType: WidgetTypeId;
  widgetData: TData;
}

// =============================================================================
// Registry Types
// =============================================================================

export interface WidgetRegistryEntry<TData = unknown> {
  definition: WidgetDefinition<TData>;
  registeredAt: number;
  enabled: boolean;
}

export interface WidgetRegistryQuery {
  category?: WidgetCategory;
  canvasKind?: CanvasKind;
  capability?: keyof WidgetCapabilities;
  enabled?: boolean;
}
