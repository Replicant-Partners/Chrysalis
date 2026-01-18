# Universal LLM-Powered Adapter Architecture

**Version**: 1.0.0  
**Last Updated**: January 12, 2026  
**Status**: Design Specification  

---

## Executive Summary

This document specifies the architecture for consolidating the existing 22 protocol-specific adapters into a **single Universal LLM-Powered Adapter**. The adapter uses an AI backend to dynamically interpret protocol specifications from a registry of approved URLs, eliminating the need for hand-coded adapters per framework.

### Current State (Accidental Complexity)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CURRENT: 22 Hand-Coded Adapters                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │ MCPAdapter   │  │ A2AAdapter   │  │ ANPAdapter   │                  │
│  └──────────────┘  └──────────────┘  └──────────────┘                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │ LMOSAdapter  │  │LangChainAdpt │  │ CrewAIAdapt  │                  │
│  └──────────────┘  └──────────────┘  └──────────────┘                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │ ElizaOSAdapt │  │ USAAdapter   │  │ BaseAdapter  │                  │
│  └──────────────┘  └──────────────┘  └──────────────┘                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │ unified-adap │  │ base-unified │  │ mcp-unified  │                  │
│  └──────────────┘  └──────────────┘  └──────────────┘                  │
│                      + 10 more...                                       │
│                                                                         │
│  PROBLEMS:                                                              │
│  • 1,304+ lines in base-adapter.ts alone                               │
│  • 533 lines in base-unified-adapter.ts                                │
│  • Each new protocol requires new hand-coded adapter                   │
│  • Maintenance burden grows O(N) with protocols                        │
│  • Type duplication across adapters                                    │
│  • Inconsistent error handling patterns                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Target State (Essential Elegance)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  TARGET: Single Universal LLM Adapter                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    UNIVERSAL ADAPTER                            │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │                    LLM ENGINE                            │   │   │
│  │  │  • Interprets protocol specs dynamically                │   │   │
│  │  │  • Generates translations on-demand                     │   │   │
│  │  │  • Validates against schema definitions                 │   │   │
│  │  │  • Caches learned mappings for performance              │   │   │
│  │  └──────────────────────┬──────────────────────────────────┘   │   │
│  │                         │                                       │   │
│  │  ┌──────────────────────▼──────────────────────────────────┐   │   │
│  │  │              PROTOCOL SPECIFICATION REGISTRY            │   │   │
│  │  │  ┌────────────┬────────────────────────────────────┐   │   │   │
│  │  │  │ Protocol   │ Specification URL                  │   │   │   │
│  │  │  ├────────────┼────────────────────────────────────┤   │   │   │
│  │  │  │ MCP        │ https://spec.modelcontextprotocol.io│  │   │   │
│  │  │  │ A2A        │ https://google.github.io/A2A/spec  │   │   │   │
│  │  │  │ ANP        │ https://anp.dev/specification      │   │   │   │
│  │  │  │ LMOS       │ https://eclipse.dev/lmos/spec      │   │   │   │
│  │  │  │ LangChain  │ https://api.langchain.com/schema   │   │   │   │
│  │  │  │ CrewAI     │ https://docs.crewai.com/api/spec   │   │   │   │
│  │  │  │ SemanticAgent        │ internal://chrysalis/usa/v2.0      │   │   │   │
│  │  │  └────────────┴────────────────────────────────────┘   │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  BENEFITS:                                                              │
│  • Single adapter handles ALL protocols                                │
│  • Adding new protocol = registering URL (no code)                     │
│  • Maintenance burden is O(1)                                          │
│  • Specs update without code changes                                   │
│  • LLM handles edge cases and ambiguities                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture Design

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       UNIVERSAL ADAPTER SYSTEM                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      PUBLIC API LAYER                            │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │  │
│  │  │ translate()     │  │ validate()      │  │ discover()      │  │  │
│  │  │ (source→target) │  │ (against spec)  │  │ (protocol caps) │  │  │
│  │  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │  │
│  └───────────┼────────────────────┼────────────────────┼────────────┘  │
│              │                    │                    │               │
│  ┌───────────▼────────────────────▼────────────────────▼────────────┐  │
│  │                    TRANSLATION ENGINE                            │  │
│  │  ┌──────────────────────────────────────────────────────────┐   │  │
│  │  │                    LLM ORCHESTRATOR                      │   │  │
│  │  │  • Prompt construction with protocol specs               │   │  │
│  │  │  • Multi-turn reasoning for complex translations         │   │  │
│  │  │  • Schema validation integration                         │   │  │
│  │  │  • Confidence scoring and fallback logic                 │   │  │
│  │  └──────────────────────────────────────────────────────────┘   │  │
│  │                               │                                  │  │
│  │  ┌───────────────────────────▼────────────────────────────────┐ │  │
│  │  │                 TRANSLATION CACHE                          │ │  │
│  │  │  • Memoized field mappings                                 │ │  │
│  │  │  • Cached schema interpretations                           │ │  │
│  │  │  • Performance optimization (avoid repeated LLM calls)     │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                               │                                        │
│  ┌───────────────────────────▼────────────────────────────────────┐   │
│  │                 PROTOCOL SPECIFICATION REGISTRY                │   │
│  │  ┌────────────────────────────────────────────────────────┐   │   │
│  │  │                   SPEC LOADER                          │   │   │
│  │  │  • Fetch specs from URLs (with caching)                │   │   │
│  │  │  • Parse JSON Schema / OpenAPI / AsyncAPI              │   │   │
│  │  │  • Version tracking and compatibility                  │   │   │
│  │  └────────────────────────────────────────────────────────┘   │   │
│  │  ┌────────────────────────────────────────────────────────┐   │   │
│  │  │                   SPEC REGISTRY                        │   │   │
│  │  │  • Approved protocol URLs                              │   │   │
│  │  │  • Version constraints                                 │   │   │
│  │  │  • Trust levels (internal, verified, experimental)     │   │   │
│  │  └────────────────────────────────────────────────────────┘   │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Core Interfaces

