# Chrysalis Development Plan
**Generated:** January 11, 2026  
**Status:** TypeScript Build Remediation Required

## Executive Summary

This development plan addresses the TypeScript build failures identified during the engineering review. The codebase has **366 TypeScript errors** distributed across several major subsystems. This document provides a prioritized remediation roadmap with clear action items.

---

## 1. Current Build Status

### 1.1 Error Distribution by Category

| Category | Error Count | Priority | Effort |
|----------|-------------|----------|--------|
| React Components (AgentCanvas, Workspace) | 148 | High | Large |
| Terminal Protocols | 56 | High | Medium |
| LLM Services | 45 | Medium | Medium |
| Bridge Infrastructure | 23 | Medium | Small |
| Memory/Learning | 15 | Low | Small |
| Agents/Bridges | 10 | Low | Small |
| Other | 69 | Low | Medium |

### 1.2 Top 10 Files by Error Count

1. `src/components/AgentCanvas/AgentNodeWidget.tsx` (61 errors)
2. `src/terminal/protocols/agent-canvas-manager.ts` (41 errors)
3. `src/components/AgentCanvas/AgentImportMenu.tsx` (40 errors)
4. `src/components/ChrysalisWorkspace/ChatPane.tsx` (37 errors)
5. `src/services/llm/LLMHydrationService.ts` (33 errors)
6. `src/components/AgentCanvas/AgentCanvas.tsx` (32 errors)
7. `src/components/ChrysalisWorkspace/ChrysalisWorkspace.tsx` (18 errors)
8. `src/bridge/guards.ts` (11 errors)
9. `src/components/AgentCanvas/index.ts` (7 errors)
10. `src/terminal/protocols/agent-import-pipeline.ts` (6 errors)

---

## 2. Completed Fixes (This Session)

### 2.1 Voice TTS Providers ✅
**Files fixed:**
- `src/voice/providers/tts/elevenlabs.ts` - Type annotations for JSON responses
- `src/voice/providers/tts/coqui.ts` - voiceId → voiceProfile, durationMs → duration
- `src/voice/providers/tts/browser.ts` - DOM type declarations, VoiceProfile fixes
- `src/voice/providers/tts/base.ts` - Added isInitialized(), getStreamingAudio()
- `src/voice/providers/tts/index.ts` - Config type fixes

### 2.2 Voice STT Providers ✅
**Files fixed:**
- `src/voice/providers/stt/browser.ts` - Added timestamp to PartialTranscript
- `src/voice/providers/stt/base.ts` - Config type flexibility
- `src/voice/providers/stt/index.ts` - Provider factory patterns

### 2.3 Terminal Protocols (Partial) ✅
**Files fixed:**
- `src/terminal/protocols/agent-canvas.ts`:
  - Extended `DataResourceType` union with: api, database, vector_db, file_storage, knowledge_base
  - Added `resourceId` to `DataResourceLink` interface
  - Added `createCanvasAgent()` factory function
  - Added `AGENT_CANVAS_CONSTANTS` object
  - Extended `DATA_RESOURCE_ICONS` mapping

### 2.4 Build Configuration ✅
**Changes:**
- `tsconfig.json`: Updated target to ES2022, added shared/ to include, fixed rootDir

### 2.5 Dependencies ✅
**Installed:**
- `@types/jsonwebtoken` - For shared/api-core/src/auth.ts
- `reflect-metadata` - For bridge/container.ts decorators

### 2.6 Bridge Index Exports ✅
**Fixed:**
- `src/bridge/index.ts`: Aligned exports with actual module implementations
  - Corrected validation exports (SchemaBuilder, Validator, etc.)
  - Corrected container exports (createDefaultContainer, getGlobalContainer, etc.)
  - Corrected error exports (all specialized error classes)

---

## 3. Remediation Roadmap

### Phase 1: Critical Infrastructure (Week 1)

#### 3.1.1 Bridge Module Fixes
**Priority:** High  
**Estimated Time:** 4-6 hours

| File | Issues | Fix Strategy |
|------|--------|--------------|
| `guards.ts` (11 errors) | `field` property missing in `ValidationErrorDetail` | Add `field` property to interface or use existing `path` |
| `errors.ts` (4 errors) | Readonly `code` property assignment, timestamp type | Remove code reassignment, make timestamp non-optional |
| `container.ts` (6 errors) | Generic variance issues, Reflect.metadata | Add proper type assertions, import reflect-metadata |
| `lifecycle.ts` (2 errors) | Possibly undefined function invocation | Add null checks |

