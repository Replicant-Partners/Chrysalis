/**
 * Reference Widgets
 *
 * Example widgets demonstrating the architecture patterns
 * for each canvas type. These serve as templates for custom widgets.
 *
 * Canvas Types:
 * - Settings: API key management, configuration
 * - Board: Cards, connections for workflows
 * - Scrapbook: Clips, notes for content collection
 * - Research: Sources, synthesis for information
 * - Terminal-Browser: Terminal, browser integration
 */

import type { WidgetDefinition, WidgetCapabilities, DataContract } from '../widgets/types';
import type { CanvasKind } from '../core/types';

// =============================================================================
// Common Capabilities
// =============================================================================

const BASIC_CAPABILITIES: WidgetCapabilities = {
  canResize: true,
  canMove: true,
  canDelete: true,
  canDuplicate: true,
  canConnect: false,
  canGroup: true,
  canNest: false,
  canCollapse: false,
};

const CONNECTABLE_CAPABILITIES: WidgetCapabilities = {
  ...BASIC_CAPABILITIES,
  canConnect: true,
  maxConnections: 10,
  connectionTypes: ['data', 'reference'],
};

// =============================================================================
// Settings Canvas Widgets
// =============================================================================

/**
 * API Key Widget - Securely manages API keys
 */
export const APIKeyWidget: WidgetDefinition<APIKeyData> = {
  typeId: 'settings/api-key',
  name: 'API Key',
  description: 'Securely store and manage API keys for external services',
  category: 'settings',
  icon: '🔑',
  version: '1.0.0',

  supportedCanvases: ['settings'],
  capabilities: {
    ...BASIC_CAPABILITIES,
    canDuplicate: false, // Security: don't duplicate keys
  },

  defaultSize: { width: 400, height: 200 },
  minSize: { width: 300, height: 150 },
  maxSize: { width: 600, height: 300 },

  defaultData: {
    serviceName: '',
    keyName: '',
    keyValue: '', // Should be encrypted
    description: '',
    isConfigured: false,
    lastVerified: null,
  },

  dataContract: {
    version: '1.0.0',
    schema: {
      type: 'object',
      properties: {
        serviceName: { type: 'string' },
        keyName: { type: 'string' },
        keyValue: { type: 'string' },
        description: { type: 'string' },
        isConfigured: { type: 'boolean' },
        lastVerified: { type: ['number', 'null'] },
      },
      required: ['serviceName', 'keyName'],
    },
    migrations: [],
  },

  requiredServices: ['storage', 'encryption'],
  optionalServices: ['validation'],

  handles: [], // No connection handles
  initialState: 'editing',
  allowedStates: ['editing', 'configured', 'error'],
};

interface APIKeyData {
  serviceName: string;
  keyName: string;
  keyValue: string;
  description: string;
  isConfigured: boolean;
  lastVerified: number | null;
}

/**
 * Config Section Widget - Groups related settings
 */
export const ConfigSectionWidget: WidgetDefinition<ConfigSectionData> = {
  typeId: 'settings/config-section',
  name: 'Configuration Section',
  description: 'Group related configuration options',
  category: 'settings',
  icon: '⚙️',
  version: '1.0.0',

  supportedCanvases: ['settings'],
  capabilities: {
    ...BASIC_CAPABILITIES,
    canNest: true,
    canCollapse: true,
    maxNestingDepth: 2,
  },

  defaultSize: { width: 500, height: 300 },
  minSize: { width: 400, height: 200 },

  defaultData: {
    title: 'Configuration',
    description: '',
    collapsed: false,
    settings: [],
  },

  dataContract: {
    version: '1.0.0',
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        collapsed: { type: 'boolean' },
        settings: { type: 'array' },
      },
    },
    migrations: [],
  },

  requiredServices: ['storage'],
  handles: [],
  initialState: 'expanded',
  allowedStates: ['expanded', 'collapsed'],
};

interface ConfigSectionData {
  title: string;
  description: string;
  collapsed: boolean;
  settings: Array<{ key: string; value: unknown; type: string }>;
}

// =============================================================================
// Board Canvas Widgets
// =============================================================================

/**
 * Card Widget - Basic content card for workflows
 */
