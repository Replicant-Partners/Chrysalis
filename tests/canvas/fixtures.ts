/**
 * Canvas Test Fixtures
 * 
 * Reusable test data for canvas integration testing.
 */

import type { Node, Edge } from 'reactflow';
import type { WidgetNodeData, CanvasPolicy, CanvasTheme } from '../../src/canvas/types';

// ============================================================================
// Widget Data Fixtures
// ============================================================================

export interface NoteFixtureData extends WidgetNodeData {
  content: string;
  tags?: string[];
}

export interface LinkFixtureData extends WidgetNodeData {
  url: string;
  title: string;
  description?: string;
}

export interface ConfigFixtureData extends WidgetNodeData {
  key: string;
  value: string;
  description?: string;
}

// ============================================================================
// Node Fixtures
// ============================================================================

export const createNoteNode = (
  id: string,
  position: { x: number; y: number },
  content: string,
  label?: string
): Node<NoteFixtureData> => ({
  id,
  type: 'note',
  position,
  data: {
    type: 'note',
    label: label || 'Note',
    content,
    tags: [],
  },
});

export const createLinkNode = (
  id: string,
  position: { x: number; y: number },
  url: string,
  title: string
): Node<LinkFixtureData> => ({
  id,
  type: 'link',
  position,
  data: {
    type: 'link',
    label: title,
    url,
    title,
  },
});

export const createConfigNode = (
  id: string,
  position: { x: number; y: number },
  key: string,
  value: string
): Node<ConfigFixtureData> => ({
  id,
  type: 'config',
  position,
  data: {
    type: 'config',
    label: key,
    key,
    value,
  },
});

// ============================================================================
// Edge Fixtures
// ============================================================================

export const createEdge = (
  id: string,
  source: string,
  target: string,
  label?: string
): Edge => ({
  id,
  source,
  target,
  label,
});

// ============================================================================
// Canvas State Fixtures
// ============================================================================

export const EMPTY_CANVAS = {
  nodes: [] as Node<WidgetNodeData>[],
  edges: [] as Edge[],
};

export const SCRAPBOOK_CANVAS_FIXTURE = {
  nodes: [
    createNoteNode('note-1', { x: 100, y: 100 }, 'First note content', 'Note 1'),
    createNoteNode('note-2', { x: 100, y: 300 }, 'Second note content', 'Note 2'),
    createLinkNode('link-1', { x: 400, y: 100 }, 'https://example.com', 'Example'),
  ],
  edges: [
    createEdge('e1', 'note-1', 'link-1'),
  ],
};

export const SETTINGS_CANVAS_FIXTURE = {
  nodes: [
    createConfigNode('config-1', { x: 100, y: 100 }, 'api.endpoint', 'https://api.example.com'),
    createConfigNode('config-2', { x: 100, y: 300 }, 'api.key', '***hidden***'),
  ],
  edges: [],
};

// ============================================================================
// Policy Fixtures
// ============================================================================

export const DEFAULT_TEST_POLICY: CanvasPolicy = {
  maxNodes: 100,
  maxEdges: 200,
  rateLimit: { actions: 50, windowMs: 1000 },
  allowedWidgetTypes: ['note', 'link', 'artifact', 'config', 'connection'],
};

export const STRICT_TEST_POLICY: CanvasPolicy = {
  maxNodes: 5,
  maxEdges: 10,
  rateLimit: { actions: 5, windowMs: 1000 },
  allowedWidgetTypes: ['note'],
};

// ============================================================================
// Theme Fixtures
// ============================================================================

export const DARK_THEME: CanvasTheme = {
  background: '#1a1d24',
  gridColor: '#2f3b55',
  nodeBorder: '#3f4a5a',
  selectedBorder: '#3498db',
  edgeColor: '#546e7a',
  textColor: '#e0e0e0',
  fontFamily: 'system-ui, sans-serif',
};

export const LIGHT_THEME: CanvasTheme = {
  background: '#ffffff',
  gridColor: '#e0e0e0',
  nodeBorder: '#cccccc',
  selectedBorder: '#2196f3',
  edgeColor: '#999999',
  textColor: '#333333',
  fontFamily: 'system-ui, sans-serif',
};

// ============================================================================
// Mock Functions
// ============================================================================

export const createMockEventHandler = () => {
  const events: Array<{ type: string; payload?: unknown }> = [];
  const handler = (event: { type: string; payload?: unknown }) => {
    events.push(event);
  };
  return { handler, events };
};

export const createMockDataSource = <N extends Node<WidgetNodeData>, E extends Edge>(
  initialNodes: N[] = [],
  initialEdges: E[] = []
) => {
  let nodes = [...initialNodes];
  let edges = [...initialEdges];
  const listeners = new Set<(event: { type: string }) => void>();

  return {
    load: async () => ({ nodes: [...nodes], edges: [...edges] }),
    save: async (newNodes: N[], newEdges: E[]) => {
      nodes = [...newNodes];
      edges = [...newEdges];
      listeners.forEach((cb) => cb({ type: 'update' }));
    },
    subscribe: (callback: (event: { type: string }) => void) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    dispose: () => {
      listeners.clear();
      nodes = [];
      edges = [];
    },
    // Test helpers
    _getNodes: () => nodes,
    _getEdges: () => edges,
    _getListenerCount: () => listeners.size,
  };
};
