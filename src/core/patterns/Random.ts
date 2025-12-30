/**
 * Pattern #3: Random Selection (Distributed Instance Placement)
 * 
 * Universal Pattern: Probabilistic selection in distributed systems
 * Natural Analogy: Biological systems using randomness for optimal distribution
 * Mathematical Property: Uniform distribution, load balancing properties
 * 
 * Application: Agent instance placement, resource allocation, consensus participation
 */

export interface RandomSelectionOptions {
  seed?: number;
  deterministic?: boolean;
}

export interface WeightedItem<T> {
  item: T;
  weight: number;
}

export class RandomSelector {
  private seed: number;
  private deterministic: boolean;

  constructor(options: RandomSelectionOptions = {}) {
    this.seed = options.seed || Date.now();
    this.deterministic = options.deterministic || false;
  }

  /**
   * Generate a random number between 0 and 1
   */
  random(): number {
    if (this.deterministic) {
      // Simple linear congruential generator for deterministic randomness
      this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
      return (this.seed / 4294967296.0);
    } else {
      return Math.random();
    }
  }

  /**
   * Generate a random integer between min (inclusive) and max (exclusive)
   */
  randomInt(min: number, max: number): number {
    const range = max - min;
    return Math.floor(this.random() * range) + min;
  }

  /**
   * Generate a random number between min and max
   */
  randomRange(min: number, max: number): number {
    const range = max - min;
    return this.random() * range + min;
  }

  /**
   * Select a random item from an array
   */
  selectRandom<T>(items: T[]): T | null {
    if (items.length === 0) {
      return null;
    }
    const index = this.randomInt(0, items.length);
    return items[index];
  }

  /**
   * Select multiple random items without replacement
   */
  selectMultiple<T>(items: T[], count: number): T[] {
    if (count >= items.length) {
      return [...items]; // Return all if requesting more than available
    }

    const result: T[] = [];
    const tempItems = [...items]; // Create a copy to avoid modifying original

    for (let i = 0; i < count; i++) {
      const index = this.randomInt(0, tempItems.length);
      const item = tempItems[index];
      result.push(item);
      tempItems.splice(index, 1); // Remove selected item
    }

    return result;
  }

  /**
   * Weighted random selection using the roulette wheel selection method
   */
  selectWeighted<T>(items: WeightedItem<T>[]): T | null {
    if (items.length === 0) {
      return null;
    }

    // Calculate total weight
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);

    if (totalWeight <= 0) {
      // If all weights are 0 or negative, select randomly
      return this.selectRandom(items.map(i => i.item));
    }

    // Generate a random value between 0 and totalWeight
    const randomValue = this.random() * totalWeight;

    // Find the selected item
    let currentWeight = 0;
    for (const weightedItem of items) {
      currentWeight += weightedItem.weight;
      if (randomValue <= currentWeight) {
        return weightedItem.item;
      }
    }

