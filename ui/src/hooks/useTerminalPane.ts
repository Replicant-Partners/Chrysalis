/**
 * useTerminalPane - React hook for terminal pane management
 * 
 * Provides a convenient interface for managing terminal panes,
 * integrating with VoyeurBus, and handling terminal state.
 * 
 * @module ui/hooks/useTerminalPane
 */

import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import type { 
  TerminalPaneHandle, 
  TerminalPaneProps 
} from '../components/TerminalPane';
import type { 
  TerminalTheme, 
  TerminalMetrics, 
  ConnectionState,
  RenderingBackend 
} from '../services/terminal';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for useTerminalPane hook
 */
export interface UseTerminalPaneOptions {
  /** Unique pane identifier */
  paneId: string;
  /** WebSocket URL for backend connection */
  websocketUrl?: string;
  /** Whether to auto-connect on mount */
  autoConnect?: boolean;
  /** Initial content to write */
  initialContent?: string;
  /** Custom theme */
  theme?: Partial<TerminalTheme>;
  /** Whether terminal is read-only */
  readOnly?: boolean;
  /** Callback when data is received */
  onData?: (data: string) => void;
  /** Callback when resized */
  onResize?: (cols: number, rows: number) => void;
  /** Callback on connection state change */
  onConnectionStateChange?: (state: ConnectionState) => void;
}

/**
 * Return type for useTerminalPane hook
 */
