/**
 * Tests for CRDT State Management
 * 
 * Validates CRDT properties: commutative, associative, idempotent.
 */

import {
  GSet,
  ORSet,
  LWWRegister,
  LWWMap,
  VectorClockOps,
  CRDTStateManager,
  CRDTPropertyVerifier,
  VectorClock,
} from '../../../src/sync/CRDTState';

describe('GSet (Grow-only Set)', () => {
  describe('Basic Operations', () => {
    it('should add elements', () => {
      const set = new GSet<string>();
      set.add('a');
      set.add('b');

      expect(set.has('a')).toBe(true);
      expect(set.has('b')).toBe(true);
      expect(set.has('c')).toBe(false);
    });

    it('should not duplicate elements', () => {
      const set = new GSet<string>();
      set.add('a');
      set.add('a');

      expect(set.size).toBe(1);
    });

    it('should iterate over elements', () => {
      const set = new GSet<string>();
      set.add('a');
      set.add('b');

      const elements = Array.from(set);
      expect(elements).toContain('a');
      expect(elements).toContain('b');
    });
  });

  describe('CRDT Properties', () => {
    it('should be commutative: merge(A, B) = merge(B, A)', () => {
      const a = new GSet<string>();
      a.add('1');
      a.add('2');

      const b = new GSet<string>();
      b.add('2');
      b.add('3');

      const ab = a.merge(b);
      const ba = b.merge(a);

      expect(ab.values()).toEqual(ba.values());
    });

    it('should be associative: merge(merge(A,B), C) = merge(A, merge(B,C))', () => {
      const a = new GSet<string>();
      a.add('1');

      const b = new GSet<string>();
      b.add('2');

      const c = new GSet<string>();
      c.add('3');

      const ab_c = a.merge(b).merge(c);
      const a_bc = a.merge(b.merge(c));

      expect(ab_c.values()).toEqual(a_bc.values());
    });

    it('should be idempotent: merge(A, A) = A', () => {
      const a = new GSet<string>();
      a.add('1');
      a.add('2');

      const aa = a.merge(a);

      expect(aa.values()).toEqual(a.values());
    });
  });
});

describe('ORSet (Observed-Remove Set)', () => {
  describe('Basic Operations', () => {
    it('should add elements with tags', () => {
      const set = new ORSet<string>();
      const tag = set.add('a');

      expect(set.has('a')).toBe(true);
      expect(set.getTags('a').has(tag)).toBe(true);
    });

    it('should remove elements by observed tags', () => {
      const set = new ORSet<string>();
      const tag = set.add('a');

      set.remove('a', new Set([tag]));

      expect(set.has('a')).toBe(false);
    });

    it('should keep element if not all tags removed', () => {
      const set = new ORSet<string>();
      const tag1 = set.add('a');
      const tag2 = set.add('a');

      set.remove('a', new Set([tag1]));

      expect(set.has('a')).toBe(true);
      expect(set.getTags('a').has(tag2)).toBe(true);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent add and remove (add wins)', () => {
      const set1 = new ORSet<string>();
      const set2 = new ORSet<string>();

      // Set1 adds element
      const tag1 = set1.add('a');

      // Set2 adds and removes element
      const tag2 = set2.add('a');
      set2.remove('a', new Set([tag2]));

      // Merge: add from set1 should win
      const merged = set1.merge(set2);

      expect(merged.has('a')).toBe(true);
    });
  });

  describe('CRDT Properties', () => {
    it('should be commutative', () => {
      const a = new ORSet<string>();
      a.add('1');

      const b = new ORSet<string>();
      b.add('2');

      const ab = a.merge(b);
      const ba = b.merge(a);

      expect(ab.values()).toEqual(ba.values());
    });
  });
});

