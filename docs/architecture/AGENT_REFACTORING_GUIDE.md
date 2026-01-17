# Agent Module Refactoring Guide

> **Purpose**: Detailed technical guidance for refactoring Chrysalis agent modules to achieve type safety while preserving existing behavior.  
> **Status**: Implementation Roadmap  
> **Priority**: High - Core architectural improvement

---

## Executive Summary

The agent modules (`src/converter/`, `src/core/`, `src/adapters/`) form the heart of Chrysalis's agent conversion system. Currently, they suffer from:

1. **File-level type suppression**: `// @ts-nocheck` in `Converter.ts`
2. **Interface `any` leakage**: `FrameworkAdapter` uses `any` for all agent types
3. **Missing generic constraints**: No way to express "this adapter handles LangChain agents"
4. **Runtime validation dependency**: Types aren't enforced until runtime

This guide provides a systematic approach to introduce type safety without breaking backward compatibility.

---

## Current Architecture Analysis

### Problem: The `any` Cascade

```typescript
// src/core/FrameworkAdapter.ts - Current
export interface ShadowData {
  data: {
    [key: string]: any;    // ❌ Index signature with any
    _original: any;        // ❌ Source agent untyped
    _universal: UniformSemanticAgent;  // ✅ Typed
  };
}

abstract class FrameworkAdapter {
  abstract toUniversal(frameworkAgent: any): Promise<UniformSemanticAgent>;
  abstract fromUniversal(universalAgent: UniformSemanticAgent): Promise<any>;
  // ❌ `any` in, `any` out - type information lost
}
```

### Impact Analysis

| File | `any` Count | Risk Level | Refactoring Complexity |
|------|-------------|------------|----------------------|
| `src/converter/Converter.ts` | 15+ (plus @ts-nocheck) | 🔴 Critical | Medium |
| `src/core/FrameworkAdapter.ts` | 12 | 🔴 Critical | High (breaking) |
| `src/adapters/langchain/` | 8 | 🟡 Medium | Low |
| `src/adapters/autogen/` | 8 | 🟡 Medium | Low |
| `src/adapters/crewai/` | 6 | 🟡 Medium | Low |

---

## Target Architecture

### Solution: Generic Framework Adapters

```typescript
// Target architecture: Generic adapters with type constraints

/**
 * Base type for all framework agents - provides minimal shape
 */
interface FrameworkAgentBase {
  readonly __brand?: string;  // Optional brand for type discrimination
}

/**
 * Generic FrameworkAdapter with type parameter
 */
abstract class FrameworkAdapter<TAgent extends FrameworkAgentBase> {
  abstract readonly name: string;
  abstract readonly version: string;
  abstract readonly supports_shadow: boolean;
  
  abstract toUniversal(frameworkAgent: TAgent): Promise<UniformSemanticAgent>;
  abstract fromUniversal(universalAgent: UniformSemanticAgent): Promise<TAgent>;
  abstract embedShadow(agent: TAgent, shadow: EncryptedShadow): Promise<TAgent>;
  abstract extractShadow(agent: TAgent): Promise<EncryptedShadow | null>;
  abstract validate(agent: TAgent): Promise<ValidationResult>;
}

/**
 * Example: LangChain adapter with concrete type
 */
interface LangChainAgent extends FrameworkAgentBase {
  __brand: 'langchain';
  name: string;
  description: string;
  tools: LangChainTool[];
  llm: LangChainLLM;
  memory?: LangChainMemory;
  // ... other LangChain-specific fields
}

class LangChainAdapter extends FrameworkAdapter<LangChainAgent> {
  readonly name = 'langchain';
  readonly version = '1.0';
  readonly supports_shadow = true;
  
  async toUniversal(agent: LangChainAgent): Promise<UniformSemanticAgent> {
    // Type-safe access to agent.name, agent.tools, etc.
  }
  // ...
}
```

### Shadow Data Refinement

```typescript
/**
 * Type-safe shadow data with generic original type
 */
interface ShadowData<TOriginal extends FrameworkAgentBase> {
  framework: string;
  version: string;
  timestamp: number;
  data: ShadowPayload<TOriginal>;
  checksum: string;
}

interface ShadowPayload<TOriginal> {
  // Known structure for framework-specific extras
  extras: Record<string, unknown>;
  _original: TOriginal;
  _universal: UniformSemanticAgent;
}

// Usage in FrameworkAdapter
abstract embedShadow(
  agent: TAgent,
  shadow: EncryptedShadow
): Promise<TAgent>;
```

