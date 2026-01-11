/**
 * VoyeurBusClient Tests
 * 
 * Unit tests for the SSE-based observability event client
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VoyeurBusClient, VoyeurEvent, ConnectionState } from '../VoyeurBusClient';
import { MockEventSource } from '../../test/test-utils';

describe('VoyeurBusClient', () => {
  let client: VoyeurBusClient;
  let mockEventSource: MockEventSource;

  beforeEach(() => {
    // Mock EventSource
    mockEventSource = new MockEventSource('http://localhost:8787/voyeur-stream');
    vi.stubGlobal('EventSource', vi.fn(() => mockEventSource));
    
    client = new VoyeurBusClient({
      serverUrl: 'http://localhost:8787',
      streamPath: '/voyeur-stream',
      autoReconnect: false, // Disable for testing
      debug: false
    });
  });

  afterEach(() => {
    client.disconnect();
    vi.unstubAllGlobals();
  });

  describe('Connection Management', () => {
    it('should initialize in disconnected state', () => {
      expect(client.getConnectionState()).toBe('disconnected');
      expect(client.isConnected()).toBe(false);
    });

    it('should connect and change state to connecting', () => {
      client.connect();
      expect(client.getConnectionState()).toBe('connecting');
    });

    it('should change state to connected when EventSource opens', () => {
      const stateChanges: ConnectionState[] = [];
      client.onConnectionStateChange(state => stateChanges.push(state));

      client.connect();
      mockEventSource.simulateOpen();

      expect(client.getConnectionState()).toBe('connected');
      expect(client.isConnected()).toBe(true);
      expect(stateChanges).toContain('connecting');
      expect(stateChanges).toContain('connected');
    });

    it('should disconnect and change state to disconnected', () => {
      client.connect();
      mockEventSource.simulateOpen();
      
      client.disconnect();
      
      expect(client.getConnectionState()).toBe('disconnected');
      expect(client.isConnected()).toBe(false);
    });

    it('should not connect if already connected', () => {
      client.connect();
      mockEventSource.simulateOpen();
      
      const firstEventSource = mockEventSource;
      client.connect(); // Try to connect again
      
      // Should still be the same EventSource instance
      expect(mockEventSource).toBe(firstEventSource);
    });
  });

  describe('Event Handling', () => {
    beforeEach(() => {
      client.connect();
      mockEventSource.simulateOpen();
    });

    it('should receive and buffer events', () => {
      const event: VoyeurEvent = {
        kind: 'ingest.start',
        timestamp: new Date().toISOString(),
        sourceInstance: 'test-instance'
      };

      mockEventSource.simulateMessage(event);
      
      const events = client.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(event);
    });

    it('should call event listeners when events arrive', () => {
      const listener = vi.fn();
      client.addEventListener(listener);

      const event: VoyeurEvent = {
        kind: 'embed.request',
        timestamp: new Date().toISOString(),
        latencyMs: 42
      };

      mockEventSource.simulateMessage(event);
      
      expect(listener).toHaveBeenCalledWith(event);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should call multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      
      client.addEventListener(listener1);
      client.addEventListener(listener2);

      const event: VoyeurEvent = {
        kind: 'match.candidate',
        timestamp: new Date().toISOString(),
        similarity: 0.95
      };

      mockEventSource.simulateMessage(event);
      
      expect(listener1).toHaveBeenCalledWith(event);
      expect(listener2).toHaveBeenCalledWith(event);
    });

    it('should remove event listeners', () => {
      const listener = vi.fn();
      client.addEventListener(listener);
      client.removeEventListener(listener);

      const event: VoyeurEvent = {
        kind: 'error',
        timestamp: new Date().toISOString()
      };

      mockEventSource.simulateMessage(event);
      
      expect(listener).not.toHaveBeenCalled();
    });

    it('should respect max buffer size', () => {
      const smallClient = new VoyeurBusClient({
        maxBufferSize: 3,
        autoReconnect: false
      });
      
      smallClient.connect();
      mockEventSource.simulateOpen();

      // Add 5 events
      for (let i = 0; i < 5; i++) {
        mockEventSource.simulateMessage({
          kind: 'ingest.start',
          timestamp: new Date().toISOString()
        });
      }

      const events = smallClient.getEvents();
      expect(events).toHaveLength(3); // Should only keep last 3
      
      smallClient.disconnect();
    });
  });

  describe('Event Filtering', () => {
    beforeEach(() => {
      client.connect();
      mockEventSource.simulateOpen();

      // Add various events
      const events: VoyeurEvent[] = [
        { kind: 'ingest.start', timestamp: '2024-01-01T10:00:00Z', sourceInstance: 'agent-1' },
        { kind: 'embed.request', timestamp: '2024-01-01T10:01:00Z', sourceInstance: 'agent-2' },
        { kind: 'match.candidate', timestamp: '2024-01-01T10:02:00Z', similarity: 0.95 },
        { kind: 'ingest.complete', timestamp: '2024-01-01T10:03:00Z', sourceInstance: 'agent-1' },
        { kind: 'error', timestamp: '2024-01-01T10:04:00Z' }
      ];

      events.forEach(event => mockEventSource.simulateMessage(event));
    });

    it('should filter by event kind', () => {
      const filtered = client.getEvents({ kinds: ['ingest.start', 'ingest.complete'] });
      
      expect(filtered).toHaveLength(2);
      expect(filtered.every(e => e.kind.startsWith('ingest.'))).toBe(true);
    });

    it('should filter by source instance', () => {
      const filtered = client.getEvents({ sourceInstance: 'agent-1' });
      
      expect(filtered).toHaveLength(2);
      expect(filtered.every(e => e.sourceInstance === 'agent-1')).toBe(true);
    });

    it('should filter by minimum similarity', () => {
      const filtered = client.getEvents({ minSimilarity: 0.9 });
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].similarity).toBeGreaterThanOrEqual(0.9);
    });

    it('should combine multiple filters', () => {
      const filtered = client.getEvents({
        kinds: ['ingest.start', 'embed.request', 'ingest.complete'],
        sourceInstance: 'agent-1'
      });
      
      expect(filtered).toHaveLength(2);
      expect(filtered.every(e => e.sourceInstance === 'agent-1')).toBe(true);
    });
  });

  describe('Clear Events', () => {
    it('should clear all buffered events', () => {
      client.connect();
      mockEventSource.simulateOpen();

      // Add events
      for (let i = 0; i < 5; i++) {
        mockEventSource.simulateMessage({
          kind: 'ingest.start',
          timestamp: new Date().toISOString()
        });
      }

      expect(client.getEvents()).toHaveLength(5);
      
      client.clearEvents();
      
      expect(client.getEvents()).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should change state to error on connection error', () => {
      const stateChanges: ConnectionState[] = [];
      client.onConnectionStateChange(state => stateChanges.push(state));

      client.connect();
      mockEventSource.simulateError();

      expect(stateChanges).toContain('error');
    });

    it('should handle malformed JSON gracefully', () => {
      client.connect();
      mockEventSource.simulateOpen();

      const listener = vi.fn();
      client.addEventListener(listener);

      // Send invalid JSON
      mockEventSource.simulateMessage('invalid json{');

      // Should not crash, listener should not be called
      expect(listener).not.toHaveBeenCalled();
      expect(client.getEvents()).toHaveLength(0);
    });
  });

  describe('Reconnection', () => {
    it('should not reconnect when autoReconnect is false', async () => {
      client.connect();
      mockEventSource.simulateOpen();
      mockEventSource.simulateError();

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should still be in error state
      expect(client.getConnectionState()).toBe('error');
    });

    it('should attempt reconnection when autoReconnect is true', async () => {
      const autoReconnectClient = new VoyeurBusClient({
        autoReconnect: true,
        reconnectDelayMs: 50
      });

      const stateChanges: ConnectionState[] = [];
      autoReconnectClient.onConnectionStateChange(state => stateChanges.push(state));

      autoReconnectClient.connect();
      mockEventSource.simulateOpen();
      mockEventSource.simulateError();

      // Wait for reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(stateChanges).toContain('reconnecting');
      
      autoReconnectClient.disconnect();
    });
  });

  describe('State Listeners', () => {
    it('should notify listeners on state change', () => {
      const listener = vi.fn();
      client.onConnectionStateChange(listener);

      client.connect();
      expect(listener).toHaveBeenCalledWith('connecting');

      mockEventSource.simulateOpen();
      expect(listener).toHaveBeenCalledWith('connected');
    });

    it('should remove state listeners', () => {
      const listener = vi.fn();
      client.onConnectionStateChange(listener);
      client.offConnectionStateChange(listener);

      client.connect();
      
      expect(listener).not.toHaveBeenCalled();
    });
  });
});