**Action Items:**
```typescript
// guards.ts - Add 'field' alias or rename to 'path'
interface ValidationErrorDetail {
  path: string;
  field?: string;  // Add this for compatibility
  code: string;
  message: string;
}

// errors.ts - Fix code property (lines 292, 309, 339)
// Change from: this.code = ErrorCode.SCHEMA_INVALID;
// To: Object.defineProperty(this, 'code', { value: ErrorCode.SCHEMA_INVALID, writable: false });

// container.ts - Add at top of file:
import 'reflect-metadata';
```

#### 3.1.2 Terminal Protocols Completion
**Priority:** High  
**Estimated Time:** 8-12 hours

| File | Errors | Root Cause |
|------|--------|------------|
| `agent-canvas-manager.ts` (41) | Missing imports, interface mismatches | Interface alignment |
| `agent-import-pipeline.ts` (6) | createCanvasAgent signature | Already partially fixed |
| `agent-lifecycle-manager.ts` (5) | AgentSpecSummary properties | Add identity, memory, _import_metadata |

**Action Items:**
1. Add missing properties to `AgentSpecSummary`:
```typescript
interface AgentSpecSummary {
  // ... existing properties
  identity?: {
    role: string;
    goal: string;
    backstory?: string;
  };
  memory?: MemoryTierConfig;
  _import_metadata?: Record<string, unknown>;
}
```

2. Fix `createCanvasAgent` function signature to match expected parameters

### Phase 2: React Components (Week 2)

#### 3.2.1 AgentCanvas Component Suite
**Priority:** High  
**Estimated Time:** 16-20 hours

| File | Errors | Root Cause |
|------|--------|------------|
| `AgentNodeWidget.tsx` (61) | Props interface mismatches, missing types | Type alignment with agent-canvas.ts |
| `AgentImportMenu.tsx` (40) | Import pipeline types | Needs ImportResult, ImportPipelineConfig types |
| `AgentCanvas.tsx` (32) | State management types | Canvas state type mismatches |
| `index.ts` (7) | Re-export issues | Fix barrel file exports |

**Remediation Strategy:**
1. Create a shared types file: `src/components/AgentCanvas/types.ts`
2. Align component props with `agent-canvas.ts` definitions
3. Fix state management type annotations
4. Update barrel exports

#### 3.2.2 Workspace Components
**Priority:** Medium  
**Estimated Time:** 12-16 hours

| File | Errors | Root Cause |
|------|--------|------------|
| `ChatPane.tsx` (37) | Memory types, AgentTerminalClient | Missing chat method |
| `ChrysalisWorkspace.tsx` (18) | Service integration types | Type mismatches |

**Remediation Strategy:**
1. Add `chat` method to `AgentTerminalClient` interface
2. Fix Memory type union to include `summary` property
3. Align service interfaces

### Phase 3: Services Layer (Week 3)

#### 3.3.1 LLM Services
**Priority:** Medium  
**Estimated Time:** 8-12 hours

| File | Errors | Root Cause |
|------|--------|------------|
| `LLMHydrationService.ts` (33) | Provider config types | ProviderConfig[] vs object mismatch |
| `AgentLLMClient.ts` (6) | CompletionRequest interface | Missing agentId |
| `index.ts` (2) | Re-export issues | Barrel file fixes |

**Fix Pattern:**
```typescript
// Fix ProviderConfig type
interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
}

// Change from object to array or update interface
type ProviderConfigs = ProviderConfig[] | Record<string, ProviderConfig>;

// Fix CompletionRequest
interface CompletionRequest {
  agentId: string;  // Add this
  messages: Message[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}
```

#### 3.3.2 Agent Chat Integration
**Priority:** Medium  
**Estimated Time:** 4-6 hours

| File | Errors | Root Cause |
|------|--------|------------|
| `AgentChatIntegration.ts` (6) | Service dependencies | Missing method signatures |

### Phase 4: Supporting Systems (Week 4)

#### 3.4.1 Memory Persistence
**Estimated Time:** 4 hours

- `src/memory/persistence/index.ts` (4 errors)
- `src/memory/persistence/VectorPersistence.ts` (3 errors)

#### 3.4.2 Learning System
**Estimated Time:** 4 hours

- `src/learning/LegendEmbeddingLoader.ts` (4 errors)
- `src/learning/ConversationMemoryManager.ts` (4 errors)

#### 3.4.3 Agent Bridges
**Estimated Time:** 6 hours

- `src/agents/bridges/DirectLLMBridge.ts` (4 errors) - defaultModel, CompletionRequest
- `src/agents/bridges/ElizaOSBridge.ts` - defaultModel property
- `src/agents/bridges/SerenaBridge.ts` - tools property

---

## 4. Type System Recommendations

### 4.1 Create Central Type Definitions

