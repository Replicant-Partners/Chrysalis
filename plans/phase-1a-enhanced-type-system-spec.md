# Phase 1A: Enhanced Type System and Protocol Abstraction Layer

**Document Version:** 1.0  
**Based on:** [`chrysalis-integration-platform-implementation-plan.md`](chrysalis-integration-platform-implementation-plan.md)  
**Date:** January 11, 2026  
**Status:** Engineering Specification - Ready for Implementation

---

## Executive Summary

This document specifies the Phase 1A implementation scope for the Chrysalis Integration Platform, focusing on:
1. Enhanced type system with protocol-agnostic message structures
2. Protocol Version Registry with semantic versioning
3. Adapter abstraction layer unifying RDF-based and USA-based patterns
4. Backward compatibility preservation for existing adapters

---

## 1. Current Architecture Analysis

### 1.1 Two Adapter Patterns Identified

The Chrysalis codebase currently implements **two distinct adapter patterns**:

#### Pattern A: RDF-Based Adapters

**Base Class:** [`src/adapters/base-adapter.ts`](../src/adapters/base-adapter.ts:252) - `BaseAdapter`

```typescript
// Current interface
abstract class BaseAdapter {
  abstract readonly framework: AgentFramework;
  abstract toCanonical(native: NativeAgent): Promise<CanonicalAgent>;
  abstract fromCanonical(canonical: CanonicalAgent): Promise<NativeAgent>;
  abstract validateNative(native: NativeAgent): ValidationResult;
  abstract getFieldMappings(): FieldMapping[];
}
```

**Implementations:**
- [`mcp-adapter.ts`](../src/adapters/mcp-adapter.ts) - Full RDF translation
- [`langchain-adapter.ts`](../src/adapters/langchain-adapter.ts) - Full RDF translation

**Canonical Format:** RDF Quads with Chrysalis ontology

#### Pattern B: USA-Based Adapters

**Base Class:** [`src/core/FrameworkAdapter.ts`](../src/core/FrameworkAdapter.ts) / `FrameworkAdapterV2`

```typescript
// Current interface
abstract class FrameworkAdapter {
  abstract toUniversal(native: T): Promise<UniformSemanticAgent>;
  abstract fromUniversal(universal: UniformSemanticAgent): Promise<T>;
  abstract embedShadow(native: T, shadow: EncryptedShadow): Promise<T>;
  abstract extractShadow(native: T): Promise<EncryptedShadow | null>;
  abstract validate(native: T): Promise<ValidationResult>;
}
```

**Implementations:**
- [`MCPAdapter.ts`](../src/adapters/MCPAdapter.ts) - Cline/Roo style MCP
- [`CrewAIAdapter.ts`](../src/adapters/CrewAIAdapter.ts) - CrewAI role-playing

**Canonical Format:** UniformSemanticAgentV2

### 1.2 Current Type Definitions

**AgentFramework enum** (in `base-adapter.ts`):
```typescript
export type AgentFramework = 
  | 'usa'           // Chrysalis Uniform Semantic Agent
  | 'lmos'          // Eclipse LMOS Protocol
  | 'mcp'           // Anthropic Model Context Protocol
  | 'langchain'     // LangChain Agent
  | 'openai'        // OpenAI Function Calling
  | 'autogpt'       // AutoGPT
  | 'semantic-kernel'; // Microsoft Semantic Kernel
```

**Protocols section** (in `UniformSemanticAgentV2.ts`):
```typescript
export interface Protocols {
  mcp?: { enabled: boolean; role: 'client' | 'server' | 'both'; ... };
  a2a?: { enabled: boolean; endpoint: string; agent_card: AgentCard; ... };
  agent_protocol?: { enabled: boolean; endpoint: string; capabilities: string[]; ... };
}
```

---

## 2. Backward Compatibility Requirements

### 2.1 Non-Breaking Changes

| Requirement | Approach | Risk |
|-------------|----------|------|
| Existing adapters must work unchanged | Extend types, don't modify | Low |
| RDF-based adapters continue functioning | BaseAdapter remains stable | Low |
| USA-based adapters continue functioning | FrameworkAdapter remains stable | Low |
| Existing protocol configs preserved | New protocols added alongside | Low |
| Extension mechanisms maintained | ExtensionProperty interface unchanged | Low |

### 2.2 Backward-Compatible Extension Strategy

