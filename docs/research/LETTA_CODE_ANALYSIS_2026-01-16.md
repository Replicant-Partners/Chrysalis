# Letta Code Analysis for Chrysalis

**Date:** January 16, 2026
**Purpose:** Analyze Letta Code's memory-first architecture and its alignment with Chrysalis

---

## Executive Summary

**Letta Code** (from the creators of MemGPT) is a **memory-first coding agent** that is philosophically aligned with Chrysalis's core mission of persistent, evolving agents. This is the most directly relevant project we've analyzed - it solves the **session vs agent** problem that Chrysalis addresses at the distributed level.

**Key Insight:** Letta Code proves that memory-first agents are viable for production use. Chrysalis's unique value is taking this further with **distributed memory**, **Byzantine resistance**, and **protocol morphing**.

---

## Philosophy Comparison

| Aspect | Claude Code / Codex | Letta Code | Chrysalis |
|--------|---------------------|------------|-----------|
| **Sessions** | Independent | Persistent agent | Distributed instances |
| **Memory** | None (AGENTS.md only) | Persistent blocks | Episodic + Semantic + Distributed |
| **Learning** | None | `/remember`, `/skill` | ExperienceSyncManager |
| **Portability** | Fixed model | Cross-model | Cross-protocol + Cross-model |
| **Trust** | None | None | Byzantine 2/3 supermajority |

---

## Key Architecture Components

### 1. Memory Block System

Memory stored as labeled blocks in `.mdx` files:

```typescript
// Global blocks (shared across projects)
GLOBAL_BLOCK_LABELS = ["persona", "human"]

// Project blocks (local to directory)
PROJECT_BLOCK_LABELS = ["project", "skills", "loaded_skills"]

// Read-only blocks (agent cannot modify)
READ_ONLY_BLOCK_LABELS = ["skills", "loaded_skills"]

// Isolated per conversation
ISOLATED_BLOCK_LABELS = ["skills", "loaded_skills"]
```

**Alignment with Chrysalis:** Chrysalis has `episodic` and `semantic` memory collections. Letta's block model is simpler but could inform a "quick access" memory layer.

### 2. Subagent Manager

Spawns and coordinates subagents via headless CLI:

```typescript
interface SubagentResult {
  agentId: string;
  report: string;
  success: boolean;
  error?: string;
  totalTokens?: number;
}
```

**Features:**
- Spawns via `letta` CLI in headless mode
- Parallel execution support
- Tool call tracking per subagent
- Model inheritance from parent

**Alignment with Chrysalis:** Similar to OpenHands delegation but with persistent memory. Chrysalis could add subagent memory sharing.

### 3. Skill System

Commands for skill management:
- `/init` - Initialize memory system
- `/remember [instructions]` - Guide memory update
- `/skill [instructions]` - Learn skill from current trajectory
- `/clear` - Reset session but keep memory

**Alignment with Chrysalis:** `SkillAccumulator` handles skill aggregation. Letta's `/skill` command = skill learning from trajectory is unique.

### 4. Tool System

Rich tool set organized by capability:

```
src/tools/impl/
├── File: Read, Write, Edit, MultiEdit, ApplyPatch
├── Search: Glob, Grep, GrepFiles, LS
├── Shell: Bash, BashOutput, KillBash, Shell, ShellCommand
├── Planning: EnterPlanMode, ExitPlanMode, UpdatePlan, Task, TodoWrite
├── Skill: Skill.ts
├── LSP: ReadLSP
└── Model-specific: *Gemini, *Codex variants
```

**Notable:**
- **Plan Mode**: Explicit enter/exit for planning vs execution
- **Model-specific tools**: Adapts tool behavior per model
- **LSP integration**: Language Server Protocol for code intelligence

---

## Extractable Patterns for Chrysalis

### Pattern 1: Memory Blocks (MEDIUM VALUE)

**What:** Quick-access named memory blocks with isolation rules

