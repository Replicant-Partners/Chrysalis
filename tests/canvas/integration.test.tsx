/**
 * Canvas Integration Tests
 * 
 * These tests verify the integration between canvas components,
 * data sources, and the widget registry.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import React from 'react';
import { createWidgetRegistry } from '../../src/canvas/WidgetRegistry';
import { createMemoryDataSource } from '../../src/canvas/DataSource';
import {
  createNoteNode,
  createLinkNode,
  createEdge,
  createMockEventHandler,
  createMockDataSource,
  DEFAULT_TEST_POLICY,
  SCRAPBOOK_CANVAS_FIXTURE,
} from './fixtures';
import type { WidgetDefinition, WidgetNodeData } from '../../src/canvas/types';

// Mock widget renderer
const MockWidget: React.FC<{ data: WidgetNodeData }> = ({ data }) => 
  React.createElement('div', { 'data-testid': `widget-${data.type}` }, data.label);

describe('Canvas Integration', () => {
  describe('WidgetRegistry + DataSource Integration', () => {
    it('should register widgets and load data from source', async () => {
      // Setup registry
      const registry = createWidgetRegistry('scrapbook', ['note', 'link']);
      
      const noteWidgetDef: WidgetDefinition<WidgetNodeData> = {
        type: 'note',
        displayName: 'Note',
        renderer: MockWidget,
        capabilities: ['read', 'edit'],
        defaultData: {},
      };
      
      const linkWidgetDef: WidgetDefinition<WidgetNodeData> = {
        type: 'link',
        displayName: 'Link',
        renderer: MockWidget,
        capabilities: ['read'],
        defaultData: {},
      };
      
      registry.register(noteWidgetDef);
      registry.register(linkWidgetDef);
      
      // Setup data source with fixtures
      const dataSource = createMemoryDataSource(
        SCRAPBOOK_CANVAS_FIXTURE.nodes,
        SCRAPBOOK_CANVAS_FIXTURE.edges
      );
      
      // Load data
      const loaded = await dataSource.load();
      
      // Verify all nodes have registered widget types
      for (const node of loaded.nodes) {
        expect(registry.has(node.type!)).toBe(true);
      }
      
      expect(loaded.nodes).toHaveLength(3);
      expect(loaded.edges).toHaveLength(1);
    });

    it('should filter nodes by allowed widget types', async () => {
      const registry = createWidgetRegistry('restricted', ['note']);
      
      const noteWidgetDef: WidgetDefinition<WidgetNodeData> = {
        type: 'note',
        displayName: 'Note',
        renderer: MockWidget,
        capabilities: ['read'],
        defaultData: {},
      };
      
      registry.register(noteWidgetDef);
      
      // Load mixed data
      const dataSource = createMemoryDataSource(
        SCRAPBOOK_CANVAS_FIXTURE.nodes,
        SCRAPBOOK_CANVAS_FIXTURE.edges
      );
      
      const loaded = await dataSource.load();
      
      // Filter to allowed types
      const allowedNodes = loaded.nodes.filter(
        (node) => node.type && registry.isAllowed(node.type)
      );
      
      expect(allowedNodes).toHaveLength(2); // Only notes
      expect(allowedNodes.every((n) => n.type === 'note')).toBe(true);
    });
  });

  describe('DataSource Subscription', () => {
    it('should notify subscribers on data changes', async () => {
      const mockDataSource = createMockDataSource();
      const { handler, events } = createMockEventHandler();
      
      mockDataSource.subscribe(handler);
      
      // Save new data
      await mockDataSource.save(
        [createNoteNode('new-1', { x: 0, y: 0 }, 'New note')],
        []
      );
      
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('update');
    });

    it('should allow multiple subscribers', async () => {
      const mockDataSource = createMockDataSource();
      const handler1 = createMockEventHandler();
      const handler2 = createMockEventHandler();
      
      mockDataSource.subscribe(handler1.handler);
      mockDataSource.subscribe(handler2.handler);
      
      await mockDataSource.save([], []);
      
      expect(handler1.events).toHaveLength(1);
      expect(handler2.events).toHaveLength(1);
    });

    it('should unsubscribe correctly', async () => {
      const mockDataSource = createMockDataSource();
      const { handler, events } = createMockEventHandler();
      
      const unsubscribe = mockDataSource.subscribe(handler);
      unsubscribe();
      
      await mockDataSource.save([], []);
      
      expect(events).toHaveLength(0);
    });
  });

  describe('Node and Edge Operations', () => {
    it('should add nodes correctly', async () => {
      const dataSource = createMemoryDataSource();
      
      const node1 = createNoteNode('n1', { x: 100, y: 100 }, 'Note 1');
      const node2 = createNoteNode('n2', { x: 200, y: 200 }, 'Note 2');
      
      await dataSource.save([node1, node2], []);
      
      const loaded = await dataSource.load();
      expect(loaded.nodes).toHaveLength(2);
      expect(loaded.nodes.map((n) => n.id)).toEqual(['n1', 'n2']);
    });

    it('should add edges between nodes', async () => {
      const dataSource = createMemoryDataSource();
      
      const node1 = createNoteNode('n1', { x: 100, y: 100 }, 'Note 1');
      const node2 = createNoteNode('n2', { x: 200, y: 200 }, 'Note 2');
      const edge = createEdge('e1', 'n1', 'n2');
      
      await dataSource.save([node1, node2], [edge]);
      
      const loaded = await dataSource.load();
      expect(loaded.edges).toHaveLength(1);
      expect(loaded.edges[0].source).toBe('n1');
      expect(loaded.edges[0].target).toBe('n2');
    });

    it('should update nodes correctly', async () => {
      const dataSource = createMemoryDataSource();
      
      const node = createNoteNode('n1', { x: 100, y: 100 }, 'Original');
      await dataSource.save([node], []);
      
      // Update node
      const updatedNode = {
        ...node,
        position: { x: 200, y: 200 },
        data: { ...node.data, content: 'Updated' },
      };
      await dataSource.save([updatedNode], []);
      
      const loaded = await dataSource.load();
      expect(loaded.nodes[0].position).toEqual({ x: 200, y: 200 });
    });

    it('should delete nodes correctly', async () => {
      const dataSource = createMemoryDataSource();
      
      const node1 = createNoteNode('n1', { x: 100, y: 100 }, 'Note 1');
      const node2 = createNoteNode('n2', { x: 200, y: 200 }, 'Note 2');
      
      await dataSource.save([node1, node2], []);
      
      // Delete node1
      await dataSource.save([node2], []);
      
      const loaded = await dataSource.load();
      expect(loaded.nodes).toHaveLength(1);
      expect(loaded.nodes[0].id).toBe('n2');
    });
  });

  describe('Policy Enforcement', () => {
    it('should respect allowed widget types', () => {
      const registry = createWidgetRegistry('test', ['note', 'link']);
      
      expect(registry.isAllowed('note')).toBe(false); // Not registered yet
      
      registry.register({
        type: 'note',
        displayName: 'Note',
        renderer: MockWidget,
        capabilities: [],
        defaultData: {},
      });
      
      expect(registry.isAllowed('note')).toBe(true);
      expect(registry.isAllowed('config')).toBe(false); // Not in allowlist
    });

    it('should categorize widgets correctly', () => {
      const registry = createWidgetRegistry('test', ['note', 'link', 'artifact']);
      
      registry.register({
        type: 'note',
        displayName: 'Note',
        renderer: MockWidget,
        capabilities: [],
        defaultData: {},
        category: 'content',
      });
      
      registry.register({
        type: 'link',
        displayName: 'Link',
        renderer: MockWidget,
        capabilities: [],
        defaultData: {},
        category: 'reference',
      });
      
      registry.register({
        type: 'artifact',
        displayName: 'Artifact',
        renderer: MockWidget,
        capabilities: [],
        defaultData: {},
        category: 'content',
      });
      
      const contentWidgets = registry.getByCategory('content');
      expect(contentWidgets).toHaveLength(2);
      expect(contentWidgets.map((w) => w.type)).toContain('note');
      expect(contentWidgets.map((w) => w.type)).toContain('artifact');
    });
  });

  describe('Data Persistence', () => {
    it('should maintain data integrity across save/load cycles', async () => {
      const dataSource = createMemoryDataSource();
      
      const originalNodes = [
        createNoteNode('n1', { x: 100, y: 100 }, 'Note 1', 'Label 1'),
        createLinkNode('l1', { x: 200, y: 200 }, 'https://example.com', 'Example'),
      ];
      const originalEdges = [createEdge('e1', 'n1', 'l1')];
      
      // Save
      await dataSource.save(originalNodes, originalEdges);
      
      // Load
      const loaded = await dataSource.load();
      
      // Verify integrity
      expect(loaded.nodes).toHaveLength(2);
      expect(loaded.edges).toHaveLength(1);
      
      // Verify node data
      const note = loaded.nodes.find((n) => n.id === 'n1');
      expect(note?.data.label).toBe('Label 1');
      expect(note?.position).toEqual({ x: 100, y: 100 });
      
      // Verify edge data
      expect(loaded.edges[0].source).toBe('n1');
      expect(loaded.edges[0].target).toBe('l1');
    });

    it('should handle empty canvas correctly', async () => {
      const dataSource = createMemoryDataSource();
      
      const loaded = await dataSource.load();
      
      expect(loaded.nodes).toEqual([]);
      expect(loaded.edges).toEqual([]);
    });
  });
});