```typescript
// OLD: Still works
const adapter = new MCPAdapter();
const canonical = await adapter.toCanonical(native);

// NEW: Extended capability
const adapter = new MCPAdapter();
const canonical = await adapter.toCanonical(native);
const a2aAdapter = new A2AAdapter();
const a2aAgent = await a2aAdapter.fromCanonical(canonical); // Cross-protocol!
```

### 2.3 Migration Path

1. **Phase 1A**: Add new types without modifying existing
2. **Phase 1B**: Create unified adapter interface bridging both patterns
3. **Phase 2**: New adapters implement unified interface
4. **Phase 3**: Optional migration of existing adapters (non-breaking)

---

## 3. Enhanced Type System Specification

### 3.1 Extended AgentFramework Type

**File:** `src/adapters/protocol-types.ts` (NEW)

```typescript
/**
 * Extended AgentFramework enumeration supporting all target protocols
 * Backward compatible - existing values preserved
 */
export type AgentFramework = 
  // === Existing (unchanged) ===
  | 'usa'             // Chrysalis Uniform Semantic Agent
  | 'lmos'            // Eclipse LMOS Protocol
  | 'mcp'             // Anthropic Model Context Protocol
  | 'langchain'       // LangChain Agent
  | 'openai'          // OpenAI Function Calling (legacy)
  | 'autogpt'         // AutoGPT
  | 'semantic-kernel' // Microsoft Semantic Kernel
  // === New Protocols ===
  | 'a2a'             // Google Agent2Agent Protocol
  | 'anp'             // Agent Network Protocol
  | 'acp'             // IBM Agent Communication Protocol
  | 'openai-agents'   // OpenAI Agents SDK (new, distinct from 'openai')
  | 'crewai'          // CrewAI (explicit)
  | 'autogen'         // Microsoft AutoGen
  | 'agntcy';         // AGNTCY Discovery Layer

/**
 * Protocol family groupings for capability matching
 */
export type ProtocolFamily = 
  | 'tool-protocol'        // MCP, OpenAI function calling
  | 'coordination-protocol' // A2A, AGNTCY
  | 'identity-protocol'    // ANP
  | 'enterprise-protocol'  // ACP, LMOS
  | 'orchestration-framework'; // LangChain, CrewAI, AutoGen

/**
 * Map frameworks to their protocol families
 */
export const PROTOCOL_FAMILIES: Record<AgentFramework, ProtocolFamily> = {
  usa: 'orchestration-framework',
  lmos: 'enterprise-protocol',
  mcp: 'tool-protocol',
  langchain: 'orchestration-framework',
  openai: 'tool-protocol',
  autogpt: 'orchestration-framework',
  'semantic-kernel': 'orchestration-framework',
  a2a: 'coordination-protocol',
  anp: 'identity-protocol',
  acp: 'enterprise-protocol',
  'openai-agents': 'tool-protocol',
  crewai: 'orchestration-framework',
  autogen: 'orchestration-framework',
  agntcy: 'coordination-protocol'
};
```

### 3.2 Protocol-Agnostic Message Structures

**File:** `src/adapters/protocol-messages.ts` (NEW)