**Implementation:**
```typescript
// New: src/memory/MemoryBlocks.ts
interface MemoryBlock {
  label: string;
  content: string;
  scope: 'global' | 'project' | 'conversation';
  readOnly: boolean;
  isolated: boolean;
}

class MemoryBlockManager {
  getBlock(label: string): MemoryBlock;
  updateBlock(label: string, content: string): void;
  isolateForConversation(conversationId: string): MemoryBlock[];
}
```

**Benefit:** Simpler memory access for common patterns (persona, project context).

### Pattern 2: Skill Learning from Trajectory (HIGH VALUE)

**What:** `/skill` command that extracts skills from current conversation

**Letta Approach:**
1. User says `/skill "learn how to deploy to k8s"`
2. Agent analyzes recent conversation trajectory
3. Extracts reusable skill definition
4. Saves to `.skills/` directory

**Implementation for Chrysalis:**
```typescript
// New: src/experience/SkillLearner.ts
class SkillLearner {
  learnFromTrajectory(
    messages: Message[],
    instruction?: string
  ): Promise<LearnedSkill>;

  private analyzeTrajectory(messages: Message[]): TrajectoryAnalysis;
  private extractSkillDefinition(analysis: TrajectoryAnalysis): SkillDefinition;
}
```

**Alignment:** Enhances `SkillAccumulator` with automatic skill extraction.

### Pattern 3: Planning Mode Toggle (MEDIUM VALUE)

**What:** Explicit `EnterPlanMode`/`ExitPlanMode` tools

**Benefit:** Clear separation between planning and execution phases.

**Implementation:**
```typescript
// Tools for mode switching
tools: [
  {
    name: "enter_plan_mode",
    description: "Enter planning mode to think through approach"
  },
  {
    name: "exit_plan_mode",
    description: "Exit planning mode and begin execution"
  },
  {
    name: "update_plan",
    description: "Modify the current plan"
  }
]
```

### Pattern 4: Subagent Memory Sharing (HIGH VALUE)

**Chrysalis Enhancement:** Go beyond Letta's subagent model:

```typescript
// Enhanced subagent with memory sharing
class ChrysalisSubagentManager {
  spawn(config: SubagentConfig): SubagentHandle;

  // Share memory between parent and subagent
  shareMemory(subagentId: string, memoryType: 'episodic' | 'semantic'): void;

  // Apply Byzantine validation to subagent contributions
  validateContributions(contributions: SubagentResult[]): ValidatedResult;

  // Sync experiences back to parent
  syncExperiences(subagentId: string): Promise<void>;
}
```

---

## Comparison Matrix (Updated)

| Capability | Chrysalis | Letta Code | OpenHands | Open Interpreter |
|------------|-----------|------------|-----------|------------------|
| **Persistent Memory** | ✅ Distributed | ✅ Local | ❌ | ❌ |
| **Skill Learning** | ✅ Accumulator | ✅ /skill | ✅ Skills | ✅ File-based |
| **Subagents** | ✅ Multi-Agent | ✅ Headless CLI | ✅ Delegation | ❌ |
| **Cross-Model** | ✅ Protocol morph | ✅ | ❌ | ✅ Profiles |
| **Byzantine Resistance** | ✅ | ❌ | ❌ | ❌ |
| **Plan Mode** | ❌ | ✅ | ❌ | ❌ |
| **LSP Integration** | ❌ | ✅ | ❌ | ❌ |
| **Computer Control** | ❌ | ❌ | ❌ | ✅ |
| **Context Condenser** | ❌ | ❌ | ✅ | ❌ |
| **ACP Support** | ❌ | ❌ | ❌ | ❌ |

---

## Strategic Insight

**Letta Code validates Chrysalis's core thesis:** Memory-first agents are the future or, stated differently per earlier research: agent-first not session-first agents are the future too.

**Chrysalis Advantages:**
1. **Distributed** - Letta is single-instance, Chrysalis enables multi-instance sync
2. **Byzantine** - Chrysalis validates memories from untrusted sources
3. **Protocol-agnostic** - Chrysalis morphs between frameworks

**Letta Advantages to Learn From:**
1. **Simpler memory model** - Blocks are easier to understand than episodic/semantic
2. **Skill learning from trajectory** - Automatic skill extraction
3. **Plan mode toggle** - Explicit phase separation
4. **LSP integration** - Code intelligence