```typescript
/**
 * Universal Adapter - Single adapter for all protocols
 */
export interface UniversalAdapter {
  /**
   * Translate agent representation between protocols
   */
  translate(
    source: AgentRepresentation,
    sourceProtocol: ProtocolId,
    targetProtocol: ProtocolId,
    options?: TranslationOptions
  ): Promise<TranslationResult>;

  /**
   * Validate agent against protocol specification
   */
  validate(
    agent: AgentRepresentation,
    protocol: ProtocolId
  ): Promise<ValidationResult>;

  /**
   * Discover protocol capabilities
   */
  discoverCapabilities(protocol: ProtocolId): Promise<ProtocolCapabilities>;

  /**
   * Register a new protocol specification
   */
  registerProtocol(
    id: ProtocolId,
    specUrl: string,
    options?: RegistrationOptions
  ): Promise<void>;

  /**
   * Get registered protocols
   */
  getRegisteredProtocols(): ProtocolInfo[];
}

/**
 * Protocol Specification Registry
 */
export interface ProtocolRegistry {
  /** Registered protocol specifications */
  protocols: Map<ProtocolId, ProtocolSpec>;
  
  /** Register new protocol */
  register(id: ProtocolId, spec: ProtocolSpec): void;
  
  /** Get protocol spec */
  get(id: ProtocolId): ProtocolSpec | undefined;
  
  /** Refresh spec from URL */
  refresh(id: ProtocolId): Promise<void>;
  
  /** List all protocols */
  list(): ProtocolInfo[];
}

/**
 * Protocol Specification
 */
export interface ProtocolSpec {
  /** Protocol identifier */
  id: ProtocolId;
  
  /** Human-readable name */
  name: string;
  
  /** Specification URL */
  specUrl: string;
  
  /** Parsed specification (JSON Schema, OpenAPI, etc.) */
  schema: JsonSchema | OpenApiSpec | AsyncApiSpec;
  
  /** Version info */
  version: SemanticVersion;
  
  /** Trust level */
  trustLevel: 'internal' | 'verified' | 'experimental';
  
  /** Last fetched timestamp */
  lastFetched: Date;
  
  /** Cache TTL in seconds */
  cacheTtl: number;
}

/**
 * Translation Options
 */
export interface TranslationOptions {
  /** Strictness mode */
  strict?: boolean;
  
  /** Include confidence scores */
  includeConfidence?: boolean;
  
  /** Allow lossy translation */
  allowLossy?: boolean;
  
  /** Custom field mappings (overrides) */
  fieldOverrides?: FieldMapping[];
  
  /** Maximum LLM reasoning steps */
  maxReasoningSteps?: number;
}

/**
 * Translation Result
 */
export interface TranslationResult {
  /** Translated agent representation */
  result: AgentRepresentation;
  
  /** Translation fidelity score (0.0 - 1.0) */
  fidelity: number;
  
  /** Confidence score from LLM */
  confidence: number;
  
  /** Fields that were successfully mapped */
  mappedFields: string[];
  
  /** Fields stored in extensions (not mappable) */
  extensionFields: string[];
  
  /** Fields that were lost */
  lostFields: string[];
  
  /** Warnings */
  warnings: TranslationWarning[];
  
  /** LLM reasoning trace (if requested) */
  reasoningTrace?: ReasoningStep[];
}
```