```typescript
/**
 * Universal message envelope for cross-protocol communication
 */
export interface UniversalMessage {
  /** Unique message identifier */
  messageId: string;
  /** Correlation ID for request-response matching */
  correlationId?: string;
  /** Message timestamp (ISO 8601) */
  timestamp: string;
  /** Source protocol */
  sourceProtocol: AgentFramework;
  /** Target protocol (if known) */
  targetProtocol?: AgentFramework;
  /** Message type */
  type: UniversalMessageType;
  /** Message payload */
  payload: UniversalPayload;
  /** Protocol-specific headers */
  headers?: Record<string, string>;
  /** Tracing context */
  trace?: TraceContext;
}

export type UniversalMessageType = 
  | 'agent-card'           // Capability advertisement
  | 'task-request'         // Task delegation
  | 'task-response'        // Task result
  | 'task-status'          // Status update
  | 'tool-invoke'          // Tool invocation
  | 'tool-result'          // Tool result
  | 'resource-request'     // Resource access
  | 'resource-response'    // Resource content
  | 'discovery-query'      // Agent discovery
  | 'discovery-response'   // Discovery results
  | 'identity-verify'      // Identity verification
  | 'error';               // Error message

/**
 * Universal payload supporting all message types
 */
export interface UniversalPayload {
  /** Agent identity (if applicable) */
  agent?: UniversalAgentRef;
  /** Task information (if applicable) */
  task?: UniversalTaskRef;
  /** Tool invocation (if applicable) */
  tool?: UniversalToolInvoke;
  /** Resource reference (if applicable) */
  resource?: UniversalResourceRef;
  /** Discovery query (if applicable) */
  discovery?: UniversalDiscoveryQuery;
  /** Error information (if applicable) */
  error?: UniversalError;
  /** Raw protocol-specific data (preserved for fidelity) */
  raw?: Record<string, unknown>;
}

/**
 * Universal agent reference
 */
export interface UniversalAgentRef {
  /** Protocol-specific identifier */
  protocolId: string;
  /** Protocol type */
  protocol: AgentFramework;
  /** Human-readable name */
  name: string;
  /** W3C DID (if available, from ANP) */
  did?: string;
  /** Chrysalis fingerprint (if available) */
  chrysalisFingerprint?: string;
  /** Endpoint URL */
  endpoint?: string;
  /** Capabilities */
  capabilities?: string[];
}

/**
 * Universal task reference (A2A-inspired)
 */
export interface UniversalTaskRef {
  taskId: string;
  state: UniversalTaskState;
  description?: string;
  input?: UniversalMessagePart[];
  output?: UniversalMessagePart[];
  artifacts?: UniversalArtifact[];
}

export type UniversalTaskState = 
  | 'pending'
  | 'running'
  | 'input-required'
  | 'completed'
  | 'failed'
  | 'canceled';

/**
 * Universal message part (multi-modal support)
 */
export interface UniversalMessagePart {
  type: 'text' | 'image' | 'file' | 'data';
  content?: string;
  uri?: string;
  mimeType?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Universal tool invocation
 */
export interface UniversalToolInvoke {
  toolName: string;
  toolProtocol: AgentFramework; // mcp, openai-agents, etc.
  parameters: Record<string, unknown>;
  schema?: Record<string, unknown>;
  result?: unknown;
  error?: UniversalError;
}

/**
 * Universal error format
 */
export interface UniversalError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
  sourceProtocol?: AgentFramework;
}

/**
 * Trace context for observability
 */
export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  baggage?: Record<string, string>;
}
```

### 3.3 Protocol Capability Declaration

**File:** `src/adapters/protocol-capabilities.ts` (NEW)

```typescript
/**
 * Protocol capability declaration
 */
export interface ProtocolCapability {
  /** Protocol identifier */
  protocol: AgentFramework;
  /** Protocol version supported */
  version: string;
  /** Capability level */
  level: CapabilityLevel;
  /** Specific features supported */
  features: ProtocolFeature[];
  /** Known limitations */
  limitations?: string[];
}

export type CapabilityLevel = 
  | 'full'        // Complete protocol implementation
  | 'partial'     // Subset of protocol features
  | 'read-only'   // Can consume but not produce
  | 'experimental'; // Unstable implementation

export type ProtocolFeature = 
  // Discovery & Identity
  | 'agent-discovery'
  | 'capability-advertisement'
  | 'identity-verification'
  | 'did-resolution'
  // Task Management
  | 'task-delegation'
  | 'task-streaming'
  | 'task-cancellation'
  | 'multi-turn-conversation'
  // Tool & Resource Access
  | 'tool-invocation'
  | 'resource-access'
  | 'prompt-templates'
  | 'schema-validation'
  // Communication Patterns
  | 'synchronous-request'
  | 'asynchronous-callback'
  | 'server-sent-events'
  | 'websocket-streaming'
  // Security & Auth
  | 'oauth2-authentication'
  | 'jwt-authentication'
  | 'api-key-authentication'
  | 'did-authentication'
  // Advanced
  | 'capability-negotiation'
  | 'protocol-translation'
  | 'experience-sync';

/**
 * Feature compatibility matrix entry
 */
export interface FeatureCompatibility {
  sourceProtocol: AgentFramework;
  targetProtocol: AgentFramework;
  feature: ProtocolFeature;
  compatibility: 'native' | 'translated' | 'unsupported';
  translationFidelity?: number; // 0.0 - 1.0
  notes?: string;
}
```

