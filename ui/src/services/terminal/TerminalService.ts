/**
 * TerminalService - Core terminal emulation service using xterm.js
 * 
 * Provides a unified interface for terminal lifecycle management,
 * WebGL rendering with automatic fallback, and bidirectional data flow.
 * 
 * @module ui/services/terminal/TerminalService
 */

import { Terminal, ITerminalOptions, ITerminalInitOnlyOptions, IDisposable } from '@xterm/xterm';
import { WebglAddon } from '@xterm/addon-webgl';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { AttachAddon } from '@xterm/addon-attach';
import { SerializeAddon } from '@xterm/addon-serialize';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Rendering backend type
 */
export type RenderingBackend = 'webgl' | 'canvas';

/**
 * Terminal connection state
 */
export type ConnectionState = 
  | 'disconnected' 
  | 'connecting' 
  | 'connected' 
  | 'reconnecting' 
  | 'error';

/**
 * Performance metrics for monitoring rendering pathway
 */
export interface TerminalMetrics {
  renderingBackend: RenderingBackend;
  webglSupported: boolean;
  webglContextLost: boolean;
  framesRendered: number;
  averageFrameTime: number;
  lastFrameTime: number;
  memoryUsage?: number;
}

/**
 * Terminal theme configuration
 */
export interface TerminalTheme {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent?: string;
  selectionBackground?: string;
  selectionForeground?: string;
  selectionInactiveBackground?: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

/**
 * Terminal service configuration options
 */
export interface TerminalServiceConfig {
  /** Initial terminal options */
  terminalOptions?: Partial<ITerminalOptions & ITerminalInitOnlyOptions>;
  /** Custom theme */
  theme?: Partial<TerminalTheme>;
  /** Font family for terminal text */
  fontFamily?: string;
  /** Font size in pixels */
  fontSize?: number;
  /** Line height multiplier */
  lineHeight?: number;
  /** Letter spacing in pixels */
  letterSpacing?: number;
  /** Scrollback buffer size */
  scrollback?: number;
  /** Whether to enable WebGL rendering */
  enableWebGL?: boolean;
  /** Whether to enable clickable links */
  enableLinks?: boolean;
  /** Custom link handler */
  linkHandler?: (event: MouseEvent, uri: string) => void;
  /** WebSocket URL for attach addon */
  websocketUrl?: string;
  /** Whether to log performance metrics */
  enableMetrics?: boolean;
  /** Metrics logging interval in milliseconds */
  metricsInterval?: number;
}

/**
 * Terminal event types
 */
export interface TerminalEvents {
  onData: (data: string) => void;
  onBinary: (data: string) => void;
  onKey: (event: { key: string; domEvent: KeyboardEvent }) => void;
  onResize: (cols: number, rows: number) => void;
  onTitleChange: (title: string) => void;
  onSelectionChange: () => void;
  onWebGLContextLost: () => void;
  onWebGLContextRestored: () => void;
  onConnectionStateChange: (state: ConnectionState) => void;
  onMetricsUpdate: (metrics: TerminalMetrics) => void;
}

/**
 * Terminal service instance interface
 */
export interface ITerminalService {
  /** Initialize terminal on a DOM element */
  mount(container: HTMLElement): void;
  /** Dispose of terminal and cleanup resources */
  dispose(): void;
  /** Write data to terminal */
  write(data: string | Uint8Array): void;
  /** Write line to terminal */
  writeln(line: string): void;
  /** Clear terminal buffer */
  clear(): void;
  /** Reset terminal state */
  reset(): void;
  /** Focus the terminal */
  focus(): void;
  /** Blur the terminal */
  blur(): void;
  /** Fit terminal to container */
  fit(): void;
  /** Get current dimensions */
  getDimensions(): { cols: number; rows: number };
  /** Get serialized terminal content */
  serialize(): string;
  /** Get current selection text */
  getSelection(): string;
  /** Connect to WebSocket backend */
  connect(url: string): Promise<void>;
  /** Disconnect from WebSocket backend */
  disconnect(): void;
  /** Reconnect to WebSocket backend */
  reconnect(): Promise<void>;
  /** Get current connection state */
  getConnectionState(): ConnectionState;
  /** Get performance metrics */
  getMetrics(): TerminalMetrics;
  /** Get rendering backend type */
  getRenderingBackend(): RenderingBackend;
  /** Check if WebGL is supported */
  isWebGLSupported(): boolean;
  /** Subscribe to terminal events */
  on<K extends keyof TerminalEvents>(event: K, handler: TerminalEvents[K]): IDisposable;
  /** Update terminal options */
  setOptions(options: Partial<ITerminalOptions>): void;
  /** Update theme */
  setTheme(theme: Partial<TerminalTheme>): void;
  /** Scroll to bottom */
  scrollToBottom(): void;
  /** Scroll to top */
  scrollToTop(): void;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_THEME: TerminalTheme = {
  // Catppuccin Mocha inspired theme for distinctive aesthetic
  background: '#1e1e2e',
  foreground: '#cdd6f4',
  cursor: '#f5e0dc',
  cursorAccent: '#1e1e2e',
  selectionBackground: '#585b70',
  selectionForeground: '#cdd6f4',
  selectionInactiveBackground: '#45475a',
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

const DEFAULT_CONFIG: Required<TerminalServiceConfig> = {
  terminalOptions: {},
  theme: DEFAULT_THEME,
  fontFamily: '"Cascadia Code", "JetBrains Mono", "Fira Code", monospace',
  fontSize: 14,
  lineHeight: 1.2,
  letterSpacing: 0,
  scrollback: 10000,
  enableWebGL: true,
  enableLinks: true,
  linkHandler: (_event, uri) => {
    window.open(uri, '_blank', 'noopener,noreferrer');
  },
  websocketUrl: '',
  enableMetrics: false,
  metricsInterval: 1000,
};

// ============================================================================
// TerminalService Implementation
// ============================================================================

/**
 * Terminal service implementation
 */
export class TerminalService implements ITerminalService {
  private terminal: Terminal | null = null;
  private webglAddon: WebglAddon | null = null;
  private fitAddon: FitAddon | null = null;
  private webLinksAddon: WebLinksAddon | null = null;
  private attachAddon: AttachAddon | null = null;
  private serializeAddon: SerializeAddon | null = null;
  
  private websocket: WebSocket | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private currentWebsocketUrl: string = '';
  
  private config: Required<TerminalServiceConfig>;
  private mounted: boolean = false;
  private disposed: boolean = false;
  
  private renderingBackend: RenderingBackend = 'canvas';
  private webglSupported: boolean = false;
  private webglContextLost: boolean = false;
  
  private eventHandlers: Map<string, Set<Function>> = new Map();
  private disposables: IDisposable[] = [];
  
  private metricsInterval: ReturnType<typeof setInterval> | null = null;
  private frameCount: number = 0;
  private frameTimes: number[] = [];
  private lastFrameTime: number = 0;

  constructor(config: TerminalServiceConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      theme: { ...DEFAULT_THEME, ...config.theme },
      terminalOptions: { ...DEFAULT_CONFIG.terminalOptions, ...config.terminalOptions },
    };
    
    this.checkWebGLSupport();
  }

  /**
   * Check if WebGL is supported in the current browser
   */
  private checkWebGLSupport(): void {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      this.webglSupported = !!gl;
      
      if (gl) {
        // Clean up test context
        const loseContext = gl.getExtension('WEBGL_lose_context');
        if (loseContext) {
          loseContext.loseContext();
        }
      }
    } catch (e) {
      this.webglSupported = false;
    }
  }