### LLM Orchestrator Design

```typescript
/**
 * LLM Orchestrator - Coordinates AI-powered translation
 */
export class LLMOrchestrator {
  constructor(
    private llmProvider: LLMProvider,
    private registry: ProtocolRegistry,
    private cache: TranslationCache
  ) {}

  /**
   * Translate between protocols using LLM reasoning
   */
  async translate(
    source: AgentRepresentation,
    sourceSpec: ProtocolSpec,
    targetSpec: ProtocolSpec,
    options: TranslationOptions
  ): Promise<TranslationResult> {
    // 1. Check cache for known mappings
    const cachedMappings = this.cache.getMappings(
      sourceSpec.id, 
      targetSpec.id
    );
    
    // 2. Build prompt with protocol specs
    const prompt = this.buildTranslationPrompt(
      source,
      sourceSpec,
      targetSpec,
      cachedMappings
    );
    
    // 3. Execute LLM reasoning
    const response = await this.llmProvider.complete(prompt, {
      maxTokens: 4096,
      temperature: 0.2,  // Low temp for deterministic translation
      responseFormat: 'json'
    });
    
    // 4. Validate response against target schema
    const validated = await this.validateAgainstSchema(
      response.result,
      targetSpec.schema
    );
    
    // 5. Cache learned mappings
    if (validated.valid) {
      this.cache.storeMappings(
        sourceSpec.id,
        targetSpec.id,
        response.fieldMappings
      );
    }
    
    return {
      result: validated.result,
      fidelity: this.calculateFidelity(source, validated.result),
      confidence: response.confidence,
      mappedFields: response.mappedFields,
      extensionFields: response.extensionFields,
      lostFields: response.lostFields,
      warnings: validated.warnings,
      reasoningTrace: options.includeConfidence ? response.reasoning : undefined
    };
  }

  /**
   * Build translation prompt with protocol specifications
   */
  private buildTranslationPrompt(
    source: AgentRepresentation,
    sourceSpec: ProtocolSpec,
    targetSpec: ProtocolSpec,
    cachedMappings: FieldMapping[]
  ): string {
    return `
You are a protocol translation expert. Translate the following agent representation
from ${sourceSpec.name} to ${targetSpec.name} format.

## Source Protocol Specification (${sourceSpec.name})
\`\`\`json
${JSON.stringify(sourceSpec.schema, null, 2)}
\`\`\`

## Target Protocol Specification (${targetSpec.name})
\`\`\`json
${JSON.stringify(targetSpec.schema, null, 2)}
\`\`\`

## Known Field Mappings (from previous translations)
${cachedMappings.map(m => `- ${m.source} → ${m.target}`).join('\n')}

## Source Agent Data
\`\`\`json
${JSON.stringify(source, null, 2)}
\`\`\`

## Instructions
1. Map each field from source to the semantically equivalent field in target
2. Preserve all data - use extensions for unmappable fields
3. Report confidence for each mapping decision
4. Flag any fields that cannot be represented in target format

## Response Format
Return JSON with:
- result: The translated agent in target format
- fieldMappings: Array of {source, target, confidence} for each field
- confidence: Overall translation confidence (0.0-1.0)
- warnings: Any issues or lossy translations
`;
  }
}
```

### Protocol Registry Implementation

```typescript
/**
 * Protocol Specification Registry Implementation
 */
