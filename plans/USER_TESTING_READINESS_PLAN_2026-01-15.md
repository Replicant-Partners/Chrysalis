# Chrysalis User Testing Readiness Plan

**Date**: January 15, 2026  
**Status**: In Progress  
**Owner**: Engineering Team  
**Version**: 3.1.1

---

## Executive Summary

This plan outlines the phased approach to prepare Chrysalis for user testing and transition to user-driven development. The analysis identified **critical blockers**, **high-priority UX issues**, and **nice-to-have enhancements**.

### Current State

| Domain | Build | Tests | Readiness |
|--------|-------|-------|-----------|
| TypeScript Core | ✅ Passing | 🟡 Partial | 70% |
| Python Memory | ✅ Passing | ✅ 77 tests | 90% |
| UI (React) | ✅ Passing | 🔴 Broken mocks | 50% |
| Backend ↔ UI Integration | 🔴 Missing | 🔴 None | 10% |

---

## Phase 1: Critical Blockers (Week 1)

### ✅ COMPLETED

1. **Install OpenTelemetry Dependencies**
   - Status: ✅ Complete
   - Installed: `@opentelemetry/api`, `@opentelemetry/sdk-trace-base`, `@opentelemetry/sdk-metrics`
   - Result: TypeScript build now passes

2. **Remove @ts-nocheck from Core Files**
   - Status: ✅ Complete
   - Fixed: `src/observability/`, `src/sync/CRDTState.ts`, `src/sync/GossipProtocol.ts`
   - Updated: `tsconfig.json` to re-include these files

3. **Fix UI Test Mocks**
   - Status: 🔄 In Progress
   - Fixed: YJS Doc mock (constructor issue)
   - Fixed: WalletCrypto.isSupported() mock
   - Remaining: EventSource mocks for VoyeurBus

### 🔄 IN PROGRESS

4. **Terminal WebSocket Backend** (3 days)
   - Create WebSocket server endpoint
   - Connect to PTY (pseudo-terminal)
   - Bridge Terminal canvas to backend

5. **VoyeurBus UI Client** (2 days)
   - Implement SSE connection in React
   - Create `useVoyeurEvents()` hook
   - Display events in Observability panel

6. **Error Tracking Integration** (1 day)
   - Sentry client/server setup
   - Error boundaries in UI
   - Session replay (LogRocket/Sentry)

---

## Phase 2: High Priority UX (Week 2)

### User-Facing Improvements

1. **Feedback Infrastructure** (2 days)
   - In-app feedback widget
   - Bug report flow
   - Feature request form

2. **Bundle Size Optimization** (3 days)
   - Code-splitting for canvas components
   - Lazy loading with React.lazy()
   - Target: <600 kB (current: 1,183 kB)

3. **Loading States & Error Messages** (2 days)
   - Skeleton UI components
   - User-friendly error messages
   - Recovery suggestions

4. **Basic Analytics** (1 day)
   - Plausible or PostHog integration
   - Usage pattern tracking
   - No PII collection

---

## Phase 3: Testing Infrastructure (Week 3)

### Test Coverage Improvements

1. **Fix Remaining UI Tests** (1 day)
   - Fix VoyeurBusClient EventSource mocks
   - Verify all 30+ tests pass
   - Run coverage report

2. **Integration Tests** (3 days)
   - Backend ↔ UI integration tests
   - WebSocket connection tests
   - CRDT sync verification

3. **E2E Test Suite** (3 days)
   - Playwright setup
   - Critical user flows:
     - Agent creation and configuration
     - Canvas manipulation
     - Message sending
     - Terminal usage

---

## Phase 4: Polish & Documentation (Week 4)

### User Documentation

1. **Quickstart Guide** (1 day)
   - Non-developer friendly
   - Step-by-step with screenshots
   - Common troubleshooting

2. **Video Tutorials** (2 days)
   - System overview (5 min)
   - Canvas system demo (3 min)
   - Agent configuration (4 min)

3. **FAQ & Troubleshooting** (1 day)
   - Common issues
   - Known limitations
   - Workarounds

### Final Polish

4. **Accessibility Audit** (2 days)
   - WCAG 2.1 AA compliance
   - Keyboard navigation
   - Screen reader testing

5. **Security Hardening** (2 days)
   - Encrypt API keys at rest
   - Secure credential storage
   - Audit logging

---

## Acceptance Criteria for User Testing

### Must Have ✅

- [ ] All builds passing (TS, Python, UI)
- [ ] No @ts-nocheck files in critical paths
- [ ] UI tests 80%+ passing
- [ ] Terminal WebSocket functional
- [ ] VoyeurBus streaming to UI
- [ ] Error tracking active (Sentry)
- [ ] Feedback mechanism in place
- [ ] Basic analytics active
- [ ] User documentation complete

### Should Have 🟡

- [ ] Bundle size <600 kB
- [ ] E2E tests for 3+ critical flows
- [ ] Loading states on all async operations
- [ ] Accessible error messages
- [ ] Session replay enabled

### Nice to Have 🟢

- [ ] Wiki authentication
- [ ] Slash commands
- [ ] Code-splitting complete
- [ ] Video tutorials

---

## Risk Management

| Risk | Impact | Mitigation |
|------|--------|------------|
| Backend/UI integration delays | High | Prioritize Terminal WebSocket in Week 1 |
| Test infrastructure breakage | Medium | Fix mocks immediately, don't defer |
| Bundle size remains high | Medium | Defer if other priorities slip |
| Documentation incomplete | Low | Focus on Quickstart only for MVP |

---

## Success Metrics

### Technical

- TypeScript strict mode: 100% (no @ts-nocheck)
- UI test pass rate: >80%
- Bundle size: <600 kB
- Backend/UI integration: Functional

### User Testing

- User can complete onboarding in <5 minutes
- User can send messages to agent
- User can create and use canvases
- User can report bugs in-app
- Error rate captured in Sentry

---

## Timeline Summary

```
Week 1: Critical Blockers
├─ OpenTelemetry ✅ DONE
├─ TypeScript fixes ✅ DONE
├─ Terminal WebSocket 🔄 IN PROGRESS
├─ VoyeurBus UI 🔄 IN PROGRESS
└─ Error tracking 📋 PLANNED

Week 2: UX Improvements
├─ Feedback widget
├─ Bundle optimization
├─ Loading states
└─ Analytics

Week 3: Testing
├─ Fix UI tests
├─ Integration tests
└─ E2E tests

Week 4: Polish
├─ Documentation
├─ Accessibility
└─ Security
```

---

## Next Steps

### Immediate (This Week)

1. Complete Terminal WebSocket implementation
2. Finish VoyeurBus UI client
3. Fix remaining UI test mocks
4. Install Sentry

### Short-term (Next 2 Weeks)

1. Implement feedback widget
2. Create E2E test suite
3. Write user documentation
4. Bundle size optimization

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [STATUS.md](../docs/STATUS.md) | Current implementation status |
| [NEXT_STEPS_2026-01-15.md](NEXT_STEPS_2026-01-15.md) | Technical next steps |
| [ARCHITECTURE.md](../ARCHITECTURE.md) | System architecture |

---

**Document Owner**: Engineering Team  
**Review Cadence**: Daily standup during user testing prep