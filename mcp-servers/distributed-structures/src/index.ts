#!/usr/bin/env node

/**
 * Distributed Structures MCP Server
 * 
 * Provides distributed system primitives:
 * - DAG operations
 * - Logical time (Lamport, Vector clocks)
 * - Threshold voting
 * - Hashgraph operations
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { Graph } from 'graphlib';

import * as dag from './dag.js';
import * as time from './logical-time.js';
import * as threshold from './threshold.js';
import * as hashgraph from './hashgraph.js';

// ============================================================================
// Tool Definitions
// ============================================================================

const TOOLS: Tool[] = [
  // DAG Operations
  {
    name: 'dag_create',
    description: 'Create a new directed acyclic graph',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'dag_add_node',
    description: 'Add node to DAG',
    inputSchema: {
      type: 'object',
      properties: {
        graph: { type: 'object', description: 'Serialized graph' },
        nodeId: { type: 'string', description: 'Node identifier' },
        data: { type: 'object', description: 'Node data (optional)' }
      },
      required: ['graph', 'nodeId']
    }
  },
  {
    name: 'dag_add_edge',
    description: 'Add directed edge to DAG',
    inputSchema: {
      type: 'object',
      properties: {
        graph: { type: 'object', description: 'Serialized graph' },
        from: { type: 'string', description: 'Source node ID' },
        to: { type: 'string', description: 'Target node ID' }
      },
      required: ['graph', 'from', 'to']
    }
  },
  {
    name: 'dag_topological_sort',
    description: 'Get topological ordering of DAG nodes',
    inputSchema: {
      type: 'object',
      properties: {
        graph: { type: 'object', description: 'Serialized graph' }
      },
      required: ['graph']
    }
  },
  {
    name: 'dag_ancestors',
    description: 'Get all ancestors of a node',
    inputSchema: {
      type: 'object',
      properties: {
        graph: { type: 'object', description: 'Serialized graph' },
        nodeId: { type: 'string', description: 'Node to find ancestors of' }
      },
      required: ['graph', 'nodeId']
    }
  },
  {
    name: 'dag_descendants',
    description: 'Get all descendants of a node',
    inputSchema: {
      type: 'object',
      properties: {
        graph: { type: 'object', description: 'Serialized graph' },
        nodeId: { type: 'string', description: 'Node to find descendants of' }
      },
      required: ['graph', 'nodeId']
    }
  },
  {
    name: 'dag_reachable',
    description: 'Check if there is a path from one node to another',
    inputSchema: {
      type: 'object',
      properties: {
        graph: { type: 'object', description: 'Serialized graph' },
        from: { type: 'string', description: 'Source node' },
        to: { type: 'string', description: 'Target node' }
      },
      required: ['graph', 'from', 'to']
    }
  },
  
  // Lamport Clocks
  {
    name: 'lamport_create',
    description: 'Create a new Lamport clock',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'Node identifier' }
      },
      required: ['nodeId']
    }
  },
  {
    name: 'lamport_tick',
    description: 'Increment Lamport clock for local event',
    inputSchema: {
      type: 'object',
      properties: {
        clock: { type: 'object', description: 'Lamport clock state' }
      },
      required: ['clock']
    }
  },
  {
    name: 'lamport_update',
    description: 'Update Lamport clock when receiving message',
    inputSchema: {
      type: 'object',
      properties: {
        clock: { type: 'object', description: 'Lamport clock state' },
        receivedTimestamp: { type: 'number', description: 'Timestamp from received message' }
      },
      required: ['clock', 'receivedTimestamp']
    }
  },
  
  // Vector Clocks
  {
    name: 'vector_create',
    description: 'Create a new Vector clock',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'This node\'s identifier' },
        allNodeIds: { type: 'array', items: { type: 'string' }, description: 'All node IDs in system' }
      },
      required: ['nodeId', 'allNodeIds']
    }
  },
  {
    name: 'vector_increment',
    description: 'Increment vector clock for local event',
    inputSchema: {
      type: 'object',
      properties: {
        clock: { type: 'object', description: 'Vector clock state' }
      },
      required: ['clock']
    }
  },
  {
    name: 'vector_merge',
    description: 'Merge vector clock with received clock',
    inputSchema: {
      type: 'object',
      properties: {
        localClock: { type: 'object', description: 'Local vector clock' },
        receivedClock: { type: 'object', description: 'Received vector clock' }
      },
      required: ['localClock', 'receivedClock']
    }
  },
  {
    name: 'vector_compare',
    description: 'Compare two vector clocks (before/after/concurrent)',
    inputSchema: {
      type: 'object',
      properties: {
        clock1: { type: 'object', description: 'First vector clock' },
        clock2: { type: 'object', description: 'Second vector clock' }
      },
      required: ['clock1', 'clock2']
    }
  },
  
  // Consensus Timestamp
  {
    name: 'consensus_timestamp',
    description: 'Calculate Byzantine-resistant consensus timestamp (median)',
    inputSchema: {
      type: 'object',
      properties: {
        timestamps: { type: 'array', items: { type: 'number' }, description: 'Timestamps from nodes' }
      },
      required: ['timestamps']
    }
  },
  
  // Threshold Voting
  {
    name: 'vote_count',
    description: 'Count votes by value',
    inputSchema: {
      type: 'object',
      properties: {
        votes: { type: 'array', description: 'Array of vote objects {nodeId, value}' }
      },
      required: ['votes']
    }
  },
  {
    name: 'vote_supermajority',
    description: 'Check if a value has supermajority (>2/3)',
    inputSchema: {
      type: 'object',
      properties: {
        votes: { type: 'array', description: 'Array of vote objects' },
        value: { description: 'Value to check' },
        threshold: { type: 'number', description: 'Threshold (default 2/3)', default: 0.667 }
      },
      required: ['votes', 'value']
    }
  },
  {
    name: 'vote_byzantine_agreement',
    description: 'Determine Byzantine consensus value',
    inputSchema: {
      type: 'object',
      properties: {
        votes: { type: 'array', description: 'Array of vote objects' },
        totalNodes: { type: 'number', description: 'Total number of nodes' }
      },
      required: ['votes', 'totalNodes']
    }
  },
  {
    name: 'vote_detect_conflicts',
    description: 'Detect nodes with conflicting votes',
    inputSchema: {
      type: 'object',
      properties: {
        votes: { type: 'array', description: 'Array of vote objects' }
      },
      required: ['votes']
    }
  },
  
  // Hashgraph Operations
  {
    name: 'hashgraph_create_event',
    description: 'Create a new hashgraph event',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'Creator node ID' },
        timestamp: { type: 'number', description: 'Event timestamp' },
        selfParent: { type: 'string', description: 'Previous event from same node (optional)' },
        otherParent: { type: 'string', description: 'Event from another node (optional)' }
      },
      required: ['nodeId', 'timestamp']
    }
  },
  {
    name: 'hashgraph_sees',
    description: 'Check if event A sees event B',
    inputSchema: {
      type: 'object',
      properties: {
        graph: { type: 'object', description: 'Serialized graph' },
        events: { type: 'object', description: 'Event map' },
        eventA: { type: 'string', description: 'Event A ID' },
        eventB: { type: 'string', description: 'Event B ID' }
      },
      required: ['graph', 'events', 'eventA', 'eventB']
    }
  },
  {
    name: 'hashgraph_assign_rounds',
    description: 'Assign round numbers to all events',
    inputSchema: {
      type: 'object',
      properties: {
        graph: { type: 'object', description: 'Serialized graph' },
        events: { type: 'object', description: 'Event map' },
        allNodeIds: { type: 'array', items: { type: 'string' }, description: 'All node IDs' }
      },
      required: ['graph', 'events', 'allNodeIds']
    }
  },
  {
    name: 'hashgraph_find_witnesses',
    description: 'Find witness events for a round',
    inputSchema: {
      type: 'object',
      properties: {
        events: { type: 'object', description: 'Event map' },
        round: { type: 'number', description: 'Round number' }
      },
      required: ['events', 'round']
    }
  }
];

// ============================================================================
// Server Implementation
// ============================================================================

const server = new Server(
  {
    name: 'distributed-structures',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (!args) {
    throw new Error('Arguments are required');
  }
  
  try {
    switch (name) {
      // DAG Operations
      case 'dag_create': {
        const graph = dag.createDAG();
        const serialized = dag.serializeGraph(graph);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ graph: serialized }, null, 2)
          }]
        };
      }
      
      case 'dag_add_node': {
        const graph = dag.deserializeGraph(args.graph as any);
        dag.addNode(graph, {
          id: args.nodeId as string,
          data: args.data
        });
        const serialized = dag.serializeGraph(graph);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ graph: serialized }, null, 2)
          }]
        };
      }
      
      case 'dag_add_edge': {
        const graph = dag.deserializeGraph(args.graph as any);
        dag.addEdge(graph, {
          from: args.from as string,
          to: args.to as string
        });
        const serialized = dag.serializeGraph(graph);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ graph: serialized }, null, 2)
          }]
        };
      }
      
      case 'dag_topological_sort': {
        const graph = dag.deserializeGraph(args.graph as any);
        const sorted = dag.topologicalSort(graph);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ sorted }, null, 2)
          }]
        };
      }
      
      case 'dag_ancestors': {
        const graph = dag.deserializeGraph(args.graph as any);
        const ancestors = dag.ancestors(graph, args.nodeId as string);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ ancestors: Array.from(ancestors) }, null, 2)
          }]
        };
      }
      
      case 'dag_descendants': {
        const graph = dag.deserializeGraph(args.graph as any);
        const descendants = dag.descendants(graph, args.nodeId as string);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ descendants: Array.from(descendants) }, null, 2)
          }]
        };
      }
      
      case 'dag_reachable': {
        const graph = dag.deserializeGraph(args.graph as any);
        const reachable = dag.isReachable(
          graph,
          args.from as string,
          args.to as string
        );
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ reachable }, null, 2)
          }]
        };
      }
      
      // Lamport Clocks
      case 'lamport_create': {
        const clock = time.createLamportClock(args.nodeId as string);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ clock }, null, 2)
          }]
        };
      }
      
      case 'lamport_tick': {
        const clock = time.lamportTick(args.clock as time.LamportClock);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ clock }, null, 2)
          }]
        };
      }
      
      case 'lamport_update': {
        const clock = time.lamportUpdate(
          args.clock as time.LamportClock,
          args.receivedTimestamp as number
        );
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ clock }, null, 2)
          }]
        };
      }
      
      // Vector Clocks
      case 'vector_create': {
        const clock = time.createVectorClock(
          args.nodeId as string,
          args.allNodeIds as string[]
        );
        const serialized = time.serializeVectorClock(clock);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ clock: serialized }, null, 2)
          }]
        };
      }
      
      case 'vector_increment': {
        const clock = time.deserializeVectorClock(args.clock as any);
        const incremented = time.vectorIncrement(clock);
        const serialized = time.serializeVectorClock(incremented);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ clock: serialized }, null, 2)
          }]
        };
      }
      
      case 'vector_merge': {
        const local = time.deserializeVectorClock(args.localClock as any);
        const received = time.deserializeVectorClock(args.receivedClock as any);
        const merged = time.vectorMerge(local, received);
        const serialized = time.serializeVectorClock(merged);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ clock: serialized }, null, 2)
          }]
        };
      }
      
      case 'vector_compare': {
        const clock1 = time.deserializeVectorClock(args.clock1 as any);
        const clock2 = time.deserializeVectorClock(args.clock2 as any);
        const ordering = time.vectorCompare(clock1, clock2);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ ordering }, null, 2)
          }]
        };
      }
      
      // Consensus Timestamp
      case 'consensus_timestamp': {
        const timestamp = time.consensusTimestamp(args.timestamps as number[]);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ consensusTimestamp: timestamp }, null, 2)
          }]
        };
      }
      
      // Threshold Voting
      case 'vote_count': {
        const votes = args.votes as threshold.Vote[];
        const counts = threshold.countVotes(votes);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ counts }, null, 2)
          }]
        };
      }
      
      case 'vote_supermajority': {
        const votes = args.votes as threshold.Vote[];
        const value = args.value;
        const thresholdValue = (args.threshold as number) || 2/3;
        const hasSupermajority = threshold.hasSupermajority(votes, value, thresholdValue);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ 
              hasSupermajority,
              threshold: thresholdValue
            }, null, 2)
          }]
        };
      }
      
      case 'vote_byzantine_agreement': {
        const votes = args.votes as threshold.Vote[];
        const totalNodes = args.totalNodes as number;
        const agreed = threshold.byzantineAgreement(votes, totalNodes);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ 
              agreedValue: agreed,
              hasAgreement: agreed !== null
            }, null, 2)
          }]
        };
      }
      
      case 'vote_detect_conflicts': {
        const votes = args.votes as threshold.Vote[];
        const conflicts = threshold.detectConflicts(votes);
        const conflictArray = Array.from(conflicts.entries()).map(([nodeId, values]) => ({
          nodeId,
          conflictingValues: values
        }));
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ 
              conflicts: conflictArray,
              conflictCount: conflicts.size
            }, null, 2)
          }]
        };
      }
      
      // Hashgraph Operations
      case 'hashgraph_create_event': {
        const event = hashgraph.createEvent(
          args.nodeId as string,
          args.timestamp as number,
          args.selfParent as string | undefined,
          args.otherParent as string | undefined
        );
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ event }, null, 2)
          }]
        };
      }
      
      case 'hashgraph_sees': {
        const graph = dag.deserializeGraph(args.graph as any);
        const eventsObj = args.events as any;
        const events = new Map<string, hashgraph.HashgraphEvent>(
          Object.entries(eventsObj)
        );
        
        const sees = hashgraph.sees(
          graph,
          events,
          args.eventA as string,
          args.eventB as string
        );
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ sees }, null, 2)
          }]
        };
      }
      
      case 'hashgraph_assign_rounds': {
        const graph = dag.deserializeGraph(args.graph as any);
        const eventsObj = args.events as any;
        const events = new Map<string, hashgraph.HashgraphEvent>(
          Object.entries(eventsObj)
        );
        
        hashgraph.assignRounds(graph, events, args.allNodeIds as string[]);
        
        const eventsResult = Object.fromEntries(events.entries());
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ 
              events: eventsResult,
              graph: dag.serializeGraph(graph)
            }, null, 2)
          }]
        };
      }
      
      case 'hashgraph_find_witnesses': {
        const eventsObj = args.events as any;
        const events = new Map<string, hashgraph.HashgraphEvent>(
          Object.entries(eventsObj)
        );
        
        const witnesses = hashgraph.findWitnesses(events, args.round as number);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ witnesses }, null, 2)
          }]
        };
      }
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ error: errorMessage }, null, 2)
      }],
      isError: true
    };
  }
});

// ============================================================================
// Start Server
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Distributed Structures MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
