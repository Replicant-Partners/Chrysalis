# Chrysalis Development Plan
**Generated: 2026-01-11**
**Status: Build In Progress**

## Executive Summary

This development plan addresses the current state of the Chrysalis repository following a comprehensive documentation review and initial build remediation efforts. The project is a Uniform Semantic Agent (USA) transformation system with voice, memory, and multi-agent orchestration capabilities.

## Current Build Status

### Fixed Issues ✅
1. **Voice TTS Providers** - All errors resolved:
   - `elevenlabs.ts` - Type annotations for JSON responses
   - `coqui.ts` - voiceId → voiceProfile?.voiceId, durationMs → duration, VoiceProfile properties
   - `browser.ts` - DOM types, voiceProfile access, duration format
   - `base.ts` - isInitialized() method, getStreamingAudio() generator
   - `index.ts` - Config type adjustments

2. **Voice STT Providers** - All errors resolved:
   - `browser.ts` - timestamp property in PartialTranscript
   - `base.ts` - Config type flexibility
   - `index.ts` - Provider factory patterns

### Remaining Build Errors ⚠️

The following errors in `src/terminal/protocols/` require architectural attention:

#### agent-canvas.ts (Type Compatibility)
- Type predicates need adjustment for CanvasState/AgentCanvasState
- AgentNodeWidgetProps needs index signature
- AgentCanvasMetadata type conversion issues

#### agent-import-pipeline.ts (Missing Exports)
- Missing exports: `createCanvasAgent`, `AGENT_CANVAS_CONSTANTS`
- Property access on empty objects: `all`, `chat`

#### agent-lifecycle-manager.ts (Type Definitions)
- Missing properties on `CanvasAgent`: `name`
- Missing properties on `AgentSpecSummary`: `identity`, `memory`, `_import_metadata`

#### data-resource-connector.ts (Type Union Mismatch)
- `DataResourceType` enum missing values: `api`, `database`, `vector_db`, `file_storage`, `knowledge_base`
- `DataResourceLink` missing `resourceId` property

## Phase 1: Stabilization (Immediate - 1 week)

### 1.1 Complete Build Fix
- [ ] Add missing exports to agent-canvas.ts
- [ ] Extend DataResourceType enum to include all resource types
- [ ] Add missing properties to AgentSpecSummary interface
- [ ] Fix type predicate issues with proper type guards

### 1.2 Test Suite Remediation
- [ ] Fix Python test collection errors in memory_system/tests/
- [ ] Address Jest timeout issues in a2a-client tests
- [ ] Ensure core unit tests pass

### 1.3 Documentation Alignment
- [ ] Update IMPLEMENTATION_STATUS.md with accurate component statuses
- [ ] Remove or archive outdated documentation
- [ ] Add API documentation for voice providers

## Phase 2: Core Functionality (2-4 weeks)

### 2.1 Memory System Enhancement
**Priority: High**
- Memory validation with Byzantine resistance
- CRDT-based memory merging
- Embedding service singleton pattern

**Files:**
- `memory_system/byzantine.py`
- `memory_system/crdt_merge.py`
- `memory_system/embedding/singleton.py`

### 2.2 Voice Integration Completion
**Priority: High**
- Complete voice cloning workflow
- VAD (Voice Activity Detection) improvements
- Elder-specific speech pattern recognition

**Files:**
- `src/voice/providers/tts/*.ts`
- `src/voice/providers/stt/*.ts`

### 2.3 Agent Canvas System
**Priority: Medium**
- Canvas agent lifecycle management
- Data resource connector patterns
- Agent import/export pipeline

**Files:**
- `src/terminal/protocols/agent-canvas.ts`
- `src/terminal/protocols/agent-lifecycle-manager.ts`
- `src/terminal/protocols/data-resource-connector.ts`

## Phase 3: Feature Development (4-8 weeks)

### 3.1 Elder UX Optimization
**Priority: High (per project context)**
- Voice interface with elder-specific tuning
- Cognitive load monitoring
- Simplified navigation (3-choice maximum)

### 3.2 Family Features
**Priority: Medium**
- Multi-generational access control
- Family photo sharing workflow
- Caregiver monitoring with consent

### 3.3 Knowledge Builder
**Priority: Medium**
- Schema.org entity resolution
- Cost-aware search orchestration
- Knowledge deepening cycles

## Phase 4: Quality & Security (Ongoing)

### 4.1 Security Hardening
- [ ] PII detection and redaction (MemorySanitizer)
- [ ] Threshold cryptography implementation
- [ ] Consent management for voice cloning

### 4.2 Test Coverage
- Target: 70% line coverage
- Focus areas: Memory system, Voice providers, Agent canvas

### 4.3 Performance Optimization
- Embedding cache optimization
- Provider fallback latency reduction
- Memory query performance

## Technical Debt Items

| Item | Priority | Effort | Impact |
|------|----------|--------|--------|
| DataResourceType enum incomplete | Critical | Low | Blocks build |
| Missing canvas exports | Critical | Low | Blocks build |
| Type predicate refinement | High | Medium | Type safety |
| Jest test timeouts | Medium | Low | CI/CD |
| Python test fixtures | Medium | Medium | Test reliability |
| Documentation staleness | Low | Medium | Developer experience |

## Risk Assessment

### High Risk
- **Type System Drift**: Multiple type definition mismatches indicate possible refactoring incomplete
- **Provider Integration**: External API dependencies (ElevenLabs, OpenAI) need error handling

### Medium Risk
- **Test Brittleness**: Timeout issues suggest async handling problems
- **Memory System Complexity**: Byzantine/CRDT patterns require careful validation

### Low Risk
- **Documentation**: Can be updated incrementally
- **Voice Providers**: Browser fallbacks provide resilience

## Success Metrics

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| Build Success | ❌ | ✅ | 1 week |
| Test Pass Rate | ~60% | 90%+ | 2 weeks |
| Documentation Coverage | 40% | 80% | 4 weeks |
| Type Coverage | 85% | 100% | 4 weeks |

## Recommended Immediate Actions

1. **Fix DataResourceType enum** - Add missing type literals
2. **Export canvas constants** - Add missing exports to agent-canvas.ts
3. **Type interface completion** - Add missing properties to AgentSpecSummary
4. **Run test suite** - Identify and fix failing tests
5. **Create .env.example** - Document required environment variables

## Resource Requirements

- **Development**: 1-2 engineers for build stabilization
- **Review**: Architecture review for type system alignment
- **Testing**: QA pass for voice and memory features

---

*This plan is based on build output analysis from 2026-01-11 and should be updated as issues are resolved.*