# Stub Cleanup & Hidden Code Smell Detection Guide

## Purpose

This guide provides a systematic approach to identifying and removing hidden stubs, placeholders, and code patterns that mask incomplete functionality. These patterns often slip through code reviews because they look "complete" while actually doing nothing.

## Philosophy: Root Cause Debugging

> "We are root cause coders and designers — we ask why and get to the root of the problem and solve it."

When you find a stub:
1. **Ask WHY** the stub exists
2. **Determine** if it's blocking real functionality
3. **Either FIX** the root cause or **EXPLICITLY FLAG** it for future work
4. **NEVER** leave silent stubs that hide bugs

---

## Detection Patterns

### 🔴 HIGH SEVERITY - Fix Immediately

#### Pattern 1: "Fake Success" Returns
Functions that claim success but do nothing.

**Search Query:**
```bash
grep -rn "console.log.*Would" src/
grep -rn 'return.*created|modified' src/
```

**Example:**
```typescript
// BAD: Says it created a branch but didn't
stages.push(await this.executeStep('create-branch', async () => {
  const branchName = `feature-${id}`;
  return `Branch ${branchName} created`;  // LIE - nothing was created
}));
```

**Fix:** Either implement the actual operation or throw `NotImplementedError`.

---

#### Pattern 2: "Trigger Without Action"
Functions named `trigger*`, `send*`, `execute*` that only log.

**Search Query:**
```bash
grep -rn "async.*trigger\|send\|execute" src/ | xargs grep -l "logger\.\(debug\|info\)" | xargs grep -L "await.*http\|fetch\|axios"
```

**Example:**
```typescript
// BAD: Named "trigger" but doesn't trigger anything
private async triggerCheckIn(instanceId: string): Promise<void> {
  logger.debug('Triggering check-in', { instance_id: instanceId });
  // This would send a request to the instance
  // For now, just log
}
```

**Fix:** Implement the HTTP call or rename to `_stubTriggerCheckIn` and add `@deprecated`.

---

#### Pattern 3: Hardcoded URLs/IDs
Fake URLs that will break in production.

**Search Query:**
```bash
grep -rn "github.com/org/repo\|example.com\|localhost:.*hardcode" src/
```

**Example:**
```typescript
// BAD: Hardcoded fake PR URL
pullRequestUrl: this.config.git.createPullRequest
  ? `https://github.com/org/repo/pull/123`  // FAKE!
  : undefined,
```

**Fix:** Generate real URL from git remote or mark as `undefined` with TODO.

---

### 🟡 MEDIUM SEVERITY - Review & Document

#### Pattern 4: "Placeholder Return Arrays"
Methods that return empty arrays with placeholder comments.

**Search Query:**
```bash
grep -rn "return \[\];" src/ | xargs grep -B2 -i "placeholder\|production\|for now"
```

**Example:**
```typescript
// BAD: Entire method is a stub
async getAdaptationEvents(): Promise<AdaptationEvent[]> {
  // In production: Query Memory System
  // Placeholder: Return empty array
  return [];
}
```

**Fix:**
- If blocking: Implement or connect to real data source
- If deferred: Add `@stub` JSDoc tag and TODO comment with issue link

---

#### Pattern 5: "Commented-Out Real Implementation"
The actual code exists but is commented out.

**Search Query:**
```bash
grep -rn "// this\.\w*\.\(on\|emit\|subscribe\)" src/
grep -rn "// await" src/
```

**Example:**
```typescript
// BAD: Real implementation is commented out
startCollecting(): void {
  // this.experienceSyncManager.on('experience_synced', (event) => {
  //     this.handleExperienceEvent(event);
  // });
}
```

**Fix:** Either uncomment and wire up, or remove and document why it's not implemented.

---

#### Pattern 6: "Feature Flag Stubs"
Empty conditional blocks for unimplemented features.

**Search Query:**
```bash
grep -rn "if.*\{" src/ | xargs grep -A1 "// Would\|// TODO"
```

**Example:**
```typescript
// BAD: Feature flag with no implementation
if (config?.compression) {
  // Would decompress batch here
}
```

**Fix:** Implement decompression or remove the config option until implemented.

---

#### Pattern 7: "In Production" Comments
Comments indicating the real implementation is missing.

**Search Query:**
```bash
grep -rn "// In production\|// In real implementation\|// For now" src/
```

**Example:**
```typescript
// In real implementation, would query registry or upstream
// For now, return reasonable defaults
return ['1.0.0', '1.1.0'];
```

**Fix:** Connect to actual registry or add explicit `@stub` annotation.

---

### 🟢 LOW SEVERITY - Acceptable With Documentation

#### Pattern 8: Explicit NotImplementedError
Properly documented stubs that throw on use.

**Example:**
```typescript
// ACCEPTABLE: Explicit failure, not silent
async memoryQuery(): Promise<CallToolResult> {
  throw new NotImplementedError('memory-query');
}
```

**When Acceptable:**
- Feature is planned but not yet needed
- External dependency not available
- Requires significant integration work

---

#### Pattern 9: Underscore-Prefixed Unused Parameters
Parameters marked as intentionally unused.

**Example:**
```typescript
// ACCEPTABLE: Parameters preserved for interface compliance
async handleHealth(_req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  // _req not needed for health check
}
```

**When Acceptable:**
- Interface compliance requires the parameter
- Event handler signature requirements

---

## Cleanup Workflow

### Phase 1: Discovery
```bash
# Run all detection queries
grep -rn "console.log.*Would" src/ > stubs_fake_success.txt
grep -rn "// For now\|// Placeholder\|// In production" src/ > stubs_deferred.txt
grep -rn "return \[\];" src/ > stubs_empty_returns.txt
```

### Phase 2: Categorization
For each stub found, categorize:

| Category | Action | Example |
|----------|--------|---------|
| **Blocking** | Fix immediately | Deployment stage fake git ops |
| **Integration** | Create issue, add TODO | Memory system adapter |
| **Deferred** | Document with `@stub` | Compression support |
| **Acceptable** | Leave with documentation | NotImplementedError stubs |

### Phase 3: Fix or Flag

**For Blocking Stubs:**
```typescript
// BEFORE: Silent fake success
return `Branch ${branchName} created`;

