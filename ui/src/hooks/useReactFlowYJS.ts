/**
 * useReactFlowYJS Hook
 * 
 * Bidirectional synchronization between React Flow state and YJS CRDT.
 * Enables real-time collaboration on the canvas.
 */

import { useEffect, useRef, useCallback } from 'react';
import { Node, Edge } from '@xyflow/react';
import * as Y from 'yjs';

// Debounce utility
function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]) as T;
}

/**
 * Hook to synchronize React Flow nodes/edges with YJS document
 */
export function useReactFlowYJS(
  doc: Y.Doc | null,
  nodes: Node[],
  edges: Edge[],
  setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void,
  setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void
) {
  const yNodes = useRef<Y.Array<Node>>();
  const yEdges = useRef<Y.Array<Edge>>();
  const isUpdatingFromYJS = useRef(false);

  // Initialize YJS arrays
  useEffect(() => {
    if (!doc) return;

    yNodes.current = doc.getArray<Node>('canvas_nodes');
    yEdges.current = doc.getArray<Edge>('canvas_edges');

    // Initial load from YJS
    const initialNodes = yNodes.current.toArray();
    const initialEdges = yEdges.current.toArray();
    
    if (initialNodes.length > 0) {
      setNodes(initialNodes);
    }
    if (initialEdges.length > 0) {
      setEdges(initialEdges);
    }

    // YJS → React Flow observer
    const handleYJSUpdate = () => {
      if (!yNodes.current || !yEdges.current) return;
      
      isUpdatingFromYJS.current = true;
      setNodes(yNodes.current.toArray());
      setEdges(yEdges.current.toArray());
      
      // Reset flag after React has processed the update
      setTimeout(() => {
        isUpdatingFromYJS.current = false;
      }, 0);
    };

    yNodes.current.observe(handleYJSUpdate);
    yEdges.current.observe(handleYJSUpdate);

    return () => {
      yNodes.current?.unobserve(handleYJSUpdate);
      yEdges.current?.unobserve(handleYJSUpdate);
    };
  }, [doc, setNodes, setEdges]);

  // React Flow → YJS sync (debounced to avoid excessive updates)
  const syncToYJS = useDebouncedCallback(
    useCallback(() => {
      if (!doc || !yNodes.current || !yEdges.current || isUpdatingFromYJS.current) {
        return;
      }

      doc.transact(() => {
        if (yNodes.current) {
          yNodes.current.delete(0, yNodes.current.length);
          yNodes.current.push(nodes);
        }
        if (yEdges.current) {
          yEdges.current.delete(0, yEdges.current.length);
          yEdges.current.push(edges);
        }
      });
    }, [doc, nodes, edges]),
    100 // 100ms debounce
  );

  // Trigger sync when nodes or edges change (unless from YJS)
  useEffect(() => {
    if (!isUpdatingFromYJS.current) {
      syncToYJS();
    }
  }, [nodes, edges, syncToYJS]);
}