---

## Migration Strategy

### Phase 1: Define Framework Agent Types (Week 1-2)

Create explicit types for each supported framework:

```typescript
// src/types/frameworks/langchain.ts
export interface LangChainAgent {
  __brand: 'langchain';
  name: string;
  description: string;
  tools: Array<{
    name: string;
    description: string;
    func: string;
  }>;
  llm: {
    model: string;
    temperature: number;
    // ...
  };
  // Shadow field (optional, added during conversion)
  __chrysalis_shadow__?: string;
}

// src/types/frameworks/autogen.ts
export interface AutoGenAgent {
  __brand: 'autogen';
  name: string;
  system_message: string;
  llm_config: {
    model: string;
    // ...
  };
  // ...
}

// src/types/frameworks/crewai.ts
export interface CrewAIAgent {
  __brand: 'crewai';
  role: string;
  goal: string;
  backstory: string;
  // ...
}

// src/types/frameworks/index.ts - Union type for any framework agent
export type AnyFrameworkAgent = 
  | LangChainAgent 
  | AutoGenAgent 
  | CrewAIAgent;
```

### Phase 2: Generic Adapter Base (Week 2-3)

Create the generic adapter while maintaining backward compatibility:

```typescript
// src/core/FrameworkAdapter.ts - New version

// Backward-compatible alias
type LegacyAgent = Record<string, unknown>;

/**
 * Generic framework adapter
 * @template TAgent - The framework-specific agent type
 */
export abstract class FrameworkAdapter<TAgent = LegacyAgent> {
  abstract readonly name: string;
  abstract readonly version: string;
  abstract readonly supports_shadow: boolean;
  
  // Type-safe methods
  abstract toUniversal(frameworkAgent: TAgent): Promise<UniformSemanticAgent>;
  abstract fromUniversal(universalAgent: UniformSemanticAgent): Promise<TAgent>;
  abstract embedShadow(agent: TAgent, shadow: EncryptedShadow): Promise<TAgent>;
  abstract extractShadow(agent: TAgent): Promise<EncryptedShadow | null>;
  abstract validate(agent: TAgent): Promise<ValidationResult>;
  
  // Protected helpers remain backward compatible
  protected getNestedValue(obj: unknown, path: string): unknown {
    // Implementation unchanged
  }
}

// Legacy support: Untyped adapter for gradual migration
export type UntypedFrameworkAdapter = FrameworkAdapter<LegacyAgent>;
```

### Phase 3: Update Adapters (Week 3-4)

Migrate each adapter to use specific types:

```typescript
// src/adapters/langchain/LangChainAdapter.ts

import type { LangChainAgent } from '../../types/frameworks/langchain';
import { FrameworkAdapter } from '../../core/FrameworkAdapter';

export class LangChainAdapter extends FrameworkAdapter<LangChainAgent> {
  readonly name = 'langchain';
  readonly version = '1.0.0';
  readonly supports_shadow = true;
  
  async toUniversal(agent: LangChainAgent): Promise<UniformSemanticAgent> {
    // Now type-safe: agent.name, agent.tools, etc. are typed
    return {
      identity: {
        name: agent.name,
        // ...
      },
      // ...
    };
  }
  
  async fromUniversal(universal: UniformSemanticAgent): Promise<LangChainAgent> {
    return {
      __brand: 'langchain',
      name: universal.identity.name,
      description: universal.identity.bio,
      tools: this.mapCapabilitiesToTools(universal.capabilities),
      // ...
    };
  }
  
  async validate(agent: LangChainAgent): Promise<ValidationResult> {
    const errors: string[] = [];
    
    if (!agent.name) {
      errors.push('Agent must have a name');
    }
    
    if (!Array.isArray(agent.tools)) {
      errors.push('Agent must have tools array');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
    };
  }
  
  // ...
}
```

### Phase 4: Update Converter (Week 4-5)

Refactor Converter to work with typed adapters:

