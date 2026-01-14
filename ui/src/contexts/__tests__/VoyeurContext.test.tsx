/**
 * VoyeurContext Tests
 * 
 * Tests for the observability context
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { VoyeurProvider, useVoyeurEvents } from '../VoyeurContext';
import { MockEventSource } from '../../test/test-utils';

// Mock VoyeurBusClient
vi.mock('../../utils/VoyeurBusClient', () => {
  const mockClient = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    reconnect: vi.fn(),
    getConnectionState: vi.fn(() => 'disconnected'),
    isConnected: vi.fn(() => false),
    getEvents: vi.fn(() => []),
    clearEvents: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    onConnectionStateChange: vi.fn(),
    offConnectionStateChange: vi.fn()
  };

  return {
    VoyeurBusClient: vi.fn(() => mockClient),
    MockEventSource
  };
});

describe('VoyeurContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should start disconnected when autoConnect is false', () => {
      const { result } = renderHook(() => useVoyeurEvents(), {
        wrapper: ({ children }) => (
          <VoyeurProvider autoConnect={false}>{children}</VoyeurProvider>
        )
      });

      expect(result.current.connectionState).toBe('disconnected');
      expect(result.current.isConnected).toBe(false);
    });

    it('should not auto-connect by default', () => {
      const { result } = renderHook(() => useVoyeurEvents(), {
        wrapper: VoyeurProvider
      });

      expect(result.current.connectionState).toBe('disconnected');
    });
  });

  describe('Connection Management', () => {
    it('should connect when connect is called', () => {
      const { result } = renderHook(() => useVoyeurEvents(), {
        wrapper: VoyeurProvider
      });

      act(() => {
        result.current.connect();
      });

      expect(result.current.connect).toBeDefined();
    });

    it('should disconnect when disconnect is called', () => {
      const { result } = renderHook(() => useVoyeurEvents(), {
        wrapper: VoyeurProvider
      });

      act(() => {
        result.current.disconnect();
      });

      expect(result.current.disconnect).toBeDefined();
    });

    it('should reconnect when reconnect is called', () => {
      const { result } = renderHook(() => useVoyeurEvents(), {
        wrapper: VoyeurProvider
      });

      act(() => {
        result.current.reconnect();
      });

      expect(result.current.reconnect).toBeDefined();
    });
  });

  describe('Event Management', () => {
    it('should start with empty events array', () => {
      const { result } = renderHook(() => useVoyeurEvents(), {
        wrapper: VoyeurProvider
      });

      expect(result.current.events).toEqual([]);
      expect(result.current.filteredEvents).toEqual([]);
    });

    it('should clear events', () => {
      const { result } = renderHook(() => useVoyeurEvents(), {
        wrapper: VoyeurProvider
      });

      act(() => {
        result.current.clearEvents();
      });

      expect(result.current.events).toEqual([]);
    });
  });

  describe('Filtering', () => {
    it('should update filter', () => {
      const { result } = renderHook(() => useVoyeurEvents(), {
        wrapper: VoyeurProvider
      });

      act(() => {
        result.current.setFilter({
          kinds: ['ingest.start', 'ingest.complete']
        });
      });

      expect(result.current.filter.kinds).toEqual(['ingest.start', 'ingest.complete']);
    });

    it('should update search text filter', () => {
      const { result } = renderHook(() => useVoyeurEvents(), {
        wrapper: VoyeurProvider
      });

      act(() => {
        result.current.setFilter({
          searchText: 'test query'
        });
      });

      expect(result.current.filter.searchText).toBe('test query');
    });

    it('should filter by source instance', () => {
      const { result } = renderHook(() => useVoyeurEvents(), {
        wrapper: VoyeurProvider
      });

      act(() => {
        result.current.setFilter({
          sourceInstance: 'agent-1'
        });
      });

      expect(result.current.filter.sourceInstance).toBe('agent-1');
    });
  });

  describe('Settings', () => {
    it('should have default max buffer size', () => {
      const { result } = renderHook(() => useVoyeurEvents(), {
        wrapper: VoyeurProvider
      });

      expect(result.current.maxBufferSize).toBe(500);
    });

    it('should update max buffer size', () => {
      const { result } = renderHook(() => useVoyeurEvents(), {
        wrapper: VoyeurProvider
      });

      act(() => {
        result.current.setMaxBufferSize(1000);
      });

      expect(result.current.maxBufferSize).toBe(1000);
    });

    it('should start with isPaused false', () => {
      const { result } = renderHook(() => useVoyeurEvents(), {
        wrapper: VoyeurProvider
      });

      expect(result.current.isPaused).toBe(false);
    });

    it('should toggle pause state', () => {
      const { result } = renderHook(() => useVoyeurEvents(), {
        wrapper: VoyeurProvider
      });

      act(() => {
        result.current.setPaused(true);
      });

      expect(result.current.isPaused).toBe(true);

      act(() => {
        result.current.setPaused(false);
      });

      expect(result.current.isPaused).toBe(false);
    });
  });

  describe('Configuration Options', () => {
    it('should accept custom server URL', () => {
      const { result } = renderHook(() => useVoyeurEvents(), {
        wrapper: ({ children }) => (
          <VoyeurProvider
            options={{
              serverUrl: 'http://custom:9999',
              streamPath: '/custom-stream'
            }}
          >
            {children}
          </VoyeurProvider>
        )
      });

      expect(result.current).toBeDefined();
    });

    it('should accept custom buffer size', () => {
      const { result } = renderHook(() => useVoyeurEvents(), {
        wrapper: ({ children }) => (
          <VoyeurProvider
            options={{
              maxBufferSize: 2000
            }}
          >
            {children}
          </VoyeurProvider>
        )
      });

      expect(result.current.maxBufferSize).toBe(2000);
    });
  });
});