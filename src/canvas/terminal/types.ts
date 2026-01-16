/**
 * Terminal Widget Types
 *
 * Defines the xterm.js integration for the Terminal-Browser canvas:
 * - Terminal configuration
 * - Session management
 * - Multiplexing
 * - PTY backend interface
 */

// =============================================================================
// Terminal Configuration
// =============================================================================

/**
 * Terminal appearance configuration.
 */
export interface TerminalTheme {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selectionBackground: string;
  selectionForeground?: string;

  // ANSI colors
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;

  // Bright ANSI colors
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export const DEFAULT_TERMINAL_THEME: TerminalTheme = {
  background: '#1e1e2e',
  foreground: '#cdd6f4',
  cursor: '#f5e0dc',
  cursorAccent: '#1e1e2e',
  selectionBackground: '#45475a',

  black: '#45475a',
  red: '#f38ba8',
  green: '#a6e3a1',
  yellow: '#f9e2af',
  blue: '#89b4fa',
  magenta: '#f5c2e7',
  cyan: '#94e2d5',
  white: '#bac2de',

  brightBlack: '#585b70',
  brightRed: '#f38ba8',
  brightGreen: '#a6e3a1',
  brightYellow: '#f9e2af',
  brightBlue: '#89b4fa',
  brightMagenta: '#f5c2e7',
  brightCyan: '#94e2d5',
  brightWhite: '#a6adc8',
};

/**
 * Terminal behavior configuration.
 */
export interface TerminalConfig {
  /** Number of columns */
  cols: number;

  /** Number of rows */
  rows: number;

  /** Font family */
  fontFamily: string;

  /** Font size in pixels */
  fontSize: number;

  /** Line height multiplier */
  lineHeight: number;

  /** Letter spacing in pixels */
  letterSpacing: number;

  /** Cursor style */
  cursorStyle: 'block' | 'underline' | 'bar';

  /** Cursor blink */
  cursorBlink: boolean;

  /** Scrollback buffer size (lines) */
  scrollback: number;

  /** Enable WebGL renderer (better performance) */
  webgl: boolean;

  /** Enable link detection */
  linkDetection: boolean;

  /** Bell style */
  bellStyle: 'none' | 'sound' | 'visual' | 'both';

  /** Theme */
  theme: TerminalTheme;

  /** Allow transparency */
  allowTransparency: boolean;

  /** Tab stop width */
  tabStopWidth: number;

  /** Word separator characters for double-click selection */
  wordSeparator: string;

  /** Right click behavior */
  rightClickSelectsWord: boolean;

  /** Enable scrolling via mouse wheel */
  scrollOnUserInput: boolean;
}

export const DEFAULT_TERMINAL_CONFIG: TerminalConfig = {
  cols: 80,
  rows: 24,
  fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
  fontSize: 14,
  lineHeight: 1.2,
  letterSpacing: 0,
  cursorStyle: 'block',
  cursorBlink: true,
  scrollback: 10000,
  webgl: true,
  linkDetection: true,
  bellStyle: 'visual',
  theme: DEFAULT_TERMINAL_THEME,
  allowTransparency: false,
  tabStopWidth: 8,
  wordSeparator: ' ()[]{}\',:;"',
  rightClickSelectsWord: true,
  scrollOnUserInput: true,
};

// =============================================================================
// Session Management
// =============================================================================

/**
 * Terminal session state.
 */
export type SessionState =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'closed';

/**
 * Terminal session information.
 */
export interface TerminalSession {
  /** Unique session ID */
  id: string;

  /** Display name */
  name: string;

  /** Shell command/path */
  shell: string;

  /** Shell arguments */
  shellArgs: string[];

  /** Working directory */
  cwd: string;

  /** Environment variables */
  env: Record<string, string>;

  /** Current state */
  state: SessionState;

  /** Created timestamp */
  createdAt: number;

  /** Last activity timestamp */
  lastActivityAt: number;

  /** Exit code (if closed) */
  exitCode?: number;

  /** Error message (if error state) */
  error?: string;

  /** Current dimensions */
  dimensions: { cols: number; rows: number };

