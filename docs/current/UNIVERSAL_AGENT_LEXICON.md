# Uniform Semantic Agent Lexicon (OODA + Interrogatives + Emoji Mode)

## Core Entities
- Agent: autonomous process with cryptographic identity; implements UniformSemanticAgent schema and participates in experience sync and morphing across MCP/multi_agent/orchestrated modes.
- Identity: SHA-384 fingerprint + Ed25519 keys; anchors accountability and signing of experience/state transfers.
- Instance: running agent copy with transport, sync protocol, health, and stats; unit of observation in OODA loops.
- Experience: episodic records (interactions, outcomes, lessons) with optional OODA interrogatives captured per stage.
- Memory: episodic + semantic stores (vector/graph/hybrid); convergence and deduplication rules govern merges.
- Skill: profiled capability with proficiency, learning curve, usage stats, synergies; aggregated across instances.
- Knowledge/Concept: named semantic node with definition, relations, confidence, provenance; forms graph substrate.
- Tool: MCP/native/API action with usage metrics; bound to instances and governed by transport policy.
- Pattern: validated primitive (hash, signature, random, gossip, DAG, convergence, redundancy, threshold, logical time, CRDT); resolved per context via resolver.
- Morphing: lossless conversion between agent implementations with shadow fields to preserve fidelity.

## Fabrics and Resolution
- Pattern Resolver: chooses implementation source (go | mcp | embedded | library) based on deployment context (distributed, mcp_available, performance_critical, prefer_reusability).
- Go gRPC Fabric: crypto primitives (hash, verify, Merkle, Ed25519, BLS, random) over gRPC.
- MCP Fabric: cryptographic-primitives + distributed-structures servers delivering networked pattern operations.
- Embedded Patterns: local TypeScript implementations for low-latency, single-node use.
- Adaptive Deployment: hybrid choice per pattern call; favors reusability (Go/MCP) vs latency (embedded) vs simplicity (library).

## Synchronization and State
- Experience Sync: streaming | lumped | check_in protocols over https | websocket | mcp transports; merges via conflict resolution and deduplication.
- Evolution Tracking: DAG of state transitions with logical time and fingerprints to support traceability.
- Aggregation: convergence/threshold functions (median, trimmed mean, supermajority) for byzantine-resistant merging.

## OODA + Interrogative Matrix
- Each cell defines the question the agent must answer for the step; populate from memories, tools, peers, and current context; persisted on episodes.

| OODA Step | Who | What | When | Where | Why | How | Huh? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Observe | sources/actors emitting signals | events, deltas, anomalies | timestamps, cadence | locations, channels | purpose of signal, stakes | collection methods, sensors | gaps in sensing or missing signals |
| Orient | stakeholders, roles | state, patterns, priors | temporal ordering, recency | topology, neighborhood | causal hypotheses | models, transforms, embeddings | contradictions, unknown priors |
| Decide | accountable owners | candidate options | deadlines, horizons | execution surface | objectives, success criteria | plans, playbooks, resource maps | unresolved risks, missing options |
| Act | executors/peers | chosen action/tool | schedule, latency | target system/path | rationale communicated | protocols, APIs, safeguards | failed effects, surprises, retries |

## Biomimetic Mapping
- Gossip ↔ Mycelial/rumor spread: resilient, redundant propagation of experiences.
- DAG ↔ Causal chains: lineage of actions akin to ancestry; preserves provenance.
- Threshold/Convergence ↔ Group consensus: median-based agreement mirrors crowds finding robust norms.
- Episodic/Semantic Memory ↔ Human memory: time-bound episodes feeding abstract concepts and skills.
- Morphing ↔ Metamorphosis: retain identity while adapting body (implementation) to environment.

## Population and Learning Loop
- Fill OODA cells from instance stats, recent episodes, semantic graph queries, tool outputs, and peer syncs.
- After Act, record new episodes, update skills/knowledge, and feed back into Observe/Orient.
- Maintain fingerprints and evolution DAG entries for every loop to keep trail auditable.

## Emoji Command Mode
- Purpose: issue agent directives using emoji-only tokens mapped to canonical actions.
- Default set: Noto emojis; user-selectable sets: Fluent, OpenMoji, or custom.
- Canonical actions: observe, orient, decide, act, sync, hash, sign, verify, merkle, random, skill-up, knowledge-add, gossip, stop.
- Sample mapping (Noto default): observe=👁️, orient=🧭, decide=🧠, act=⚡, sync=🔄, hash=#️⃣, sign=✍️, verify=✅, merkle=🌳, random=🎲, skill-up=📈, knowledge-add=📚, gossip=📢, stop=🛑.
- Usage: select emoji set → translate incoming emoji tokens to canonical actions → dispatch to matching tool/adapter; fall back to text commands.
