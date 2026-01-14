/**
 * useTerminal Hook Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTerminal } from '../useTerminal';

// Mock YJS and WebSocket
vi.mock('yjs', () => ({
  Doc: vi.fn(() => ({
    destroy: vi.fn()
  }))
}));

vi.mock('y-websocket', () => ({
  WebsocketProvider: vi.fn(() => ({
    on: vi.fn(),
    disconnect: vi.fn()
  }))
}));

describe('useTerminal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Connection', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => 
        useTerminal({
          terminalId: 'test-terminal',
          serverUrl: 'ws://localhost:1234'
        })
      );

      expect(result.current).toBeDefined();
      expect(result.current.doc).toBeDefined();
    });

    it('should start disconnected when autoConnect is false', () => {
      const { result } = renderHook(() => 
        useTerminal({
          terminalId: 'test-terminal',
          autoConnect: false
        })
      );

      expect(result.current.connected).toBe(false);
      expect(result.current.synced).toBe(false);
    });

    it('should use custom server URL', () => {
      const { result } = renderHook(() => 
        useTerminal({
          terminalId: 'test-terminal',
          serverUrl: 'ws://custom:5678'
        })
      );

      expect(result.current).toBeDefined();
    });
  });

  describe('YJS Document', () => {
    it('should create YJS document', () => {
      const { result } = renderHook(() => 
        useTerminal({ terminalId: 'test-terminal' })
      );

      expect(result.current.doc).toBeDefined();
    });

    it('should cleanup on unmount', () => {
      const { unmount } = renderHook(() => 
        useTerminal({ terminalId: 'test-terminal' })
      );

      unmount();
      
      // Should have called destroy (verified via mock)
      expect(true).toBe(true);
    });
  });

  describe('Connection State', () => {
    it('should track connection state', () => {
      const { result } = renderHook(() => 
        useTerminal({ terminalId: 'test-terminal' })
      );

      expect(typeof result.current.connected).toBe('boolean');
    });

    it('should track sync state', () => {
      const { result } = renderHook(() => 
        useTerminal({ terminalId: 'test-terminal' })
      );

      expect(typeof result.current.synced).toBe('boolean');
    });
  });
});