describe('LWWRegister (Last-Writer-Wins)', () => {
  describe('Basic Operations', () => {
    it('should store value with timestamp', () => {
      const reg = new LWWRegister<string>();
      reg.set('value1', 100, 'writer1');

      expect(reg.value).toBe('value1');
      expect(reg.timestamp).toBe(100);
      expect(reg.writer).toBe('writer1');
    });

    it('should keep newer value', () => {
      const reg = new LWWRegister<string>();
      reg.set('old', 100, 'writer1');
      reg.set('new', 200, 'writer2');

      expect(reg.value).toBe('new');
    });

    it('should ignore older value', () => {
      const reg = new LWWRegister<string>();
      reg.set('new', 200, 'writer1');
      reg.set('old', 100, 'writer2');

      expect(reg.value).toBe('new');
    });
  });

  describe('Tie Breaking', () => {
    it('should use writer ID for tie breaking', () => {
      const reg1 = new LWWRegister<string>('a', 100, 'writer1');
      const reg2 = new LWWRegister<string>('b', 100, 'writer2');

      const merged = reg1.merge(reg2);

      // writer2 > writer1 alphabetically
      expect(merged.value).toBe('b');
    });
  });

  describe('CRDT Properties', () => {
    it('should be commutative', () => {
      const a = new LWWRegister<string>('a', 100, 'w1');
      const b = new LWWRegister<string>('b', 200, 'w2');

      const ab = a.merge(b);
      const ba = b.merge(a);

      expect(ab.value).toBe(ba.value);
    });

    it('should be associative', () => {
      const a = new LWWRegister<string>('a', 100, 'w1');
      const b = new LWWRegister<string>('b', 200, 'w2');
      const c = new LWWRegister<string>('c', 300, 'w3');

      const ab_c = a.merge(b).merge(c);
      const a_bc = a.merge(b.merge(c));

      expect(ab_c.value).toBe(a_bc.value);
    });

    it('should be idempotent', () => {
      const a = new LWWRegister<string>('a', 100, 'w1');
      const aa = a.merge(a);

      expect(aa.value).toBe(a.value);
    });
  });
});

describe('LWWMap', () => {
  it('should store key-value pairs', () => {
    const map = new LWWMap<string, number>();
    map.set('key1', 100, Date.now(), 'writer1');

    expect(map.get('key1')).toBe(100);
    expect(map.has('key1')).toBe(true);
  });

  it('should merge maps', () => {
    const map1 = new LWWMap<string, number>();
    map1.set('key1', 100, 100, 'w1');

    const map2 = new LWWMap<string, number>();
    map2.set('key2', 200, 200, 'w2');

    const merged = map1.merge(map2);

    expect(merged.get('key1')).toBe(100);
    expect(merged.get('key2')).toBe(200);
  });

  it('should resolve conflicts with LWW', () => {
    const map1 = new LWWMap<string, number>();
    map1.set('key', 100, 100, 'w1');

    const map2 = new LWWMap<string, number>();
    map2.set('key', 200, 200, 'w2');

    const merged = map1.merge(map2);

    expect(merged.get('key')).toBe(200); // Newer wins
  });
});

describe('VectorClockOps', () => {
  describe('Increment', () => {
    it('should increment clock for instance', () => {
      const clock: VectorClock = { 'i1': 1, 'i2': 2 };
      const incremented = VectorClockOps.increment(clock, 'i1');

      expect(incremented['i1']).toBe(2);
      expect(incremented['i2']).toBe(2);
    });

    it('should initialize new instance', () => {
      const clock: VectorClock = { 'i1': 1 };
      const incremented = VectorClockOps.increment(clock, 'i2');

      expect(incremented['i2']).toBe(1);
    });
  });

  describe('Merge', () => {
    it('should take element-wise max', () => {
      const clock1: VectorClock = { 'i1': 3, 'i2': 1 };
      const clock2: VectorClock = { 'i1': 1, 'i2': 5 };

      const merged = VectorClockOps.merge(clock1, clock2);

      expect(merged['i1']).toBe(3);
      expect(merged['i2']).toBe(5);
    });
  });

  describe('Compare', () => {
    it('should detect before relationship', () => {
      const clock1: VectorClock = { 'i1': 1, 'i2': 1 };
      const clock2: VectorClock = { 'i1': 2, 'i2': 2 };

      expect(VectorClockOps.compare(clock1, clock2)).toBe('before');
    });

    it('should detect after relationship', () => {
      const clock1: VectorClock = { 'i1': 2, 'i2': 2 };
      const clock2: VectorClock = { 'i1': 1, 'i2': 1 };

      expect(VectorClockOps.compare(clock1, clock2)).toBe('after');
    });

    it('should detect concurrent events', () => {
      const clock1: VectorClock = { 'i1': 2, 'i2': 1 };
      const clock2: VectorClock = { 'i1': 1, 'i2': 2 };

      expect(VectorClockOps.compare(clock1, clock2)).toBe('concurrent');
    });

    it('should detect equal clocks', () => {
      const clock1: VectorClock = { 'i1': 1, 'i2': 2 };
      const clock2: VectorClock = { 'i1': 1, 'i2': 2 };

      expect(VectorClockOps.compare(clock1, clock2)).toBe('equal');
    });
  });
});

