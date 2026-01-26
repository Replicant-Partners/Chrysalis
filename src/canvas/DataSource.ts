/**
 * Canvas Data Source
 * 
 * Provides persistence and synchronization for canvas state.
 */

import type { CanvasDataSource, DataSourceEvent, WidgetNodeData } from './types';
import type { Node, Edge } from 'reactflow';

/**
 * Create a localStorage-based data source
 * @param storageKey
 */
export function createLocalStorageDataSource<
  N extends Node<WidgetNodeData> = Node<WidgetNodeData>,
  E extends Edge = Edge
>(storageKey: string): CanvasDataSource<N, E> {
  const listeners = new Set<(event: DataSourceEvent<N, E>) => void>();

  return {
    async load(): Promise<{ nodes: N[]; edges: E[] }> {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const data = JSON.parse(stored);
          return {
            nodes: (data.nodes || []) as N[],
            edges: (data.edges || []) as E[],
          };
        }
      } catch (error) {
        console.error('Failed to load canvas state from localStorage:', error);
      }
      return { nodes: [], edges: [] };
    },

    async save(nodes: N[], edges: E[]): Promise<void> {
      try {
        localStorage.setItem(storageKey, JSON.stringify({ nodes, edges }));
      } catch (error) {
        console.error('Failed to save canvas state to localStorage:', error);
        listeners.forEach(cb => cb({ type: 'error', error: error as Error }));
      }
    },

    subscribe(callback: (event: DataSourceEvent<N, E>) => void): () => void {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },

    dispose(): void {
      listeners.clear();
    },
  };
}

/**
 * Create an in-memory data source (no persistence)
 * @param initialNodes
 * @param initialEdges
 */
export function createMemoryDataSource<
  N extends Node<WidgetNodeData> = Node<WidgetNodeData>,
  E extends Edge = Edge
>(initialNodes: N[] = [], initialEdges: E[] = []): CanvasDataSource<N, E> {
  let nodes = [...initialNodes];
  let edges = [...initialEdges];
  const listeners = new Set<(event: DataSourceEvent<N, E>) => void>();

  return {
    async load(): Promise<{ nodes: N[]; edges: E[] }> {
      return { nodes: [...nodes], edges: [...edges] };
    },

    async save(newNodes: N[], newEdges: E[]): Promise<void> {
      nodes = [...newNodes];
      edges = [...newEdges];
      listeners.forEach(cb => cb({ type: 'update', nodes, edges }));
    },

    subscribe(callback: (event: DataSourceEvent<N, E>) => void): () => void {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },

    dispose(): void {
      listeners.clear();
      nodes = [];
      edges = [];
    },
  };
}

/**
 * Create a YJS-backed data source for real-time collaboration
 * @param yjsDoc - YJS document for CRDT sync
 * @param mapKey - Key prefix for nodes/edges maps in the YJS doc (default: 'canvas')
 */
export function createYjsDataSource<
  N extends Node<WidgetNodeData> = Node<WidgetNodeData>,
  E extends Edge = Edge
>(yjsDoc: { getArray: (key: string) => any; transact?: (fn: () => void) => void }, mapKey: string = 'canvas'): CanvasDataSource<N, E> {
  const listeners = new Set<(event: DataSourceEvent<N, E>) => void>();
  let disposed = false;

  // Get or create YJS arrays for nodes and edges
  const nodesArray = yjsDoc.getArray(`${mapKey}:nodes`) as { toArray: () => N[]; push: (items: N[]) => void; delete: (index: number, length: number) => void; length: number; observe: (fn: () => void) => void; unobserve: (fn: () => void) => void };
  const edgesArray = yjsDoc.getArray(`${mapKey}:edges`) as { toArray: () => E[]; push: (items: E[]) => void; delete: (index: number, length: number) => void; length: number; observe: (fn: () => void) => void; unobserve: (fn: () => void) => void };

  // Observer for nodes changes
  const nodesObserver = () => {
    if (disposed) return;
    const nodes = nodesArray.toArray();
    const edges = edgesArray.toArray();
    listeners.forEach(cb => cb({ type: 'nodesChanged', nodes, edges }));
  };

  // Observer for edges changes
  const edgesObserver = () => {
    if (disposed) return;
    const nodes = nodesArray.toArray();
    const edges = edgesArray.toArray();
    listeners.forEach(cb => cb({ type: 'edgesChanged', nodes, edges }));
  };

  // Attach observers
  nodesArray.observe(nodesObserver);
  edgesArray.observe(edgesObserver);

  return {
    async load(): Promise<{ nodes: N[]; edges: E[] }> {
      if (disposed) return { nodes: [], edges: [] };
      return {
        nodes: nodesArray.toArray(),
        edges: edgesArray.toArray(),
      };
    },

    async save(nodes: N[], edges: E[]): Promise<void> {
      if (disposed) return;

      const doSave = () => {
        // Clear and repopulate nodes
        nodesArray.delete(0, nodesArray.length);
        nodesArray.push(nodes);

        // Clear and repopulate edges
        edgesArray.delete(0, edgesArray.length);
        edgesArray.push(edges);
      };

      // Use YJS transaction for atomic update if available
      if (yjsDoc.transact) {
        yjsDoc.transact(doSave);
      } else {
        doSave();
      }
    },

    subscribe(callback: (event: DataSourceEvent<N, E>) => void): () => void {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },

    dispose(): void {
      disposed = true;
      nodesArray.unobserve(nodesObserver);
      edgesArray.unobserve(edgesObserver);
      listeners.clear();
    },
  };
}

/**
 * Create a data source that syncs with a remote API
 * @param options
 * @param options.baseUrl
 * @param options.canvasId
 * @param options.authToken
 */
export function createRemoteDataSource<
  N extends Node<WidgetNodeData> = Node<WidgetNodeData>,
  E extends Edge = Edge
>(options: {
  baseUrl: string;
  canvasId: string;
  authToken?: string;
}): CanvasDataSource<N, E> {
  const { baseUrl, canvasId, authToken } = options;
  const listeners = new Set<(event: DataSourceEvent<N, E>) => void>();
  let disposed = false;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  return {
    async load(): Promise<{ nodes: N[]; edges: E[] }> {
      if (disposed) {return { nodes: [], edges: [] };}

      try {
        const response = await fetch(`${baseUrl}/canvas/${canvasId}`, { headers });
        if (!response.ok) {
          throw new Error(`Failed to load canvas: ${response.status}`);
        }
        const data = await response.json();
        return {
          nodes: (data.nodes || []) as N[],
          edges: (data.edges || []) as E[],
        };
      } catch (error) {
        console.error('Failed to load canvas from remote:', error);
        listeners.forEach(cb => cb({ type: 'error', error: error as Error }));
        return { nodes: [], edges: [] };
      }
    },

    async save(nodes: N[], edges: E[]): Promise<void> {
      if (disposed) {return;}

      try {
        const response = await fetch(`${baseUrl}/canvas/${canvasId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ nodes, edges }),
        });
        if (!response.ok) {
          throw new Error(`Failed to save canvas: ${response.status}`);
        }
      } catch (error) {
        console.error('Failed to save canvas to remote:', error);
        listeners.forEach(cb => cb({ type: 'error', error: error as Error }));
      }
    },

    subscribe(callback: (event: DataSourceEvent<N, E>) => void): () => void {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },

    dispose(): void {
      disposed = true;
      listeners.clear();
    },
  };
}
