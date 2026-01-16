/**
 * TypeScript bindings for Chrysalis Datalog Flow Engine
 *
 * Provides declarative flow graph execution with formal correctness guarantees.
 */

// ============================================================================
// Types
// ============================================================================

export type NodeType =
  | 'start'
  | 'end'
  | 'prompt'
  | 'condition'
  | 'action'
  | 'parallel'
  | 'join';

export interface FlowNode {
  id: string;
  type: NodeType;
  handler: string;
  metadata?: Record<string, unknown>;
}

export interface FlowEdge {
  from: string;
  to: string;
  label: string;
  condition?: string;
}

export interface ExecutionState {
  executedNodes: Set<string>;
  currentNode: string | null;
  outputs: Map<string, Record<string, unknown>>;
  bindings: Map<string, unknown>;
  timestamp: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface FlowDefinition {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

// ============================================================================
// Datalog Engine
// ============================================================================

export class DatalogFlowEngine {
  private nodes: Map<string, FlowNode> = new Map();
  private edges: FlowEdge[] = [];
  private state: ExecutionState;

  constructor() {
    this.state = {
      executedNodes: new Set(),
      currentNode: null,
      outputs: new Map(),
      bindings: new Map(),
      timestamp: 0,
    };
  }

  /**
   * Add a node to the flow graph.
   */
  addNode(
    id: string,
    type: NodeType,
    handler: string,
    metadata?: Record<string, unknown>
  ): void {
    this.nodes.set(id, { id, type, handler, metadata });
  }

  /**
   * Add an edge to the flow graph.
   */
  addEdge(
    from: string,
    to: string,
    label: string = 'default',
    condition?: string
  ): void {
    this.edges.push({ from, to, label, condition });
  }

  /**
   * Get all start nodes (nodes with no incoming edges or type 'start').
   */
  getStartNodes(): string[] {
    const hasIncoming = new Set(this.edges.map((e) => e.to));
    const startNodes: string[] = [];

    for (const node of this.nodes.values()) {
      if (node.type === 'start' || !hasIncoming.has(node.id)) {
        startNodes.push(node.id);
      }
    }

    return startNodes;
  }

  /**
   * Get all end nodes (nodes with no outgoing edges or type 'end').
   */
  getEndNodes(): string[] {
    const hasOutgoing = new Set(this.edges.map((e) => e.from));
    const endNodes: string[] = [];

    for (const node of this.nodes.values()) {
      if (node.type === 'end' || !hasOutgoing.has(node.id)) {
        endNodes.push(node.id);
      }
    }

    return endNodes;
  }

  /**
   * Check if the graph has cycles.
   */
  hasCycles(): boolean {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recStack.add(nodeId);

      for (const edge of this.edges) {
        if (edge.from === nodeId) {
          const neighbor = edge.to;
          if (!visited.has(neighbor)) {
            if (dfs(neighbor)) return true;
          } else if (recStack.has(neighbor)) {
            return true;
          }
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        if (dfs(nodeId)) return true;
      }
    }

    return false;
  }

  /**
   * Check if the graph is a valid DAG.
   */
  isDAG(): boolean {
    return !this.hasCycles();
  }

  /**
   * Validate the flow graph.
   */
  validate(): ValidationResult {
    const errors: string[] = [];

    // Check for cycles
    if (this.hasCycles()) {
      errors.push('Graph contains cycles');
    }

    // Check for start nodes
    const startNodes = this.getStartNodes();
    if (startNodes.length === 0) {
      errors.push('No start node found');
    }

    // Check for end nodes
    const endNodes = this.getEndNodes();
    if (endNodes.length === 0) {
      errors.push('No end node found');
    }

    // Check edge validity
    for (const edge of this.edges) {
      if (!this.nodes.has(edge.from)) {
        errors.push(`Edge source not found: ${edge.from}`);
      }
      if (!this.nodes.has(edge.to)) {
        errors.push(`Edge target not found: ${edge.to}`);
      }
    }

    // Check for unreachable nodes (only explicit 'start' type nodes are exempt)
    const reachable = this.computeReachable();
    const explicitStartNodes = Array.from(this.nodes.values())
      .filter((n) => n.type === 'start')
      .map((n) => n.id);
    for (const nodeId of this.nodes.keys()) {
      if (!explicitStartNodes.includes(nodeId) && !reachable.has(nodeId)) {
        errors.push(`Unreachable node: ${nodeId}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Compute all reachable nodes from explicit start nodes (type='start').
   */
  private computeReachable(): Set<string> {
    const reachable = new Set<string>();
    // Only start from explicit 'start' type nodes
    const explicitStartNodes = Array.from(this.nodes.values())
      .filter((n) => n.type === 'start')
      .map((n) => n.id);
    const queue = [...explicitStartNodes];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (reachable.has(current)) continue;
      reachable.add(current);

      for (const edge of this.edges) {
        if (edge.from === current && !reachable.has(edge.to)) {
          queue.push(edge.to);
        }
      }
    }

    return reachable;
  }

  /**
   * Get topological execution order.
   */
  getExecutionOrder(): string[] {
    if (!this.isDAG()) {
      throw new Error('Cannot get execution order for graph with cycles');
    }

    const inDegree = new Map<string, number>();
    for (const nodeId of this.nodes.keys()) {
      inDegree.set(nodeId, 0);
    }

    for (const edge of this.edges) {
      const current = inDegree.get(edge.to) || 0;
      inDegree.set(edge.to, current + 1);
    }

    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) queue.push(nodeId);
    }

    const result: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      for (const edge of this.edges) {
        if (edge.from === current) {
          const newDegree = (inDegree.get(edge.to) || 1) - 1;
          inDegree.set(edge.to, newDegree);
          if (newDegree === 0) {
            queue.push(edge.to);
          }
        }
      }
    }

    return result;
  }

  /**
   * Get nodes that can be executed (all predecessors executed).
   */
  getExecutableNodes(): string[] {
    const executable: string[] = [];

    for (const node of this.nodes.values()) {
      if (this.state.executedNodes.has(node.id)) continue;

      const predecessors = this.edges
        .filter((e) => e.to === node.id)
        .map((e) => e.from);

      if (
        predecessors.length === 0 ||
        predecessors.every((p) => this.state.executedNodes.has(p))
      ) {
        executable.push(node.id);
      }
    }

    return executable;
  }

  /**
   * Get the next node based on current state and condition results.
   */
  getNextNode(): string | null {
    if (!this.state.currentNode) {
      const startNodes = this.getStartNodes();
      return startNodes.length > 0 ? startNodes[0] : null;
    }

    const current = this.state.currentNode;
    const outputs = this.state.outputs.get(current) || {};
    const conditionLabel = outputs['condition_label'] as string | undefined;

    // Find matching edge
    for (const edge of this.edges) {
      if (edge.from === current) {
        if (conditionLabel && edge.label === conditionLabel) {
          return edge.to;
        } else if (edge.label === 'default' && !conditionLabel) {
          return edge.to;
        }
      }
    }

    // No matching edge - try default
    for (const edge of this.edges) {
      if (edge.from === current && edge.label === 'default') {
        return edge.to;
      }
    }

    return null;
  }

  /**
   * Mark a node as executed with optional outputs.
   */
  markExecuted(nodeId: string, outputs?: Record<string, unknown>): void {
    this.state.executedNodes.add(nodeId);
    this.state.currentNode = nodeId;
    this.state.timestamp++;

    if (outputs) {
      this.state.outputs.set(nodeId, outputs);
    }
  }

  /**
   * Set a binding value.
   */
  setBinding(name: string, value: unknown): void {
    this.state.bindings.set(name, value);
  }

  /**
   * Get a binding value.
   */
  getBinding(name: string): unknown {
    return this.state.bindings.get(name);
  }

  /**
   * Get outputs for a node.
   */
  getOutputs(nodeId: string): Record<string, unknown> | undefined {
    return this.state.outputs.get(nodeId);
  }

  /**
   * Reset execution state.
   */
  reset(): void {
    this.state = {
      executedNodes: new Set(),
      currentNode: null,
      outputs: new Map(),
      bindings: new Map(),
      timestamp: 0,
    };
  }

  /**
   * Get a node by ID.
   */
  getNode(id: string): FlowNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Get all nodes.
   */
  getAllNodes(): FlowNode[] {
    return [...this.nodes.values()];
  }

  /**
   * Get all edges.
   */
  getAllEdges(): FlowEdge[] {
    return [...this.edges];
  }

  /**
   * Check if flow will terminate (all paths reach end).
   */
  willTerminate(): boolean {
    if (!this.isDAG()) return false;

    const endNodes = new Set(this.getEndNodes());
    const willTerminate = new Set<string>();

    // Work backwards from end nodes
    const queue = [...endNodes];
    while (queue.length > 0) {
      const current = queue.shift()!;
      willTerminate.add(current);

      // Find all predecessors
      for (const edge of this.edges) {
        if (edge.to === current && !willTerminate.has(edge.from)) {
          // Check if all successors of predecessor will terminate
          const successors = this.edges
            .filter((e) => e.from === edge.from)
            .map((e) => e.to);
          if (successors.every((s) => willTerminate.has(s))) {
            queue.push(edge.from);
          }
        }
      }
    }

    // Check all start nodes will terminate
    return this.getStartNodes().every((s) => willTerminate.has(s));
  }

  /**
   * Get parallel branches from a parallel node.
   */
  getParallelBranches(parallelNodeId: string): string[] {
    const node = this.nodes.get(parallelNodeId);
    if (!node || node.type !== 'parallel') return [];

    return this.edges
      .filter((e) => e.from === parallelNodeId)
      .map((e) => e.to);
  }

  /**
   * Check if a join node is ready (all branches complete).
   */
  isJoinReady(joinNodeId: string): boolean {
    const node = this.nodes.get(joinNodeId);
    if (!node || node.type !== 'join') return false;

    const predecessors = this.edges
      .filter((e) => e.to === joinNodeId)
      .map((e) => e.from);

    return predecessors.every((p) => this.state.executedNodes.has(p));
  }

  /**
   * Export the flow as JSON.
   */
  toJSON(): FlowDefinition {
    return {
      nodes: [...this.nodes.values()],
      edges: [...this.edges],
    };
  }

  /**
   * Import a flow from JSON.
   */
  static fromJSON(definition: FlowDefinition): DatalogFlowEngine {
    const engine = new DatalogFlowEngine();

    for (const node of definition.nodes) {
      engine.addNode(node.id, node.type, node.handler, node.metadata);
    }

    for (const edge of definition.edges) {
      engine.addEdge(edge.from, edge.to, edge.label, edge.condition);
    }

    return engine;
  }

  /**
   * Create a simple linear flow.
   */
  static createLinearFlow(steps: string[]): DatalogFlowEngine {
    const engine = new DatalogFlowEngine();

    for (let i = 0; i < steps.length; i++) {
      const type: NodeType =
        i === 0 ? 'start' : i === steps.length - 1 ? 'end' : 'action';
      engine.addNode(steps[i], type, steps[i]);

      if (i > 0) {
        engine.addEdge(steps[i - 1], steps[i]);
      }
    }

    return engine;
  }

  /**
   * Create a conditional branching flow.
   */
  static createConditionalFlow(
    startNode: string,
    conditionNode: string,
    branches: { label: string; node: string }[],
    endNode: string
  ): DatalogFlowEngine {
    const engine = new DatalogFlowEngine();

    engine.addNode(startNode, 'start', startNode);
    engine.addNode(conditionNode, 'condition', conditionNode);
    engine.addNode(endNode, 'end', endNode);

    engine.addEdge(startNode, conditionNode);

    for (const branch of branches) {
      engine.addNode(branch.node, 'action', branch.node);
      engine.addEdge(conditionNode, branch.node, branch.label);
      engine.addEdge(branch.node, endNode);
    }

    return engine;
  }
}

// ============================================================================
// Flow Executor
// ============================================================================

export type NodeHandler = (
  node: FlowNode,
  inputs: Record<string, unknown>,
  bindings: Map<string, unknown>
) => Promise<Record<string, unknown>>;

export class FlowExecutor {
  private engine: DatalogFlowEngine;
  private handlers: Map<string, NodeHandler> = new Map();
  private defaultHandler: NodeHandler;

  constructor(engine: DatalogFlowEngine) {
    this.engine = engine;
    this.defaultHandler = async (node) => {
      console.log(`Executing node: ${node.id}`);
      return {};
    };
  }

  /**
   * Register a handler for a node type or specific node.
   */
  registerHandler(key: string, handler: NodeHandler): void {
    this.handlers.set(key, handler);
  }

  /**
   * Set the default handler for unregistered nodes.
   */
  setDefaultHandler(handler: NodeHandler): void {
    this.defaultHandler = handler;
  }

  /**
   * Execute the flow.
   */
  async execute(): Promise<Record<string, unknown>> {
    const validation = this.engine.validate();
    if (!validation.valid) {
      throw new Error(`Invalid flow: ${validation.errors.join(', ')}`);
    }

    this.engine.reset();
    const results: Record<string, unknown> = {};

    while (true) {
      const nextNodeId = this.engine.getNextNode();
      if (!nextNodeId) break;

      const node = this.engine.getNode(nextNodeId);
      if (!node) break;

      // Collect inputs from predecessors
      const inputs: Record<string, unknown> = {};
      const predecessorEdges = this.engine
        .getAllEdges()
        .filter((e) => e.to === nextNodeId);
      for (const edge of predecessorEdges) {
        const predOutputs = this.engine.getOutputs(edge.from);
        if (predOutputs) {
          Object.assign(inputs, predOutputs);
        }
      }

      // Get handler
      const handler =
        this.handlers.get(nextNodeId) ||
        this.handlers.get(node.handler) ||
        this.handlers.get(node.type) ||
        this.defaultHandler;

      // Execute
      const outputs = await handler(
        node,
        inputs,
        new Map(this.engine['state'].bindings)
      );

      this.engine.markExecuted(nextNodeId, outputs);
      results[nextNodeId] = outputs;

      // Check for end node
      if (node.type === 'end') break;
    }

    return results;
  }

  /**
   * Execute with step-by-step control.
   */
  *executeStepByStep(): Generator<
    { node: FlowNode; inputs: Record<string, unknown> },
    Record<string, unknown>,
    Record<string, unknown>
  > {
    const validation = this.engine.validate();
    if (!validation.valid) {
      throw new Error(`Invalid flow: ${validation.errors.join(', ')}`);
    }

    this.engine.reset();
    const results: Record<string, unknown> = {};

    while (true) {
      const nextNodeId = this.engine.getNextNode();
      if (!nextNodeId) break;

      const node = this.engine.getNode(nextNodeId);
      if (!node) break;

      // Collect inputs
      const inputs: Record<string, unknown> = {};
      const predecessorEdges = this.engine
        .getAllEdges()
        .filter((e) => e.to === nextNodeId);
      for (const edge of predecessorEdges) {
        const predOutputs = this.engine.getOutputs(edge.from);
        if (predOutputs) {
          Object.assign(inputs, predOutputs);
        }
      }

      // Yield control to caller
      const outputs = yield { node, inputs };

      this.engine.markExecuted(nextNodeId, outputs);
      results[nextNodeId] = outputs;

      if (node.type === 'end') break;
    }

    return results;
  }
}

export default {
  DatalogFlowEngine,
  FlowExecutor,
};