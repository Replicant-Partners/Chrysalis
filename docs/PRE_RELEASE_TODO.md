# Pre-Release TODO

> Generated: 2026-01-14
> Status: **Blocking Release**

This document tracks issues that must be addressed before the next release.

---

## Test Failures Requiring Attention

### 1. Component Interaction Tests (`ai-maintenance/__tests__/integration/component-interaction.test.ts`)

These tests have event sequence mismatches indicating the actual behavior has more events than expected.

| Line | Test Name | Issue | Root Cause |
|------|-----------|-------|------------|
| 75 | RepositoryMonitor ↔ SemanticDiffAnalyzer Interaction | Event sequence mismatch | Expected sequence missing `repository-added` event at start |
| 307 | AdapterModificationGenerator ↔ Proposal Validation | Event sequence mismatch | Sequences appear identical - may be false positive or whitespace issue |
| 412 | Pipeline Stage Transitions | Event sequence mismatch | Missing `process-started` event in expected sequence |
| 538 | Full Component Interaction Flow | Event sequence mismatch | Expected sequence is missing multiple intermediate events (validate-started/completed, process-started, multiple stage-transitions, awaiting-review) |
| 748 | Actual Pattern Registry Integration (security pattern) | Confidence threshold | Expected >0.9, received 0.8 |
| 762 | Actual Pattern Registry Integration (schema migration) | Pattern not found | `undefined` returned instead of expected pattern |
| 822 | Event Recording and Audit Trail | Assertion failure | `expect(received).toBe(expected)` returned false |

**Action Required:**
- [ ] Update expected event sequences to match actual (correct) behavior
- [ ] Review confidence scoring for security pattern - should threshold be 0.8 or adjust scoring?
- [ ] Debug why schema migration pattern is returning undefined

---

### 2. Pipeline Integration Tests (`ai-maintenance/__tests__/integration/pipeline.integration.test.ts`)

| Line | Test Name | Issue | Root Cause |
|------|-----------|-------|------------|
| 524 | Schema Migration Pipeline > breaking schema changes | Pattern not found | `pattern-schema-migration` not matching |
| 777 | Real Pattern Registry Integration > security advisory | Confidence threshold | Expected >0.9, received 0.8 |
| 866 | Protocol-Specific Pipeline Scenarios > LangChain update | Impact level mismatch | Expected "significant", received "moderate" |

**Action Required:**
- [ ] Investigate schema migration pattern detection logic
- [ ] Calibrate confidence scores or adjust test expectations
- [ ] Review impact level calculation for LangChain scenarios

---

### 3. A2A Client Tests (`a2a-client/__tests__/phase1-fixes.test.ts`)

| Line | Test Name | Issue | Root Cause |
|------|-----------|-------|------------|
| 366 | A2AClient > session cleanup events | Timeout (5000ms) | Test waiting for `done()` that never fires |
| 378 | A2AClient > stream validation errors | Timeout (5000ms) | Test waiting for `done()` that never fires |

**Action Required:**
- [ ] Review event emission timing in session cleanup
- [ ] Check if stream validation error events are being emitted correctly
- [ ] Consider increasing timeout or fixing async event handling

---

## Analysis

### Pattern: Event Sequence Mismatches

**Why these are happening:**
The actual component behavior emits more events than the tests expect. This suggests:
1. Tests were written against an earlier, simpler implementation
2. Additional instrumentation/events were added during development
3. The tests need updating to reflect the richer event stream

**Recommendation:** Update test expectations rather than removing events from production code - the additional events provide better observability.

### Pattern: Confidence Score Thresholds

**Why these are happening:**
- Tests expect >0.9 confidence but actual scoring returns 0.8
- This 0.1 difference may be intentional (conservative scoring) or a calibration issue

**Recommendation:** 
1. Review the confidence scoring algorithm
2. If 0.8 is correct, lower test threshold to >0.75
3. If 0.9 is correct, adjust heuristic weights

### Pattern: Async Test Timeouts

**Why these are happening:**
- Tests use `done()` callback pattern
- Events may not be firing or tests may have race conditions

**Recommendation:**
1. Convert to async/await pattern where possible
2. Add explicit event listeners before triggering actions
3. Use `jest.useFakeTimers()` for time-dependent tests

---

## Priority Order

1. **HIGH** - A2A Client timeouts (blocking basic functionality testing)
2. **HIGH** - Schema migration pattern not found (core feature broken)
3. **MEDIUM** - Event sequence updates (tests need alignment with code)
4. **LOW** - Confidence threshold calibration (tuning, not broken)

---

## Related Files

- `src/ai-maintenance/__tests__/integration/component-interaction.test.ts`
- `src/ai-maintenance/__tests__/integration/pipeline.integration.test.ts`
- `src/a2a-client/__tests__/phase1-fixes.test.ts`
- `src/ai-maintenance/patterns/registry.ts` (confidence scoring)
- `src/ai-maintenance/patterns/definitions.ts` (pattern definitions)
- `src/a2a-client/a2a/session.ts` (session cleanup events)

---

## Completion Checklist

- [ ] All test failures resolved
- [ ] No regressions introduced
- [ ] CI pipeline passes
- [ ] Code review completed
- [ ] Documentation updated if behavior changed