```typescript
// src/converter/Converter.ts - Refactored

// REMOVE: // @ts-nocheck

import type { UniformSemanticAgent } from '../core/UniformSemanticAgent';
import type { 
  FrameworkAdapter, 
  EncryptedShadow 
} from '../core/FrameworkAdapter';
import type { AnyFrameworkAgent } from '../types/frameworks';

/**
 * Type-safe conversion result
 */
export interface ConversionResult<TTarget> {
  agent: TTarget;
  universal: UniformSemanticAgent;
  restorationKey: string;
  metadata: ConversionMetadata;
}

export interface ConversionMetadata {
  from: string;
  to: string;
  timestamp: number;
  fingerprint: string;
}

/**
 * Type-safe converter using generic adapters
 */
export class Converter {
  /**
   * Convert agent between frameworks with full type safety
   */
  async convert<TSource, TTarget>(
    sourceAgent: TSource,
    fromAdapter: FrameworkAdapter<TSource>,
    toAdapter: FrameworkAdapter<TTarget>,
    options: ConversionOptions = {}
  ): Promise<ConversionResult<TTarget>> {
    // Validation is now type-safe
    const validation = await fromAdapter.validate(sourceAgent);
    if (!validation.valid) {
      throw new ConversionError(
        `Invalid source agent:\n${validation.errors.join('\n')}`
      );
    }
    
    // Type flows through the conversion chain
    const universal = await fromAdapter.toUniversal(sourceAgent);
    let targetAgent = await toAdapter.fromUniversal(universal);
    
    if (toAdapter.supports_shadow) {
      const shadow = await this.createShadow(
        sourceAgent,
        universal,
        fromAdapter,
        options
      );
      targetAgent = await toAdapter.embedShadow(targetAgent, shadow);
    }
    
    return {
      agent: targetAgent,  // Now typed as TTarget
      universal,
      restorationKey: this.generateRestorationKey(),
      metadata: {
        from: fromAdapter.name,
        to: toAdapter.name,
        timestamp: Date.now(),
        fingerprint: universal.identity.fingerprint,
      },
    };
  }
  
  /**
   * Restore agent to original type
   */
  async restore<TOriginal>(
    morphedAgent: unknown,
    targetAdapter: FrameworkAdapter<TOriginal>,
    restorationKey: string,
    options: RestorationOptions = {}
  ): Promise<TOriginal> {
    // Shadow extraction and decryption
    const shadow = await targetAdapter.extractShadow(morphedAgent as TOriginal);
    if (!shadow) {
      throw new RestorationError('No shadow data found');
    }
    
    // Decrypt and validate
    const decrypted = await this.decryptShadow(shadow, restorationKey);
    
    // Type assertion with validation
    return this.validateAndCast<TOriginal>(decrypted._original, targetAdapter);
  }
  
  private async validateAndCast<T>(
    agent: unknown,
    adapter: FrameworkAdapter<T>
  ): Promise<T> {
    const validation = await adapter.validate(agent as T);
    if (!validation.valid) {
      throw new ValidationError('Restored agent failed validation', validation.errors);
    }
    return agent as T;
  }
}
```

---

## Validation Strategy

### Runtime Type Guards

Since TypeScript types are erased at runtime, add runtime validation:

```typescript
// src/types/guards/langchain.ts

import type { LangChainAgent } from '../frameworks/langchain';

export function isLangChainAgent(value: unknown): value is LangChainAgent {
  if (!isRecord(value)) return false;
  
  return (
    value.__brand === 'langchain' &&
    typeof value.name === 'string' &&
    typeof value.description === 'string' &&
    Array.isArray(value.tools) &&
    isRecord(value.llm)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
```

### Zod Schema Alternative

For more robust validation, use Zod schemas:

```typescript
// src/types/schemas/langchain.ts

import { z } from 'zod';

export const LangChainToolSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  func: z.string(),
});

export const LangChainAgentSchema = z.object({
  __brand: z.literal('langchain'),
  name: z.string().min(1),
  description: z.string(),
  tools: z.array(LangChainToolSchema),
  llm: z.object({
    model: z.string(),
    temperature: z.number().min(0).max(2).optional(),
  }),
  __chrysalis_shadow__: z.string().optional(),
});

export type LangChainAgent = z.infer<typeof LangChainAgentSchema>;

// Usage in adapter
class LangChainAdapter extends FrameworkAdapter<LangChainAgent> {
  async validate(agent: LangChainAgent): Promise<ValidationResult> {
    const result = LangChainAgentSchema.safeParse(agent);
    
    if (result.success) {
      return { valid: true, errors: [], warnings: [] };
    }
    
    return {
      valid: false,
      errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      warnings: [],
    };
  }
}
```