export class ProtocolRegistryImpl implements ProtocolRegistry {
  private specs: Map<ProtocolId, ProtocolSpec> = new Map();
  private loader: SpecLoader;

  constructor(loader: SpecLoader) {
    this.loader = loader;
    this.initializeBuiltInProtocols();
  }

  /**
   * Initialize built-in protocol specifications
   */
  private initializeBuiltInProtocols(): void {
    // SemanticAgent (Internal - Chrysalis native format)
    this.specs.set('usa', {
      id: 'usa',
      name: 'Uniform Semantic Agent',
      specUrl: 'internal://chrysalis/usa/v2.0',
      schema: USA_SCHEMA_V2,
      version: { major: 2, minor: 0, patch: 0 },
      trustLevel: 'internal',
      lastFetched: new Date(),
      cacheTtl: Infinity  // Internal spec never expires
    });

    // MCP (Anthropic Model Context Protocol)
    this.register('mcp', {
      id: 'mcp',
      name: 'Model Context Protocol',
      specUrl: 'https://spec.modelcontextprotocol.io/specification.json',
      version: { major: 2024, minor: 11, patch: 5 },
      trustLevel: 'verified',
      cacheTtl: 86400  // 24 hours
    });

    // A2A (Google Agent-to-Agent Protocol)
    this.register('a2a', {
      id: 'a2a',
      name: 'Agent-to-Agent Protocol',
      specUrl: 'https://google.github.io/A2A/specification/json-schema.json',
      version: { major: 1, minor: 0, patch: 0 },
      trustLevel: 'verified',
      cacheTtl: 86400
    });

    // ANP (Agent Network Protocol)
    this.register('anp', {
      id: 'anp',
      name: 'Agent Network Protocol',
      specUrl: 'https://agent-network-protocol.org/spec/v1/schema.json',
      version: { major: 1, minor: 0, patch: 0 },
      trustLevel: 'experimental',
      cacheTtl: 43200  // 12 hours for experimental
    });

    // LMOS (Eclipse LMOS)
    this.register('lmos', {
      id: 'lmos',
      name: 'Eclipse LMOS',
      specUrl: 'https://eclipse.dev/lmos/api/agent-spec.json',
      version: { major: 0, minor: 9, patch: 0 },
      trustLevel: 'experimental',
      cacheTtl: 43200
    });

    // LangChain
    this.register('langchain', {
      id: 'langchain',
      name: 'LangChain Agent',
      specUrl: 'https://api.python.langchain.com/schemas/agent.json',
      version: { major: 0, minor: 1, patch: 0 },
      trustLevel: 'verified',
      cacheTtl: 86400
    });

    // CrewAI
    this.register('crewai', {
      id: 'crewai',
      name: 'CrewAI Agent',
      specUrl: 'https://docs.crewai.com/api/schemas/agent.json',
      version: { major: 0, minor: 1, patch: 0 },
      trustLevel: 'verified',
      cacheTtl: 86400
    });
  }

  async register(id: ProtocolId, spec: Partial<ProtocolSpec>): Promise<void> {
    // Fetch and parse schema from URL
    const loadedSpec = await this.loader.load(spec.specUrl!);
    
    this.specs.set(id, {
      id,
      name: spec.name || id,
      specUrl: spec.specUrl!,
      schema: loadedSpec.schema,
      version: spec.version || loadedSpec.version,
      trustLevel: spec.trustLevel || 'experimental',
      lastFetched: new Date(),
      cacheTtl: spec.cacheTtl || 43200
    });
  }

  get(id: ProtocolId): ProtocolSpec | undefined {
    return this.specs.get(id);
  }

  async refresh(id: ProtocolId): Promise<void> {
    const existing = this.specs.get(id);
    if (!existing) throw new Error(`Protocol ${id} not registered`);
    
    await this.register(id, existing);
  }

