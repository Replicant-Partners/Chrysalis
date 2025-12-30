/**
 * Pattern #5: DAG (Directed Acyclic Graph) Structure
 * 
 * Universal Pattern: Causality and evolution tracking
 * Natural Analogy: Biological evolution trees, family trees
 * Mathematical Property: Topological ordering, directed acyclic properties
 * 
 * Application: Experience evolution tracking, agent transformation history, 
 *              capability development paths
 */

export interface DAGNode<T> {
  id: string;
  data: T;
  parents: string[]; // IDs of parent nodes
  children: string[]; // IDs of child nodes
  timestamp: number;
  version: number;
  metadata: { [key: string]: any };
}

export class DAG<T> {
  private nodes: Map<string, DAGNode<T>>;
  private rootNodes: Set<string>; // Nodes with no parents
  private leafNodes: Set<string>; // Nodes with no children

  constructor() {
    this.nodes = new Map();
    this.rootNodes = new Set();
    this.leafNodes = new Set();
  }

  /**
   * Add a node with data to the DAG
   * @param id The unique identifier for the node
   * @param data The data to store in the node
   * @param parentIds Optional parent node IDs to form edges
   * @param metadata Optional metadata for the node
   */
  addNode(
    id: string, 
    data: T, 
    parentIds: string[] = [], 
    metadata: { [key: string]: any } = {}
  ): boolean {
    // Check for cycle before adding
    if (this.wouldCreateCycle(id, parentIds)) {
      throw new Error(`Adding node ${id} with parents ${parentIds.join(', ')} would create a cycle`);
    }

    // Verify all parent nodes exist
    for (const parentId of parentIds) {
      if (!this.nodes.has(parentId)) {
        throw new Error(`Parent node ${parentId} does not exist`);
      }
    }

    // Create the new node
    const newNode: DAGNode<T> = {
      id,
      data,
      parents: [...parentIds],
      children: [],
      timestamp: Date.now(),
      version: 1,
      metadata
    };

    // Update existing nodes to include this node as a child
    for (const parentId of parentIds) {
      const parent = this.nodes.get(parentId)!;
      parent.children.push(id);

      // If parent was a leaf node, remove it from leaf set
      if (this.leafNodes.has(parentId)) {
        this.leafNodes.delete(parentId);
      }
    }

    // Add the new node
    this.nodes.set(id, newNode);

    // If no parents, this is a root node
    if (parentIds.length === 0) {
      this.rootNodes.add(id);
    } else {
      // If it has parents, it's not a root node
      this.rootNodes.delete(id);
    }

    // If no children, this is a leaf node
    if (newNode.children.length === 0) {
      this.leafNodes.add(id);
    } else {
      // If it has children, it's not a leaf node
      this.leafNodes.delete(id);
    }

    // Remove any parents from leaf nodes if they had this as a parent
    for (const parentId of parentIds) {
      this.leafNodes.delete(parentId);
    }

    return true;
  }

  /**
   * Remove a node from the DAG
   */
  removeNode(id: string): boolean {
    if (!this.nodes.has(id)) {
      return false;
    }

    const node = this.nodes.get(id)!;

    // Remove this node from children of its parents
    for (const parentId of node.parents) {
      const parent = this.nodes.get(parentId)!;
      parent.children = parent.children.filter(childId => childId !== id);

      // If parent now has no children, it's a leaf
      if (parent.children.length === 0) {
        this.leafNodes.add(parentId);
      }
    }

    // Remove this node from parents of its children
    for (const childId of node.children) {
      const child = this.nodes.get(childId)!;
      child.parents = child.parents.filter(parentId => parentId !== id);

      // If child now has no parents, it's a root
      if (child.parents.length === 0) {
        this.rootNodes.add(childId);
      }
    }

    // Clean up root and leaf sets
    this.rootNodes.delete(id);
    this.leafNodes.delete(id);

    // Remove the node
    this.nodes.delete(id);

    return true;
  }

