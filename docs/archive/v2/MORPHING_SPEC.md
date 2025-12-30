# Unified Agent Morphing Specification v2.0

**Version**: 2.0.0  
**Date**: December 28, 2025  
**Status**: Implementation Specification

---

## Executive Summary

This specification defines a comprehensive system for **lossless bidirectional agent morphing** across the three converging agent implementation paradigms, with **continuous experience synchronization** and **skill accumulation** back to the source agent.

### The Three Agent Implementation Types

Based on industry convergence analysis (see AgentSpecResearch.md), the computing world is converging on **three complementary agent implementation paradigms**:

1. **MCP-Based Agents** (Tool-Integrated)
   - **Example**: Cline, Roo Code, Cursor
   - **Characteristics**: Single agent, system prompts, IDE-integrated, conversational
   - **Protocol**: MCP (Model Context Protocol) for tool access

2. **Multi-Agent Systems** (Collaborative)
   - **Example**: CrewAI, AutoGPT, LangChain
   - **Characteristics**: Multiple specialized agents, explicit definitions, autonomous, role-based
   - **Protocol**: A2A (Agent2Agent) for peer collaboration

3. **Orchestrated Agents** (Managed)
   - **Example**: Agent Protocol compliant systems
   - **Characteristics**: REST API, task-based, framework-agnostic, monitoring/orchestration
   - **Protocol**: Agent Protocol for universal communication

### Core Innovation: Experience-Syncing Universal Agent

This specification extends the basic agent morphing concept with:

```
┌─────────────────────────────────────────────────────────────┐
│                  UNIVERSAL AGENT                            │
│            (Canonical Reference Entity)                     │
│                                                             │
│  Core Identity + Accumulated Experience + Skills           │
└─────────────────────────────────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
   ┌────────────┐  ┌────────────┐  ┌────────────┐
   │ MCP-Based  │  │Multi-Agent │  │Orchestrated│
   │  Instance  │  │  Instance  │  │  Instance  │
   └────────────┘  └────────────┘  └────────────┘
          │              │              │
          └──────────────┼──────────────┘
                         ▼
         ┌───────────────────────────────────┐
         │  Experience Sync (Streaming/      │
         │  Lumped/Check-in)                 │
         │                                    │
         │  → Memories accumulated            │
         │  → Skills learned                  │
         │  → Characteristics refined         │
         │  → Knowledge expanded              │
         └───────────────────────────────────┘
```

---

## Table of Contents