  list(): ProtocolInfo[] {
    return Array.from(this.specs.values()).map(s => ({
      id: s.id,
      name: s.name,
      version: s.version,
      trustLevel: s.trustLevel
    }));
  }
}
```

---

## Migration Strategy

### Phase 1: Create Universal Adapter (Week 1-2)

1. **Implement core interfaces** in `src/adapters/universal/`
2. **Create ProtocolRegistry** with built-in specs
3. **Implement LLMOrchestrator** with basic translation
4. **Add TranslationCache** for performance

### Phase 2: Parallel Operation (Week 3-4)

1. **Wire Universal Adapter** alongside existing adapters
2. **Add feature flag** to switch between implementations
3. **Run comparison tests** to validate translation fidelity
4. **Tune LLM prompts** based on test results

### Phase 3: Gradual Deprecation (Week 5-6)

1. **Mark legacy adapters deprecated** with warnings
2. **Update all imports** to use UniversalAdapter
3. **Document migration path** for external users
4. **Remove feature flag**, default to Universal

### Phase 4: Cleanup (Week 7-8)

1. **Delete deprecated adapter files** (22 → 1)
2. **Update tests** to use Universal Adapter
3. **Update documentation**
4. **Final validation**

---

## Files to Create/Modify

### New Files

```
src/adapters/universal/
├── index.ts                    # Public exports
├── UniversalAdapter.ts         # Main adapter class
├── LLMOrchestrator.ts          # AI translation engine
├── ProtocolRegistry.ts         # Spec registry
├── SpecLoader.ts               # URL spec fetcher
├── TranslationCache.ts         # Mapping cache
├── types.ts                    # Type definitions
└── prompts/
    └── translation.ts          # Prompt templates
```

### Files to Deprecate (Phase 3-4)

```
src/adapters/
├── a2a-unified-adapter.ts      ❌ DEPRECATE
├── adaptation-hooks.ts         ✓ KEEP (hooks are extension points)
├── anp-unified-adapter.ts      ❌ DEPRECATE
├── base-adapter.ts             ❌ DEPRECATE
├── base-unified-adapter.ts     ❌ DEPRECATE
├── CrewAIAdapter.ts            ❌ DEPRECATE
├── ElizaOSAdapter.ts           ❌ DEPRECATE
├── goCryptoClient.ts           ✓ KEEP (crypto utility)
├── langchain-adapter.ts        ❌ DEPRECATE
├── lmos-adapter.ts             ❌ DEPRECATE
├── mcp-adapter.ts              ❌ DEPRECATE
├── mcp-unified-adapter.ts      ❌ DEPRECATE
├── MCPAdapter.ts               ❌ DEPRECATE
├── MultiAgentAdapter.ts        ❌ DEPRECATE
├── OrchestratedAdapter.ts      ❌ DEPRECATE
├── protocol-capabilities.ts    ✓ KEEP (move to registry)
├── protocol-messages.ts        ✓ KEEP (universal types)
├── protocol-registry.ts        ✓ KEEP (integrate into new registry)
├── protocol-types.ts           ✓ KEEP (type definitions)
├── unified-adapter.ts          ❌ DEPRECATE (replaced by Universal)
└── usa-adapter.ts              ❌ DEPRECATE
```

---

## Testing Strategy

### Unit Tests

- Translation fidelity tests for each protocol pair
- Schema validation tests
- Cache hit/miss tests
- LLM response parsing tests

### Integration Tests

- Round-trip translation tests (A → B → A)
- Registry refresh tests
- Multi-protocol translation chains

### Comparison Tests

- Compare Universal Adapter output to legacy adapters
- Measure fidelity delta
- Performance benchmarks

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Adapter count | 22 → 1 |
| Lines of code (adapters) | ~15,000 → ~2,000 |
| Translation fidelity | ≥ 0.95 for verified protocols |
| Time to add new protocol | Days → Minutes (just URL) |
| Maintenance burden | O(N) → O(1) |

---

## References

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [A2A Protocol](https://google.github.io/A2A/)
- [ANP Specification](https://agent-network-protocol.org/)
- [LangChain Agents](https://api.python.langchain.com/)
- [CrewAI Documentation](https://docs.crewai.com/)

---

**Document Owner**: Chrysalis Architecture Team  
**Review Cadence**: On implementation milestones
