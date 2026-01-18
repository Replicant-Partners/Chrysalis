import { describe, it, expect, beforeEach } from '@jest/globals';
import { MemoryDataSource, LocalStorageDataSource } from '../../src/canvas/DataSource';
import type { Node, Edge } from 'reactflow';

describe('MemoryDataSource', () => {
  let dataSource: MemoryDataSource<Node, Edge>;

  beforeEach(() => {
    dataSource = new MemoryDataSource('test-canvas');
  });

  it('should load empty canvas initially', async () => {
    const data = await dataSource.loadAll();
    expect(data.nodes).toEqual([]);
    expect(data.edges).toEqual([]);
  });

  it('should persist and load nodes', async () => {
    const node: Node = {
      id: '1',
      type: 'default',
      position: { x: 0, y: 0 },
      data: { label: 'Test' },
    };

    await dataSource.persist({
      nodesAdded: [node],
      nodesUpdated: [],
      nodesDeleted: [],
      edgesAdded: [],
      edgesDeleted: [],
    });

    const loaded = await dataSource.loadAll();
    expect(loaded.nodes).toHaveLength(1);
    expect(loaded.nodes[0].id).toBe('1');
  });

  it('should load tile within bounds', async () => {
    const nodes: Node[] = [
      { id: '1', type: 'default', position: { x: 0, y: 0 }, data: {} },
      { id: '2', type: 'default', position: { x: 100, y: 100 }, data: {} },
      { id: '3', type: 'default', position: { x: 500, y: 500 }, data: {} },
    ];

    await dataSource.persist({
      nodesAdded: nodes,
      nodesUpdated: [],
      nodesDeleted: [],
      edgesAdded: [],
      edgesDeleted: [],
    });

    const tile = await dataSource.loadTile({ minX: 0, maxX: 200, minY: 0, maxY: 200 });
    expect(tile.nodes).toHaveLength(2);
  });
});
