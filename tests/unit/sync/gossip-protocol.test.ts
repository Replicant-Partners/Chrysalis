/**
 * Tests for Gossip Protocol
 * 
 * Validates O(log N) propagation and epidemic spread properties.
 */

import {
  GossipProtocol,
  GossipNetworkManager,
  GossipPeer,
  GossipMessage,
  DEFAULT_GOSSIP_CONFIG,
} from '../../../src/sync/GossipProtocol';

describe('GossipProtocol', () => {
  let protocol: GossipProtocol;

  beforeEach(() => {
    protocol = new GossipProtocol('instance-1');
  });

  afterEach(async () => {
    await protocol.stop();
  });

  describe('Peer Management', () => {
    it('should add and track peers', () => {
      const peer: GossipPeer = {
        peerId: 'peer-1',
        instanceId: 'instance-2',
        endpoint: 'http://localhost:3001',
        lastSeen: Date.now(),
        active: true,
        healthScore: 1.0,
        failureCount: 0,
      };

      protocol.addPeer(peer);
      const activePeers = protocol.getActivePeers();

      expect(activePeers.length).toBe(1);
      expect(activePeers[0].instanceId).toBe('instance-2');
    });

    it('should remove peers', () => {
      const peer: GossipPeer = {
        peerId: 'peer-1',
        instanceId: 'instance-2',
        endpoint: 'http://localhost:3001',
        lastSeen: Date.now(),
        active: true,
        healthScore: 1.0,
        failureCount: 0,
      };

      protocol.addPeer(peer);
      protocol.removePeer('peer-1');

      expect(protocol.getActivePeers().length).toBe(0);
    });

    it('should mark peers as failed after max retries', () => {
      const peer: GossipPeer = {
        peerId: 'peer-1',
        instanceId: 'instance-2',
        endpoint: 'http://localhost:3001',
        lastSeen: Date.now(),
        active: true,
        healthScore: 1.0,
        failureCount: 0,
      };

      protocol.addPeer(peer);

      // Fail multiple times
      for (let i = 0; i < DEFAULT_GOSSIP_CONFIG.maxRetries; i++) {
        protocol.markPeerFailed('peer-1');
      }

      expect(protocol.getActivePeers().length).toBe(0);
    });
  });

  describe('Peer Selection', () => {
    it('should select random peers up to fanout', () => {
      // Add 10 peers
      for (let i = 0; i < 10; i++) {
        protocol.addPeer({
          peerId: `peer-${i}`,
          instanceId: `instance-${i + 2}`,
          endpoint: `http://localhost:${3001 + i}`,
          lastSeen: Date.now(),
          active: true,
          healthScore: 1.0,
          failureCount: 0,
        });
      }

      const selected = protocol.selectRandomPeers();
      expect(selected.length).toBe(DEFAULT_GOSSIP_CONFIG.fanout);
    });

    it('should return all peers if fewer than fanout', () => {
      protocol.addPeer({
        peerId: 'peer-1',
        instanceId: 'instance-2',
        endpoint: 'http://localhost:3001',
        lastSeen: Date.now(),
        active: true,
        healthScore: 1.0,
        failureCount: 0,
      });

      const selected = protocol.selectRandomPeers();
      expect(selected.length).toBe(1);
    });

    it('should only select active peers', () => {
      protocol.addPeer({
        peerId: 'peer-1',
        instanceId: 'instance-2',
        endpoint: 'http://localhost:3001',
        lastSeen: Date.now(),
        active: true,
        healthScore: 1.0,
        failureCount: 0,
      });

      protocol.addPeer({
        peerId: 'peer-2',
        instanceId: 'instance-3',
        endpoint: 'http://localhost:3002',
        lastSeen: Date.now(),
        active: false, // Inactive
        healthScore: 0.5,
        failureCount: 3,
      });

      const selected = protocol.selectRandomPeers();
      expect(selected.length).toBe(1);
      expect(selected[0].instanceId).toBe('instance-2');
    });
  });

  describe('Propagation Calculations', () => {
    it('should calculate O(log N) rounds to reach all instances', () => {
      // With fanout=3:
      // 10 instances: ceil(log3(10)) = 3 rounds
      // 100 instances: ceil(log3(100)) = 5 rounds
      // 1000 instances: ceil(log3(1000)) = 7 rounds

      expect(protocol.roundsToReach(10)).toBeLessThanOrEqual(3);
      expect(protocol.roundsToReach(100)).toBeLessThanOrEqual(5);
      expect(protocol.roundsToReach(1000)).toBeLessThanOrEqual(7);
    });

    it('should estimate propagation time', () => {
      const time10 = protocol.estimatePropagationTime(10);
      const time100 = protocol.estimatePropagationTime(100);

      // Time should scale logarithmically
      expect(time100).toBeLessThan(time10 * 3); // Not linear
    });
  });

  describe('Message Handling', () => {
    it('should drop duplicate messages', async () => {
      const message: GossipMessage = {
        messageId: 'msg-1',
        type: 'push',
        senderId: 'instance-2',
        timestamp: Date.now(),
        round: 1,
        ttl: 5,
        payload: { kind: 'push', events: [], memoryIds: [] },
        seenBy: new Set(['instance-2']),
      };

      // Receive same message twice
      await protocol.receiveMessage(message);
      const stats1 = protocol.getStats();

      await protocol.receiveMessage(message);
      const stats2 = protocol.getStats();

      expect(stats2.messagesReceived).toBe(stats1.messagesReceived);
      expect(stats2.messagesDropped).toBe(stats1.messagesDropped + 1);
    });

    it('should drop expired messages', async () => {
      const message: GossipMessage = {
        messageId: 'msg-1',
        type: 'push',
        senderId: 'instance-2',
        timestamp: Date.now() - 120000, // 2 minutes ago (expired)
        round: 1,
        ttl: 5,
        payload: { kind: 'push', events: [], memoryIds: [] },
        seenBy: new Set(['instance-2']),
      };

      await protocol.receiveMessage(message);
      const stats = protocol.getStats();

      expect(stats.messagesDropped).toBe(1);
    });

    it('should drop messages with TTL=0', async () => {
      const message: GossipMessage = {
        messageId: 'msg-1',
        type: 'push',
        senderId: 'instance-2',
        timestamp: Date.now(),
        round: 1,
        ttl: 0, // No more hops
        payload: { kind: 'push', events: [], memoryIds: [] },
        seenBy: new Set(['instance-2']),
      };

      await protocol.receiveMessage(message);
      const stats = protocol.getStats();

      expect(stats.messagesDropped).toBe(1);
    });
  });

  describe('Statistics', () => {
    it('should track gossip statistics', () => {
      const stats = protocol.getStats();

      expect(stats.currentRound).toBe(0);
      expect(stats.messagesSent).toBe(0);
      expect(stats.messagesReceived).toBe(0);
      expect(stats.activePeers).toBe(0);
    });
  });
});

describe('GossipNetworkManager', () => {
  let manager: GossipNetworkManager;

  beforeEach(() => {
    manager = new GossipNetworkManager();
  });

  afterEach(async () => {
    await manager.stopAll();
  });

  it('should create protocols for instances', () => {
    const protocol = manager.createProtocol('instance-1');
    expect(protocol).toBeDefined();
    expect(manager.getProtocol('instance-1')).toBe(protocol);
  });

  it('should connect peers bidirectionally', () => {
    manager.createProtocol('instance-1');
    manager.createProtocol('instance-2');

    manager.connectPeers(
      'instance-1',
      'instance-2',
      'http://localhost:3001',
      'http://localhost:3002'
    );

    const protocol1 = manager.getProtocol('instance-1')!;
    const protocol2 = manager.getProtocol('instance-2')!;

    expect(protocol1.getActivePeers().length).toBe(1);
    expect(protocol2.getActivePeers().length).toBe(1);
  });

  it('should collect network statistics', () => {
    manager.createProtocol('instance-1');
    manager.createProtocol('instance-2');

    const stats = manager.getNetworkStats();

    expect(stats.size).toBe(2);
    expect(stats.has('instance-1')).toBe(true);
    expect(stats.has('instance-2')).toBe(true);
  });
});