export interface UseTerminalPaneResult {
  /** Ref to attach to TerminalPane component */
  terminalRef: React.RefObject<TerminalPaneHandle>;
  /** Current connection state */
  connectionState: ConnectionState;
  /** Current rendering backend */
  renderingBackend: RenderingBackend;
  /** Whether WebGL context was lost */
  webglContextLost: boolean;
  /** Current terminal dimensions */
  dimensions: { cols: number; rows: number };
  /** Current metrics */
  metrics: TerminalMetrics | null;
  /** Props to spread on TerminalPane */
  terminalProps: Partial<TerminalPaneProps>;
  /** Actions */
  actions: {
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
    /** Fit terminal to container */
    fit: () => void;
    /** Connect to WebSocket */
    connect: (url?: string) => Promise<void>;
    /** Disconnect from WebSocket */
    disconnect: () => void;
    /** Reconnect */
    reconnect: () => Promise<void>;
    /** Get serialized content */
    serialize: () => string;
    /** Get selected text */
    getSelection: () => string;
    /** Update theme */
    setTheme: (theme: Partial<TerminalTheme>) => void;
    /** Scroll to bottom */
    scrollToBottom: () => void;
  };
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing terminal pane state and actions
 */
export function useTerminalPane(
  options: UseTerminalPaneOptions
): UseTerminalPaneResult {
  const {
    paneId,
    websocketUrl,
    autoConnect = false,
    initialContent,
    theme,
    readOnly = false,
    onData,
    onResize,
    onConnectionStateChange,
  } = options;

  const terminalRef = useRef<TerminalPaneHandle>(null);
  
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [renderingBackend, setRenderingBackend] = useState<RenderingBackend>('canvas');
  const [webglContextLost, setWebglContextLost] = useState(false);
  const [dimensions, setDimensions] = useState({ cols: 80, rows: 24 });
  const [metrics, setMetrics] = useState<TerminalMetrics | null>(null);

  // Handle connection state changes
  const handleConnectionStateChange = useCallback((state: ConnectionState) => {
    setConnectionState(state);
    onConnectionStateChange?.(state);
  }, [onConnectionStateChange]);

  // Handle resize events
  const handleResize = useCallback((cols: number, rows: number) => {
    setDimensions({ cols, rows });
    onResize?.(cols, rows);
  }, [onResize]);

  // Handle metrics updates
  const handleMetricsUpdate = useCallback((newMetrics: TerminalMetrics) => {
    setMetrics(newMetrics);
    setRenderingBackend(newMetrics.renderingBackend);
    setWebglContextLost(newMetrics.webglContextLost);
  }, []);

  // Actions
  const write = useCallback((data: string | Uint8Array) => {
    terminalRef.current?.write(data);
  }, []);

  const writeln = useCallback((line: string) => {
    terminalRef.current?.writeln(line);
  }, []);

  const clear = useCallback(() => {
    terminalRef.current?.clear();
  }, []);

  const reset = useCallback(() => {
    terminalRef.current?.reset();
  }, []);

  const focus = useCallback(() => {
    terminalRef.current?.focus();
  }, []);

  const fit = useCallback(() => {
    terminalRef.current?.fit();
  }, []);

  const connect = useCallback(async (url?: string) => {
    const targetUrl = url || websocketUrl;
    if (targetUrl) {
      await terminalRef.current?.connect(targetUrl);
    }
  }, [websocketUrl]);

  const disconnect = useCallback(() => {
    terminalRef.current?.disconnect();
  }, []);

  const reconnect = useCallback(async () => {
    await terminalRef.current?.reconnect();
  }, []);

  const serialize = useCallback(() => {
    return terminalRef.current?.serialize() ?? '';
  }, []);

  const getSelection = useCallback(() => {
    return terminalRef.current?.getSelection() ?? '';
  }, []);

  const setTheme = useCallback((newTheme: Partial<TerminalTheme>) => {
    terminalRef.current?.setTheme(newTheme);
  }, []);

  const scrollToBottom = useCallback(() => {
    terminalRef.current?.scrollToBottom();
  }, []);

  // Update dimensions when ref changes
  useEffect(() => {
    if (terminalRef.current) {
      const dims = terminalRef.current.getDimensions();
      setDimensions(dims);
      setRenderingBackend(terminalRef.current.getRenderingBackend());
    }
  }, []);

  // Build terminal props
  const terminalProps = useMemo<Partial<TerminalPaneProps>>(() => ({
    paneId,
    websocketUrl,
    autoConnect,
    initialContent,
    theme,
    readOnly,
    onData,
    onResize: handleResize,
    onConnectionStateChange: handleConnectionStateChange,
    onMetricsUpdate: handleMetricsUpdate,
  }), [
    paneId,
    websocketUrl,
    autoConnect,
    initialContent,
    theme,
    readOnly,
    onData,
    handleResize,
    handleConnectionStateChange,
    handleMetricsUpdate,
  ]);

  // Build actions object
  const actions = useMemo(() => ({
    write,
    writeln,
    clear,
    reset,
    focus,
    fit,
    connect,
    disconnect,
    reconnect,
    serialize,
    getSelection,
    setTheme,
    scrollToBottom,
  }), [
    write,
    writeln,
    clear,
    reset,
    focus,
    fit,
    connect,
    disconnect,
    reconnect,
    serialize,
    getSelection,
    setTheme,
    scrollToBottom,
  ]);

  return {
    terminalRef,
    connectionState,
    renderingBackend,
    webglContextLost,
    dimensions,
    metrics,
    terminalProps,
    actions,
  };
}

// ============================================================================
// Voyeur Integration Hook
// ============================================================================

/**
 * Options for useVoyeurTerminal hook
 */
export interface UseVoyeurTerminalOptions extends UseTerminalPaneOptions {
  /** Session ID to observe */
  sessionId?: string;
  /** Whether to show timestamps */
  showTimestamps?: boolean;
  /** Maximum buffer lines */
  maxBufferLines?: number;
}

/**
 * Hook for terminal pane integrated with VoyeurBus
 * 
 * Subscribes to VoyeurBus events for a specific session
 * and renders them in the terminal pane.
 */
export function useVoyeurTerminal(
  options: UseVoyeurTerminalOptions
): UseTerminalPaneResult & {
  /** Current session ID being observed */
  sessionId: string | undefined;
  /** Set the session to observe */
  setSessionId: (sessionId: string) => void;
  /** Buffer of raw event data */
  eventBuffer: string[];
} {
  const { sessionId: initialSessionId, showTimestamps = true, maxBufferLines = 10000, ...baseOptions } = options;
  
  const baseResult = useTerminalPane(baseOptions);
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [eventBuffer, setEventBuffer] = useState<string[]>([]);

  // Format event for terminal display
  const formatEvent = useCallback((event: {
    kind: string;
    timestamp: string;
    data?: unknown;
    sourceInstance?: string;
  }): string => {
    const timestamp = showTimestamps 
      ? `\x1b[90m[${new Date(event.timestamp).toLocaleTimeString()}]\x1b[0m ` 
      : '';
    
    const source = event.sourceInstance 
      ? `\x1b[36m@${event.sourceInstance}\x1b[0m ` 
      : '';
    
    // Color code by event kind
    let kindColor = '37'; // white
    if (event.kind.includes('error')) kindColor = '31'; // red
    else if (event.kind.includes('complete') || event.kind.includes('success')) kindColor = '32'; // green
    else if (event.kind.includes('start') || event.kind.includes('request')) kindColor = '33'; // yellow
    else if (event.kind.includes('match') || event.kind.includes('found')) kindColor = '34'; // blue
    
    const kind = `\x1b[${kindColor}m[${event.kind}]\x1b[0m`;
    
    const data = event.data 
      ? ` ${typeof event.data === 'string' ? event.data : JSON.stringify(event.data)}`
      : '';
    
    return `${timestamp}${source}${kind}${data}`;
  }, [showTimestamps]);

  // Write event to terminal
  const writeEvent = useCallback((event: {
    kind: string;
    timestamp: string;
    data?: unknown;
    sourceInstance?: string;
  }) => {
    const formatted = formatEvent(event);
    baseResult.actions.writeln(formatted);
    
    // Update buffer
    setEventBuffer(prev => {
      const next = [...prev, formatted];
      if (next.length > maxBufferLines) {
        return next.slice(-maxBufferLines);
      }
      return next;
    });
  }, [formatEvent, baseResult.actions, maxBufferLines]);

  return {
    ...baseResult,
    sessionId,
    setSessionId,
    eventBuffer,
  };
}

export default useTerminalPane;
