# Chrysalis Improvement Implementation Guide

**Quick Reference for Development Team**  
**Based on:** Comprehensive Code Review 2026-01-11  
**Last Updated:** January 11, 2026  

---

## 🚨 Critical Fixes (Do First)

### Fix 1: Browser Compatibility
**File:** `src/a2a-client/a2a-client.ts`  
**Line:** ~700  
**Time:** 30 minutes  

```typescript
// BEFORE (broken in browsers):
const credentials = Buffer.from(`${username}:${password}`).toString('base64');

// AFTER (works everywhere):
const credentials = typeof btoa !== 'undefined'
  ? btoa(`${username}:${password}`)
  : Buffer.from(`${username}:${password}`).toString('base64');
```

**Test:**
```bash
npm test -- --testPathPattern=a2a-client
```

---

### Fix 2: Schema Validation
**Files:** New `src/a2a-client/schemas/`  
**Time:** 2 hours  

**Step 1: Install Zod**
```bash
npm install zod
```

**Step 2: Create Schema File**
```typescript
// src/a2a-client/schemas/stream.schema.ts
import { z } from 'zod';

export const TaskStatusEventSchema = z.object({
  type: z.literal('task.status'),
  status: z.object({
    state: z.enum(['submitted', 'working', 'input-required', 'completed', 'failed', 'canceled']),
    timestamp: z.string().optional(),
    message: z.string().optional()
  })
});

export const DoneEventSchema = z.object({
  type: z.literal('done'),
  task: z.object({
    id: z.string(),
    status: z.object({
      state: z.enum(['submitted', 'working', 'input-required', 'completed', 'failed', 'canceled'])
    })
  })
});

export const StreamEventSchema = z.discriminatedUnion('type', [
  TaskStatusEventSchema,
  // Add other event types...
  DoneEventSchema
]);
```

**Step 3: Update Parser**
```typescript
// In parseStreamEvents method:
import { StreamEventSchema } from './schemas/stream.schema';

const parsed = JSON.parse(line);
const validated = StreamEventSchema.safeParse(parsed);
if (!validated.success) {
  this.log('error', `Invalid event: ${validated.error.message}`);
  this.emitEvent('stream-error', { error: validated.error, raw: line });
  continue;
}
yield validated.data;
```

---

### Fix 3: Session Memory Leak
**File:** `src/a2a-client/a2a-client.ts`  
**Time:** 1 hour  

**Add to class:**
```typescript
private static readonly MAX_SESSIONS = 1000;
private static readonly SESSION_TTL_MS = 24 * 60 * 60 * 1000;
private cleanupTimer?: NodeJS.Timeout;

constructor(config: A2AClientConfig) {
  super();
  // ... existing code ...
  this.startSessionCleanup();
}

private startSessionCleanup(): void {
  this.cleanupTimer = setInterval(() => this.cleanupSessions(), 60 * 60 * 1000);
  this.cleanupTimer.unref?.();
}

private cleanupSessions(): void {
  const now = Date.now();
  for (const [id, session] of this.sessions) {
    if (now - new Date(session.lastActivityAt).getTime() > A2AClient.SESSION_TTL_MS) {
      this.sessions.delete(id);
    }
  }
  // LRU eviction if over limit
  if (this.sessions.size > A2AClient.MAX_SESSIONS) {
    const sorted = [...this.sessions.entries()]
      .sort((a, b) => new Date(a[1].lastActivityAt).getTime() - new Date(b[1].lastActivityAt).getTime());
    sorted.slice(0, this.sessions.size - A2AClient.MAX_SESSIONS)
      .forEach(([id]) => this.sessions.delete(id));
  }
}

disconnect(): void {
  if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  // ... existing code ...
}
```

---

### Fix 4: Error Cause Chain
**File:** `src/a2a-client/a2a-client.ts`  
**Time:** 30 minutes  

```typescript
export class A2AError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly data?: unknown,
    options?: { cause?: Error }
  ) {
    super(message, options);
    this.name = 'A2AError';
    Object.setPrototypeOf(this, A2AError.prototype);
  }

  static from(error: unknown, code?: number): A2AError {
    if (error instanceof A2AError) return error;
    if (error instanceof Error) {
      return new A2AError(
        code ?? A2A_ERROR_CODES.INTERNAL_ERROR,
        error.message,
        undefined,
        { cause: error }
      );
    }
    return new A2AError(code ?? A2A_ERROR_CODES.INTERNAL_ERROR, String(error));
  }
}
```

---

## 📋 Implementation Checklist

### Week 1-2: Critical Fixes
- [ ] Fix Buffer.from() browser compatibility
- [ ] Install and configure Zod
- [ ] Create stream event schemas
- [ ] Integrate schema validation
- [ ] Implement session cleanup
- [ ] Update A2AError with cause chain
- [ ] Add tests for all fixes
- [ ] Update documentation

### Week 3-4: Foundation
- [ ] Create shared HTTP client
- [ ] Implement rate limiter
- [ ] Add security headers to MCP server
- [ ] Configure ESLint + Prettier
- [ ] Set up Husky pre-commit hooks

### Week 5-6: Testing
- [ ] Set up Playwright for E2E
- [ ] Create mock A2A agent fixture
- [ ] Write happy path E2E tests
- [ ] Write error scenario tests
- [ ] Achieve 85% coverage target

---

## 🔧 Development Commands

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- --testPathPattern=a2a-client

# Run E2E tests (after setup)
npm run test:e2e

# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run typecheck
```

---

## 📊 Progress Tracking

### Security Score Target: 95/100

| Issue | Status | Impact |
|-------|--------|--------|
| Buffer.from() | ⬜ TODO | +5 |
| Schema validation | ⬜ TODO | +8 |
| Session leak | ⬜ TODO | +4 |
| Error cause chain | ⬜ TODO | +2 |
| Rate limiting | ⬜ TODO | +3 |
| Security headers | ⬜ TODO | +3 |

Current: 78/100 → Target: 95/100

### Test Coverage Target: 85%

| Module | Current | Target |
|--------|---------|--------|
| a2a-client | 85% | 90% |
| adapters | 72% | 85% |
| mcp-server | 68% | 85% |
| security | 80% | 90% |

---

## 🔗 Quick Links

- [Full Code Review](./COMPREHENSIVE_CODE_REVIEW_2026-01-11.md)
- [Remediation Plan](../plans/CODE_REVIEW_REMEDIATION_PLAN_2026-01-11.md)
- [Work Plan](../plans/COMPREHENSIVE_IMPROVEMENT_WORKPLAN_2026-01-11.md)
- [A2A Client Tests](../src/a2a-client/__tests__/)

---

## 🆘 Getting Help

**Stuck on implementation?**
1. Check the detailed work plan for context
2. Review the code review findings for rationale
3. Ask in #chrysalis-dev Slack channel

**Found a new issue?**
1. Document in GitHub Issues
2. Tag with appropriate priority label
3. Link to relevant code review section

---

*Keep this guide updated as fixes are completed!*