  /**
   * Mount terminal to a DOM container
   */
  public mount(container: HTMLElement): void {
    if (this.disposed) {
      throw new Error('TerminalService has been disposed');
    }
    
    if (this.mounted) {
      throw new Error('Terminal is already mounted');
    }

    // Create terminal instance
    this.terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: this.config.fontFamily,
      fontSize: this.config.fontSize,
      lineHeight: this.config.lineHeight,
      letterSpacing: this.config.letterSpacing,
      scrollback: this.config.scrollback,
      theme: this.config.theme,
      allowProposedApi: true,
      ...this.config.terminalOptions,
    });

    // Initialize addons
    this.initializeAddons();
    
    // Open terminal in container
    this.terminal.open(container);
    this.mounted = true;
    
    // Attach WebGL addon after opening
    this.attachWebGLAddon();
    
    // Initial fit
    this.fit();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Start metrics collection if enabled
    if (this.config.enableMetrics) {
      this.startMetricsCollection();
    }
    
    // Auto-connect if URL provided
    if (this.config.websocketUrl) {
      this.connect(this.config.websocketUrl);
    }
  }

  /**
   * Initialize terminal addons
   */
  private initializeAddons(): void {
    if (!this.terminal) return;

    // Fit addon - always loaded
    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);

    // Serialize addon - always loaded
    this.serializeAddon = new SerializeAddon();
    this.terminal.loadAddon(this.serializeAddon);

    // Web links addon - conditional
    if (this.config.enableLinks) {
      this.webLinksAddon = new WebLinksAddon(this.config.linkHandler);
      this.terminal.loadAddon(this.webLinksAddon);
    }
  }

  /**
   * Attach WebGL addon with fallback handling
   */
  private attachWebGLAddon(): void {
    if (!this.terminal || !this.config.enableWebGL || !this.webglSupported) {
      this.renderingBackend = 'canvas';
      this.logMetric('Rendering backend: canvas (WebGL disabled or unsupported)');
      return;
    }

    try {
      this.webglAddon = new WebglAddon();
      
      // Handle WebGL context loss
      this.webglAddon.onContextLoss(() => {
        this.handleWebGLContextLoss();
      });
      
      this.terminal.loadAddon(this.webglAddon);
      this.renderingBackend = 'webgl';
      this.logMetric('Rendering backend: webgl');
    } catch (error) {
      console.warn('WebGL addon failed to load, falling back to canvas:', error);
      this.webglAddon = null;
      this.renderingBackend = 'canvas';
      this.logMetric('Rendering backend: canvas (WebGL addon failed)');
    }
  }

  /**
   * Handle WebGL context loss
   */
  private handleWebGLContextLoss(): void {
    this.webglContextLost = true;
    this.emitEvent('onWebGLContextLost');
    
    console.warn('WebGL context lost, attempting recovery...');
    
    // Dispose of WebGL addon
    if (this.webglAddon) {
      this.webglAddon.dispose();
      this.webglAddon = null;
    }
    
    // Fall back to canvas rendering
    this.renderingBackend = 'canvas';
    
    // Attempt to restore WebGL after a delay
    setTimeout(() => {
      this.attemptWebGLRecovery();
    }, 1000);
  }

  /**
   * Attempt to recover WebGL context
   */
  private attemptWebGLRecovery(): void {
    if (!this.terminal || !this.config.enableWebGL || !this.webglSupported) {
      return;
    }

    try {
      this.webglAddon = new WebglAddon();
      this.webglAddon.onContextLoss(() => {
        this.handleWebGLContextLoss();
      });
      
      this.terminal.loadAddon(this.webglAddon);
      this.renderingBackend = 'webgl';
      this.webglContextLost = false;
      
      this.emitEvent('onWebGLContextRestored');
      this.logMetric('WebGL context restored');
    } catch (error) {
      console.warn('WebGL recovery failed, staying on canvas:', error);
      this.renderingBackend = 'canvas';
    }
  }

  /**
   * Setup terminal event listeners
   */
  private setupEventListeners(): void {
    if (!this.terminal) return;

    this.disposables.push(
      this.terminal.onData((data) => {
        this.emitEvent('onData', data);
      }),
      
      this.terminal.onBinary((data) => {
        this.emitEvent('onBinary', data);
      }),
      
      this.terminal.onKey((event) => {
        this.emitEvent('onKey', event);
      }),
      
      this.terminal.onResize(({ cols, rows }) => {
        this.emitEvent('onResize', cols, rows);
      }),
      
      this.terminal.onTitleChange((title) => {
        this.emitEvent('onTitleChange', title);
      }),
      
      this.terminal.onSelectionChange(() => {
        this.emitEvent('onSelectionChange');
      })
    );
  }

  /**
   * Emit event to registered handlers
   */
  private emitEvent(event: string, ...args: unknown[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Subscribe to terminal events
   */
  public on<K extends keyof TerminalEvents>(
    event: K,
    handler: TerminalEvents[K]
  ): IDisposable {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    
    const handlers = this.eventHandlers.get(event)!;
    handlers.add(handler);
    
    return {
      dispose: () => {
        handlers.delete(handler);
      },
    };
  }

  /**
   * Write data to terminal
   */
  public write(data: string | Uint8Array): void {
    this.terminal?.write(data);
  }

  /**
   * Write line to terminal
   */
  public writeln(line: string): void {
    this.terminal?.writeln(line);
  }

  /**
   * Clear terminal buffer
   */
  public clear(): void {
    this.terminal?.clear();
  }

  /**
   * Reset terminal state
   */
  public reset(): void {
    this.terminal?.reset();
  }

  /**
   * Focus the terminal
   */
  public focus(): void {
    this.terminal?.focus();
  }

  /**
   * Blur the terminal
   */
  public blur(): void {
    this.terminal?.blur();
  }

  /**
   * Fit terminal to container
   */
  public fit(): void {
    if (this.fitAddon && this.mounted) {
      try {
        this.fitAddon.fit();
      } catch (error) {
        console.warn('Failed to fit terminal:', error);
      }
    }
  }

  /**
   * Get current dimensions
   */
  public getDimensions(): { cols: number; rows: number } {
    return {
      cols: this.terminal?.cols ?? 80,
      rows: this.terminal?.rows ?? 24,
    };
  }

  /**
   * Get serialized terminal content
   */
  public serialize(): string {
    return this.serializeAddon?.serialize() ?? '';
  }

  /**
   * Get current selection text
   */
  public getSelection(): string {
    return this.terminal?.getSelection() ?? '';
  }

  /**
   * Connect to WebSocket backend
   */
  public async connect(url: string): Promise<void> {
    if (this.disposed) {
      throw new Error('TerminalService has been disposed');
    }

    this.currentWebsocketUrl = url;
    this.setConnectionState('connecting');

    return new Promise((resolve, reject) => {
      try {
        this.websocket = new WebSocket(url);
        
        this.websocket.onopen = () => {
          this.setConnectionState('connected');
          this.reconnectAttempts = 0;
          
          // Attach the terminal to websocket
          if (this.terminal && this.websocket) {
            this.attachAddon = new AttachAddon(this.websocket);
            this.terminal.loadAddon(this.attachAddon);
          }
          
          resolve();
        };
        
        this.websocket.onerror = (event) => {
          console.error('WebSocket error:', event);
          this.setConnectionState('error');
          reject(new Error('WebSocket connection failed'));
        };
        
        this.websocket.onclose = () => {
          this.handleWebSocketClose();
        };
      } catch (error) {
        this.setConnectionState('error');
        reject(error);
      }
    });
  }

  /**
   * Handle WebSocket close event
   */
  private handleWebSocketClose(): void {
    // Dispose of attach addon
    if (this.attachAddon) {
      this.attachAddon.dispose();
      this.attachAddon = null;
    }

    if (this.connectionState === 'connected') {
      // Unexpected disconnect - attempt reconnection
      this.attemptReconnect();
    } else {
      this.setConnectionState('disconnected');
    }
  }

  /**
   * Attempt to reconnect to WebSocket
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setConnectionState('error');
      return;
    }

    this.setConnectionState('reconnecting');
    this.reconnectAttempts++;

    setTimeout(() => {
      if (this.connectionState === 'reconnecting') {
        this.connect(this.currentWebsocketUrl).catch(() => {
          this.attemptReconnect();
        });
      }
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  /**
   * Disconnect from WebSocket backend
   */
  public disconnect(): void {
    if (this.websocket) {
      this.setConnectionState('disconnected');
      this.websocket.close();
      this.websocket = null;
    }
    
    if (this.attachAddon) {
      this.attachAddon.dispose();
      this.attachAddon = null;
    }
  }

  /**
   * Reconnect to WebSocket backend
   */
  public async reconnect(): Promise<void> {
    this.disconnect();
    this.reconnectAttempts = 0;
    
    if (this.currentWebsocketUrl) {
      return this.connect(this.currentWebsocketUrl);
    }
    
    throw new Error('No WebSocket URL configured');
  }

  /**
   * Set connection state and emit event
   */
  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    this.emitEvent('onConnectionStateChange', state);
  }

  /**
   * Get current connection state
   */
  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Get performance metrics
   */
  public getMetrics(): TerminalMetrics {
    const averageFrameTime = this.frameTimes.length > 0
      ? this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
      : 0;

    return {
      renderingBackend: this.renderingBackend,
      webglSupported: this.webglSupported,
      webglContextLost: this.webglContextLost,
      framesRendered: this.frameCount,
      averageFrameTime,
      lastFrameTime: this.lastFrameTime,
      memoryUsage: (performance as any).memory?.usedJSHeapSize,
    };
  }

  /**
   * Get rendering backend type
   */
  public getRenderingBackend(): RenderingBackend {
    return this.renderingBackend;
  }

  /**
   * Check if WebGL is supported
   */
  public isWebGLSupported(): boolean {
    return this.webglSupported;
  }

  /**
   * Update terminal options
   */
  public setOptions(options: Partial<ITerminalOptions>): void {
    if (this.terminal) {
      Object.entries(options).forEach(([key, value]) => {
        this.terminal!.options[key as keyof ITerminalOptions] = value;
      });
    }
  }

  /**
   * Update theme
   */
  public setTheme(theme: Partial<TerminalTheme>): void {
    const mergedTheme = { ...this.config.theme, ...theme };
    this.config.theme = mergedTheme;
    this.setOptions({ theme: mergedTheme });
  }

  /**
   * Scroll to bottom
   */
  public scrollToBottom(): void {
    this.terminal?.scrollToBottom();
  }

  /**
   * Scroll to top
   */
  public scrollToTop(): void {
    this.terminal?.scrollToTop();
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      const metrics = this.getMetrics();
      this.emitEvent('onMetricsUpdate', metrics);
    }, this.config.metricsInterval);
  }

  /**
   * Log metric for debugging
   */
  private logMetric(message: string): void {
    if (this.config.enableMetrics) {
      console.log(`[TerminalService] ${message}`);
    }
  }

  /**
   * Dispose of terminal and cleanup resources
   */
  public dispose(): void {
    if (this.disposed) return;
    
    this.disposed = true;
    this.mounted = false;

    // Stop metrics collection
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    // Disconnect WebSocket
    this.disconnect();

    // Dispose of all registered disposables
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];

    // Dispose of addons
    this.webglAddon?.dispose();
    this.fitAddon?.dispose();
    this.webLinksAddon?.dispose();
    this.serializeAddon?.dispose();

    this.webglAddon = null;
    this.fitAddon = null;
    this.webLinksAddon = null;
    this.serializeAddon = null;

    // Dispose of terminal
    this.terminal?.dispose();
    this.terminal = null;

    // Clear event handlers
    this.eventHandlers.clear();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new terminal service instance
 */
export function createTerminalService(config?: TerminalServiceConfig): ITerminalService {
  return new TerminalService(config);
}

export default TerminalService;