---

## 4. Protocol Version Registry Specification

### 4.1 Registry Structure

**File:** `src/adapters/protocol-registry.ts` (NEW)

```typescript
/**
 * Protocol Version Registry
 * Manages protocol versions, compatibility, and health
 */
export interface ProtocolVersionRegistry {
  /**
   * Register a new protocol version
   */
  registerVersion(
    protocol: AgentFramework,
    version: ProtocolVersionInfo
  ): void;
  
  /**
   * Get supported versions for a protocol
   */
  getSupportedVersions(protocol: AgentFramework): ProtocolVersionInfo[];
  
  /**
   * Get latest stable version
   */
  getLatestStable(protocol: AgentFramework): ProtocolVersionInfo | null;
  
  /**
   * Check version compatibility
   */
  isCompatible(
    protocol: AgentFramework,
    requiredVersion: string,
    actualVersion: string
  ): VersionCompatibility;
  
  /**
   * Get deprecation warnings
   */
  getDeprecationWarnings(
    protocol: AgentFramework,
    version: string
  ): DeprecationWarning[];
}

/**
 * Protocol version information
 */
export interface ProtocolVersionInfo {
  /** Semantic version string */
  version: string;
  /** Release date */
  releaseDate: string;
  /** Version status */
  status: VersionStatus;
  /** SDK/implementation version */
  sdkVersion?: string;
  /** Minimum compatible Chrysalis adapter version */
  minAdapterVersion: string;
  /** Breaking changes from previous version */
  breakingChanges?: string[];
  /** New features in this version */
  newFeatures?: string[];
  /** Deprecation date (if applicable) */
  deprecationDate?: string;
  /** End of life date (if applicable) */
  eolDate?: string;
}

export type VersionStatus = 
  | 'stable'
  | 'beta'
  | 'alpha'
  | 'deprecated'
  | 'eol'; // End of Life

/**
 * Version compatibility result
 */
export interface VersionCompatibility {
  compatible: boolean;
  level: 'exact' | 'minor' | 'major' | 'incompatible';
  warnings: string[];
  migrationPath?: string[];
}

/**
 * Deprecation warning
 */
export interface DeprecationWarning {
  feature: string;
  deprecatedIn: string;
  removedIn?: string;
  replacement?: string;
  migrationGuide?: string;
}
```

### 4.2 Initial Registry Data

```typescript
/**
 * Initial protocol versions (January 2026)
 */
export const INITIAL_PROTOCOL_VERSIONS: Record<AgentFramework, ProtocolVersionInfo[]> = {
  mcp: [
    {
      version: '1.0.0',
      releaseDate: '2024-11-01',
      status: 'stable',
      sdkVersion: 'python-sdk-1.0.0',
      minAdapterVersion: '1.0.0',
      newFeatures: ['tools', 'resources', 'prompts', 'sampling']
    }
  ],
  a2a: [
    {
      version: '1.0.0',
      releaseDate: '2025-04-09',
      status: 'stable',
      sdkVersion: 'a2a-python-1.0.0',
      minAdapterVersion: '1.0.0',
      newFeatures: ['agent-card', 'task-lifecycle', 'streaming', 'push-notifications']
    }
  ],
  anp: [
    {
      version: '0.9.0',
      releaseDate: '2025-06-01',
      status: 'beta',
      minAdapterVersion: '1.0.0',
      newFeatures: ['did-wba', 'meta-protocol', 'capability-discovery'],
      breakingChanges: ['Specification still evolving']
    }
  ],
  acp: [
    {
      version: '1.0.0',
      releaseDate: '2025-08-01',
      status: 'beta',
      sdkVersion: 'beeai-1.0.0',
      minAdapterVersion: '1.0.0',
      newFeatures: ['enterprise-messaging', 'audit-logging']
    }
  ],
  'openai-agents': [
    {
      version: '1.0.0',
      releaseDate: '2025-03-11',
      status: 'stable',
      sdkVersion: 'openai-agents-python-0.0.7',
      minAdapterVersion: '1.0.0',
      newFeatures: ['handoffs', 'guardrails', 'tracing']
    }
  ],
  // ... other protocols
};
```

---

## 5. Unified Adapter Interface

### 5.1 Bridge Interface

**File:** `src/adapters/unified-adapter.ts` (NEW)