  /**
   * Check if adding a node with specified parents would create a cycle
   */
  private wouldCreateCycle(id: string, parentIds: string[]): boolean {
    // If the node already exists, check if adding these parents would create a cycle
    if (this.nodes.has(id)) {
      // This is an update to an existing node
      for (const parentId of parentIds) {
        if (this.hasPath(parentId, id)) {
          return true;
        }
      }
    } else {
      // This is a new node
      if (parentIds.includes(id)) {
        return true;
      }

      for (const parentId of parentIds) {
        if (this.hasPath(parentId, id)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if there's a path from source to target
   */
  private hasPath(source: string, target: string): boolean {
    if (source === target) {
      return true;
    }

    const visited = new Set<string>();
    const queue = [source];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === target) {
        return true;
      }

      if (visited.has(current)) {
        continue;
      }

      visited.add(current);

      const node = this.nodes.get(current);
      if (node) {
        queue.push(...node.children);
      }
    }

    return false;
  }

  /**
   * Get a node by ID
   */
  getNode(id: string): DAGNode<T> | null {
    return this.nodes.get(id) || null;
  }

  /**
   * Update node data
   */
  updateNode(id: string, data: T): boolean {
    if (!this.nodes.has(id)) {
      return false;
    }

    const node = this.nodes.get(id)!;
    node.data = data;
    node.version++;
    return true;
  }

  /**
   * Get all root nodes (nodes with no parents)
   */
  getRootNodes(): DAGNode<T>[] {
    return Array.from(this.rootNodes).map(id => this.nodes.get(id)!);
  }

  /**
   * Get all leaf nodes (nodes with no children)
   */
  getLeafNodes(): DAGNode<T>[] {
    return Array.from(this.leafNodes).map(id => this.nodes.get(id)!);
  }

  /**
   * Get all nodes in the DAG
   */
  getAllNodes(): DAGNode<T>[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get children of a specific node
   */
  getChildren(id: string): DAGNode<T>[] {
    const node = this.nodes.get(id);
    if (!node) {
      return [];
    }

    return node.children.map(childId => this.nodes.get(childId)!);
  }

  /**
   * Get parents of a specific node
   */
  getParents(id: string): DAGNode<T>[] {
    const node = this.nodes.get(id);
    if (!node) {
      return [];
    }

    return node.parents.map(parentId => this.nodes.get(parentId)!);
  }

  /**
   * Get all ancestors of a node (recursive parents)
   */
  getAncestors(id: string): DAGNode<T>[] {
    const ancestors: DAGNode<T>[] = [];
    const visited = new Set<string>();

    const traverse = (currentId: string) => {
      if (visited.has(currentId)) {
        return;
      }
      visited.add(currentId);

      const node = this.nodes.get(currentId);
      if (!node) return;

      for (const parentId of node.parents) {
        if (!visited.has(parentId)) {
          ancestors.push(this.nodes.get(parentId)!);
          traverse(parentId);
        }
      }
    };

    traverse(id);
    return ancestors;
  }

  /**
   * Get all descendants of a node (recursive children)
   */
  getDescendants(id: string): DAGNode<T>[] {
    const descendants: DAGNode<T>[] = [];
    const visited = new Set<string>();

    const traverse = (currentId: string) => {
      if (visited.has(currentId)) {
        return;
      }
      visited.add(currentId);

      const node = this.nodes.get(currentId);
      if (!node) return;

      for (const childId of node.children) {
        if (!visited.has(childId)) {
          descendants.push(this.nodes.get(childId)!);
          traverse(childId);
        }
      }
    };

    traverse(id);
    return descendants;
  }

  /**
   * Perform topological sort of the DAG
   */
  topologicalSort(): DAGNode<T>[] {
    const result: DAGNode<T>[] = [];
    const visited = new Set<string>();
    const temp = new Set<string>();

    const visit = (nodeId: string) => {
      if (temp.has(nodeId)) {
        throw new Error("Graph is not a DAG - cycle detected");
      }

      if (visited.has(nodeId)) {
        return;
      }

      temp.add(nodeId);

      const node = this.nodes.get(nodeId);
      if (node) {
        for (const childId of node.children) {
          visit(childId);
        }
      }

      temp.delete(nodeId);
      visited.add(nodeId);
      result.unshift(this.nodes.get(nodeId)!); // Add to front
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        visit(nodeId);
      }
    }

    return result;
  }

  /**
   * Get the longest path length in the DAG
   */
  getLongestPathLength(): number {
    if (this.nodes.size === 0) return 0;

    const sorted = this.topologicalSort();
    const distances = new Map<string, number>();

    for (const node of sorted) {
      distances.set(node.id, 0);
    }

    for (const node of sorted) {
      const currentDistance = distances.get(node.id)!;

      for (const childId of node.children) {
        const newDistance = currentDistance + 1;
        const existingDistance = distances.get(childId)!;

        if (newDistance > existingDistance) {
          distances.set(childId, newDistance);
        }
      }
    }

    return Math.max(...Array.from(distances.values()));
  }

  /**
   * Get the depth of a specific node from root
   */
  getNodeDepth(id: string): number {
    if (!this.nodes.has(id)) {
      return -1;
    }

    // Use BFS from all root nodes
    const queue: Array<{ nodeId: string; depth: number }> = [];
    const visited = new Set<string>();

    // Start from all root nodes
    for (const rootId of this.rootNodes) {
      queue.push({ nodeId: rootId, depth: 0 });
    }

    while (queue.length > 0) {
      const { nodeId, depth } = queue.shift()!;

      if (nodeId === id) {
        return depth;
      }

      if (visited.has(nodeId)) {
        continue;
      }

      visited.add(nodeId);

      const node = this.nodes.get(nodeId);
      if (node) {
        for (const childId of node.children) {
          if (!visited.has(childId)) {
            queue.push({ nodeId: childId, depth: depth + 1 });
          }
        }
      }
    }

    // Node is unreachable from any root (shouldn't happen in a proper DAG)
    return -1;
  }

  /**
   * Serialize the DAG to a JSON object
   */
  serialize(): any {
    const serializedNodes = Array.from(this.nodes.entries()).map(([id, node]) => ({
      id: node.id,
      data: node.data,
      parents: node.parents,
      children: node.children,
      timestamp: node.timestamp,
      version: node.version,
      metadata: node.metadata
    }));

    return {
      nodes: serializedNodes,
      rootNodes: Array.from(this.rootNodes),
      leafNodes: Array.from(this.leafNodes)
    };
  }

  /**
   * Deserialize a DAG from a JSON object
   */
  static deserialize<T>(data: any): DAG<T> {
    const dag = new DAG<T>();

    // Add all nodes first
    for (const nodeData of data.nodes) {
      dag.nodes.set(nodeData.id, {
        id: nodeData.id,
        data: nodeData.data,
        parents: nodeData.parents,
        children: nodeData.children,
        timestamp: nodeData.timestamp,
        version: nodeData.version,
        metadata: nodeData.metadata
      });
    }

    // Set up root and leaf sets
    dag.rootNodes = new Set(data.rootNodes);
    dag.leafNodes = new Set(data.leafNodes);

    return dag;
  }
}

/**
 * Specialized DAG for Agent Experience Tracking
 */
export interface ExperienceNode {
  id: string;
  type: string; // 'skill', 'memory', 'knowledge', 'belief', etc.
  content: any;
  timestamp: number;
  source: string; // Which agent or process generated this
  confidence: number; // Confidence level in the experience
  metadata: { [key: string]: any };
}

export class AgentExperienceDAG extends DAG<ExperienceNode> {
  constructor() {
    super();
  }

  /**
   * Add an experience to the DAG
   */
  addExperience(
    id: string,
    type: string,
    content: any,
    source: string,
    confidence: number,
    parentIds: string[] = [],
    metadata: { [key: string]: any } = {}
  ): boolean {
    const experienceNode: ExperienceNode = {
      id,
      type,
      content,
      timestamp: Date.now(),
      source,
      confidence,
      metadata
    };

    return this.addNode(id, experienceNode, parentIds, metadata);
  }

  /**
   * Get experiences by type
   */
  getExperiencesByType(type: string): ExperienceNode[] {
    return this.getAllNodes()
      .map(node => node.data)
      .filter(exp => exp.type === type);
  }

  /**
   * Get experiences by source
   */
  getExperiencesBySource(source: string): ExperienceNode[] {
    return this.getAllNodes()
      .map(node => node.data)
      .filter(exp => exp.source === source);
  }

  /**
   * Get experiences within a time range
   */
  getExperiencesByTimeRange(startTime: number, endTime: number): ExperienceNode[] {
    return this.getAllNodes()
      .map(node => node.data)
      .filter(exp => exp.timestamp >= startTime && exp.timestamp <= endTime);
  }

  /**
   * Get experiences with confidence above threshold
   */
  getExperiencesByConfidence(minConfidence: number): ExperienceNode[] {
    return this.getAllNodes()
      .map(node => node.data)
      .filter(exp => exp.confidence >= minConfidence);
  }
}

/**
 * Specialized DAG for Agent Transformation Tracking
 */
export interface TransformationNode {
  id: string;
  fromType: string; // 'MCP', 'MultiAgent', 'Orchestrated'
  toType: string;
  timestamp: number;
  parameters: { [key: string]: any };
  result: any;
  metadata: { [key: string]: any };
}

export class AgentTransformationDAG extends DAG<TransformationNode> {
  constructor() {
    super();
  }

  /**
   * Add a transformation record to the DAG
   */
  addTransformation(
    id: string,
    fromType: string,
    toType: string,
    parameters: { [key: string]: any },
    result: any,
    parentIds: string[] = [],
    metadata: { [key: string]: any } = {}
  ): boolean {
    const transformationNode: TransformationNode = {
      id,
      fromType,
      toType,
      timestamp: Date.now(),
      parameters,
      result,
      metadata
    };

    return this.addNode(id, transformationNode, parentIds, metadata);
  }

  /**
   * Get transformations from a specific type
   */
  getTransformationsFromType(fromType: string): TransformationNode[] {
    return this.getAllNodes()
      .map(node => node.data)
      .filter(trans => trans.fromType === fromType);
  }

  /**
   * Get transformations to a specific type
   */
  getTransformationsToType(toType: string): TransformationNode[] {
    return this.getAllNodes()
      .map(node => node.data)
      .filter(trans => trans.toType === toType);
  }
}