---

## Recommended Integration

### Priority 1: Skill Learning from Trajectory (3 days)

Port Letta's `/skill` concept:
```typescript
// /skill command in Chrysalis CLI
async handleSkillCommand(instruction?: string) {
  const trajectory = this.getCurrentConversation();
  const skill = await this.skillLearner.learnFromTrajectory(trajectory, instruction);
  await this.skillAccumulator.addSkill(skill);
  // Sync to other instances via ExperienceSyncManager
  await this.experienceSync.broadcastSkillLearned(skill);
}
```

### Priority 2: Memory Blocks Quick Access (2 days)

Add simple block interface alongside episodic/semantic:
```typescript
// Quick access blocks
agent.memory.blocks.persona    // Who the agent is
agent.memory.blocks.project    // Current project context
agent.memory.blocks.human      // Who the user is
```

### Priority 3: Plan Mode Tools (1 day)

Add planning phase tools:
```typescript
const planningTools = [
  { name: "enter_plan_mode", ... },
  { name: "exit_plan_mode", ... },
  { name: "update_plan", ... }
];
```

### Priority 4: LSP Integration (1 week)

Add language server protocol for code intelligence:
```typescript
// src/lsp/LSPBridge.ts
class LSPBridge {
  getDefinition(file: string, position: Position): Location;
  getReferences(file: string, position: Position): Location[];
  getCompletions(file: string, position: Position): Completion[];
  getDiagnostics(file: string): Diagnostic[];
}
```

---

## Conclusion: Memory-Agnostic Philosophy

Letta Code validates the memory-first approach and should be **offered as a memory stack option**.

### Chrysalis Memory Philosophy

> **"Memory is essential. The right memory model is unknown."**

Just as Chrysalis supports multiple agent frameworks (A2A, ANP, MCP, CrewAI, ElizaOS) through the Universal Protocol Translation System, we support **multiple memory providers** through the Universal Memory Provider:

| Provider | Model | Best For |
|----------|-------|----------|
| **Chrysalis Native** | Episodic/Semantic/Procedural + Byzantine | Distributed, untrusted environments |
| **Letta** | Memory blocks (persona/human/project) | Simple, cloud-hosted, skill learning |
| **Mem0** | User/session memory | Temporal awareness, user profiles |
| **Zep** | Conversation memory | Entity extraction, long conversations |

### Key Extractable Patterns

1. **Skill Learning from Trajectory** - Automatic skill extraction (HIGH PRIORITY)
2. **Memory Blocks** - Simple named memory access
3. **Plan Mode Toggle** - Phase separation tools
4. **LSP Integration** - Code intelligence

### Implementation Status

✅ **LettaMemoryAdapter** created (`src/memory/adapters/LettaMemoryAdapter.ts`)
✅ **UniversalMemoryProvider** created (`src/memory/UniversalMemoryProvider.ts`)
✅ **LETTA_API_KEY** configured in `.env`

### Usage

```typescript
import { UniversalMemoryClient, memoryProviderRegistry } from './memory';

// Register Letta as a provider option
memoryProviderRegistry.register('letta', () => new LettaMemoryAdapter());

// Use Letta as primary memory
const client = new UniversalMemoryClient({ 
  primaryProvider: 'letta',
  fallbackProviders: ['chrysalis']  // Byzantine-validated local fallback
});
await client.initialize();

// Store memory (goes to Letta, replicates to Chrysalis)
await client.store({ content: 'User prefers TypeScript', type: 'semantic', importance: 0.8 });
```

Combined with previous recommendations:
- **ACP** for editor integration
- **OpenHands Condenser/StuckDetector** for efficiency
- **Open Interpreter exec()** for code execution

Chrysalis is now the **most comprehensive memory-agnostic agent system** available.

---

## Links

- [Letta Code GitHub](https://github.com/letta-ai/letta-code)
- [Letta Docs](https://docs.letta.com/letta-code)
- [Letta Platform](https://app.letta.com/)

---

**Document Status:** Analysis Complete