// AFTER: Explicit failure or real implementation
throw new NotImplementedError('git-branch-creation', {
  context: { branchName },
  requiredIntegration: 'simple-git or child_process git commands'
});
```

**For Deferred Stubs:**
```typescript
/**
 * @stub Requires Memory System Python interop integration
 * @see https://github.com/org/repo/issues/123
 * @todo Implement via Pyodide or child_process bridge
 */
async getAdaptationEvents(): Promise<AdaptationEvent[]> {
  console.warn('[MemorySystemAdapter] getAdaptationEvents is not implemented');
  return [];
}
```

### Phase 4: Verification
```bash
# Verify no silent stubs remain
npx tsc --noEmit
npm test
grep -rn "// For now, just log" src/  # Should be empty
```

---

## Anti-Patterns to Avoid

### ❌ DON'T: Hide Stubs Behind Success
```typescript
// BAD: Looks successful, actually does nothing
async deployChanges(): Promise<{ success: true }> {
  console.log('Deploying...');
  return { success: true };
}
```

### ❌ DON'T: Use Comments as Implementation
```typescript
// BAD: Comment describes what SHOULD happen
async triggerSync(): Promise<void> {
  // This would send HTTP request to sync service
  // Would include authentication headers
  // Would retry on failure
}
```

### ❌ DON'T: Return Fake Data Silently
```typescript
// BAD: Returns plausible fake data
async getMetrics(): Promise<Metrics> {
  return {
    requests: 1000,  // FAKE!
    latency: 50,     // FAKE!
    errors: 0        // FAKE!
  };
}
```

### ✅ DO: Fail Explicitly
```typescript
// GOOD: Explicit about what's not implemented
async deployChanges(): Promise<DeploymentResult> {
  throw new NotImplementedError('deployChanges', {
    reason: 'Requires git integration',
    workaround: 'Use manual git commands'
  });
}
```

### ✅ DO: Document Deferred Work
```typescript
/**
 * @stub Memory System integration pending
 * @blocking false - system works without metrics
 * @priority medium
 */
async getMetrics(): Promise<Metrics | null> {
  console.warn('[Metrics] Not implemented - returning null');
  return null;
}
```

---

## Quick Reference: Search Commands

```bash
# All stub indicators
grep -rn "// For now\|// Placeholder\|// In production\|// Would\|// This would" src/

# Fake success patterns
grep -rn "return.*success.*true\|return.*created\|return.*modified" src/

# Empty returns
grep -rn "return \[\];\|return {};\|return null;" src/

# Trigger stubs
grep -rn "async.*trigger\|async.*send" src/ | head -20

# Commented implementations
grep -rn "// this\.\|// await\|// const.*=" src/

# NotImplementedError (acceptable)
grep -rn "NotImplementedError\|throw new Error.*not.*implement" src/
```

---

## Maintenance

When adding new stubs (sometimes necessary):

1. **Always** use `@stub` JSDoc tag
2. **Always** add a `console.warn` on invocation
3. **Always** link to a tracking issue
4. **Never** return fake success data
5. **Never** use `// For now` without a TODO

---

*Last Updated: 2026-01-14*
*Based on Chrysalis codebase stub cleanup effort*
