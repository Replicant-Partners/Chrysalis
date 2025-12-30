/**
 * DAG (Directed Acyclic Graph) operations using graphlib
 * 
 * Provides graph construction, traversal, and reachability queries
 * for distributed system event graphs.
 */

import { Graph } from 'graphlib';

export interface DAGNode {
  id: string;
  data?: any;
}

export interface DAGEdge {
  from: string;
  to: string;
}

/**
 * Create a new directed acyclic graph
 */
export function createDAG(): Graph {
  return new Graph({ directed: true });
}

/**
 * Add node to DAG
 */
export function addNode(graph: Graph, node: DAGNode): void {
  graph.setNode(node.id, node.data || {});
}

/**
 * Add directed edge to DAG
 * 
 * Note: Does not check for cycles (caller responsible)
 */
export function addEdge(graph: Graph, edge: DAGEdge): void {
  if (!graph.hasNode(edge.from)) {
    throw new Error(`Source node ${edge.from} does not exist`);
  }
  if (!graph.hasNode(edge.to)) {
    throw new Error(`Target node ${edge.to} does not exist`);
  }
  
  graph.setEdge(edge.from, edge.to);
}

/**
 * Get topological sort of DAG
 * 
 * Returns nodes in order such that for every edge u→v, u appears before v
 */
export function topologicalSort(graph: Graph): string[] {
  const sorted: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  
  function visit(node: string): void {
    if (visited.has(node)) return;
    
    if (visiting.has(node)) {
      throw new Error('Graph contains cycle');
    }
    
    visiting.add(node);
    
    // Visit all successors first
    const successors = graph.successors(node) || [];
    for (const successor of successors) {
      visit(successor);
    }
    
    visiting.delete(node);
    visited.add(node);
    sorted.unshift(node); // Add to front
  }
  
  // Visit all nodes
  const nodes = graph.nodes();
  for (const node of nodes) {
    if (!visited.has(node)) {
      visit(node);
    }
  }
  
  return sorted;
}

/**
 * Get all ancestors of a node (nodes that can reach this node)
 */
export function ancestors(graph: Graph, nodeId: string): Set<string> {
  if (!graph.hasNode(nodeId)) {
    throw new Error(`Node ${nodeId} does not exist`);
  }
  
  const result = new Set<string>();
  const queue = [...(graph.predecessors(nodeId) || [])];
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    
    if (result.has(current)) continue;
    
    result.add(current);
    
    // Add predecessors to queue
    const preds = graph.predecessors(current) || [];
    queue.push(...preds);
  }
  
  return result;
}

/**
 * Get all descendants of a node (nodes reachable from this node)
 */
export function descendants(graph: Graph, nodeId: string): Set<string> {
  if (!graph.hasNode(nodeId)) {
    throw new Error(`Node ${nodeId} does not exist`);
  }
  
  const result = new Set<string>();
  const queue = [...(graph.successors(nodeId) || [])];
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    
    if (result.has(current)) continue;
    
    result.add(current);
    
    // Add successors to queue
    const succs = graph.successors(current) || [];
    queue.push(...succs);
  }
  
  return result;
}

/**
 * Check if there's a path from 'from' to 'to'
 */
export function isReachable(graph: Graph, from: string, to: string): boolean {
  if (!graph.hasNode(from) || !graph.hasNode(to)) {
    return false;
  }
  
  if (from === to) {
    return true;
  }
  
  const visited = new Set<string>();
  const queue = [from];
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    
    if (current === to) {
      return true;
    }
    
    if (visited.has(current)) continue;
    visited.add(current);
    
    const successors = graph.successors(current) || [];
    queue.push(...successors);
  }
  
  return false;
}

/**
 * Get nodes at a specific distance from source
 */
export function nodesAtDistance(graph: Graph, source: string, distance: number): Set<string> {
  if (!graph.hasNode(source)) {
    throw new Error(`Node ${source} does not exist`);
  }
  
  if (distance === 0) {
    return new Set([source]);
  }
  
  const result = new Set<string>();
  const distances = new Map<string, number>();
  distances.set(source, 0);
  
  const queue = [source];
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDist = distances.get(current)!;
    
    if (currentDist === distance) {
      result.add(current);
      continue;
    }
    
    if (currentDist > distance) {
      continue;
    }
    
    const successors = graph.successors(current) || [];
    for (const successor of successors) {
      if (!distances.has(successor)) {
        distances.set(successor, currentDist + 1);
        queue.push(successor);
      }
    }
  }
  
  return result;
}

/**
 * Serialize graph to JSON
 */
export function serializeGraph(graph: Graph): any {
  return {
    nodes: graph.nodes().map(id => ({
      id,
      data: graph.node(id)
    })),
    edges: graph.edges().map(e => ({
      from: e.v,
      to: e.w
    }))
  };
}

/**
 * Deserialize graph from JSON
 */
export function deserializeGraph(data: any): Graph {
  const graph = createDAG();
  
  for (const node of data.nodes) {
    addNode(graph, node);
  }
  
  for (const edge of data.edges) {
    addEdge(graph, edge);
  }
  
  return graph;
}