export const CardWidget: WidgetDefinition<CardData> = {
  typeId: 'board/card',
  name: 'Card',
  description: 'Versatile card for content and workflow steps',
  category: 'content',
  icon: '📋',
  version: '1.0.0',

  supportedCanvases: ['board'],
  capabilities: {
    ...CONNECTABLE_CAPABILITIES,
    canCollapse: true,
  },

  defaultSize: { width: 280, height: 180 },
  minSize: { width: 200, height: 120 },
  maxSize: { width: 600, height: 800 },

  defaultData: {
    title: 'New Card',
    content: '',
    color: '#3b82f6',
    tags: [],
    priority: 'medium',
    status: 'todo',
  },

  dataContract: {
    version: '1.0.0',
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        content: { type: 'string' },
        color: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        priority: { enum: ['low', 'medium', 'high', 'urgent'] },
        status: { enum: ['todo', 'in-progress', 'review', 'done'] },
      },
    },
    migrations: [],
  },

  requiredServices: [],

  handles: [
    { id: 'input', position: 'left', type: 'target', dataTypes: ['any'] },
    { id: 'output', position: 'right', type: 'source', dataTypes: ['any'] },
  ],

  initialState: 'viewing',
  allowedStates: ['viewing', 'editing'],
};

interface CardData {
  title: string;
  content: string;
  color: string;
  tags: string[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'todo' | 'in-progress' | 'review' | 'done';
}

/**
 * Connector Widget - Visual connection point
 */
export const ConnectorWidget: WidgetDefinition<ConnectorData> = {
  typeId: 'board/connector',
  name: 'Connector',
  description: 'Hub for connecting multiple cards',
  category: 'flow',
  icon: '🔗',
  version: '1.0.0',

  supportedCanvases: ['board'],
  capabilities: {
    ...CONNECTABLE_CAPABILITIES,
    canResize: false,
    maxConnections: 20,
  },

  defaultSize: { width: 60, height: 60 },
  minSize: { width: 60, height: 60 },
  maxSize: { width: 60, height: 60 },

  defaultData: {
    label: '',
    shape: 'circle',
    color: '#6366f1',
  },

  dataContract: {
    version: '1.0.0',
    schema: {
      type: 'object',
      properties: {
        label: { type: 'string' },
        shape: { enum: ['circle', 'diamond', 'square'] },
        color: { type: 'string' },
      },
    },
    migrations: [],
  },

  requiredServices: [],

  handles: [
    { id: 'top', position: 'top', type: 'source', dataTypes: ['any'] },
    { id: 'right', position: 'right', type: 'source', dataTypes: ['any'] },
    { id: 'bottom', position: 'bottom', type: 'target', dataTypes: ['any'] },
    { id: 'left', position: 'left', type: 'target', dataTypes: ['any'] },
  ],

  initialState: 'default',
  allowedStates: ['default', 'highlighted'],
};

interface ConnectorData {
  label: string;
  shape: 'circle' | 'diamond' | 'square';
  color: string;
}

// =============================================================================
// Scrapbook Canvas Widgets
// =============================================================================

/**
 * Clip Widget - Captured content from various sources
 */
export const ClipWidget: WidgetDefinition<ClipData> = {
  typeId: 'scrapbook/clip',
  name: 'Clip',
  description: 'Captured content from web, files, or manual input',
  category: 'content',
  icon: '📎',
  version: '1.0.0',

  supportedCanvases: ['scrapbook'],
  capabilities: BASIC_CAPABILITIES,

  defaultSize: { width: 300, height: 200 },
  minSize: { width: 200, height: 150 },

  defaultData: {
    contentType: 'text',
    content: '',
    sourceUrl: null,
    capturedAt: Date.now(),
    tags: [],
    notes: '',
  },

  dataContract: {
    version: '1.0.0',
    schema: {
      type: 'object',
      properties: {
        contentType: { enum: ['text', 'image', 'link', 'code'] },
        content: { type: 'string' },
        sourceUrl: { type: ['string', 'null'] },
        capturedAt: { type: 'number' },
        tags: { type: 'array' },
        notes: { type: 'string' },
      },
    },
    migrations: [],
  },

  requiredServices: [],
  handles: [],
  initialState: 'viewing',
  allowedStates: ['viewing', 'editing'],
};

interface ClipData {
  contentType: 'text' | 'image' | 'link' | 'code';
  content: string;
  sourceUrl: string | null;
  capturedAt: number;
  tags: string[];
  notes: string;
}

/**
 * Note Widget - Freeform notes
 */
export const NoteWidget: WidgetDefinition<NoteData> = {
  typeId: 'scrapbook/note',
  name: 'Note',
  description: 'Freeform text note with rich formatting',
  category: 'content',
  icon: '📝',
  version: '1.0.0',

  supportedCanvases: ['scrapbook', 'board', 'research'],
  capabilities: {
    ...BASIC_CAPABILITIES,
    canCollapse: true,
  },

  defaultSize: { width: 250, height: 180 },
  minSize: { width: 150, height: 100 },

  defaultData: {
    title: '',
    content: '',
    color: '#fef08a', // Yellow sticky note
    pinned: false,
    createdAt: Date.now(),
    modifiedAt: Date.now(),
  },

  dataContract: {
    version: '1.0.0',
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        content: { type: 'string' },
        color: { type: 'string' },
        pinned: { type: 'boolean' },
        createdAt: { type: 'number' },
        modifiedAt: { type: 'number' },
      },
    },
    migrations: [],
  },

  requiredServices: [],
  handles: [],
  initialState: 'editing',
  allowedStates: ['viewing', 'editing'],
};