    // Fallback (should not reach here due to floating point precision)
    return items[items.length - 1].item;
  }

  /**
   * Weighted selection for multiple items without replacement
   */
  selectMultipleWeighted<T>(items: WeightedItem<T>[], count: number): T[] {
    if (count >= items.length) {
      return items.map(i => i.item);
    }

    const result: T[] = [];
    const tempItems = [...items];

    for (let i = 0; i < count; i++) {
      if (tempItems.length === 0) {
        break;
      }

      const selected = this.selectWeighted(tempItems);
      if (selected !== null) {
        result.push(selected);

        // Remove the selected item from tempItems
        const index = tempItems.findIndex(item => item.item === selected);
        if (index !== -1) {
          tempItems.splice(index, 1);
        }
      }
    }

    return result;
  }

  /**
   * Perform random sampling with reservoir sampling algorithm
   * Useful when you have a large or infinite stream of items
   */
  reservoirSampling<T>(items: Iterable<T> | ArrayLike<T>, k: number): T[] {
    // Convert to array if necessary
    const arr = Array.isArray(items) ? items : Array.from(items);
    
    if (arr.length <= k) {
      return [...arr];
    }

    // Create reservoir with first k elements
    const reservoir = arr.slice(0, k);

    // Continue with remaining elements
    for (let i = k; i < arr.length; i++) {
      // Pick a random index from 0 to i
      const randomIndex = this.randomInt(0, i + 1);
      
      // If the random index is within the reservoir, replace that element
      if (randomIndex < k) {
        reservoir[randomIndex] = arr[i];
      }
    }

    return reservoir;
  }

  /**
   * Shuffle an array using Fisher-Yates algorithm
   */
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.randomInt(0, i + 1);
      [result[i], result[j]] = [result[j], result[i]]; // Swap elements
    }
    return result;
  }

  /**
   * Perform random selection with a probability threshold
   */
  randomWithProbability<T>(items: T[], probability: number): T[] {
    return items.filter(() => this.random() < probability);
  }

  /**
   * Generate a random choice between two values based on a probability
   */
  randomChoice<T>(value1: T, value2: T, probability: number): T {
    return this.random() < probability ? value1 : value2;
  }

  /**
   * Generate random selection for distributed load balancing
   */
  loadBalancedSelection<T>(
    items: T[], 
    utilizationRates: number[], // Values between 0 and 1 representing utilization
    loadFactor: number = 0.7
  ): T | null {
    if (items.length === 0 || items.length !== utilizationRates.length) {
      return null;
    }

    // Calculate selection weights based on inverse of utilization (lower utilization = higher weight)
    const weightedItems: WeightedItem<T>[] = items.map((item, index) => ({
      item,
      weight: Math.max(0.01, 1 - utilizationRates[index]) // Prevent 0 weight, ensure some randomness
    }));

    // Apply load factor to reduce randomness when utilization is high
    const adjustedWeightedItems = weightedItems.map((weightedItem, index) => {
      const utilization = utilizationRates[index];
      // Higher load factor means more load-aware selection
      const adjustedWeight = weightedItem.weight * (1 + (loadFactor * (1 - utilization)));
      return {
        item: weightedItem.item,
        weight: adjustedWeight
      };
    });

    return this.selectWeighted(adjustedWeightedItems);
  }
}

/**
 * Distributed Random Selector for Multi-Agent Systems
 */
export class DistributedRandomSelector {
  private localSelector: RandomSelector;
  private nodeId: string;
  private clusterNodes: string[];
  private selectionHistory: Map<string, Date>; // Track selections per node

  constructor(nodeId: string, options: RandomSelectionOptions = {}) {
    this.nodeId = nodeId;
    this.localSelector = new RandomSelector(options);
    this.clusterNodes = [nodeId]; // Initialize with self
    this.selectionHistory = new Map();
  }

  /**
   * Update the list of nodes in the cluster
   */
  updateClusterNodes(nodes: string[]): void {
    this.clusterNodes = [...nodes];
  }

  /**
   * Add a new node to the cluster
   */
  addNode(nodeId: string): void {
    if (!this.clusterNodes.includes(nodeId)) {
      this.clusterNodes.push(nodeId);
    }
  }

  /**
   * Remove a node from the cluster
   */
  removeNode(nodeId: string): void {
    this.clusterNodes = this.clusterNodes.filter(id => id !== nodeId);
    this.selectionHistory.delete(nodeId);
  }

  /**
   * Perform distributed random selection for agent tasks
   */
  selectAgentForTask(taskComplexity: number = 1): string | null {
    if (this.clusterNodes.length === 0) {
      return null;
    }

    // Adjust selection based on task complexity and node availability
    // Less loaded nodes have higher probability of selection
    const weightedNodes: WeightedItem<string>[] = this.clusterNodes.map(nodeId => {
      // Calculate weight based on how recently this node was selected
      const lastSelection = this.selectionHistory.get(nodeId);
      const timeSinceLastSelection = lastSelection ? 
        (Date.now() - lastSelection.getTime()) / (1000 * 60) : // Minutes since last selection
        1000; // Very high weight if never selected
      
      // Prefer nodes that haven't been selected recently
      // Also consider task complexity
      const weight = timeSinceLastSelection / Math.max(taskComplexity, 1);
      
      return { item: nodeId, weight };
    });

    const selectedNode = this.localSelector.selectWeighted(weightedNodes);
    
    if (selectedNode) {
      // Record the selection
      this.selectionHistory.set(selectedNode, new Date());
    }

    return selectedNode;
  }

