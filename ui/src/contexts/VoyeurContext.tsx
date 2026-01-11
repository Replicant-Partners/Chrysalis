/**
 * VoyeurContext - React context for observability events
 * 
 * Provides access to VoyeurBus events throughout the application.
 * Manages connection lifecycle, event buffering, and filtering.
 * 
 * @module ui/contexts/VoyeurContext
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  ReactNode
} from 'react';
import {
  VoyeurBusClient,
  VoyeurEvent,
  VoyeurEventKind,
  ConnectionState,
  VoyeurBusClientOptions
} from '../utils/VoyeurBusClient';

// ============================================================================
// Types
// ============================================================================

export interface VoyeurFilter {
  /** Filter by event kind (empty = all) */
  kinds?: VoyeurEventKind[];
  /** Filter by source instance */
  sourceInstance?: string;
  /** Filter by minimum similarity threshold */
  minSimilarity?: number;
  /** Search text in event details */
  searchText?: string;
}

export interface VoyeurContextValue {
  // Connection state
  connectionState: ConnectionState;
  isConnected: boolean;
  
  // Events
  events: VoyeurEvent[];
  filteredEvents: VoyeurEvent[];
  
  // Connection control
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;
  
  // Event management
  clearEvents: () => void;
  
  // Filtering
  filter: VoyeurFilter;
  setFilter: (filter: VoyeurFilter) => void;
  
  // Settings
  maxBufferSize: number;
  setMaxBufferSize: (size: number) => void;
  isPaused: boolean;
  setPaused: (paused: boolean) => void;
}

// ============================================================================
// Context
// ============================================================================

const VoyeurContext = createContext<VoyeurContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

export interface VoyeurProviderProps {
  children: ReactNode;
  /** Client configuration options */
  options?: VoyeurBusClientOptions;
  /** Auto-connect on mount (default: false) */
  autoConnect?: boolean;
}

export function VoyeurProvider({ 
  children, 
  options = {},
  autoConnect = false
}: VoyeurProviderProps) {
  // Client instance
  const clientRef = useRef<VoyeurBusClient | null>(null);
  
  // State
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [events, setEvents] = useState<VoyeurEvent[]>([]);
  const [filter, setFilter] = useState<VoyeurFilter>({});
  const [maxBufferSize, setMaxBufferSizeState] = useState(options.maxBufferSize || 500);
  const [isPaused, setPaused] = useState(false);

  // Initialize client
  useEffect(() => {
    const client = new VoyeurBusClient({
      ...options,
      debug: true // Enable debug logging
    });
    
    clientRef.current = client;

    // Listen to connection state changes
    const stateListener = (state: ConnectionState) => {
      setConnectionState(state);
    };
    client.addStateListener(stateListener);

    // Listen to events
    const eventListener = (event: VoyeurEvent) => {
      if (!isPaused) {
        setEvents(prev => {
          const updated = [...prev, event];
          // Trim to max buffer size
          if (updated.length > maxBufferSize) {
            return updated.slice(-maxBufferSize);
          }
          return updated;
        });
      }
    };
    client.addEventListener(eventListener);

    // Auto-connect if enabled
    if (autoConnect) {
      client.connect();
    }

    // Cleanup
    return () => {
      client.removeStateListener(stateListener);
      client.removeEventListener(eventListener);
      client.destroy();
    };
  }, [options.serverUrl, options.streamPath, autoConnect]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update max buffer size
  useEffect(() => {
    setEvents(prev => {
      if (prev.length > maxBufferSize) {
        return prev.slice(-maxBufferSize);
      }
      return prev;
    });
  }, [maxBufferSize]);

  // Connection control
  const connect = useCallback(() => {
    clientRef.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
  }, []);

  const reconnect = useCallback(() => {
    clientRef.current?.disconnect();
    setTimeout(() => {
      clientRef.current?.connect();
    }, 100);
  }, []);

  // Event management
  const clearEvents = useCallback(() => {
    setEvents([]);
    clientRef.current?.clearEvents();
  }, []);

  const setMaxBufferSize = useCallback((size: number) => {
    setMaxBufferSizeState(Math.max(10, Math.min(10000, size)));
  }, []);

  // Filter events
  const filteredEvents = useMemo(() => {
    let result = events;

    // Filter by kinds
    if (filter.kinds && filter.kinds.length > 0) {
      result = result.filter(event => filter.kinds!.includes(event.kind));
    }

    // Filter by source instance
    if (filter.sourceInstance) {
      result = result.filter(event => 
        event.sourceInstance === filter.sourceInstance
      );
    }

    // Filter by minimum similarity
    if (filter.minSimilarity !== undefined) {
      result = result.filter(event => 
        event.similarity !== undefined && event.similarity >= filter.minSimilarity!
      );
    }

    // Search in event details
    if (filter.searchText) {
      const searchLower = filter.searchText.toLowerCase();
      result = result.filter(event => {
        const eventStr = JSON.stringify(event).toLowerCase();
        return eventStr.includes(searchLower);
      });
    }

    return result;
  }, [events, filter]);

  // Context value
  const value: VoyeurContextValue = useMemo(() => ({
    connectionState,
    isConnected: connectionState === 'connected',
    
    events,
    filteredEvents,
    
    connect,
    disconnect,
    reconnect,
    
    clearEvents,
    
    filter,
    setFilter,
    
    maxBufferSize,
    setMaxBufferSize,
    isPaused,
    setPaused
  }), [
    connectionState,
    events,
    filteredEvents,
    connect,
    disconnect,
    reconnect,
    clearEvents,
    filter,
    maxBufferSize,
    setMaxBufferSize,
    isPaused
  ]);

  return (
    <VoyeurContext.Provider value={value}>
      {children}
    </VoyeurContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access VoyeurBus events and controls
 */
export function useVoyeurEvents(): VoyeurContextValue {
  const context = useContext(VoyeurContext);
  if (!context) {
    throw new Error('useVoyeurEvents must be used within a VoyeurProvider');
  }
  return context;
}

export default VoyeurContext;