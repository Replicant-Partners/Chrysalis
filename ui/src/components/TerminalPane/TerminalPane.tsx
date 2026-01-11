/**
 * TerminalPane - React component for embedded terminal emulation
 * 
 * Wraps the TerminalService to provide a React-friendly terminal component
 * that integrates with the ChatPane container hierarchy and VoyeurPane.
 * 
 * Features:
 * - WebGL-accelerated rendering with automatic fallback
 * - Automatic resize handling
 * - Theme synchronization
 * - Connection state management
 * - Error boundaries for WebGL context loss
 * 
 * @module ui/components/TerminalPane
 */

import React, { 
  useRef, 
  useEffect, 
  useCallback, 
  useState, 
  forwardRef, 
  useImperativeHandle,
  useMemo 
} from 'react';
import { 
  createTerminalService,
  type ITerminalService,
  type TerminalServiceConfig,
  type TerminalTheme,
  type TerminalMetrics,
  type ConnectionState,
  type RenderingBackend
} from '../../services/terminal';
import { Badge, Button } from '../design-system';
import styles from './TerminalPane.module.css';

// Import xterm.js CSS
import '@xterm/xterm/css/xterm.css';

// ============================================================================
// Types
// ============================================================================

/**
 * Props for TerminalPane component
 */
export interface TerminalPaneProps {
  /** Unique identifier for this terminal pane */
  paneId: string;
  /** Title displayed in the pane header */
  title?: string;
  /** WebSocket URL for backend connection */
  websocketUrl?: string;
  /** Whether to auto-connect on mount */
  autoConnect?: boolean;
  /** Terminal configuration options */
  config?: Partial<TerminalServiceConfig>;
  /** Custom theme overrides */
  theme?: Partial<TerminalTheme>;
  /** Callback when terminal is ready */
  onReady?: (terminal: ITerminalService) => void;
  /** Callback when data is received from user input */
  onData?: (data: string) => void;
  /** Callback when terminal is resized */
  onResize?: (cols: number, rows: number) => void;
  /** Callback when connection state changes */
  onConnectionStateChange?: (state: ConnectionState) => void;
  /** Callback when metrics are updated */
  onMetricsUpdate?: (metrics: TerminalMetrics) => void;
  /** Whether to show the header bar */
  showHeader?: boolean;
  /** Whether to show connection status */
  showConnectionStatus?: boolean;
  /** Whether to show rendering backend indicator */
  showRenderingBackend?: boolean;
  /** Additional CSS class names */
  className?: string;
  /** Inline styles */
  style?: React.CSSProperties;
  /** Initial content to write to terminal */
  initialContent?: string;
  /** Whether the terminal is read-only */
  readOnly?: boolean;
}

/**
 * Ref handle exposed by TerminalPane
 */
export interface TerminalPaneHandle {
  /** Write data to terminal */
  write: (data: string | Uint8Array) => void;
  /** Write line to terminal */
  writeln: (line: string) => void;
  /** Clear terminal */
  clear: () => void;
  /** Reset terminal */
  reset: () => void;
  /** Focus terminal */
  focus: () => void;
  /** Blur terminal */
  blur: () => void;
  /** Fit terminal to container */
  fit: () => void;
  /** Get terminal dimensions */
  getDimensions: () => { cols: number; rows: number };
  /** Get serialized content */
  serialize: () => string;
  /** Get selected text */
  getSelection: () => string;
  /** Connect to WebSocket */
  connect: (url: string) => Promise<void>;
  /** Disconnect from WebSocket */
  disconnect: () => void;
  /** Reconnect to WebSocket */
  reconnect: () => Promise<void>;
  /** Get connection state */
  getConnectionState: () => ConnectionState;
  /** Get rendering backend */
  getRenderingBackend: () => RenderingBackend;
  /** Get metrics */
  getMetrics: () => TerminalMetrics;
  /** Update theme */
  setTheme: (theme: Partial<TerminalTheme>) => void;
  /** Scroll to bottom */
  scrollToBottom: () => void;
}

// ============================================================================
// Sub-components
// ============================================================================

interface TerminalHeaderProps {
  title: string;
  connectionState: ConnectionState;
  renderingBackend: RenderingBackend;
  showConnectionStatus: boolean;
  showRenderingBackend: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onReconnect: () => void;
  onClear: () => void;
}