```typescript
import { BaseAdapter, NativeAgent, CanonicalAgent } from './base-adapter';
import { FrameworkAdapterV2 } from '../core/FrameworkAdapterV2';
import { UniformSemanticAgentV2 } from '../core/UniformSemanticAgentV2';
import { UniversalMessage } from './protocol-messages';
import { ProtocolCapability, ProtocolFeature } from './protocol-capabilities';

/**
 * Unified Adapter Interface
 * 
 * Bridges RDF-based (BaseAdapter) and USA-based (FrameworkAdapter) patterns
 * while adding cross-protocol communication capabilities.
 */
export interface UnifiedAdapter {
  // === Identity ===
  readonly framework: AgentFramework;
  readonly name: string;
  readonly version: string;
  
  // === Capabilities ===
  getCapabilities(): ProtocolCapability;
  supportsFeature(feature: ProtocolFeature): boolean;
  
  // === Translation (Both Canonical Formats) ===
  
  /** Convert native format to RDF canonical (BaseAdapter pattern) */
  toRdfCanonical?(native: NativeAgent): Promise<CanonicalAgent>;
  
  /** Convert RDF canonical to native format (BaseAdapter pattern) */
  fromRdfCanonical?(canonical: CanonicalAgent): Promise<NativeAgent>;
  
  /** Convert native format to USA canonical (FrameworkAdapter pattern) */
  toUsaCanonical?(native: unknown): Promise<UniformSemanticAgentV2>;
  
  /** Convert USA canonical to native format (FrameworkAdapter pattern) */
  fromUsaCanonical?(usa: UniformSemanticAgentV2): Promise<unknown>;
  
  // === Cross-Protocol Messaging ===
  
  /** Send message to agent using this protocol */
  sendMessage?(message: UniversalMessage): Promise<UniversalMessage>;
  
  /** Receive and translate incoming message */
  receiveMessage?(raw: unknown): Promise<UniversalMessage>;
  
  // === Validation ===
  validateNative(native: unknown): Promise<ValidationResult>;
  
  // === Protocol Health ===
  checkHealth?(): Promise<ProtocolHealth>;
}

/**
 * Protocol health status
 */
export interface ProtocolHealth {
  protocol: AgentFramework;
  available: boolean;
  latencyMs?: number;
  lastCheck: Date;
  errorCount: number;
  consecutiveFailures: number;
  circuitBreakerOpen: boolean;
}

/**
 * Create unified adapter from existing BaseAdapter
 */
export function wrapBaseAdapter(adapter: BaseAdapter): UnifiedAdapter {
  return {
    framework: adapter.framework,
    name: adapter.name,
    version: adapter.version,
    
    getCapabilities: () => ({
      protocol: adapter.framework,
      version: adapter.version,
      level: 'full',
      features: ['tool-invocation', 'resource-access'] // Inferred
    }),
    
    supportsFeature: (feature) => {
      // Map features based on adapter type
      const baseFeatures: ProtocolFeature[] = [
        'tool-invocation', 'resource-access', 'schema-validation'
      ];
      return baseFeatures.includes(feature);
    },
    
    toRdfCanonical: (native) => adapter.toCanonical(native),
    fromRdfCanonical: (canonical) => adapter.fromCanonical(canonical),
    
    validateNative: async (native) => adapter.validateNative(native as NativeAgent)
  };
}

/**
 * Create unified adapter from existing FrameworkAdapterV2
 */
export function wrapFrameworkAdapter<T>(
  adapter: FrameworkAdapterV2,
  framework: AgentFramework
): UnifiedAdapter {
  return {
    framework,
    name: adapter.name,
    version: adapter.version,
    
    getCapabilities: () => ({
      protocol: framework,
      version: adapter.version,
      level: adapter.supports_shadow ? 'full' : 'partial',
      features: ['experience-sync'] // Inferred from shadow support
    }),
    
    supportsFeature: (feature) => {
      if (feature === 'experience-sync') return adapter.supports_experience_sync;
      return false;
    },
    
    toUsaCanonical: (native) => adapter.toUniversal(native as T),
    fromUsaCanonical: (usa) => adapter.fromUniversal(usa),
    
    validateNative: (native) => adapter.validate(native as T)
  };
}
```

---

## 6. Implementation File Structure