---

## Testing Requirements

### Unit Tests for Type Safety

```typescript
// src/converter/__tests__/Converter.test.ts

import { Converter } from '../Converter';
import { LangChainAdapter } from '../../adapters/langchain';
import { AutoGenAdapter } from '../../adapters/autogen';
import type { LangChainAgent } from '../../types/frameworks/langchain';
import type { AutoGenAgent } from '../../types/frameworks/autogen';

describe('Converter type safety', () => {
  const converter = new Converter();
  const langchainAdapter = new LangChainAdapter();
  const autogenAdapter = new AutoGenAdapter();
  
  it('should convert LangChain to AutoGen with type preservation', async () => {
    const source: LangChainAgent = {
      __brand: 'langchain',
      name: 'Test Agent',
      description: 'A test agent',
      tools: [{ name: 'search', description: 'Search the web', func: 'search' }],
      llm: { model: 'gpt-4' },
    };
    
    const result = await converter.convert(
      source,
      langchainAdapter,
      autogenAdapter
    );
    
    // TypeScript knows result.agent is AutoGenAgent
    expect(result.agent.__brand).toBe('autogen');
    expect(result.agent.name).toBe('Test Agent');
    // @ts-expect-error - AutoGenAgent doesn't have 'tools'
    expect(result.agent.tools).toBeUndefined();
  });
  
  it('should fail validation for invalid agents', async () => {
    const invalid = {
      __brand: 'langchain',
      // Missing required fields
    };
    
    await expect(
      converter.convert(
        invalid as LangChainAgent,
        langchainAdapter,
        autogenAdapter
      )
    ).rejects.toThrow('Invalid source agent');
  });
});
```

---

## Backward Compatibility

### Migration Period Support

During migration, support both typed and untyped usage:

```typescript
// src/converter/index.ts

// Legacy export (deprecated)
export { Converter } from './Converter';

// New typed export
export { TypedConverter } from './TypedConverter';

// Deprecation warning
/** @deprecated Use TypedConverter instead */
export class LegacyConverter extends Converter<unknown> {
  constructor() {
    super();
    console.warn(
      'LegacyConverter is deprecated. Migrate to TypedConverter for type safety.'
    );
  }
}
```

---

## Implementation Checklist

### Immediate Actions
- [ ] Remove `// @ts-nocheck` from `Converter.ts`
- [ ] Create `src/types/frameworks/` directory structure
- [ ] Define types for LangChain, AutoGen, CrewAI agents
- [ ] Add type guards for runtime validation

### Short-term (2 weeks)
- [ ] Add generic parameter to `FrameworkAdapter`
- [ ] Update `Converter` to use generics
- [ ] Migrate `LangChainAdapter` to typed version
- [ ] Add unit tests for type safety

### Medium-term (4 weeks)
- [ ] Migrate remaining adapters (AutoGen, CrewAI, Custom)
- [ ] Add Zod schemas for all framework types
- [ ] Update documentation with typed examples
- [ ] Enable strict TypeScript checks project-wide

### Validation
- [ ] All existing tests pass
- [ ] No runtime behavior changes
- [ ] Type coverage > 95% in converter module
- [ ] Zero `any` types in public interfaces

---

## Related Documents

- [`CODEBASE_MODERNIZATION_AUDIT.md`](./CODEBASE_MODERNIZATION_AUDIT.md) - Technical debt inventory
- [`TARGET_ARCHITECTURE_STANDARDS.md`](./TARGET_ARCHITECTURE_STANDARDS.md) - Type safety requirements
- [`RUST_MIGRATION_ROADMAP.md`](./RUST_MIGRATION_ROADMAP.md) - Security module migration

---

*This guide provides the technical foundation for type-safe agent modules. Implementation should proceed incrementally with full test coverage at each stage.*
