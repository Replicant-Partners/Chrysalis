/**
 * DataSource Tests
 * 
 * Updated to match current factory function API
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createMemoryDataSource, createLocalStorageDataSource } from '../../src/canvas/DataSource';
import type { CanvasDataSource } from '../../src/canvas/types';
import type { Node, Edge } from 'reactflow';

describe('MemoryDataSource', () => {
  let dataSource: CanvasDataSource<Node, Edge>;

  beforeEach(() => {
    dataSource = createMemoryDataSource<Node, Edge>();
  });

  it('should load empty canvas initially', async () => {
    const data = await dataSource.load();
    expect(data.nodes).toEqual([]);
    expect(data.edges).toEqual([]);
  });

  it('should save and load nodes', async () => {
    const node: Node = {
      id: '1',
      type: 'default',
      position: { x: 0, y: 0 },
      data: { label: 'Test' },
    };

    await dataSource.save([node], []);

    const loaded = await dataSource.load();
    expect(loaded.nodes).toHaveLength(1);
    expect(loaded.nodes[0].id).toBe('1');
  });

  it('should save and load edges', async () => {
    const edge: Edge = {
      id: 'e1',
      source: '1',
      target: '2',
    };

    await dataSource.save([], [edge]);

    const loaded = await dataSource.load();
    expect(loaded.edges).toHaveLength(1);
    expect(loaded.edges[0].id).toBe('e1');
  });

  it('should notify subscribers on save', async () => {
    const callback = jest.fn();
    dataSource.subscribe(callback);

    const node: Node = {
      id: '1',
      type: 'default',
      position: { x: 0, y: 0 },
      data: {},
    };

    await dataSource.save([node], []);

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'update' })
    );
  });

  it('should unsubscribe correctly', async () => {
    const callback = jest.fn();
    const unsubscribe = dataSource.subscribe(callback);
    unsubscribe();

    await dataSource.save([], []);

    expect(callback).not.toHaveBeenCalled();
  });

  it('should clear data on dispose', async () => {
    const node: Node = {
      id: '1',
      type: 'default',
      position: { x: 0, y: 0 },
      data: {},
    };

    await dataSource.save([node], []);
    dataSource.dispose();

    const loaded = await dataSource.load();
    expect(loaded.nodes).toEqual([]);
    expect(loaded.edges).toEqual([]);
  });
});

// LocalStorageDataSource tests require browser environment (jsdom)
// These tests are skipped in Node.js environment
describe.skip('LocalStorageDataSource', () => {
  const storageKey = 'test-canvas-state';
  let dataSource: CanvasDataSource<Node, Edge>;

  beforeEach(() => {
    localStorage.removeItem(storageKey);
    dataSource = createLocalStorageDataSource<Node, Edge>(storageKey);
  });

  afterEach(() => {
    localStorage.removeItem(storageKey);
  });

  it('should load empty canvas when no data exists', async () => {
    const data = await dataSource.load();
    expect(data.nodes).toEqual([]);
    expect(data.edges).toEqual([]);
  });

  it('should save and load nodes from localStorage', async () => {
    const node: Node = {
      id: '1',
      type: 'default',
      position: { x: 100, y: 200 },
      data: { label: 'Test Node' },
    };

    await dataSource.save([node], []);

    const newDataSource = createLocalStorageDataSource<Node, Edge>(storageKey);
    const loaded = await newDataSource.load();

    expect(loaded.nodes).toHaveLength(1);
    expect(loaded.nodes[0].id).toBe('1');
    expect(loaded.nodes[0].position).toEqual({ x: 100, y: 200 });
  });
});
