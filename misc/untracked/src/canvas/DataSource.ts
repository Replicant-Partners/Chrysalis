/**
 * Canvas Data Source Implementations
 * 
 * Provides various backend implementations for canvas data persistence and loading.
 * Supports tile-based virtualization and real-time subscriptions.
 * 
 * @see types.ts for CanvasDataSource interface
 */

import type {
  CanvasDataSource,
  Tile,
  Bounds,
  ChangeSet,
  DataEvent,
  Unsubscribe,
} from './types';
import type { Node, Edge } from 'reactflow';

/**
 * In-Memory Data Source
 * 
 * Simple in-memory implementation for testing and development.
 * Data is not persisted between sessions.
 */
export class MemoryDataSource<TNode extends Node, TEdge extends Edge> implements CanvasDataSource<TNode, TEdge> {
  private nodes: Map<string, TNode> = new Map();
  private edges: Map<string, TEdge> = new Map();
  private subscribers: Array<(event: DataEvent) => void> = [];

  constructor(
    private readonly canvasId: string,
    initialNodes: TNode[] = [],
    initialEdges: TEdge[] = []
  ) {
    initialNodes.forEach((node) => this.nodes.set(node.id, node));
    initialEdges.forEach((edge) => this.edges.set(edge.id, edge));
  }

  async loadTile(bounds: Bounds): Promise<Tile<TNode, TEdge>> {
    // Filter nodes within bounds
    const nodesInBounds = Array.from(this.nodes.values()).filter((node) => {
      return (
        node.position.x >= bounds.minX &&
        node.position.x <= bounds.maxX &&
        node.position.y >= bounds.minY &&
        node.position.y <= bounds.maxY
      );
    });

    // Get edges connected to those nodes
    const nodeIds = new Set(nodesInBounds.map((n) => n.id));
    const edgesInBounds = Array.from(this.edges.values()).filter((edge) => {
      return nodeIds.has(edge.source) || nodeIds.has(edge.target);
    });

    return {
      bounds,
      nodes: nodesInBounds,
      edges: edgesInBounds,
      timestamp: Date.now(),
    };
  }

  async persist(changes: ChangeSet<TNode, TEdge>): Promise<void> {
    // Apply changes
    changes.nodesAdded.forEach((node) => this.nodes.set(node.id, node));
    changes.nodesUpdated.forEach((node) => this.nodes.set(node.id, node));
    changes.nodesDeleted.forEach((id) => this.nodes.delete(id));
    changes.edgesAdded.forEach((edge) => this.edges.set(edge.id, edge));
    changes.edgesDeleted.forEach((id) => this.edges.delete(id));

    // Notify subscribers
    this.notify({
      type: 'canvasSaved',
      canvasId: this.canvasId,
      timestamp: Date.now(),
      payload: changes,
    });
  }

  subscribe(callback: (event: DataEvent) => void): Unsubscribe {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  async loadAll(): Promise<{ nodes: TNode[]; edges: TEdge[] }> {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
    };
  }

  private notify(event: DataEvent): void {
    this.subscribers.forEach((callback) => callback(event));
  }
}

/**
 * LocalStorage Data Source
 * 
 * Persists canvas data to browser LocalStorage.
 * Suitable for small to medium canvases.
 */
export class LocalStorageDataSource<TNode extends Node, TEdge extends Edge> implements CanvasDataSource<TNode, TEdge> {
  private readonly storageKey: string;
  private subscribers: Array<(event: DataEvent) => void> = [];

  constructor(private readonly canvasId: string) {
    this.storageKey = `canvas:${canvasId}`;
  }

  async loadTile(bounds: Bounds): Promise<Tile<TNode, TEdge>> {
    const all = await this.loadAll();

    // Filter by bounds
    const nodesInBounds = all.nodes.filter((node) => {
      return (
        node.position.x >= bounds.minX &&
        node.position.x <= bounds.maxX &&
        node.position.y >= bounds.minY &&
        node.position.y <= bounds.maxY
      );
    });

    const nodeIds = new Set(nodesInBounds.map((n) => n.id));
    const edgesInBounds = all.edges.filter((edge) => {
      return nodeIds.has(edge.source) || nodeIds.has(edge.target);
    });

    return {
      bounds,
      nodes: nodesInBounds,
      edges: edgesInBounds,
      timestamp: Date.now(),
    };
  }

