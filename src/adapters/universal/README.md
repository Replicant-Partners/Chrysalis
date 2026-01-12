# Universal LLM-Powered Adapter

## 🚨 PARADIGM SHIFT: READ THIS FIRST

**This module represents a fundamental shift in how we build software in the LLM era.**

### The Old Way (Pre-LLM Thinking)
```
22 hand-coded adapters × ~500 lines each = ~11,000 lines of transformation logic
+ Each new protocol = new adapter = more code = more maintenance
+ Bugs in mapping logic = code changes required
+ Protocol spec updates = manual adapter updates
```

### The New Way (LLM-Delegated Complexity)
```
1 universal adapter × ~200 lines + structured prompts = done
+ New protocol = add URL to registry (no code)
+ Mapping issues = prompt refinement (no code changes)
+ Protocol updates = automatic (specs fetched from URLs)
```

## Core Principle

> **Push complexity to the LLM through well-structured prompts.**

Instead of encoding transformation logic in code, we:

1. **Express mapping PRINCIPLES** in prompts (what semantic equivalence means)
2. **Provide protocol SPECIFICATIONS** as context (fetched from URLs)
3. **Delegate EXECUTION** to the LLM (it applies principles to specs)

The LLM is not a black box - it's a reasoning engine that applies our principles to each unique translation case.

## Why This Works

LLMs excel at:
- **Semantic understanding**: Matching fields by meaning, not syntax
- **Pattern recognition**: Seeing that "tools" ≈ "capabilities" ≈ "functions"
- **Contextual reasoning**: Applying principles to novel cases
- **Schema interpretation**: Understanding JSON Schema / OpenAPI specs

Humans are better at:
- **Defining principles**: What constitutes semantic equivalence?
- **Curating specs**: Which protocols matter? What are their authoritative URLs?
- **Validating results**: Is this translation correct?

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     UNIVERSAL ADAPTER                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    PROMPT LAYER                          │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │           MAPPING PRINCIPLES                        │ │  │
│  │  │  • Semantic equivalence over syntactic matching     │ │  │
│  │  │  • Preserve all information (use extensions)        │ │  │
│  │  │  • Structural transformation rules                  │ │  │
│  │  │  • Required field defaults                          │ │  │
│  │  │  • Capability/Memory/Identity mappings              │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │               PROTOCOL REGISTRY                          │  │
│  │  ┌───────────┬─────────────────────────────────────────┐ │  │
│  │  │ Protocol  │ Specification URL                       │ │  │
│  │  ├───────────┼─────────────────────────────────────────┤ │  │
│  │  │ usa       │ chrysalis.dev/schemas/usa/v2            │ │  │
│  │  │ mcp       │ spec.modelcontextprotocol.io/schema     │ │  │
│  │  │ a2a       │ google.github.io/A2A/spec               │ │  │
│  │  │ crewai    │ docs.crewai.com/api/schema              │ │  │
│  │  │ ...       │ (just add URL for new protocols)        │ │  │
│  │  └───────────┴─────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    LLM ENGINE                            │  │
│  │  Applies mapping principles to protocol specs            │  │
│  │  Returns structured translation + confidence             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Usage

```typescript
import { UniversalAdapter, createUniversalAdapter } from './adapters/universal';

// Create adapter with your LLM provider
const adapter = createUniversalAdapter({
  complete: async (prompt) => {
    // Call your LLM (Claude, GPT-4, etc.)
    const response = await llm.complete(prompt);
    return JSON.parse(response);
  }
});

// Translate between ANY protocols
const result = await adapter.translate(
  myAgent,           // Agent data
  'crewai',          // Source protocol
  'mcp'              // Target protocol
);

console.log(result.result);        // Translated agent
console.log(result.confidence);    // LLM's confidence (0-1)
console.log(result.unmappedFields);// Fields stored in extensions
```

## Adding a New Protocol

**No code required.** Just add to the registry:

```typescript
adapter.registerProtocol('new_framework', {
  name: 'New Agent Framework',
  specUrl: 'https://newframework.io/api/schema.json',
  docsUrl: 'https://newframework.io/docs'
});

// Now you can translate to/from new_framework
await adapter.translate(agent, 'usa', 'new_framework');
```

## Files

| File | Purpose | Lines |
|------|---------|-------|
| `index.ts` | Universal Adapter class + Protocol Registry | ~150 |
| `prompts.ts` | Mapping principles + prompt builders | ~200 |
| `types.ts` | Type definitions (optional, for TypeScript users) | ~100 |

**Total: ~450 lines** (replacing ~11,000 lines of hand-coded adapters)

## Design Principles for Future Engineers

### DO ✅

1. **Express logic as prompts** - If you find yourself writing transformation code, stop. Can it be a prompt?

2. **Add to the registry, not the code** - New protocol? Add URL. Don't write a new adapter class.

3. **Refine mapping principles** - Found an edge case? Update the principles in `prompts.ts`, not scattered across adapter code.

4. **Trust the LLM with context** - Give it specs + principles + data. Let it reason.

5. **Validate outputs** - Use the validation functions. Trust but verify.

### DON'T ❌

1. **Don't hand-code transformations** - Every `if/else` mapping is a failure to delegate.

2. **Don't create protocol-specific adapters** - The whole point is ONE universal adapter.

3. **Don't embed protocol knowledge in code** - Protocol specs live at URLs, not in your code.

4. **Don't over-engineer the adapter** - It should be simple. Complexity goes to prompts.

## Comparison: Before vs After

### Before (22 Adapters)

```typescript
// MCPAdapter.ts - 600 lines
export class MCPAdapter extends BaseAdapter {
  toCanonical(mcp: MCPAgent): CanonicalAgent {
    return {
      id: mcp.id,
      name: mcp.name,
      tools: mcp.tools?.map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.input_schema,  // manual mapping
        // ... 50 more field mappings
      })),
      // ... hundreds more lines
    };
  }
  
  fromCanonical(canonical: CanonicalAgent): MCPAgent {
    // ... another 300 lines doing the reverse
  }
}

// Repeat 22 times for each protocol...
```

### After (1 Universal Adapter)

```typescript
// That's it. The whole adapter.
const adapter = createUniversalAdapter(llm);
const result = await adapter.translate(agent, 'mcp', 'crewai');
```

## The Deeper Point

This isn't just about reducing code. It's about recognizing that:

1. **LLMs change what should be code vs. data** - Transformation logic is now data (prompts).

2. **Specifications are the source of truth** - Not our interpretations of them encoded in adapters.

3. **Principles > Procedures** - Express what semantic equivalence means; let the LLM figure out how.

4. **Maintenance becomes curation** - Update principles and registry, not code.

This pattern applies beyond adapters. Anywhere you're writing lots of similar logic with slight variations, consider: can this be principles + context + LLM?

## Migration from Legacy Adapters

The 22 existing adapters in `src/adapters/` are deprecated. Migration path:

1. **Phase 1**: Run Universal Adapter in parallel, compare outputs
2. **Phase 2**: Switch to Universal Adapter as default
3. **Phase 3**: Remove legacy adapters

See `docs/architecture/UNIVERSAL_ADAPTER_DESIGN.md` for full migration plan.

---

**Remember**: Every line of transformation code you write is a line that could have been a prompt. Choose wisely.