  /** Is this session in the foreground? */
  isForeground: boolean;
}

/**
 * Options for creating a new session.
 */
export interface CreateSessionOptions {
  name?: string;
  shell?: string;
  shellArgs?: string[];
  cwd?: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
}

// =============================================================================
// PTY Backend Interface
// =============================================================================

/**
 * Interface for PTY backend communication.
 * This abstracts the actual PTY (could be local node-pty, WebSocket to server, etc.)
 */
export interface PTYBackend {
  /** Connect to create a new PTY session */
  connect(options: CreateSessionOptions): Promise<TerminalSession>;

  /** Write data to the PTY */
  write(sessionId: string, data: string): void;

  /** Resize the PTY */
  resize(sessionId: string, cols: number, rows: number): void;

  /** Close the PTY session */
  close(sessionId: string): void;

  /** Subscribe to data from the PTY */
  onData(sessionId: string, callback: (data: string) => void): () => void;

  /** Subscribe to session state changes */
  onStateChange(sessionId: string, callback: (state: SessionState) => void): () => void;

  /** Subscribe to session close */
  onClose(sessionId: string, callback: (exitCode: number) => void): () => void;

  /** Get session info */
  getSession(sessionId: string): TerminalSession | undefined;

  /** List all sessions */
  listSessions(): TerminalSession[];
}

// =============================================================================
// Multiplexing
// =============================================================================

/**
 * Terminal multiplexer configuration.
 */
export interface MultiplexerConfig {
  /** Maximum concurrent sessions */
  maxSessions: number;

  /** Auto-close sessions on exit */
  autoCloseOnExit: boolean;

  /** Keep sessions alive when terminal widget is hidden */
  keepAliveInBackground: boolean;

  /** Session idle timeout (ms, 0 = never) */
  idleTimeoutMs: number;

  /** Default shell */
  defaultShell: string;

  /** Default working directory */
  defaultCwd: string;
}

export const DEFAULT_MULTIPLEXER_CONFIG: MultiplexerConfig = {
  maxSessions: 10,
  autoCloseOnExit: false,
  keepAliveInBackground: true,
  idleTimeoutMs: 0,
  defaultShell: process.env.SHELL || '/bin/bash',
  defaultCwd: process.env.HOME || '/',
};

// =============================================================================
// Terminal Widget Data
// =============================================================================

/**
 * Data stored in a terminal widget node.
 */
export interface TerminalWidgetData {
  /** Session ID (if connected) */
  sessionId?: string;

  /** Terminal configuration */
  config: TerminalConfig;

  /** Session options for reconnection */
  sessionOptions: CreateSessionOptions;

  /** Scrollback position */
  scrollPosition: number;

  /** Is the terminal focused? */
  focused: boolean;

  /** Custom title (overrides session name) */
  customTitle?: string;
}

export const DEFAULT_TERMINAL_WIDGET_DATA: TerminalWidgetData = {
  config: DEFAULT_TERMINAL_CONFIG,
  sessionOptions: {},
  scrollPosition: 0,
  focused: false,
};

// =============================================================================
// Terminal Events
// =============================================================================

export type TerminalEventType =
  | 'session:created'
  | 'session:connected'
  | 'session:disconnected'
  | 'session:closed'
  | 'session:error'
  | 'data:received'
  | 'data:sent'
  | 'resize'
  | 'focus'
  | 'blur'
  | 'bell'
  | 'title:changed'
  | 'link:clicked';

export interface TerminalEvent<T = unknown> {
  type: TerminalEventType;
  sessionId: string;
  timestamp: number;
  payload: T;
}

// =============================================================================
// Link Handling
// =============================================================================

export interface TerminalLink {
  /** Start position in buffer */
  start: { x: number; y: number };

  /** End position in buffer */
  end: { x: number; y: number };

  /** Link text */
  text: string;

  /** Resolved URL (if applicable) */
  url?: string;

  /** Link type */
  type: 'url' | 'file' | 'command';
}

export interface LinkHandler {
  /** Pattern to match */
  pattern: RegExp;

  /** Link type */
  type: TerminalLink['type'];

  /** Handler function */
  handler: (link: TerminalLink) => void;

  /** Tooltip text */
  tooltip?: string;

  /** Priority (higher = checked first) */
  priority: number;
}
