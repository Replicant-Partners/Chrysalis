# Refactoring and Consolidation Implementation Plan

**Date**: 2026-01-16
**Status**: Draft
**Source**: `docs/architecture/CONSOLIDATION_REPORT_2026-01-16.md`

## 1. Executive Summary

### Objective
The primary objective of this plan is to stabilize the Chrysalis codebase following the aggressive removal of legacy adapter implementations (`BaseAdapter`, `MCPAdapter`, etc.) and to finalize the transition to the semantic, LLM-driven `UniversalAdapter` architecture. This consolidation aims to eliminate technical debt, reduce maintenance surface area, and enable advanced reasoning capabilities via OpenHands tool integration.

### Context
We have successfully deleted 6+ legacy adapter files and updated `src/adapters/index.ts` to export only the new architecture. The codebase is currently in a transitional state where the "Universal Adapter" pattern is the sole supported mechanism for protocol translation, but downstream consumers may still rely on deprecated patterns. The "Algorithmic Reasoner" (Python) has been identified as a critical component for complex workflows but is not yet fully integrated with the TypeScript core.

### Success Criteria
1.  **Build Stability**: The project builds (`npm run build`) with zero errors related to missing adapter imports.
2.  **Test Passing**: The regression test suite (`tests/integration/adapters.test.ts`) passes using the new `UniversalAdapter`.
3.  **Registry Adoption**: All protocol definitions are sourced exclusively from `src/adapters/universal/registry.ts`.
4.  **OpenHands Bridge**: A defined interface exists for the TypeScript adapter to invoke the Python `FlowExecutor`.

## 2. Technical Approach & Architecture

### Pattern Adoption
The `UnifiedAdapter` interface (in `src/adapters/unified-adapter.ts`) will serve as the facade. However, instead of wrapping legacy classes, it will now exclusively wrap `UniversalAdapter`.
*   **Translation**: All `toUniversalMessage` and `fromUniversalMessage` calls will delegate to `UniversalAdapter.translate()`, which uses the LLM and semantic prompts.
*   **Validation**: `validate()` will use `UniversalAdapter.validate()`.

### Registry Integration
Hardcoded protocol logic (e.g., "if protocol === 'mcp' do X") will be replaced by data-driven logic using `PROTOCOL_REGISTRY_V2`.
*   **Semantic Hints**: The adapter will look up `semanticHints` from the registry to determine how to map fields (Identity, Capabilities, etc.) dynamically.
*   **Spec Fetching**: The adapter will use the registry's `specUrl` to fetch schemas on demand (cached), ensuring up-to-date validation.

### OpenHands Integration
The OpenHands "Algorithmic Reasoner" (Python) will be integrated as a "High-Order Reasoning Engine".
*   **Routing**: The `UniversalAdapter` will detect if a task requires complex reasoning (loops, multi-step planning).
*   **Delegation**: If complex, it will serialize the task to a `FlowGraph` (or request one) and send it to the Python `FlowExecutor`.
*   **Bridge**: A lightweight local MCP server or HTTP sidecar will expose the Python engine to the TypeScript environment.

## 3. Phased Implementation Plan

### Phase 1: Stabilization & Cleanup (Immediate Priority)
*Goal: Restore build health and verify basic functionality.*

*   **[High] Fix Index Exports**: Ensure `src/adapters/index.ts` cleanly exports `UniversalAdapter` and related types, with no lingering references to deleted files. (Completed)
*   **[High] Audit Consumers**: Search the codebase for imports from `src/adapters/MCPAdapter` etc., and update them to use `src/adapters/universal/adapter-v2`.
*   **[Medium] Verify Unified Wrapper**: Ensure `createUnifiedAdapter` in `unified-adapter.ts` correctly instantiates `UniversalAdapter` when no legacy adapter is provided.
*   **[Medium] Smoke Test**: Run a manual test of the MCP server to ensure it starts and registers tools.

### Phase 2: V2 Architecture Standardization
*Goal: Enforce the new patterns strictly.*

*   **[High] Registry Enforcement**: Refactor `UniversalAdapter` to throw an error if a protocol is not in `PROTOCOL_REGISTRY_V2`.
*   **[Medium] Prompt Standardization**: Review `prompts-v2.ts` to ensure all prompts utilize the `semanticHints` from the registry effectively.
*   **[Medium] Caching Strategy**: Implement the in-memory `SpecCache` and `MappingCache` fully to prevent excessive LLM calls during development.

### Phase 3: Feature Parity & OpenHands Integration
*Goal: Re-implement missing features and add reasoning.*

*   **[High] Capability Mapping**: Verify that specific features (e.g., "MCP Resources") are correctly mapped by the universal adapter. If the LLM misses them, update `semanticHints` in the registry.
*   **[High] Python Bridge Design**: Design the API contract (JSON-RPC/MCP) for the TypeScript-to-Python bridge.
*   **[Medium] Flow Execution Hook**: Add a method `executeFlow(graph: FlowGraph)` to `UniversalAdapter` that calls the Python bridge.

### Phase 4: Verification & Documentation
*Goal: Prove stability and document the new world.*

*   **[Medium] Regression Suite**: Create a new test file `tests/integration/universal_adapter.test.ts` that specifically tests the V2 adapter against all registered protocols.
*   **[Low] API Documentation**: Generate TypeDoc for `src/adapters/universal/` and update the `README.md`.
*   **[Low] Final Report**: Update `CONSOLIDATION_REPORT` with the results of the integration.

## 4. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
| :--- | :--- | :--- | :--- |
| **Broken Imports** | Build failure in unrelated modules. | High | Run `grep` for deleted filenames across the entire repo immediately. |
| **Loss of Nuance** | Generic LLM translation misses protocol-specific edge cases (e.g., MCP resource subscription). | Medium | Enhance `semanticHints` in `registry.ts` with explicit mapping rules for edge cases. |
| **Performance Regression** | LLM-based translation is slower than hardcoded logic. | High | Enable `SpecCache` and `MappingCache` by default. Implement the Rust "Fast Path" (future). |
| **Python Dependency** | TS environment cannot run Python code easily. | Medium | Containerize the Python engine or use a standard `venv` setup script. |