  async persist(changes: ChangeSet<TNode, TEdge>): Promise<void> {
    // Load current data
    const current = await this.loadAll();

    // Apply changes
    const nodesMap = new Map(current.nodes.map((n) => [n.id, n]));
    const edgesMap = new Map(current.edges.map((e) => [e.id, e]));

    changes.nodesAdded.forEach((node) => nodesMap.set(node.id, node));
    changes.nodesUpdated.forEach((node) => nodesMap.set(node.id, node));
    changes.nodesDeleted.forEach((id) => nodesMap.delete(id));
    changes.edgesAdded.forEach((edge) => edgesMap.set(edge.id, edge));
    changes.edgesDeleted.forEach((id) => edgesMap.delete(id));

    // Save to localStorage
    const data = {
      nodes: Array.from(nodesMap.values()),
      edges: Array.from(edgesMap.values()),
      timestamp: Date.now(),
    };

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));

      // Notify subscribers
      this.notify({
        type: 'canvasSaved',
        canvasId: this.canvasId,
        timestamp: Date.now(),
        payload: changes,
      });
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
      throw error;
    }
  }

  subscribe(callback: (event: DataEvent) => void): Unsubscribe {
    this.subscribers.push(callback);

    // Listen for storage events from other tabs
    const storageListener = (event: StorageEvent): void => {
      if (event.key === this.storageKey) {
        callback({
          type: 'canvasLoaded',
          canvasId: this.canvasId,
          timestamp: Date.now(),
        });
      }
    };

    window.addEventListener('storage', storageListener);

    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
      window.removeEventListener('storage', storageListener);
    };
  }

  async loadAll(): Promise<{ nodes: TNode[]; edges: TEdge[] }> {
    const stored = localStorage.getItem(this.storageKey);

    if (!stored) {
      return { nodes: [], edges: [] };
    }

    try {
      const data = JSON.parse(stored);
      return {
        nodes: data.nodes || [],
        edges: data.edges || [],
      };
    } catch (error) {
      console.error('Failed to parse stored data:', error);
      return { nodes: [], edges: [] };
    }
  }

  /**
   * Clear all data for this canvas
   */
  async clear(): Promise<void> {
    localStorage.removeItem(this.storageKey);
    this.notify({
      type: 'canvasLoaded',
      canvasId: this.canvasId,
      timestamp: Date.now(),
    });
  }

  private notify(event: DataEvent): void {
    this.subscribers.forEach((callback) => callback(event));
  }
}

/**
 * IndexedDB Data Source
 * 
 * Persists canvas data to browser IndexedDB.
 * Suitable for large canvases with efficient querying.
 */
export class IndexedDBDataSource<TNode extends Node, TEdge extends Edge> implements CanvasDataSource<TNode, TEdge> {
  private db: IDBDatabase | null = null;
  private readonly dbName: string;
  private readonly dbVersion = 1;
  private subscribers: Array<(event: DataEvent) => void> = [];

  constructor(private readonly canvasId: string) {
    this.dbName = `canvas_db_${canvasId}`;
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains('nodes')) {
          const nodeStore = db.createObjectStore('nodes', { keyPath: 'id' });
          nodeStore.createIndex('position', ['position.x', 'position.y'], { unique: false });
        }