**Recommended Structure:**
```
src/types/
├── index.ts           # Barrel exports
├── agents.ts          # Agent-related types
├── canvas.ts          # Canvas/UI types
├── memory.ts          # Memory system types
├── llm.ts             # LLM provider types
├── services.ts        # Service interfaces
└── bridge.ts          # Bridge infrastructure types
```

### 4.2 Type Safety Patterns

1. **Use discriminated unions for state:**
```typescript
type AgentState = 
  | { status: 'dormant' }
  | { status: 'waking'; progress: number }
  | { status: 'awake'; sessionId: string }
  | { status: 'error'; error: Error };
```

2. **Prefer explicit over implicit any:**
```typescript
// Bad
const data: any = await response.json();

// Good
const data = await response.json() as ExpectedType;
```

3. **Use type guards for runtime safety:**
```typescript
function isAgentSpecSummary(obj: unknown): obj is AgentSpecSummary {
  return obj !== null 
    && typeof obj === 'object'
    && 'name' in obj
    && 'apiVersion' in obj;
}
```

---

## 5. Testing Strategy

### 5.1 Type-Only Tests
Create type-level tests using `@ts-expect-error`:

```typescript
// __tests__/types.test.ts
import { AgentSpecSummary } from '../src/terminal/protocols/agent-canvas';

// @ts-expect-error - name is required
const invalid: AgentSpecSummary = { apiVersion: 'usa/v2' };

// Valid assignment
const valid: AgentSpecSummary = { 
  apiVersion: 'usa/v2',
  name: 'Test',
  // ... 
};
```

### 5.2 Runtime Validation
Implement runtime type checking for external data:

```typescript
import { z } from 'zod';

const AgentSpecSchema = z.object({
  apiVersion: z.string().startsWith('usa/'),
  name: z.string().min(1),
  // ...
});

function parseAgentSpec(data: unknown): AgentSpecSummary {
  return AgentSpecSchema.parse(data);
}
```

---

## 6. Immediate Actions (Today)

1. **Fix `src/bridge/guards.ts`** - Add `field` property to ValidationErrorDetail
2. **Fix `src/bridge/errors.ts`** - Remove readonly code reassignment
3. **Fix `src/bridge/container.ts`** - Add reflect-metadata import
4. **Update `src/terminal/protocols/agent-canvas.ts`** - Add missing AgentSpecSummary properties

### Quick Fix Script
```bash
# Run these fixes in sequence
cd /home/mdz-axolotl/Documents/GitClones/Chrysalis

# 1. Add reflect-metadata import to container.ts
sed -i '1i import "reflect-metadata";' src/bridge/container.ts

# 2. Build to verify reduced error count
npm run build 2>&1 | grep -c "error TS"
```

---

## 7. Long-Term Architecture Improvements

### 7.1 Modular Build Configuration
Create separate tsconfig files for different subsystems:

```json
// tsconfig.base.json - shared settings
// tsconfig.bridge.json - extends base, src/bridge only
// tsconfig.components.json - extends base, src/components only
// tsconfig.services.json - extends base, src/services only
```

### 7.2 Strict Mode Adoption
Gradually enable stricter TypeScript options:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  }
}
```

### 7.3 API Contract Testing
Implement OpenAPI/JSON Schema validation for external APIs:

1. Generate TypeScript types from OpenAPI specs
2. Validate runtime data against schemas
3. Auto-generate API client code

---

## 8. Success Metrics

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| TypeScript Errors | 366 | 0 | 4 weeks |
| Type Coverage | ~60% | 95% | 6 weeks |
| Build Time | N/A (fails) | <30s | 4 weeks |
| Test Coverage | TBD | 80% | 8 weeks |

---

## 9. Dependencies and Blockers

### Required Dependencies
- [x] `@types/jsonwebtoken` - Installed
- [x] `reflect-metadata` - Installed
- [ ] `zod` - For runtime validation (recommended)
- [ ] `@tanstack/react-query` types - If using React Query

### Potential Blockers
1. **React 19 compatibility** - Some type definitions may need updates
2. **External SDK types** - MCP SDK types may need augmentation
3. **Circular dependencies** - Some module restructuring may be needed

---

## 10. Reference

### Key Files Modified This Session
1. `tsconfig.json`
2. `src/bridge/index.ts`
3. `src/voice/providers/tts/*.ts`
4. `src/voice/providers/stt/*.ts`
5. `src/terminal/protocols/agent-canvas.ts`

### Documentation Resources
- [TypeScript Handbook - Strict Mode](https://www.typescriptlang.org/tsconfig#strict)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
- [Type-Safe Error Handling](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)

---

*This development plan was generated based on the build analysis performed on January 11, 2026.*