interface NoteData {
  title: string;
  content: string;
  color: string;
  pinned: boolean;
  createdAt: number;
  modifiedAt: number;
}

// =============================================================================
// Research Canvas Widgets
// =============================================================================

/**
 * Source Widget - Reference to external source
 */
export const SourceWidget: WidgetDefinition<SourceData> = {
  typeId: 'research/source',
  name: 'Source',
  description: 'Reference to an external information source',
  category: 'research',
  icon: '📚',
  version: '1.0.0',

  supportedCanvases: ['research'],
  capabilities: CONNECTABLE_CAPABILITIES,

  defaultSize: { width: 350, height: 220 },
  minSize: { width: 280, height: 180 },

  defaultData: {
    title: '',
    url: '',
    author: '',
    publishedDate: null,
    sourceType: 'article',
    summary: '',
    credibilityScore: null,
    quotes: [],
    tags: [],
    accessed: Date.now(),
  },

  dataContract: {
    version: '1.0.0',
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        url: { type: 'string' },
        author: { type: 'string' },
        publishedDate: { type: ['string', 'null'] },
        sourceType: { enum: ['article', 'paper', 'book', 'website', 'video', 'podcast'] },
        summary: { type: 'string' },
        credibilityScore: { type: ['number', 'null'] },
        quotes: { type: 'array' },
        tags: { type: 'array' },
        accessed: { type: 'number' },
      },
    },
    migrations: [],
  },

  requiredServices: [],

  handles: [
    { id: 'cite', position: 'right', type: 'source', dataTypes: ['citation'] },
  ],

  initialState: 'viewing',
  allowedStates: ['viewing', 'editing', 'fetching'],
};

interface SourceData {
  title: string;
  url: string;
  author: string;
  publishedDate: string | null;
  sourceType: 'article' | 'paper' | 'book' | 'website' | 'video' | 'podcast';
  summary: string;
  credibilityScore: number | null;
  quotes: Array<{ text: string; page?: string }>;
  tags: string[];
  accessed: number;
}

/**
 * Synthesis Widget - Synthesized insight from sources
 */
export const SynthesisWidget: WidgetDefinition<SynthesisData> = {
  typeId: 'research/synthesis',
  name: 'Synthesis',
  description: 'Synthesized insight combining multiple sources',
  category: 'research',
  icon: '💡',
  version: '1.0.0',

  supportedCanvases: ['research'],
  capabilities: {
    ...CONNECTABLE_CAPABILITIES,
    canNest: true,
    maxNestingDepth: 3,
  },

  defaultSize: { width: 400, height: 300 },
  minSize: { width: 350, height: 250 },

  defaultData: {
    title: '',
    thesis: '',
    content: '',
    confidence: 0.5,
    sourceIds: [],
    contradictions: [],
    questions: [],
    createdAt: Date.now(),
    modifiedAt: Date.now(),
  },

  dataContract: {
    version: '1.0.0',
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        thesis: { type: 'string' },
        content: { type: 'string' },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        sourceIds: { type: 'array', items: { type: 'string' } },
        contradictions: { type: 'array' },
        questions: { type: 'array' },
        createdAt: { type: 'number' },
        modifiedAt: { type: 'number' },
      },
    },
    migrations: [],
  },

  requiredServices: [],

  handles: [
    { id: 'sources', position: 'left', type: 'target', dataTypes: ['citation'] },
    { id: 'derived', position: 'right', type: 'source', dataTypes: ['synthesis'] },
  ],

  initialState: 'editing',
  allowedStates: ['viewing', 'editing', 'analyzing'],
};

