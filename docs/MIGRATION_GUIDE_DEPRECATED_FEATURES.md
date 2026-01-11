# Migration Guide: Deprecated Feature Removal

**Version:** Bridge Module Code Review Remediation
**Date:** 2026-01-11

This document describes the removal of 6 peripheral features from the bridge module and provides migration guidance for any code that may have depended on them.

---

## Summary of Removed Features

| Feature | Module | Reason for Removal | Migration Path |
|---------|--------|-------------------|----------------|
| `LazyDisposable<T>` | lifecycle.ts | Speculative generality - zero production usages | Use standard async initialization |
| `LogMethod` decorator | logging.ts | Over-engineered - no methods decorated | Use direct logger calls |
| `CorrelationContext` | logging.ts | Not wired into pipeline | Use `createRequestLogger()` |
| `Injectable`/`Inject` | container.ts | Requires unavailable Reflect.metadata | Use explicit dependency injection |
| `BridgePersistenceService` | service-integration.ts | Duplicates TemporalStore functionality | Use `TemporalStore` directly |
| `exhaustiveCheck`/`unreachable` | guards.ts | TypeScript provides this natively | Use `const _: never = x` pattern |

---

## Migration Details

### 1. LazyDisposable → Standard Async Initialization

**Before (removed):**
```typescript
import { LazyDisposable, lazyDisposable } from '@bridge';

const resource = lazyDisposable(() => createExpensiveResource());
const value = await resource.get();
await resource.dispose();
```

**After:**
```typescript
// Use standard async factory pattern
class ResourceManager {
  private resource?: ExpensiveResource;
  
  async get(): Promise<ExpensiveResource> {
    if (!this.resource) {
      this.resource = await createExpensiveResource();
    }
    return this.resource;
  }
  
  async dispose(): Promise<void> {
    if (this.resource) {
      await this.resource.dispose();
      this.resource = undefined;
    }
  }
}
```

### 2. LogMethod Decorator → Direct Logger Calls

**Before (removed):**
```typescript
import { LogMethod } from '@bridge';

class MyService {
  @LogMethod({ level: 'debug' })
  async process(data: Data): Promise<Result> {
    return doWork(data);
  }
}
```

**After:**
```typescript
import { getLogger } from '@bridge';

class MyService {
  private readonly logger = getLogger('MyService');
  
  async process(data: Data): Promise<Result> {
    this.logger.debug('process called', { dataId: data.id });
    const result = await doWork(data);
    this.logger.debug('process completed', { resultId: result.id });
    return result;
  }
}
```

### 3. CorrelationContext → createRequestLogger

**Before (removed):**
```typescript
import { correlationContext } from '@bridge';

const ctx = correlationContext.create({ requestId: 'req-123' });
ctx.run(() => {
  // Logs automatically include correlationId
  logger.info('Processing');
});
```

**After:**
```typescript
import { createRequestLogger } from '@bridge';

const requestLogger = createRequestLogger({ requestId: 'req-123' });
requestLogger.info('Processing'); // Includes requestId in metadata
```

### 4. Injectable/Inject → Explicit Dependency Injection

**Before (removed):**
```typescript
import { Injectable, Inject } from '@bridge';

@Injectable()
class MyService {
  constructor(@Inject('logger') private logger: Logger) {}
}
```

**After:**
```typescript
// Use explicit constructor injection
class MyService {
  constructor(private readonly logger: Logger) {}
}

// At composition root
const logger = getLogger('MyService');
const service = new MyService(logger);
```

### 5. BridgePersistenceService → TemporalStore

**Before (removed):**
```typescript
import { BridgePersistenceService } from '@bridge/service-integration';

const persistence = new BridgePersistenceService(orchestrator, eventBus);
persistence.storeAgent(uri, agent);
const stored = persistence.getAgent(uri);
const atTime = persistence.getAgentAtTime(uri, timestamp);
```

**After:**
```typescript
import { TemporalStore } from '@bridge/temporal-storage';

const store = new TemporalStore();

// Store with bi-temporal tracking
await store.store({
  uri,
  data: agent,
  validFrom: new Date(),
  recordedAt: new Date(),
});

// Get current version
const current = await store.getCurrent(uri);

// Get version at specific time (bi-temporal query)
const historical = await store.getAtTime(uri, {
  validAt: timestamp,
  recordedAt: timestamp,
});
```

### 6. exhaustiveCheck/unreachable → TypeScript never Pattern

**Before (removed):**
```typescript
import { exhaustiveCheck, unreachable } from '@bridge';

switch (value.type) {
  case 'a': return handleA(value);
  case 'b': return handleB(value);
  default: exhaustiveCheck(value); // or unreachable()
}
```

**After:**
```typescript
switch (value.type) {
  case 'a': return handleA(value);
  case 'b': return handleB(value);
  default:
    // TypeScript's built-in exhaustiveness check
    const _exhaustiveCheck: never = value;
    throw new Error(`Unknown type: ${(value as any).type}`);
}
```

---

## Impact Analysis

### Zero-Impact Removals (No Production Usage Found)

All 6 removed features had **zero production usages** in the codebase:

| Feature | Search Pattern | Results |
|---------|---------------|---------|
| LazyDisposable | `LazyDisposable\|lazyDisposable` | 0 matches |
| LogMethod | `@LogMethod\|LogMethod` | 0 matches |
| CorrelationContext | `CorrelationContext\|correlationContext` | 0 matches |
| Injectable/Inject | `@Injectable\|@Inject\(` | 0 matches |
| exhaustiveCheck/unreachable | `exhaustiveCheck\|unreachable\(` | 0 matches in src/ |

Note: `ui/src/utils/CanvasNodeWrapper.ts` uses a local variable named `exhaustiveCheck` for TypeScript's native exhaustiveness pattern - this is unrelated to the removed function.

### Test Updates

The following test file was updated to remove tests for `BridgePersistenceService`:

- `tests/bridge/service-integration.test.ts`
  - Removed ~300 lines of BridgePersistenceService tests
  - Updated IntegratedBridgeService tests to remove persistence property references
  - Updated healthCheck test expectations

---

## Breaking Changes Summary

```
BREAKING CHANGE: The following exports are no longer available from @bridge:

- Injectable, Inject decorators → use explicit DI
- correlationContext, LogMethod → use direct logger calls  
- LazyDisposable, lazyDisposable → use standard async init
- unreachable, exhaustiveCheck → use TypeScript's never type
- BridgePersistenceService → use TemporalStore
- StoredAgent, AgentVersion, TranslationRecord types → removed
```

---

## Commits

1. **76057f8**: `feat(errors): consolidate error classes with factory method pattern`
2. **1bdf40d**: `refactor(bridge): remove 6 peripheral features`
3. **33368e7**: `refactor(bridge): update exports and tests for deprecated feature removal`

**Total Impact:** ~600 net lines removed (~12% of bridge module)