```
src/adapters/
├── base-adapter.ts              # UNCHANGED - RDF-based base
├── protocol-types.ts            # NEW - Extended AgentFramework enum
├── protocol-messages.ts         # NEW - Universal message structures
├── protocol-capabilities.ts     # NEW - Capability declarations
├── protocol-registry.ts         # NEW - Version registry
├── unified-adapter.ts           # NEW - Unified interface bridge
├── AdapterOrchestrator.ts       # NEW - Runtime selection
├── adapters/
│   ├── mcp-adapter.ts          # UNCHANGED
│   ├── MCPAdapter.ts           # UNCHANGED
│   ├── langchain-adapter.ts    # UNCHANGED
│   ├── CrewAIAdapter.ts        # UNCHANGED
│   ├── a2a-adapter.ts          # NEW - Phase 2
│   ├── anp-adapter.ts          # NEW - Phase 2
│   ├── acp-adapter.ts          # NEW - Phase 4
│   └── openai-agents-adapter.ts # NEW - Phase 4
└── index.ts                     # Updated exports
```

---

## 7. Implementation Checklist

### Phase 1A Tasks (Code Mode)

- [ ] Create `src/adapters/protocol-types.ts`
  - [ ] Extended `AgentFramework` type
  - [ ] `ProtocolFamily` type and mapping
  - [ ] Export backward-compatible union type
  
- [ ] Create `src/adapters/protocol-messages.ts`
  - [ ] `UniversalMessage` interface
  - [ ] All payload types
  - [ ] `TraceContext` for observability
  
- [ ] Create `src/adapters/protocol-capabilities.ts`
  - [ ] `ProtocolCapability` interface
  - [ ] `ProtocolFeature` enum
  - [ ] `FeatureCompatibility` type
  
- [ ] Create `src/adapters/protocol-registry.ts`
  - [ ] `ProtocolVersionRegistry` interface
  - [ ] `ProtocolVersionInfo` type
  - [ ] `VersionCompatibility` utilities
  - [ ] Initial version data
  
- [ ] Create `src/adapters/unified-adapter.ts`
  - [ ] `UnifiedAdapter` interface
  - [ ] `wrapBaseAdapter()` helper
  - [ ] `wrapFrameworkAdapter()` helper
  
- [ ] Update `src/adapters/index.ts`
  - [ ] Export all new types
  - [ ] Maintain backward compatibility

### Validation Criteria

- [ ] All existing adapter tests pass unchanged
- [ ] New types compile without errors
- [ ] No breaking changes to existing imports
- [ ] TypeScript strict mode compliance
- [ ] Documentation comments on all public interfaces

---

## 8. Test Strategy

### Unit Tests

```typescript
// protocol-types.test.ts
describe('AgentFramework', () => {
  it('should include all legacy frameworks', () => {
    const legacy: AgentFramework[] = ['usa', 'mcp', 'langchain', 'openai'];
    // All should compile
  });
  
  it('should include all new frameworks', () => {
    const newFrameworks: AgentFramework[] = ['a2a', 'anp', 'acp', 'openai-agents'];
    // All should compile
  });
});

// unified-adapter.test.ts
describe('wrapBaseAdapter', () => {
  it('should create unified adapter from MCPAdapter', async () => {
    const mcpAdapter = new MCPAdapter();
    const unified = wrapBaseAdapter(mcpAdapter);
    
    expect(unified.framework).toBe('mcp');
    expect(unified.toRdfCanonical).toBeDefined();
  });
});
```

### Integration Tests

```typescript
// cross-protocol.test.ts
describe('Cross-Protocol Translation', () => {
  it('should translate MCP agent to A2A format', async () => {
    const mcpAdapter = wrapBaseAdapter(new MCPAdapter());
    const a2aAdapter = ...; // After Phase 2
    
    const mcpAgent = { /* MCP server config */ };
    const canonical = await mcpAdapter.toRdfCanonical(mcpAgent);
    const a2aAgent = await a2aAdapter.fromRdfCanonical(canonical);
    
    expect(a2aAgent.name).toBe(mcpAgent.name);
  });
});
```

---

## 9. Next Steps

1. **Switch to Code Mode** to implement Phase 1A
2. **Create files** in order specified above
3. **Run existing tests** to verify no regressions
4. **Add new tests** for type system
5. **Update documentation** in README

---

*Document Version: 1.0*  
*Ready for Implementation*
