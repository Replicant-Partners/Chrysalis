# Distributed Structures MCP Server

## Overview

Layer 1 MCP server providing distributed system primitives for consensus protocols:

- **DAG Operations**: Graph construction, topological sort, reachability
- **Logical Time**: Lamport clocks, Vector clocks, causal ordering
- **Threshold Voting**: Vote counting, supermajority detection, Byzantine agreement
- **Hashgraph Operations**: Round calculation, witness identification, "sees" relationships

## Installation

```bash
cd mcp-servers/distributed-structures
npm install
npm run build
```

## Usage

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "distributed-structures": {
      "command": "node",
      "args": [
        "/home/mdz-axolotl/Documents/GitClones/Chrysalis/mcp-servers/distributed-structures/dist/index.js"
      ]
    }
  }
}
```

## Architecture

Built on proven libraries and algorithms:
- `graphlib` - Mature DAG operations (10+ years)
- Custom Lamport/Vector clock implementations
- Hashgraph virtual voting (from research papers)

## Tools Provided

### DAG Operations
- `dag_create` - Create new DAG
- `dag_add_node` - Add vertex to DAG
- `dag_add_edge` - Add directed edge
- `dag_topological_sort` - Get topological ordering
- `dag_ancestors` - Get all ancestors of node
- `dag_descendants` - Get all descendants
- `dag_reachable` - Check if path exists

### Logical Time
- `lamport_create` - Create Lamport clock
- `lamport_tick` - Increment local clock
- `lamport_update` - Update from received timestamp
- `vector_create` - Create Vector clock
- `vector_increment` - Increment for local event
- `vector_merge` - Merge with received clock
- `vector_compare` - Compare two clocks (before/after/concurrent)

### Threshold Voting
- `vote_count` - Count votes by option
- `vote_supermajority` - Check if threshold reached
- `vote_byzantine_agreement` - Byzantine-resistant agreement

### Hashgraph Operations (Advanced)
- `hashgraph_round` - Calculate round number for event
- `hashgraph_witnesses` - Find witness events for round
- `hashgraph_sees` - Check if event sees another
- `hashgraph_strongly_sees` - Check strong seeing (>2/3)

## Concepts

### DAG (Directed Acyclic Graph)
Events in distributed systems form a DAG based on causality. If event A happened before event B, there's an edge A→B.

### Lamport Clocks
Simple logical timestamps that capture happens-before relationships:
- Increment on local event
- Update to max(local, received) + 1 on message receive

### Vector Clocks
Complete causal history tracking:
- Each node maintains vector of timestamps
- Can detect concurrent events
- Enables causal ordering

### Threshold Voting
Byzantine fault-tolerant voting:
- Requires >2/3 agreement (f < n/3 Byzantine nodes)
- Prevents malicious manipulation

### Hashgraph Virtual Voting
Asynchronous Byzantine consensus:
- Events "see" each other through parent edges
- Witnesses elected per round
- Virtual voting achieves consensus without voting messages

## Development

```bash
# Build
npm run build

# Development mode (watch)
npm run dev

# Run tests
npm test

# Test with watch
npm test:watch
```

## License

MIT