1. [Core Architecture](#core-architecture)
2. [Universal Agent Schema v2](#universal-agent-schema-v2)
3. [Instance Management](#instance-management)
4. [Experience Synchronization](#experience-synchronization)
5. [Memory Merge Protocols](#memory-merge-protocols)
6. [Skill Accumulation](#skill-accumulation)
7. [Three-Protocol Stack Integration](#three-protocol-stack-integration)
8. [Morphing with Experience Preservation](#morphing-with-experience-preservation)
9. [Implementation Architecture](#implementation-architecture)
10. [Protocol Buffers Definitions](#protocol-buffers-definitions)
11. [API Specifications](#api-specifications)
12. [Security & Privacy](#security--privacy)

---

## 1. Core Architecture

### 1.1 Layered Design

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 5: Universal Agent (Canonical Entity)                │
│  • Core identity (immutable)                                │
│  • Accumulated experience (growable)                        │
│  • Learned skills (expandable)                              │
│  • Refined characteristics (evolvable)                      │
└─────────────────────────────────────────────────────────────┘
                         ↕ Morphing + Sync
┌─────────────────────────────────────────────────────────────┐
│  LAYER 4: Instance Management                               │
│  • Track deployed instances                                 │
│  • Monitor instance state                                   │
│  • Coordinate sync operations                               │
│  • Manage lifecycle                                         │
└─────────────────────────────────────────────────────────────┘
                         ↕ Experience Flow
┌─────────────────────────────────────────────────────────────┐
│  LAYER 3: Experience Synchronization                        │
│  • Streaming sync (real-time)                               │
│  • Lumped sync (batched)                                    │
│  • Check-in sync (periodic)                                 │
│  • Merge conflict resolution                                │
└─────────────────────────────────────────────────────────────┘
                         ↕ Framework Adaptation
┌─────────────────────────────────────────────────────────────┐
│  LAYER 2: Framework Adapters                                │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐    │
│  │  MCP Adapter  │ │  A2A Adapter  │ │Agent Protocol │    │
│  │  (Cline-style)│ │ (CrewAI-style)│ │   Adapter     │    │
│  └───────────────┘ └───────────────┘ └───────────────┘    │
└─────────────────────────────────────────────────────────────┘
                         ↕ Execution
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1: Protocol Stack                                    │
│  • MCP: Agent ↔ Tools                                       │
│  • A2A: Agent ↔ Agent                                       │
│  • Agent Protocol: User/System ↔ Agent                      │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    MORPHING FLOW                            │
└─────────────────────────────────────────────────────────────┘

Universal Agent (Source)
    ↓
Extract Core Identity + Current State
    ↓
Select Target Implementation Type
    ↓
Apply Framework Adapter
    ↓
Encrypt Non-Mappable Data (Shadow Field)
    ↓
Deploy Instance in Target Environment
    ↓
Instance Executes & Learns
    ↓
Experience Sync (Streaming/Lumped/Check-in)
    ↓
Extract: Memories, Skills, Characteristics
    ↓
Merge into Universal Agent (Source)
    ↓
Universal Agent Now Enhanced!
```

---

## 2. Universal Agent Schema v2

### 2.1 Enhanced Schema

```yaml
# Universal Agent v2.0 Schema
apiVersion: uas/v2
kind: UniversalAgent

# Core identity (immutable fingerprint)
identity:
  id: uuid                    # Unique agent ID
  name: string                # Display name
  designation: string         # Primary role
  bio: string | string[]      # Background
  fingerprint: string         # Cryptographic identity hash
  created: timestamp          # Creation time
  version: semantic_version   # Current version

# Personality (evolves over time)
personality:
  core_traits: string[]                # Base traits
  values: string[]                     # Core values
  quirks: string[]                     # Unique behaviors
  emotional_ranges:                    # Emotional modeling
    range_name:
      triggers: string[]
      expressions: string[]
      voice_modulation:
        speed: float
        pitch: float

# Capabilities (expandable)
capabilities:
  primary: string[]           # Core skills
  secondary: string[]         # Supporting skills
  domains: string[]           # Knowledge domains
  tools: ToolDefinition[]     # Available tools
  learned_skills:             # NEW: Accumulated during execution
    - skill_id: string
      name: string
      proficiency: 0.0-1.0
      acquired: timestamp
      source_instance: uuid
      usage_count: int

# Knowledge (growing)
knowledge:
  facts: string[]
  topics: string[]
  expertise: string[]
  sources: KnowledgeSource[]
  lore: string[]
  accumulated_knowledge:      # NEW: Gained from instances
    - knowledge_id: uuid
      content: string
      confidence: 0.0-1.0
      source_instance: uuid
      acquired: timestamp
      verification_count: int

# Memory system (persistent + accumulating)
memory:
  type: 'vector' | 'graph' | 'hybrid'
  provider: string
  settings: object
  collections:                # NEW: Memory collections
    short_term:
      retention: duration
      max_size: int
    long_term:
      storage: 'vector' | 'graph'
      embedding_model: string
    episodic:                 # NEW: Specific episodes/experiences
      episodes: Episode[]
    semantic:                 # NEW: Semantic knowledge
      concepts: Concept[]

# Beliefs (refined over time)
beliefs:
  who: Belief[]
  what: Belief[]
  why: Belief[]
  how: Belief[]
  where: Belief[]
  when: Belief[]
  huh: Belief[]              # Uncertainties

# Training & examples
training:
  conversations: Conversation[]
  demonstrations: Demonstration[]
  feedback: Feedback[]
  accumulated_examples:       # NEW: From instance execution
    - example_id: uuid
      input: string
      output: string
      context: object
      source_instance: uuid
      timestamp: timestamp
      effectiveness_rating: 0.0-1.0

# Instance management (NEW Section)
instances:
  active:                     # Currently deployed instances
    - instance_id: uuid
      type: 'mcp' | 'multi_agent' | 'orchestrated'
      framework: string       # e.g., 'cline', 'crewai', 'agent_protocol'
      deployment_context: string
      created: timestamp
      last_sync: timestamp
      status: 'running' | 'idle' | 'syncing' | 'terminated'
      sync_protocol: 'streaming' | 'lumped' | 'check_in'
      endpoint: url
      health: object
  
  terminated:                 # Historical instances
    - instance_id: uuid
      type: string
      framework: string
      created: timestamp
      terminated: timestamp
      total_syncs: int
      experience_contributed: object

# Experience sync configuration (NEW Section)
experience_sync:
  enabled: boolean
  default_protocol: 'streaming' | 'lumped' | 'check_in'
  
  streaming:                  # Real-time sync
    enabled: boolean
    interval_ms: int          # How often to stream
    batch_size: int           # Events per batch
    priority_threshold: float # Only sync high-priority events
  
  lumped:                     # Batched sync
    enabled: boolean
    batch_interval: duration  # e.g., "1h", "24h"
    max_batch_size: int
    compression: boolean
  
  check_in:                   # Periodic sync
    enabled: boolean
    schedule: cron_expression # e.g., "0 * * * *" (hourly)
    include_full_state: boolean
  
  merge_strategy:             # How to merge experiences
    conflict_resolution: 'latest_wins' | 'weighted_merge' | 'manual_review'
    memory_deduplication: boolean
    skill_aggregation: 'max' | 'average' | 'weighted'
    knowledge_verification_threshold: float

# Protocols (three-stack integration)
protocols:
  mcp:                        # Tool integration
    enabled: boolean
    role: 'client' | 'server' | 'both'
    servers: MCPServer[]
    tools: MCPTool[]
  
  a2a:                        # Agent collaboration
    enabled: boolean
    role: 'client' | 'server' | 'both'
    endpoint: url
    agent_card: AgentCard
    authentication: AuthConfig
    peers: AgentReference[]   # Known peer agents
  
  agent_protocol:             # Orchestration
    enabled: boolean
    endpoint: url
    capabilities: string[]
    task_types: string[]

# Execution configuration
execution:
  llm:
    provider: string
    model: string
    temperature: float
    max_tokens: int
    parameters: object
  
  runtime:
    timeout: int
    max_iterations: int
    retry_policy: RetryPolicy
    error_handling: string

# Deployment info
deployment:
  preferred_contexts: string[]  # e.g., ['ide', 'api', 'multi_agent']
  scaling: ScalingConfig
  environment: object

# Metadata
metadata:
  version: string
  schema_version: "2.0.0"
  created: timestamp
  updated: timestamp
  author: string
  tags: string[]
  source_framework: string    # Original framework (if migrated)
  
  # NEW: Evolution tracking
  evolution:
    total_deployments: int
    total_syncs: int
    total_skills_learned: int
    total_knowledge_acquired: int
    total_conversations: int
    last_evolution: timestamp
    evolution_rate: float     # Skills/knowledge gained per day
```

### 2.2 Supporting Types

```yaml
# Episode: Specific experience instance
Episode:
  episode_id: uuid
  timestamp: timestamp
  source_instance: uuid
  duration: duration
  context: object
  interactions: Interaction[]
  outcome: string
  lessons_learned: string[]
  skills_practiced: string[]
  effectiveness_rating: 0.0-1.0

# Concept: Semantic knowledge unit
Concept:
  concept_id: uuid
  name: string
  definition: string
  related_concepts: uuid[]
  confidence: 0.0-1.0
  sources: string[]
  usage_count: int
  last_used: timestamp

# Belief with evolution tracking
Belief:
  content: string
  conviction: 0.0-1.0
  privacy: 'PUBLIC' | 'PRIVATE'
  source: string
  tags: string[]
  revision_history:           # NEW: Track belief changes
    - timestamp: timestamp
      previous_conviction: float
      reason: string
      source_instance: uuid

# Tool definition with usage stats
ToolDefinition:
  name: string
  protocol: 'mcp' | 'native' | 'api'
  config: object
  usage_stats:                # NEW: Track tool effectiveness
    total_invocations: int
    success_rate: float
    average_latency_ms: float
    last_used: timestamp
    preferred_contexts: string[]

# Sync event
SyncEvent:
  event_id: uuid
  timestamp: timestamp
  source_instance: uuid
  event_type: 'memory' | 'skill' | 'knowledge' | 'characteristic'
  priority: 'low' | 'medium' | 'high' | 'critical'
  data: object
  applied: boolean
  applied_at: timestamp
```

---

## 3. Instance Management

### 3.1 Instance Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                  INSTANCE LIFECYCLE                         │
└─────────────────────────────────────────────────────────────┘

1. CREATE
   Universal Agent + Target Framework
        ↓
   Morph to target implementation type
        ↓
   Deploy instance with sync config

2. REGISTER
   Instance registers with source agent
        ↓
   Establishes sync channel
        ↓
   Begins experience tracking

3. EXECUTE
   Instance performs tasks
        ↓
   Accumulates experiences
        ↓
   Syncs based on protocol (streaming/lumped/check-in)

4. SYNC
   Extract experiences
        ↓
   Package sync payload
        ↓
   Send to source agent
        ↓
   Merge into universal agent

5. TERMINATE
   Instance signals shutdown
        ↓
   Final sync (complete state)
        ↓
   Archive instance metadata
        ↓
   Update source agent statistics
```

### 3.2 Instance Tracking

```typescript
interface InstanceTracker {
  // Instance registry
  instances: Map<UUID, InstanceMetadata>;
  
  // Create new instance
  createInstance(
    sourceAgent: UniversalAgent,
    targetType: 'mcp' | 'multi_agent' | 'orchestrated',
    framework: string,
    syncProtocol: SyncProtocol
  ): Promise<InstanceDeployment>;
  
  // Register instance after deployment
  registerInstance(
    instanceId: UUID,
    endpoint: URL,
    capabilities: Capabilities
  ): Promise<void>;
  
  // Track instance health
  monitorInstance(instanceId: UUID): InstanceHealth;
  
  // Terminate instance
  terminateInstance(
    instanceId: UUID,
    reason: string,
    performFinalSync: boolean
  ): Promise<TerminationReport>;
  
  // Query instances
  getActiveInstances(): InstanceMetadata[];
  getInstancesByType(type: string): InstanceMetadata[];
  getInstancesSyncingNow(): InstanceMetadata[];
}

interface InstanceMetadata {
  instance_id: UUID;
  type: 'mcp' | 'multi_agent' | 'orchestrated';
  framework: string;
  deployment_context: string;
  created: Timestamp;
  last_sync: Timestamp;
  status: 'running' | 'idle' | 'syncing' | 'terminated';
  sync_protocol: SyncProtocol;
  endpoint: URL;
  health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    last_heartbeat: Timestamp;
    error_rate: number;
    sync_lag: Duration;
  };
  statistics: {
    total_syncs: number;
    memories_contributed: number;
    skills_learned: number;
    knowledge_acquired: number;
    conversations_handled: number;
  };
}
```

---

## 4. Experience Synchronization

### 4.1 Three Sync Protocols

#### Protocol 1: Streaming Sync (Real-Time)

```yaml
streaming_sync:
  description: "Continuous real-time experience streaming"
  use_case: "Critical applications, real-time learning"
  latency: "< 1 second"
  overhead: "High"
  
  configuration:
    interval_ms: 500          # Stream every 500ms
    batch_size: 10            # Max events per batch
    priority_threshold: 0.7   # Only sync high-priority events
    compression: true
    retry_attempts: 3
  
  event_types:
    - 'critical_error'        # Priority: 1.0
    - 'skill_acquired'        # Priority: 0.9
    - 'important_interaction' # Priority: 0.8
    - 'knowledge_update'      # Priority: 0.7
    - 'memory_formation'      # Priority: 0.6
  
  flow:
    - Instance performs action
    - Action generates experience event
    - Event evaluated against priority threshold
    - If priority >= threshold: queue for sync
    - Batch accumulated events
    - Stream batch to source agent
    - Source agent acknowledges receipt
    - Instance marks events as synced
```

#### Protocol 2: Lumped Sync (Batched)

```yaml
lumped_sync:
  description: "Periodic batch synchronization"
  use_case: "Normal operations, cost-effective"
  latency: "Minutes to hours"
  overhead: "Medium"
  
  configuration:
    batch_interval: "1h"      # Sync every hour
    max_batch_size: 1000      # Max events per batch
    compression: true
    deduplication: true
  
  batch_structure:
    batch_id: uuid
    instance_id: uuid
    timestamp_start: timestamp
    timestamp_end: timestamp
    event_count: int
    events:
      memories: Memory[]
      skills: Skill[]
      knowledge: Knowledge[]
      interactions: Interaction[]
      stats: Statistics
  
  flow:
    - Instance accumulates experiences locally
    - On schedule (e.g., every hour):
      - Package all accumulated experiences
      - Compress and deduplicate
      - Send batch to source agent
      - Wait for acknowledgment
      - Clear local accumulation buffer
```

#### Protocol 3: Check-In Sync (Periodic)

```yaml
check_in_sync:
  description: "Scheduled periodic synchronization"
  use_case: "Long-running autonomous agents, async operations"
  latency: "Hours to days"
  overhead: "Low"
  
  configuration:
    schedule: "0 */6 * * *"   # Every 6 hours (cron)
    include_full_state: true
    differential_sync: false  # Send complete state
  
  check_in_payload:
    instance_id: uuid
    check_in_time: timestamp
    uptime: duration
    full_state:
      current_status: string
      accumulated_memories: Memory[]
      learned_skills: Skill[]
      acquired_knowledge: Knowledge[]
      completed_tasks: Task[]
      error_log: Error[]
      performance_metrics: Metrics
  
  flow:
    - Instance runs autonomously
    - On schedule (e.g., every 6 hours):
      - Capture complete state snapshot
      - Package all accumulated experiences
      - Send check-in to source agent
      - Await merge instructions
      - Apply any updates from source
      - Resume autonomous operation
```

### 4.2 Sync Manager

```typescript
interface ExperienceSyncManager {
  // Initialize sync for instance
  initializeSync(
    instanceId: UUID,
    protocol: SyncProtocol,
    config: SyncConfig
  ): Promise<SyncChannel>;
  
  // Stream sync
  streamEvent(
    instanceId: UUID,
    event: ExperienceEvent
  ): Promise<void>;
  
  // Lumped sync
  sendBatch(
    instanceId: UUID,
    batch: ExperienceBatch
  ): Promise<BatchAcknowledgment>;
  
  // Check-in sync
  checkIn(
    instanceId: UUID,
    state: InstanceState
  ): Promise<CheckInResponse>;
  
  // Receive sync from instance
  receiveSyncEvent(
    instanceId: UUID,
    payload: SyncPayload
  ): Promise<MergeResult>;
  
  // Query sync status
  getSyncStatus(instanceId: UUID): SyncStatus;
  getSyncBacklog(instanceId: UUID): number;
  getSyncStatistics(instanceId: UUID): SyncStatistics;
}

interface ExperienceEvent {
  event_id: UUID;
  timestamp: Timestamp;
  source_instance: UUID;
  event_type: 'memory' | 'skill' | 'knowledge' | 'characteristic' | 'interaction';
  priority: number;          // 0.0 - 1.0
  data: {
    // Type-specific data
    [key: string]: any;
  };
  context: {
    task_id?: UUID;
    conversation_id?: UUID;
    trigger: string;
    environment: object;
  };
}
```

---

## 5. Memory Merge Protocols

### 5.1 Memory Merge Strategies

```yaml
memory_merge:
  strategies:
    
    # Strategy 1: Append (Safest)
    append:
      description: "Add new memories without modification"
      use_case: "Default for most scenarios"
      conflict_handling: "None - all memories preserved"
      implementation:
        - Validate incoming memory
        - Assign unique ID
        - Add to memory collection
        - Update indexes
    
    # Strategy 2: Weighted Merge
    weighted_merge:
      description: "Merge similar memories with weighted averaging"
      use_case: "Consolidating related experiences"
      conflict_handling: "Weighted by confidence/recency"
      implementation:
        - Detect similar memories (embedding similarity)
        - Calculate weighted average of attributes
        - Merge into single memory with combined confidence
        - Link to source memories
    
    # Strategy 3: Latest Wins
    latest_wins:
      description: "Newer information replaces older"
      use_case: "Rapidly changing information"
      conflict_handling: "Timestamp-based precedence"
      implementation:
        - Compare timestamps
        - Replace older memory with newer
        - Archive older version
    
    # Strategy 4: Manual Review
    manual_review:
      description: "Queue conflicts for human review"
      use_case: "Critical memories, high-stakes decisions"
      conflict_handling: "Human-in-the-loop"
      implementation:
        - Detect conflicting memories
        - Queue for review interface
        - Await human decision
        - Apply approved merge
```

### 5.2 Memory Deduplication

```typescript
interface MemoryDeduplicator {
  // Detect duplicate memories
  findDuplicates(
    memories: Memory[],
    similarityThreshold: number
  ): DuplicateGroup[];
  
  // Merge duplicate memories
  mergeDuplicates(
    group: DuplicateGroup,
    strategy: 'keep_all' | 'keep_best' | 'merge'
  ): Memory;
  
  // Calculate memory similarity
  calculateSimilarity(
    memory1: Memory,
    memory2: Memory
  ): number;  // 0.0 - 1.0
}

interface Memory {
  memory_id: UUID;
  content: string;
  embedding: Vector;
  confidence: number;
  source_instance: UUID;
  created: Timestamp;
  accessed_count: number;
  last_accessed: Timestamp;
  tags: string[];
  related_memories: UUID[];
  importance: number;        // 0.0 - 1.0
}
```

---

## 6. Skill Accumulation

### 6.1 Skill Learning & Tracking

```yaml
skill_accumulation:
  description: "Track and aggregate skills learned across instances"
  
  skill_structure:
    skill_id: uuid
    name: string
    category: string          # e.g., "research", "coding", "analysis"
    proficiency: 0.0-1.0      # Skill level
    acquired: timestamp
    source_instance: uuid
    
    usage_stats:
      invocation_count: int
      success_rate: float
      average_effectiveness: float
      contexts_used: string[]
      
    learning_curve:
      - timestamp: timestamp
        proficiency: float
        event: string         # What caused proficiency change
    
    prerequisites: skill_id[]
    enables: skill_id[]       # Skills this unlocks
    
  aggregation_rules:
    
    # Rule 1: Max proficiency across instances
    max_proficiency:
      description: "Use highest proficiency from any instance"
      formula: "proficiency = max(instance_proficiencies)"
    
    # Rule 2: Weighted average by usage
    weighted_average:
      description: "Weight by usage frequency"
      formula: "proficiency = sum(prof * usage) / sum(usage)"
    
    # Rule 3: Time-decay weighted
    time_decay:
      description: "Recent practice weighted higher"
      formula: "proficiency = sum(prof * usage * decay(time))"
      decay_factor: 0.95      # 5% decay per time unit
```

### 6.2 Skill Synergies

```typescript
interface SkillAccumulator {
  // Add learned skill from instance
  addSkill(
    skill: Skill,
    sourceInstance: UUID
  ): Promise<void>;
  
  // Update skill proficiency
  updateProficiency(
    skillId: UUID,
    newProficiency: number,
    evidence: Evidence
  ): Promise<void>;
  
  // Detect skill synergies
  detectSynergies(
    skills: Skill[]
  ): SkillSynergy[];
  
  // Recommend skill development
  recommendNextSkills(
    currentSkills: Skill[]
  ): SkillRecommendation[];
  
  // Calculate overall capability score
  calculateCapabilityScore(): number;
}

interface Skill {
  skill_id: UUID;
  name: string;
  category: string;
  proficiency: number;
  acquired: Timestamp;
  source_instances: UUID[];
  
  // Learning trajectory
  learning_curve: {
    timestamp: Timestamp;
    proficiency: number;
    event: string;
  }[];
  
  // Usage statistics
  usage: {
    total_invocations: number;
    success_rate: number;
    contexts: Set<string>;
    last_used: Timestamp;
  };
  
  // Relationships
  prerequisites: UUID[];
  enables: UUID[];
  synergies: {
    skill_id: UUID;
    synergy_strength: number;  // 0.0 - 1.0
  }[];
}

interface SkillSynergy {
  skills: UUID[];
  synergy_type: 'complementary' | 'reinforcing' | 'multiplicative';
  strength: number;
  evidence: string[];
  suggested_applications: string[];
}
```

---

## 7. Three-Protocol Stack Integration

### 7.1 MCP Implementation Type (Cline-Style)

```yaml
mcp_implementation:
  type: "mcp"
  description: "Single agent with tool integration"
  frameworks:
    - Cline
    - Roo Code
    - Cursor
  
  characteristics:
    agent_count: 1
    interaction_model: "conversational"
    deployment: "IDE-integrated"
    state_management: "conversation_history"
  
  morphing_strategy:
    from_universal:
      - Extract system prompt from identity + personality
      - Map tools to MCP server configurations
      - Configure LLM settings
      - Deploy to IDE environment
    
    to_universal:
      - Extract conversations → training.conversations
      - Extract tool usage → capabilities.learned_skills
      - Extract context → knowledge.accumulated_knowledge
  
  experience_sync:
    preferred_protocol: "streaming"
    sync_events:
      - "conversation_turn"
      - "tool_invocation"
      - "code_generation"
      - "problem_solved"
    
    extraction:
      memories:
        - Conversation context
        - Problem-solution pairs
        - Code patterns
      
      skills:
        - Tool usage proficiency
        - Problem-solving strategies
        - Code generation patterns
      
      knowledge:
        - Project-specific information
        - API usage patterns
        - Error resolution strategies
```

### 7.2 Multi-Agent Implementation Type (CrewAI-Style)

```yaml
multi_agent_implementation:
  type: "multi_agent"
  description: "Multiple specialized collaborative agents"
  frameworks:
    - CrewAI
    - AutoGPT
    - LangChain
  
  characteristics:
    agent_count: "multiple"
    interaction_model: "autonomous + collaboration"
    deployment: "API/CLI/background"
    state_management: "task_based + memory"
  
  morphing_strategy:
    from_universal:
      - Create specialized agent for each capability
      - Configure role, goal, backstory from identity
      - Map tools to agent-specific tools
      - Setup crew orchestration
    
    to_universal:
      - Aggregate experiences from all crew members
      - Merge skills from specialized agents
      - Consolidate knowledge discoveries
      - Combine task completion patterns
  
  experience_sync:
    preferred_protocol: "lumped"
    sync_events:
      - "task_completed"
      - "collaboration_successful"
      - "delegation_handled"
      - "goal_achieved"
    
    extraction:
      memories:
        - Task execution traces
        - Inter-agent communications
        - Decision rationales
      
      skills:
        - Task decomposition patterns
        - Collaboration strategies
        - Delegation effectiveness
      
      knowledge:
        - Domain-specific insights
        - Best practices discovered
        - Failure patterns to avoid
```

### 7.3 Orchestrated Implementation Type (Agent Protocol)

```yaml
orchestrated_implementation:
  type: "orchestrated"
  description: "Framework-agnostic REST API agent"
  frameworks:
    - Agent Protocol compliant
    - Custom orchestrators
  
  characteristics:
    agent_count: "flexible"
    interaction_model: "task_based"
    deployment: "API service"
    state_management: "task + artifact"
  
  morphing_strategy:
    from_universal:
      - Expose Agent Protocol REST API
      - Map capabilities to task handlers
      - Configure artifact management
      - Setup monitoring endpoints
    
    to_universal:
      - Extract task execution history
      - Analyze artifact generation patterns
      - Aggregate step-by-step learnings
  
  experience_sync:
    preferred_protocol: "check_in"
    sync_events:
      - "task_step_completed"
      - "artifact_generated"
      - "task_finished"
      - "error_recovered"
    
    extraction:
      memories:
        - Task execution traces
        - Step-by-step decisions
        - Artifact creation context
      
      skills:
        - Task planning strategies
        - Error recovery techniques
        - Artifact optimization
      
      knowledge:
        - Task patterns
        - Optimization opportunities
        - Resource efficiency gains
```

---

## 8. Morphing with Experience Preservation

### 8.1 Complete Morphing Flow

```typescript
interface EnhancedMorphingSystem {
  // Create instance with sync
  morph(
    sourceAgent: UniversalAgent,
    targetType: 'mcp' | 'multi_agent' | 'orchestrated',
    framework: string,
    syncConfig: SyncConfig
  ): Promise<MorphResult>;
  
  // Restore with experience integration
  restore(
    instanceId: UUID,
    mergeExperience: boolean
  ): Promise<UniversalAgent>;
  
  // Sync experience during runtime
  syncExperience(
    instanceId: UUID,
    syncProtocol: SyncProtocol
  ): Promise<SyncResult>;
  
  // Merge multiple instance experiences
  mergeExperiences(
    sourceAgent: UniversalAgent,
    instances: UUID[]
  ): Promise<MergeResult>;
}

interface MorphResult {
  instance_id: UUID;
  deployed_agent: any;           // Framework-specific
  framework: string;
  type: 'mcp' | 'multi_agent' | 'orchestrated';
  sync_channel: SyncChannel;
  restoration_key: string;
  shadow_data: EncryptedShadow;
  
  // NEW: Sync configuration
  sync_config: {
    protocol: SyncProtocol;
    endpoint: URL;
    credentials: Credentials;
  };
}

interface SyncResult {
  instance_id: UUID;
  sync_timestamp: Timestamp;
  events_synced: number;
  
  // What was synced
  memories_added: number;
  skills_updated: number;
  knowledge_acquired: number;
  characteristics_refined: number;
  
  // Merge status
  conflicts_detected: number;
  conflicts_resolved: number;
  conflicts_queued: number;
  
  // Next sync
  next_sync: Timestamp;
  backlog_size: number;
}
```

### 8.2 Experience Extraction

```typescript
interface ExperienceExtractor {
  // Extract from MCP-based instance
  extractFromMCP(
    instance: MCPInstance,
    since: Timestamp
  ): Experience;
  
  // Extract from multi-agent instance
  extractFromMultiAgent(
    instance: MultiAgentInstance,
    since: Timestamp
  ): Experience;
  
  // Extract from orchestrated instance
  extractFromOrchestrated(
    instance: OrchestratedInstance,
    since: Timestamp
  ): Experience;
}

interface Experience {
  instance_id: UUID;
  extraction_time: Timestamp;
  time_range: {
    start: Timestamp;
    end: Timestamp;
  };
  
  memories: Memory[];
  skills: {
    new_skills: Skill[];
    improved_skills: {
      skill_id: UUID;
      proficiency_delta: number;
      evidence: string[];
    }[];
  };
  
  knowledge: {
    facts: string[];
    concepts: Concept[];
    insights: string[];
    verification_level: number;
  };
  
  characteristics: {
    trait_changes: {
      trait: string;
      old_value: number;
      new_value: number;
      reason: string;
    }[];
  };
  
  performance_metrics: {
    tasks_completed: number;
    success_rate: number;
    average_response_time: Duration;
    error_rate: number;
  };
}
```

---

## 9. Implementation Architecture

### 9.1 Module Structure

```
unified-agent-system/
│
├── core/
│   ├── UniversalAgent.ts           # v2 schema
│   ├── FrameworkAdapter.ts         # Base adapter
│   ├── AdapterRegistry.ts          # Adapter management
│   └── Encryption.ts               # Shadow encryption
│
├── adapters/
│   ├── MCPAdapter.ts               # Cline-style
│   ├── MultiAgentAdapter.ts        # CrewAI-style
│   ├── OrchestratedAdapter.ts      # Agent Protocol
│   └── BaseAdapter.ts              # Shared logic
│
├── instance/
│   ├── InstanceManager.ts          # Instance lifecycle
│   ├── InstanceTracker.ts          # State tracking
│   └── InstanceHealth.ts           # Health monitoring
│
├── sync/
│   ├── ExperienceSyncManager.ts    # Sync coordination
│   ├── StreamingSync.ts            # Real-time sync
│   ├── LumpedSync.ts               # Batch sync
│   ├── CheckInSync.ts              # Periodic sync
│   └── SyncProtocol.ts             # Protocol interface
│
├── experience/
│   ├── ExperienceExtractor.ts      # Extract from instances
│   ├── MemoryMerger.ts             # Memory merge logic
│   ├── SkillAccumulator.ts         # Skill aggregation
│   ├── KnowledgeIntegrator.ts      # Knowledge consolidation
│   └── CharacteristicEvolver.ts    # Personality evolution
│
├── protocols/
│   ├── MCPProtocol.ts              # MCP integration
│   ├── A2AProtocol.ts              # A2A integration
│   └── AgentProtocol.ts            # Agent Protocol integration
│
├── converter/
│   ├── Converter.ts                # Main morphing logic
│   └── ExperiencePreservingConverter.ts  # With sync
│
└── cli/
    └── agent-morph-v2.ts           # Enhanced CLI
```

### 9.2 Data Storage

```yaml
storage_architecture:
  
  # Core agent storage
  agent_store:
    type: "database"  # PostgreSQL, MongoDB, etc.
    schema: "uas_v2"
    tables:
      - universal_agents
      - instances
      - sync_events
      - memories
      - skills
      - knowledge
  
  # Vector storage for embeddings
  vector_store:
    type: "vector_database"  # Qdrant, Pinecone, etc.
    collections:
      - agent_memories
      - agent_knowledge
      - conversation_embeddings
  
  # Time-series for metrics
  timeseries_store:
    type: "timeseries"  # InfluxDB, TimescaleDB, etc.
    metrics:
      - sync_events
      - performance_metrics
      - skill_proficiency_over_time
  
  # Cache for active instances
  cache_store:
    type: "redis"
    purpose: "active_instance_state"
    ttl: "24h"
```

---

## 10. Protocol Buffers Definitions

```protobuf
syntax = "proto3";
package uas.v2;

// Universal Agent v2
message UniversalAgent {
  Identity identity = 1;
  Personality personality = 2;
  Capabilities capabilities = 3;
  Knowledge knowledge = 4;
  Memory memory = 5;
  repeated Belief beliefs = 6;
  Training training = 7;
  
  // NEW in v2
  InstanceManagement instances = 8;
  ExperienceSyncConfig experience_sync = 9;
  Protocols protocols = 10;
  
  Execution execution = 11;
  Deployment deployment = 12;
  Metadata metadata = 13;
}

// Instance Management
message InstanceManagement {
  repeated InstanceMetadata active = 1;
  repeated InstanceMetadata terminated = 2;
}

message InstanceMetadata {
  string instance_id = 1;
  string type = 2;  // "mcp", "multi_agent", "orchestrated"
  string framework = 3;
  string deployment_context = 4;
  int64 created = 5;
  int64 last_sync = 6;
  string status = 7;
  string sync_protocol = 8;
  string endpoint = 9;
  InstanceHealth health = 10;
  InstanceStatistics statistics = 11;
}

message InstanceHealth {
  string status = 1;  // "healthy", "degraded", "unhealthy"
  int64 last_heartbeat = 2;
  double error_rate = 3;
  int64 sync_lag_ms = 4;
}

message InstanceStatistics {
  int32 total_syncs = 1;
  int32 memories_contributed = 2;
  int32 skills_learned = 3;
  int32 knowledge_acquired = 4;
  int32 conversations_handled = 5;
}

// Experience Sync Configuration
message ExperienceSyncConfig {
  bool enabled = 1;
  string default_protocol = 2;
  
  StreamingSyncConfig streaming = 3;
  LumpedSyncConfig lumped = 4;
  CheckInSyncConfig check_in = 5;
  
  MergeStrategy merge_strategy = 6;
}

message StreamingSyncConfig {
  bool enabled = 1;
  int32 interval_ms = 2;
  int32 batch_size = 3;
  double priority_threshold = 4;
}

message LumpedSyncConfig {
  bool enabled = 1;
  string batch_interval = 2;
  int32 max_batch_size = 3;
  bool compression = 4;
}

message CheckInSyncConfig {
  bool enabled = 1;
  string schedule = 2;
  bool include_full_state = 3;
}

message MergeStrategy {
  string conflict_resolution = 1;
  bool memory_deduplication = 2;
  string skill_aggregation = 3;
  double knowledge_verification_threshold = 4;
}

// Experience Event
message ExperienceEvent {
  string event_id = 1;
  int64 timestamp = 2;
  string source_instance = 3;
  string event_type = 4;
  double priority = 5;
  bytes data = 6;  // Serialized data
  map<string, string> context = 7;
}

// Skill (enhanced)
message Skill {
  string skill_id = 1;
  string name = 2;
  string category = 3;
  double proficiency = 4;
  int64 acquired = 5;
  repeated string source_instances = 6;
  
  repeated SkillDataPoint learning_curve = 7;
  SkillUsage usage = 8;
  
  repeated string prerequisites = 9;
  repeated string enables = 10;
  repeated SkillSynergy synergies = 11;
}

message SkillDataPoint {
  int64 timestamp = 1;
  double proficiency = 2;
  string event = 3;
}

message SkillUsage {
  int32 total_invocations = 1;
  double success_rate = 2;
  repeated string contexts = 3;
  int64 last_used = 4;
}

message SkillSynergy {
  string skill_id = 1;
  double synergy_strength = 2;
}

// Memory (enhanced)
message Memory {
  string memory_id = 1;
  string content = 2;
  repeated double embedding = 3;
  double confidence = 4;
  string source_instance = 5;
  int64 created = 6;
  int32 accessed_count = 7;
  int64 last_accessed = 8;
  repeated string tags = 9;
  repeated string related_memories = 10;
  double importance = 11;
}

// Protocols
message Protocols {
  MCPProtocol mcp = 1;
  A2AProtocol a2a = 2;
  AgentProtocolConfig agent_protocol = 3;
}

message MCPProtocol {
  bool enabled = 1;
  string role = 2;
  repeated MCPServer servers = 3;
}

message A2AProtocol {
  bool enabled = 1;
  string role = 2;
  string endpoint = 3;
  AgentCard agent_card = 4;
  Authentication authentication = 5;
  repeated string peers = 6;
}

message AgentCard {
  string name = 1;
  string version = 2;
  string protocol_version = 3;
  repeated string capabilities = 4;
  repeated SkillInfo skills = 5;
  string endpoint = 6;
}
```

---

## 11. API Specifications

### 11.1 REST API Endpoints

```yaml
# Instance Management API
POST   /api/v2/instances/create
  body:
    source_agent_id: uuid
    target_type: 'mcp' | 'multi_agent' | 'orchestrated'
    framework: string
    sync_protocol: SyncProtocol
  returns:
    instance_id: uuid
    deployment: InstanceDeployment
    sync_channel: SyncChannel

GET    /api/v2/instances/{instance_id}
  returns:
    InstanceMetadata

GET    /api/v2/instances
  query:
    type: string (optional)
    status: string (optional)
    framework: string (optional)
  returns:
    instances: InstanceMetadata[]

DELETE /api/v2/instances/{instance_id}
  query:
    final_sync: boolean
  returns:
    TerminationReport

# Experience Sync API
POST   /api/v2/sync/stream
  body:
    instance_id: uuid
    events: ExperienceEvent[]
  returns:
    acknowledged: boolean
    processed: number

POST   /api/v2/sync/batch
  body:
    instance_id: uuid
    batch: ExperienceBatch
  returns:
    batch_id: uuid
    processed: boolean

POST   /api/v2/sync/check-in
  body:
    instance_id: uuid
    state: InstanceState
  returns:
    merge_result: MergeResult
    instructions: SyncInstructions

GET    /api/v2/sync/status/{instance_id}
  returns:
    SyncStatus

# Agent Evolution API
GET    /api/v2/agents/{agent_id}/evolution
  returns:
    total_deployments: int
    total_syncs: int
    skills_learned: Skill[]
    knowledge_acquired: Knowledge[]
    characteristic_changes: CharacteristicChange[]

GET    /api/v2/agents/{agent_id}/skills
  returns:
    skills: Skill[]

POST   /api/v2/agents/{agent_id}/merge-experiences
  body:
    instance_ids: uuid[]
    strategy: MergeStrategy
  returns:
    merge_result: MergeResult
```

### 11.2 WebSocket API (Streaming Sync)

```yaml
# WebSocket endpoint for real-time sync
ws://api/v2/sync/stream/{instance_id}

# Client → Server messages
message_types:
  
  # Register for streaming
  register:
    type: "register"
    instance_id: uuid
    capabilities: Capabilities
  
  # Stream experience event
  stream_event:
    type: "event"
    event: ExperienceEvent
  
  # Heartbeat
  heartbeat:
    type: "heartbeat"
    timestamp: timestamp

# Server → Client messages
message_types:
  
  # Acknowledge registration
  registered:
    type: "registered"
    session_id: uuid
    sync_config: SyncConfig
  
  # Acknowledge event
  ack:
    type: "ack"
    event_id: uuid
    processed: boolean
  
  # Sync instructions
  instructions:
    type: "instructions"
    actions: Action[]
  
  # Error
  error:
    type: "error"
    code: string
    message: string
```

---

## 12. Security & Privacy

### 12.1 Data Protection

```yaml
security_measures:
  
  # Encryption at rest
  data_at_rest:
    agent_data: "AES-256-GCM"
    memories: "AES-256-GCM"
    shadow_fields: "AES-256-GCM + RSA signatures"
    sync_events: "AES-256-GCM"
  
  # Encryption in transit
  data_in_transit:
    sync_protocol: "TLS 1.3"
    api_calls: "HTTPS with certificate pinning"
    websocket: "WSS (secure websocket)"
  
  # Authentication
  authentication:
    instance_registration: "OAuth2 + mTLS"
    api_access: "JWT tokens"
    sync_channel: "Shared secret + rotating tokens"
  
  # Authorization
  authorization:
    instance_permissions: "Scope-based (sync:read, sync:write)"
    api_permissions: "RBAC"
    
  # Privacy
  privacy:
    memory_classification: "Public, Private, Confidential"
    pii_detection: "Automatic masking"
    data_retention: "Configurable per sensitivity level"
    gdpr_compliance: "Right to forget, data export"
```

### 12.2 Instance Isolation

```yaml
instance_isolation:
  
  # Namespace isolation
  namespaces:
    purpose: "Isolate instances by tenant/org"
    implementation: "Kubernetes namespaces or equivalent"
  
  # Resource limits
  resource_limits:
    memory: "Configurable per instance"
    cpu: "Configurable per instance"
    sync_bandwidth: "Rate limited"
    storage: "Quota enforced"
  
  # Network policies
  network:
    instance_to_instance: "Denied by default"
    instance_to_source: "Sync channel only"
    instance_to_external: "Allowed (for tools)"
```

---

## Conclusion

This v2.0 specification provides a complete architecture for:

✅ **Lossless morphing** across three agent implementation types  
✅ **Experience synchronization** with streaming/lumped/check-in protocols  
✅ **Memory merging** with conflict resolution  
✅ **Skill accumulation** with learning tracking  
✅ **Knowledge growth** with verification  
✅ **Characteristic evolution** based on experience  
✅ **Three-protocol stack** (MCP + A2A + Agent Protocol) integration  
✅ **Instance management** with health monitoring  
✅ **Security & privacy** with encryption and isolation  

Agents are now truly **living, learning entities** that can:
- Exist in multiple implementation forms simultaneously
- Continuously learn and evolve from all their instances
- Maintain a canonical identity independent of framework
- Synchronize experiences back to enhance their core capabilities

---

**Next Steps:**
1. Implement core v2 types
2. Build instance manager
3. Create sync protocols
4. Implement experience extractors
5. Test with all three agent types
6. Deploy reference implementation