        if (!db.objectStoreNames.contains('edges')) {
          db.createObjectStore('edges', { keyPath: 'id' });
        }
      };
    });
  }

  async loadTile(bounds: Bounds): Promise<Tile<TNode, TEdge>> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['nodes', 'edges'], 'readonly');
      const nodeStore = transaction.objectStore('nodes');
      const edgeStore = transaction.objectStore('edges');

      const nodes: TNode[] = [];
      const edges: TEdge[] = [];

      // Get all nodes (IndexedDB doesn't support complex spatial queries easily)
      const nodeRequest = nodeStore.getAll();

      nodeRequest.onsuccess = () => {
        const allNodes = nodeRequest.result as TNode[];

        // Filter by bounds
        const filteredNodes = allNodes.filter((node) => {
          return (
            node.position.x >= bounds.minX &&
            node.position.x <= bounds.maxX &&
            node.position.y >= bounds.minY &&
            node.position.y <= bounds.maxY
          );
        });

        nodes.push(...filteredNodes);

        // Get edges connected to these nodes
        const nodeIds = new Set(nodes.map((n) => n.id));
        const edgeRequest = edgeStore.getAll();

        edgeRequest.onsuccess = () => {
          const allEdges = edgeRequest.result as TEdge[];
          const filteredEdges = allEdges.filter((edge) => {
            return nodeIds.has(edge.source) || nodeIds.has(edge.target);
          });

          edges.push(...filteredEdges);

          resolve({
            bounds,
            nodes,
            edges,
            timestamp: Date.now(),
          });
        };

        edgeRequest.onerror = () => {
          reject(new Error('Failed to load edges'));
        };
      };

      nodeRequest.onerror = () => {
        reject(new Error('Failed to load nodes'));
      };
    });
  }

  async persist(changes: ChangeSet<TNode, TEdge>): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['nodes', 'edges'], 'readwrite');
      const nodeStore = transaction.objectStore('nodes');
      const edgeStore = transaction.objectStore('edges');

      // Apply node changes
      changes.nodesAdded.forEach((node) => nodeStore.put(node));
      changes.nodesUpdated.forEach((node) => nodeStore.put(node));
      changes.nodesDeleted.forEach((id) => nodeStore.delete(id));

      // Apply edge changes
      changes.edgesAdded.forEach((edge) => edgeStore.put(edge));
      changes.edgesDeleted.forEach((id) => edgeStore.delete(id));

      transaction.oncomplete = () => {
        this.notify({
          type: 'canvasSaved',
          canvasId: this.canvasId,
          timestamp: Date.now(),
          payload: changes,
        });
        resolve();
      };

      transaction.onerror = () => {
        reject(new Error('Failed to persist changes'));
      };
    });
  }

  subscribe(callback: (event: DataEvent) => void): Unsubscribe {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  async loadAll(): Promise<{ nodes: TNode[]; edges: TEdge[] }> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['nodes', 'edges'], 'readonly');
      const nodeStore = transaction.objectStore('nodes');
      const edgeStore = transaction.objectStore('edges');

      const nodeRequest = nodeStore.getAll();
      const edgeRequest = edgeStore.getAll();

      transaction.oncomplete = () => {
        resolve({
          nodes: nodeRequest.result as TNode[],
          edges: edgeRequest.result as TEdge[],
        });
      };

      transaction.onerror = () => {
        reject(new Error('Failed to load canvas data'));
      };
    });
  }

  private notify(event: DataEvent): void {
    this.subscribers.forEach((callback) => callback(event));
  }

  /**
   * Clear all data for this canvas
   */
  async clear(): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['nodes', 'edges'], 'readwrite');
      const nodeStore = transaction.objectStore('nodes');
      const edgeStore = transaction.objectStore('edges');

      nodeStore.clear();
      edgeStore.clear();

      transaction.oncomplete = () => {
        this.notify({
          type: 'canvasLoaded',
          canvasId: this.canvasId,
          timestamp: Date.now(),
        });
        resolve();
      };

      transaction.onerror = () => {
        reject(new Error('Failed to clear data'));
      };
    });
  }
}

/**
 * Factory functions for creating data sources
 */

export function createMemoryDataSource<TNode extends Node, TEdge extends Edge>(
  canvasId: string,
  initialNodes?: TNode[],
  initialEdges?: TEdge[]
): CanvasDataSource<TNode, TEdge> {
  return new MemoryDataSource(canvasId, initialNodes, initialEdges);
}

export function createLocalStorageDataSource<TNode extends Node, TEdge extends Edge>(
  canvasId: string
): CanvasDataSource<TNode, TEdge> {
  return new LocalStorageDataSource(canvasId);
}

export function createIndexedDBDataSource<TNode extends Node, TEdge extends Edge>(
  canvasId: string
): CanvasDataSource<TNode, TEdge> {
  return new IndexedDBDataSource(canvasId);
}
