/**
 * Tests for DAG operations
 */

import { test } from 'node:test';
import assert from 'node:assert';
import {
  createDAG,
  addNode,
  addEdge,
  topologicalSort,
  ancestors,
  descendants,
  isReachable,
  serializeGraph,
  deserializeGraph
} from '../dist/dag.js';

test('createDAG - creates empty graph', () => {
  const graph = createDAG();
  assert.strictEqual(graph.nodeCount(), 0);
  assert.strictEqual(graph.edgeCount(), 0);
});

test('addNode - adds node to graph', () => {
  const graph = createDAG();
  addNode(graph, { id: 'A', data: { value: 1 } });
  
  assert.strictEqual(graph.nodeCount(), 1);
  assert.ok(graph.hasNode('A'));
});

test('addEdge - adds edge between nodes', () => {
  const graph = createDAG();
  addNode(graph, { id: 'A' });
  addNode(graph, { id: 'B' });
  addEdge(graph, { from: 'A', to: 'B' });
  
  assert.strictEqual(graph.edgeCount(), 1);
  assert.ok(graph.hasEdge('A', 'B'));
});

test('addEdge - throws if source missing', () => {
  const graph = createDAG();
  addNode(graph, { id: 'B' });
  
  assert.throws(() => {
    addEdge(graph, { from: 'A', to: 'B' });
  }, /does not exist/);
});

test('topologicalSort - simple chain', () => {
  const graph = createDAG();
  addNode(graph, { id: 'A' });
  addNode(graph, { id: 'B' });
  addNode(graph, { id: 'C' });
  addEdge(graph, { from: 'A', to: 'B' });
  addEdge(graph, { from: 'B', to: 'C' });
  
  const sorted = topologicalSort(graph);
  
  assert.deepStrictEqual(sorted, ['A', 'B', 'C']);
});

test('topologicalSort - diamond', () => {
  const graph = createDAG();
  addNode(graph, { id: 'A' });
  addNode(graph, { id: 'B' });
  addNode(graph, { id: 'C' });
  addNode(graph, { id: 'D' });
  addEdge(graph, { from: 'A', to: 'B' });
  addEdge(graph, { from: 'A', to: 'C' });
  addEdge(graph, { from: 'B', to: 'D' });
  addEdge(graph, { from: 'C', to: 'D' });
  
  const sorted = topologicalSort(graph);
  
  // A must come first, D last
  assert.strictEqual(sorted[0], 'A');
  assert.strictEqual(sorted[3], 'D');
  // B and C can be in either order
});

test('ancestors - finds all ancestors', () => {
  const graph = createDAG();
  addNode(graph, { id: 'A' });
  addNode(graph, { id: 'B' });
  addNode(graph, { id: 'C' });
  addNode(graph, { id: 'D' });
  addEdge(graph, { from: 'A', to: 'B' });
  addEdge(graph, { from: 'B', to: 'C' });
  addEdge(graph, { from: 'A', to: 'D' });
  addEdge(graph, { from: 'D', to: 'C' });
  
  const anc = ancestors(graph, 'C');
  
  assert.ok(anc.has('A'));
  assert.ok(anc.has('B'));
  assert.ok(anc.has('D'));
  assert.strictEqual(anc.size, 3);
});

test('descendants - finds all descendants', () => {
  const graph = createDAG();
  addNode(graph, { id: 'A' });
  addNode(graph, { id: 'B' });
  addNode(graph, { id: 'C' });
  addNode(graph, { id: 'D' });
  addEdge(graph, { from: 'A', to: 'B' });
  addEdge(graph, { from: 'A', to: 'C' });
  addEdge(graph, { from: 'B', to: 'D' });
  
  const desc = descendants(graph, 'A');
  
  assert.ok(desc.has('B'));
  assert.ok(desc.has('C'));
  assert.ok(desc.has('D'));
  assert.strictEqual(desc.size, 3);
});

test('isReachable - direct edge', () => {
  const graph = createDAG();
  addNode(graph, { id: 'A' });
  addNode(graph, { id: 'B' });
  addEdge(graph, { from: 'A', to: 'B' });
  
  assert.strictEqual(isReachable(graph, 'A', 'B'), true);
  assert.strictEqual(isReachable(graph, 'B', 'A'), false);
});

test('isReachable - transitive path', () => {
  const graph = createDAG();
  addNode(graph, { id: 'A' });
  addNode(graph, { id: 'B' });
  addNode(graph, { id: 'C' });
  addEdge(graph, { from: 'A', to: 'B' });
  addEdge(graph, { from: 'B', to: 'C' });
  
  assert.strictEqual(isReachable(graph, 'A', 'C'), true);
  assert.strictEqual(isReachable(graph, 'C', 'A'), false);
});

test('serialize/deserialize roundtrip', () => {
  const graph = createDAG();
  addNode(graph, { id: 'A', data: { x: 1 } });
  addNode(graph, { id: 'B', data: { x: 2 } });
  addEdge(graph, { from: 'A', to: 'B' });
  
  const serialized = serializeGraph(graph);
  const deserialized = deserializeGraph(serialized);
  
  assert.strictEqual(deserialized.nodeCount(), 2);
  assert.strictEqual(deserialized.edgeCount(), 1);
  assert.ok(deserialized.hasNode('A'));
  assert.ok(deserialized.hasNode('B'));
  assert.ok(deserialized.hasEdge('A', 'B'));
});