  /**
   * Perform round-robin selection with randomization
   */
  roundRobinWithRandomization<T>(items: T[]): T | null {
    if (items.length === 0) {
      return null;
    }

    // Add some randomization to pure round-robin
    const shouldRandomize = this.localSelector.random() < 0.3; // 30% chance of randomization

    if (shouldRandomize) {
      return this.localSelector.selectRandom(items);
    } else {
      // Do round-robin by using the hash of current time and node ID
      const now = Date.now();
      const index = (now + this.nodeId.length) % items.length;
      return items[index];
    }
  }

  /**
   * Select a random subset of nodes for gossip or consensus
   */
  selectRandomNodesForGossip(count: number): string[] {
    return this.localSelector.selectMultiple(this.clusterNodes, Math.min(count, this.clusterNodes.length));
  }

  /**
   * Perform consistent hashing-style selection for distributed resource placement
   */
  consistentHashPlacement(key: string, replicas: number = 1): string[] {
    if (this.clusterNodes.length === 0) {
      return [];
    }

    const placements: string[] = [];
    
    for (let i = 0; i < replicas; i++) {
      // Create a deterministic hash by combining the key with replica number
      const replicaKey = `${key}-${i}`;
      let hash = 0;
      
      // Simple hash function
      for (let j = 0; j < replicaKey.length; j++) {
        hash = (hash << 5) - hash + replicaKey.charCodeAt(j);
        hash |= 0; // Convert to 32-bit integer
      }
      
      // Use the hash to select a node (deterministic based on key)
      const index = Math.abs(hash) % this.clusterNodes.length;
      placements.push(this.clusterNodes[index]);
    }
    
    return [...new Set(placements)]; // Remove duplicates
  }

  /**
   * Perform leader election using random selection with additional criteria
   */
  electLeader(nodesInfo: Array<{ id: string; capability: number; lastSeen: number }>): string | null {
    if (nodesInfo.length === 0) {
      return null;
    }

    // Weight selection based on capability and recency of contact
    const now = Date.now();
    const weightedNodes: WeightedItem<string>[] = nodesInfo
      .filter(node => (now - node.lastSeen) < 30000) // Filter out nodes not seen in last 30 seconds
      .map(nodeInfo => {
        // Weight is based on capability score and how recently the node was seen
        const timeFactor = Math.max(0.1, 1 - ((now - nodeInfo.lastSeen) / 30000)); // 0.1 to 1.0
        const weight = nodeInfo.capability * timeFactor;
        
        return { 
          item: nodeInfo.id, 
          weight: Math.max(0.01, weight) // Ensure minimum weight
        };
      });

    return this.localSelector.selectWeighted(weightedNodes);
  }
}

/**
 * Random utility functions for general use
 */
export class RandomUtils {
  private static globalSelector = new RandomSelector();

  /**
   * Generate a random UUID (v4)
   */
  static generateUUID(): string {
    // Use the global selector to maintain consistency
    const random = () => RandomUtils.globalSelector.random();
    
    const s4 = () => Math.floor((1 + random()) * 0x10000).toString(16).substring(1);
    
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
           s4() + '-' + s4() + s4() + s4();
  }

  /**
   * Generate a random string of specified length
   */
  static generateRandomString(length: number, chars: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[RandomUtils.globalSelector.randomInt(0, chars.length)];
    }
    return result;
  }

  /**
   * Sample from a normal (Gaussian) distribution using Box-Muller transform
   */
  static sampleNormal(mean: number = 0, stdDev: number = 1): number {
    const u = RandomUtils.globalSelector.random();
    const v = RandomUtils.globalSelector.random();
    
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return z * stdDev + mean;
  }

  /**
   * Random selection with exponential backoff for retries
   */
  static exponentialBackoff(baseDelay: number, attempt: number, maxDelay: number = 60000): number {
    const delay = baseDelay * Math.pow(2, attempt);
    const jitter = RandomUtils.globalSelector.randomRange(0, delay * 0.1); // 10% jitter
    return Math.min(delay + jitter, maxDelay);
  }
}