interface SynthesisData {
  title: string;
  thesis: string;
  content: string;
  confidence: number;
  sourceIds: string[];
  contradictions: string[];
  questions: string[];
  createdAt: number;
  modifiedAt: number;
}

// =============================================================================
// Terminal-Browser Canvas Widgets
// =============================================================================

/**
 * Terminal Widget - Integrated terminal
 */
export const TerminalWidget: WidgetDefinition<TerminalWidgetDataRef> = {
  typeId: 'terminal-browser/terminal',
  name: 'Terminal',
  description: 'Integrated terminal with session management',
  category: 'tools',
  icon: '💻',
  version: '1.0.0',

  supportedCanvases: ['terminal-browser'],
  capabilities: {
    ...BASIC_CAPABILITIES,
    canDuplicate: true,
  },

  defaultSize: { width: 600, height: 400 },
  minSize: { width: 400, height: 200 },

  defaultData: {
    sessionId: null,
    shell: '/bin/bash',
    cwd: '~',
    env: {},
    fontSize: 14,
    theme: 'dark',
  },

  dataContract: {
    version: '1.0.0',
    schema: {
      type: 'object',
      properties: {
        sessionId: { type: ['string', 'null'] },
        shell: { type: 'string' },
        cwd: { type: 'string' },
        env: { type: 'object' },
        fontSize: { type: 'number' },
        theme: { enum: ['dark', 'light'] },
      },
    },
    migrations: [],
  },

  requiredServices: ['terminal'],
  handles: [],
  initialState: 'disconnected',
  allowedStates: ['disconnected', 'connecting', 'connected', 'error'],
};

interface TerminalWidgetDataRef {
  sessionId: string | null;
  shell: string;
  cwd: string;
  env: Record<string, string>;
  fontSize: number;
  theme: 'dark' | 'light';
}

/**
 * Browser Widget - Embedded web browser
 */
export const BrowserWidget: WidgetDefinition<BrowserWidgetDataRef> = {
  typeId: 'terminal-browser/browser',
  name: 'Browser',
  description: 'Embedded web browser with tab support',
  category: 'tools',
  icon: '🌐',
  version: '1.0.0',

  supportedCanvases: ['terminal-browser'],
  capabilities: {
    ...BASIC_CAPABILITIES,
    canDuplicate: true,
  },

  defaultSize: { width: 800, height: 600 },
  minSize: { width: 400, height: 300 },

  defaultData: {
    url: 'about:blank',
    showToolbar: true,
    showTabs: true,
    tabs: [],
    zoom: 1,
  },

  dataContract: {
    version: '1.0.0',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        showToolbar: { type: 'boolean' },
        showTabs: { type: 'boolean' },
        tabs: { type: 'array' },
        zoom: { type: 'number' },
      },
    },
    migrations: [],
  },

  requiredServices: ['browser'],
  handles: [],
  initialState: 'idle',
  allowedStates: ['idle', 'loading', 'loaded', 'error'],
};

interface BrowserWidgetDataRef {
  url: string;
  showToolbar: boolean;
  showTabs: boolean;
  tabs: Array<{ id: string; url: string; title: string }>;
  zoom: number;
}

// =============================================================================
// Widget Collection Export
// =============================================================================

/**
 * All reference widgets grouped by canvas type.
 */
export const REFERENCE_WIDGETS: Record<CanvasKind, WidgetDefinition[]> = {
  settings: [APIKeyWidget, ConfigSectionWidget],
  board: [CardWidget, ConnectorWidget, NoteWidget],
  scrapbook: [ClipWidget, NoteWidget],
  research: [SourceWidget, SynthesisWidget, NoteWidget],
  'terminal-browser': [TerminalWidget, BrowserWidget],
};

/**
 * Flat list of all reference widgets.
 */
export const ALL_REFERENCE_WIDGETS: WidgetDefinition[] = [
  APIKeyWidget,
  ConfigSectionWidget,
  CardWidget,
  ConnectorWidget,
  ClipWidget,
  NoteWidget,
  SourceWidget,
  SynthesisWidget,
  TerminalWidget,
  BrowserWidget,
];