function TerminalHeader({
  title,
  connectionState,
  renderingBackend,
  showConnectionStatus,
  showRenderingBackend,
  onConnect,
  onDisconnect,
  onReconnect,
  onClear,
}: TerminalHeaderProps) {
  const connectionColors: Record<ConnectionState, string> = {
    disconnected: 'secondary',
    connecting: 'warning',
    connected: 'success',
    reconnecting: 'warning',
    error: 'error',
  };

  const connectionLabels: Record<ConnectionState, string> = {
    disconnected: 'Disconnected',
    connecting: 'Connecting...',
    connected: 'Connected',
    reconnecting: 'Reconnecting...',
    error: 'Error',
  };

  return (
    <div className={styles.header}>
      <div className={styles.headerLeft}>
        <span className={styles.headerIcon}>⬛</span>
        <h3 className={styles.headerTitle}>{title}</h3>
        
        {showRenderingBackend && (
          <Badge 
            variant={renderingBackend === 'webgl' ? 'success' : 'secondary'}
            className={styles.backendBadge}
          >
            {renderingBackend === 'webgl' ? '🎮 WebGL' : '🖼️ Canvas'}
          </Badge>
        )}
      </div>
      
      <div className={styles.headerRight}>
        {showConnectionStatus && (
          <Badge variant={connectionColors[connectionState] as any}>
            {connectionLabels[connectionState]}
          </Badge>
        )}
        
        <div className={styles.headerButtons}>
          {connectionState === 'disconnected' && (
            <Button size="sm" onClick={onConnect}>Connect</Button>
          )}
          {connectionState === 'connected' && (
            <Button size="sm" variant="secondary" onClick={onDisconnect}>
              Disconnect
            </Button>
          )}
          {connectionState === 'error' && (
            <Button size="sm" onClick={onReconnect}>Retry</Button>
          )}
          <Button size="sm" variant="secondary" onClick={onClear}>
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Error Boundary
// ============================================================================

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class TerminalErrorBoundary extends React.Component<
  { children: React.ReactNode; onReset: () => void },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; onReset: () => void }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('TerminalPane error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onReset();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.errorContainer}>
          <div className={styles.errorContent}>
            <span className={styles.errorIcon}>⚠️</span>
            <h4>Terminal Error</h4>
            <p>{this.state.error?.message || 'An unknown error occurred'}</p>
            <Button onClick={this.handleReset}>Restart Terminal</Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * TerminalPane component for embedded terminal emulation
 */
export const TerminalPane = forwardRef<TerminalPaneHandle, TerminalPaneProps>(
  function TerminalPane(props, ref) {
    const {
      paneId,
      title = 'Terminal',
      websocketUrl,
      autoConnect = false,
      config = {},
      theme,
      onReady,
      onData,
      onResize,
      onConnectionStateChange,
      onMetricsUpdate,
      showHeader = true,
      showConnectionStatus = true,
      showRenderingBackend = true,
      className,
      style,
      initialContent,
      readOnly = false,
    } = props;

    const containerRef = useRef<HTMLDivElement>(null);
    const terminalServiceRef = useRef<ITerminalService | null>(null);
    const [mounted, setMounted] = useState(false);
    const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
    const [renderingBackend, setRenderingBackend] = useState<RenderingBackend>('canvas');
    const [webglContextLost, setWebglContextLost] = useState(false);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);

    // Merge configuration
    const mergedConfig = useMemo<TerminalServiceConfig>(() => ({
      ...config,
      theme: { ...config.theme, ...theme },
      websocketUrl: websocketUrl || config.websocketUrl,
    }), [config, theme, websocketUrl]);

    // Initialize terminal service
    useEffect(() => {
      if (!containerRef.current) return;

      const service = createTerminalService(mergedConfig);
      terminalServiceRef.current = service;

      // Mount terminal
      service.mount(containerRef.current);
      setMounted(true);
      setRenderingBackend(service.getRenderingBackend());

      // Subscribe to events
      const disposables = [
        service.on('onData', (data) => {
          if (!readOnly) {
            onData?.(data);
          }
        }),
        service.on('onResize', (cols, rows) => {
          onResize?.(cols, rows);
        }),
        service.on('onConnectionStateChange', (state) => {
          setConnectionState(state);
          onConnectionStateChange?.(state);
        }),
        service.on('onWebGLContextLost', () => {
          setWebglContextLost(true);
          setRenderingBackend('canvas');
        }),
        service.on('onWebGLContextRestored', () => {
          setWebglContextLost(false);
          setRenderingBackend('webgl');
        }),
        service.on('onMetricsUpdate', (metrics) => {
          onMetricsUpdate?.(metrics);
        }),
      ];

      // Write initial content
      if (initialContent) {
        service.write(initialContent);
      }

      // Notify ready
      onReady?.(service);

      // Auto-connect if enabled and URL provided
      if (autoConnect && websocketUrl) {
        service.connect(websocketUrl).catch(console.error);
      }

      return () => {
        disposables.forEach((d) => d.dispose());
        service.dispose();
        terminalServiceRef.current = null;
        setMounted(false);
      };
    }, [paneId]); // Only re-initialize on paneId change

    // Handle resize observation
    useEffect(() => {
      if (!containerRef.current || !mounted) return;

      const handleResize = () => {
        terminalServiceRef.current?.fit();
      };

      // Create ResizeObserver for container resize
      resizeObserverRef.current = new ResizeObserver(() => {
        // Debounce resize events
        requestAnimationFrame(handleResize);
      });

      resizeObserverRef.current.observe(containerRef.current);

      // Also listen to window resize
      window.addEventListener('resize', handleResize);

      return () => {
        resizeObserverRef.current?.disconnect();
        window.removeEventListener('resize', handleResize);
      };
    }, [mounted]);

    // Update theme when it changes
    useEffect(() => {
      if (theme && terminalServiceRef.current) {
        terminalServiceRef.current.setTheme(theme);
      }
    }, [theme]);

    // Connection handlers
    const handleConnect = useCallback(() => {
      if (websocketUrl) {
        terminalServiceRef.current?.connect(websocketUrl).catch(console.error);
      }
    }, [websocketUrl]);

    const handleDisconnect = useCallback(() => {
      terminalServiceRef.current?.disconnect();
    }, []);

    const handleReconnect = useCallback(() => {
      terminalServiceRef.current?.reconnect().catch(console.error);
    }, []);

    const handleClear = useCallback(() => {
      terminalServiceRef.current?.clear();
    }, []);

    const handleReset = useCallback(() => {
      // Full reset for error recovery
      if (terminalServiceRef.current) {
        terminalServiceRef.current.dispose();
        terminalServiceRef.current = null;
      }
      
      if (containerRef.current) {
        const service = createTerminalService(mergedConfig);
        terminalServiceRef.current = service;
        service.mount(containerRef.current);
        setMounted(true);
        setRenderingBackend(service.getRenderingBackend());
        
        if (autoConnect && websocketUrl) {
          service.connect(websocketUrl).catch(console.error);
        }
      }
    }, [mergedConfig, autoConnect, websocketUrl]);

    // Expose ref handle
    useImperativeHandle(ref, () => ({
      write: (data) => terminalServiceRef.current?.write(data),
      writeln: (line) => terminalServiceRef.current?.writeln(line),
      clear: () => terminalServiceRef.current?.clear(),
      reset: () => terminalServiceRef.current?.reset(),
      focus: () => terminalServiceRef.current?.focus(),
      blur: () => terminalServiceRef.current?.blur(),
      fit: () => terminalServiceRef.current?.fit(),
      getDimensions: () => terminalServiceRef.current?.getDimensions() ?? { cols: 80, rows: 24 },
      serialize: () => terminalServiceRef.current?.serialize() ?? '',
      getSelection: () => terminalServiceRef.current?.getSelection() ?? '',
      connect: (url) => terminalServiceRef.current?.connect(url) ?? Promise.reject(new Error('Terminal not mounted')),
      disconnect: () => terminalServiceRef.current?.disconnect(),
      reconnect: () => terminalServiceRef.current?.reconnect() ?? Promise.reject(new Error('Terminal not mounted')),
      getConnectionState: () => terminalServiceRef.current?.getConnectionState() ?? 'disconnected',
      getRenderingBackend: () => terminalServiceRef.current?.getRenderingBackend() ?? 'canvas',
      getMetrics: () => terminalServiceRef.current?.getMetrics() ?? {
        renderingBackend: 'canvas',
        webglSupported: false,
        webglContextLost: false,
        framesRendered: 0,
        averageFrameTime: 0,
        lastFrameTime: 0,
      },
      setTheme: (theme) => terminalServiceRef.current?.setTheme(theme),
      scrollToBottom: () => terminalServiceRef.current?.scrollToBottom(),
    }), []);

    return (
      <TerminalErrorBoundary onReset={handleReset}>
        <div 
          className={`${styles.terminalPane} ${className || ''}`} 
          style={style}
          data-pane-id={paneId}
        >
          {showHeader && (
            <TerminalHeader
              title={title}
              connectionState={connectionState}
              renderingBackend={renderingBackend}
              showConnectionStatus={showConnectionStatus}
              showRenderingBackend={showRenderingBackend}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onReconnect={handleReconnect}
              onClear={handleClear}
            />
          )}
          
          {webglContextLost && (
            <div className={styles.contextLostWarning}>
              <span>⚠️ WebGL context lost - using canvas fallback</span>
            </div>
          )}
          
          <div 
            ref={containerRef} 
            className={styles.terminalContainer}
            data-read-only={readOnly}
          />
        </div>
      </TerminalErrorBoundary>
    );
  }
);

export default TerminalPane;
