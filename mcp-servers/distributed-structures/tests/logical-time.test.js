/**
 * Tests for logical time operations
 */

import { test } from 'node:test';
import assert from 'node:assert';
import {
  createLamportClock,
  lamportTick,
  lamportUpdate,
  createVectorClock,
  vectorIncrement,
  vectorMerge,
  vectorCompare,
  consensusTimestamp,
  serializeVectorClock,
  deserializeVectorClock
} from '../dist/logical-time.js';

// ============================================================================
// Lamport Clocks
// ============================================================================

test('Lamport - create clock', () => {
  const clock = createLamportClock('node1');
  assert.strictEqual(clock.nodeId, 'node1');
  assert.strictEqual(clock.timestamp, 0);
});

test('Lamport - tick increments', () => {
  let clock = createLamportClock('node1');
  clock = lamportTick(clock);
  assert.strictEqual(clock.timestamp, 1);
  
  clock = lamportTick(clock);
  assert.strictEqual(clock.timestamp, 2);
});

test('Lamport - update with higher timestamp', () => {
  let clock = createLamportClock('node1');
  clock.timestamp = 5;
  
  clock = lamportUpdate(clock, 10);
  assert.strictEqual(clock.timestamp, 11);
});

test('Lamport - update with lower timestamp', () => {
  let clock = createLamportClock('node1');
  clock.timestamp = 10;
  
  clock = lamportUpdate(clock, 5);
  assert.strictEqual(clock.timestamp, 11);
});

// ============================================================================
// Vector Clocks
// ============================================================================

test('Vector - create clock', () => {
  const clock = createVectorClock('node1', ['node1', 'node2', 'node3']);
  assert.strictEqual(clock.nodeId, 'node1');
  assert.strictEqual(clock.vector.size, 3);
  assert.strictEqual(clock.vector.get('node1'), 0);
  assert.strictEqual(clock.vector.get('node2'), 0);
  assert.strictEqual(clock.vector.get('node3'), 0);
});

test('Vector - increment', () => {
  let clock = createVectorClock('node1', ['node1', 'node2']);
  clock = vectorIncrement(clock);
  
  assert.strictEqual(clock.vector.get('node1'), 1);
  assert.strictEqual(clock.vector.get('node2'), 0);
  
  clock = vectorIncrement(clock);
  assert.strictEqual(clock.vector.get('node1'), 2);
});

test('Vector - merge takes max', () => {
  const local = createVectorClock('node1', ['node1', 'node2', 'node3']);
  local.vector.set('node1', 5);
  local.vector.set('node2', 2);
  local.vector.set('node3', 0);
  
  const received = createVectorClock('node2', ['node1', 'node2', 'node3']);
  received.vector.set('node1', 3);
  received.vector.set('node2', 4);
  received.vector.set('node3', 1);
  
  const merged = vectorMerge(local, received);
  
  assert.strictEqual(merged.vector.get('node1'), 6); // max(5,3) + 1 (own increment)
  assert.strictEqual(merged.vector.get('node2'), 4); // max(2,4)
  assert.strictEqual(merged.vector.get('node3'), 1); // max(0,1)
});

test('Vector - compare before', () => {
  const clock1 = createVectorClock('node1', ['node1', 'node2']);
  clock1.vector.set('node1', 1);
  clock1.vector.set('node2', 2);
  
  const clock2 = createVectorClock('node2', ['node1', 'node2']);
  clock2.vector.set('node1', 3);
  clock2.vector.set('node2', 5);
  
  const ordering = vectorCompare(clock1, clock2);
  assert.strictEqual(ordering, 'before');
});

test('Vector - compare after', () => {
  const clock1 = createVectorClock('node1', ['node1', 'node2']);
  clock1.vector.set('node1', 5);
  clock1.vector.set('node2', 3);
  
  const clock2 = createVectorClock('node2', ['node1', 'node2']);
  clock2.vector.set('node1', 2);
  clock2.vector.set('node2', 1);
  
  const ordering = vectorCompare(clock1, clock2);
  assert.strictEqual(ordering, 'after');
});

test('Vector - compare concurrent', () => {
  const clock1 = createVectorClock('node1', ['node1', 'node2']);
  clock1.vector.set('node1', 3);
  clock1.vector.set('node2', 1);
  
  const clock2 = createVectorClock('node2', ['node1', 'node2']);
  clock2.vector.set('node1', 1);
  clock2.vector.set('node2', 3);
  
  const ordering = vectorCompare(clock1, clock2);
  assert.strictEqual(ordering, 'concurrent');
});

test('Vector - serialize/deserialize', () => {
  const clock = createVectorClock('node1', ['node1', 'node2']);
  clock.vector.set('node1', 5);
  clock.vector.set('node2', 3);
  
  const serialized = serializeVectorClock(clock);
  const deserialized = deserializeVectorClock(serialized);
  
  assert.strictEqual(deserialized.nodeId, 'node1');
  assert.strictEqual(deserialized.vector.get('node1'), 5);
  assert.strictEqual(deserialized.vector.get('node2'), 3);
});

// ============================================================================
// Consensus Timestamp
// ============================================================================

test('Consensus - median odd length', () => {
  const timestamps = [10, 20, 30, 40, 50];
  const consensus = consensusTimestamp(timestamps);
  assert.strictEqual(consensus, 30);
});

test('Consensus - median even length', () => {
  const timestamps = [10, 20, 30, 40];
  const consensus = consensusTimestamp(timestamps);
  assert.strictEqual(consensus, 25); // (20 + 30) / 2
});

test('Consensus - single timestamp', () => {
  const timestamps = [42];
  const consensus = consensusTimestamp(timestamps);
  assert.strictEqual(consensus, 42);
});

test('Consensus - Byzantine resistance', () => {
  // 5 nodes: 3 honest (10, 11, 12), 2 Byzantine (100, 200)
  const timestamps = [10, 11, 12, 100, 200];
  const consensus = consensusTimestamp(timestamps);
  
  // Median = 12 (Byzantine values ignored)
  assert.strictEqual(consensus, 12);
});

test('Consensus - empty throws', () => {
  assert.throws(() => consensusTimestamp([]), /empty array/);
});
