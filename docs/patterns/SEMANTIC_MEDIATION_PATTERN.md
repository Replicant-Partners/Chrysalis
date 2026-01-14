# Semantic Mediation via LLM Delegation

**Pattern Classification**: Structural / Behavioral Hybrid
**Also Known As**: Registry-Prompt-LLM Triad, Declarative Adapter, LLM-Delegated Translation
**Intent**: Replace N×M branching logic with a single LLM-powered adapter that interprets declarative specifications.

---

## 🎯 Problem

When integrating multiple external systems (protocols, tools, formats), traditional approaches lead to:

1. **Combinatorial Explosion**: N sources × M targets = N×M adapters
2. **Brittle Branching**: Long switch statements that grow with each new format
3. **Scattered Knowledge**: Format details spread across many adapter files
4. **High Maintenance Cost**: Every format change requires code changes

### Example: Quality Tools Before Pattern

```typescript
// Traditional approach: One class per tool
class Flake8Adapter implements IQualityTool { /* 100+ lines */ }
class BlackAdapter implements IQualityTool { /* 100+ lines */ }
class MyPyAdapter implements IQualityTool { /* 100+ lines */ }
class ESLintAdapter implements IQualityTool { /* 100+ lines */ }
// ... 10+ more adapters

// Factory with growing switch statement
switch (toolName) {
  case 'flake8': return new Flake8Adapter();
  case 'black': return new BlackAdapter();
  // ... grows with each new tool
}
```

---

## ✅ Solution

Separate **what varies** from **how to interpret variation**:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SEMANTIC MEDIATION VIA LLM                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐         │
│   │   REGISTRY   │───▶│   PROMPTS    │───▶│     LLM      │         │
│   │   (Data)     │    │   (Logic)    │    │  (Executor)  │         │
│   └──────────────┘    └──────────────┘    └──────────────┘         │
│                                                                     │
│   Declarative         Stable               Flexible                 │
│   specifications      semantic             interpretation           │
│   that evolve         categories           and error                │
│   independently       and rules            recovery                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Stability | Example |
|-----------|----------------|-----------|---------|
| **Registry** | WHAT varies - specs, hints, schemas | Low (changes with protocols) | `PROTOCOL_REGISTRY_V2` |
| **Semantic Categories** | Conceptual buckets that transcend formats | High (rarely changes) | `IDENTITY`, `CAPABILITIES` |
| **Mapping Principles** | HOW to interpret - rules for LLM | High (stable once defined) | "Map by meaning, not syntax" |
| **Prompt Templates** | Structured combination of registry + principles | Medium | `buildTranslationPromptV2()` |
| **LLM Executor** | EXECUTION - flexible interpretation | High (unchanged) | `llm.complete(prompt)` |

---

## 🏗️ Structure

```
src/
├── adapters/
│   └── universal/
│       ├── registry.ts       # Declarative specifications
│       ├── prompts.ts        # Semantic categories + templates
│       ├── adapter.ts        # Single adapter class
│       └── index.ts          # Public API
```

### Registry Entry (Declarative)

```typescript
export const REGISTRY: Record<string, Entry> = {
  protocol_a: {
    name: 'Protocol A',
    specUrl: 'https://...',
    semanticHints: {
      identityField: 'name',
      capabilitiesField: 'tools',
      // ... field mappings
    },
    fallbackSchema: { /* JSON Schema */ }
  },
  // Adding a new protocol = adding an entry (no code!)
};
```

### Semantic Categories (Stable)

```typescript
export const SEMANTIC_CATEGORIES = {
  IDENTITY: {
    description: 'Who the agent is',
    concepts: ['id', 'name', 'uuid', 'title', 'role'],
  },
  CAPABILITIES: {
    description: 'What the agent can do',
    concepts: ['tool', 'skill', 'function', 'action'],
  },
  // ... more categories
};
```

### Universal Adapter (Minimal Code)

```typescript
class UniversalAdapter {
  async translate(data, sourceId, targetId) {
    // 1. Get specs from registry
    const sourceSpec = await this.getSpec(sourceId);
    const targetSpec = await this.getSpec(targetId);

    // 2. Build prompt with semantic principles
    const prompt = buildPrompt(data, sourceSpec, targetSpec);

    // 3. Delegate to LLM
    return await this.llm.complete(prompt);
  }
}
```

---

## 📐 Formal Design Pattern Elements

### Participants