describe('CRDTStateManager', () => {
  let manager: CRDTStateManager;

  beforeEach(() => {
    manager = new CRDTStateManager('instance-1');
  });

  describe('Clock Operations', () => {
    it('should increment clocks on tick', () => {
      const before = manager.getClocks();
      manager.tick();
      const after = manager.getClocks();

      expect(after.lamport).toBe(before.lamport + 1);
      expect(after.vector['instance-1']).toBe((before.vector['instance-1'] ?? 0) + 1);
    });

    it('should update clocks from remote', () => {
      manager.updateClock(100, { 'instance-2': 50 });
      const clocks = manager.getClocks();

      expect(clocks.lamport).toBeGreaterThan(100);
      expect(clocks.vector['instance-2']).toBe(50);
    });
  });

  describe('Memory Operations', () => {
    it('should add memories', () => {
      manager.addMemory('mem-1');
      manager.addMemory('mem-2');

      expect(manager.hasMemory('mem-1')).toBe(true);
      expect(manager.hasMemory('mem-2')).toBe(true);
      expect(manager.getMemoryIds().size).toBe(2);
    });
  });

  describe('Skill Operations', () => {
    it('should update skills', () => {
      const skill = {
        skill_id: 'skill-1',
        name: 'Test Skill',
        category: 'test',
        proficiency: 0.8,
        acquired: new Date().toISOString(),
        source_instances: ['instance-1'],
        learning_curve: [],
        usage: {
          total_invocations: 10,
          success_rate: 0.9,
          contexts: [],
          last_used: new Date().toISOString(),
        },
        prerequisites: [],
        enables: [],
        synergies: [],
      };

      manager.updateSkill('skill-1', skill);

      expect(manager.getSkill('skill-1')).toEqual(skill);
    });
  });

  describe('State Merge', () => {
    it('should merge two state managers', () => {
      const manager1 = new CRDTStateManager('instance-1');
      manager1.addMemory('mem-1');
      manager1.addKnowledge('know-1');

      const manager2 = new CRDTStateManager('instance-2');
      manager2.addMemory('mem-2');
      manager2.addKnowledge('know-2');

      const merged = manager1.merge(manager2);

      expect(merged.getMemoryIds().size).toBe(2);
      expect(merged.getKnowledgeIds().size).toBe(2);
    });

    it('should apply remote state', () => {
      const remote = new CRDTStateManager('instance-2');
      remote.addMemory('remote-mem');

      manager.applyRemoteState(remote);

      expect(manager.hasMemory('remote-mem')).toBe(true);
    });
  });

  describe('Serialization', () => {
    it('should serialize and deserialize state', () => {
      manager.addMemory('mem-1');
      manager.addKnowledge('know-1');
      manager.addTag('tag-1');

      const snapshot = manager.serialize();
      const restored = CRDTStateManager.deserialize(snapshot);

      expect(restored.hasMemory('mem-1')).toBe(true);
      expect(restored.getKnowledgeIds().has('know-1')).toBe(true);
      expect(restored.getTags().has('tag-1')).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should track state statistics', () => {
      manager.addMemory('mem-1');
      manager.addKnowledge('know-1');

      const stats = manager.getStats();

      expect(stats.instanceId).toBe('instance-1');
      expect(stats.memoryCount).toBe(1);
      expect(stats.knowledgeCount).toBe(1);
    });
  });
});

describe('CRDTPropertyVerifier', () => {
  it('should verify G-Set properties', () => {
    expect(CRDTPropertyVerifier.verifyGSetProperties()).toBe(true);
  });

  it('should verify LWW-Register properties', () => {
    expect(CRDTPropertyVerifier.verifyLWWRegisterProperties()).toBe(true);
  });
});