- **Registry**: Holds declarative specifications for all formats
- **SemanticCategories**: Protocol-agnostic conceptual taxonomy
- **MappingPrinciples**: Rules the LLM follows during translation
- **PromptBuilder**: Constructs prompts from registry + principles
- **LLMExecutor**: Interprets prompts flexibly
- **UniversalAdapter**: Orchestrates the pattern (thin coordinator)

### Collaborations

1. Client requests translation/parsing via `UniversalAdapter`
2. Adapter fetches specs from `Registry`
3. `PromptBuilder` combines specs with `MappingPrinciples`
4. `LLMExecutor` processes prompt and returns result
5. Adapter normalizes and returns to client

### Consequences

**Benefits:**
- ✅ **O(N) instead of O(N×M)**: One registry entry per format
- ✅ **Declarative evolution**: Add formats without code changes
- ✅ **Graceful degradation**: LLM handles malformed/unexpected input
- ✅ **Knowledge centralization**: All format details in one place
- ✅ **Natural language flexibility**: LLM understands semantic intent

**Liabilities:**
- ⚠️ **LLM dependency**: Requires LLM provider
- ⚠️ **Latency**: LLM calls are slower than hardcoded logic
- ⚠️ **Non-determinism**: LLM output may vary (mitigate with temperature=0)
- ⚠️ **Cost**: LLM API calls have monetary cost

---

## 🔄 When to Apply

### Good Candidates

| Scenario | Why It Fits |
|----------|-------------|
| **Protocol translation** | Many formats with semantic equivalence |
| **Tool output parsing** | Variable output formats, same semantic content |
| **Data format conversion** | JSON/XML/YAML with overlapping concepts |
| **API response normalization** | Different APIs, similar data |
| **Log parsing** | Various log formats, common event types |

### Poor Candidates

| Scenario | Why It Doesn't Fit |
|----------|---------------------|
| **Binary protocols** | LLM can't interpret binary |
| **Real-time/low-latency** | LLM latency too high |
| **Cryptographic operations** | Determinism required |
| **Simple 1:1 mappings** | Overkill for trivial cases |

---

## 📊 Implementation Comparison

### Before: Traditional Adapter Factory

```typescript
// 5 files, ~500 lines total
class Flake8Adapter { /* 100 lines */ }
class BlackAdapter { /* 100 lines */ }
class MyPyAdapter { /* 100 lines */ }
class ESLintAdapter { /* 100 lines */ }
class TypeScriptCompilerAdapter { /* 100 lines */ }

// Factory with switch statement
switch (toolName) {
  case 'flake8': return new Flake8Adapter();
  case 'black': return new BlackAdapter();
  case 'mypy': return new MyPyAdapter();
  case 'eslint': return new ESLintAdapter();
  case 'tsc': return new TypeScriptCompilerAdapter();
  default: throw new Error('Unknown tool');
}
```

### After: Semantic Mediation Pattern

```typescript
// 4 files, ~400 lines total (and scales better!)
// registry.ts: 200 lines (declarative, easy to extend)
// prompts.ts: 100 lines (stable)
// adapter.ts: 100 lines (minimal)

// No switch statements - just registry lookup
const tool = getTool(toolId);
const result = await adapter.check(tool, target);
```

---

## 🔗 Related Patterns

| Pattern | Relationship |
|---------|--------------|
| **Strategy** | LLM acts as "universal strategy" |
| **Adapter** | Generalized to N adapters via registry |
| **Mediator** | Semantic categories mediate between formats |
| **Template Method** | Prompt structure is template, content varies |
| **Plugin** | Registry entries are declarative plugins |
| **Interpreter** | LLM interprets mapping principles |

---

## 📚 References

### Academic
- Halevy, A., Rajaraman, A., & Ordille, J. (2006). "Data Integration: The Teenage Years." VLDB.
- Rahm, E., & Bernstein, P. A. (2001). "A Survey of Approaches to Automatic Schema Matching." VLDB Journal.

### Industry
- Anthropic Model Context Protocol (2024). Semantic tool definitions.
- Google Agent-to-Agent Protocol (2025). AgentCard specifications.
- OpenAPI Specification. Declarative API definitions.

### Chrysalis Implementation
- `src/adapters/universal/` - Protocol translation
- `src/quality/tools/universal/` - Quality tool adaptation

---

*Pattern documented as part of Chrysalis architecture, January 2026*
