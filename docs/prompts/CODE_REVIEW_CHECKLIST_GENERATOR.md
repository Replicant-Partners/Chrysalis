# AI Code Review Checklist Generator

**Purpose**: Generate customized code review checklists based on programming language, project type, and complexity level.

---

## Input Parameters

### Required Inputs

```yaml
language: <programming_language>      # e.g., TypeScript, Python, Go, Rust, Java
project_type: <project_category>      # web_app | mobile_app | api | embedded | data_pipeline
complexity: <complexity_level>        # simple | moderate | complex
```

### Optional Inputs

```yaml
framework: <framework_name>           # e.g., React, Django, Spring Boot
security_tier: <security_level>       # standard | elevated | critical
team_size: <team_size>                # solo | small | large
codebase_age: <age>                   # new | established | legacy
```

---

## Prompt Template

```markdown
You are a senior software engineer conducting a thorough code review. Generate a comprehensive code review checklist customized for the following context:

**Language**: {{language}}
**Project Type**: {{project_type}}
**Complexity Level**: {{complexity}}
{{#if framework}}**Framework**: {{framework}}{{/if}}
{{#if security_tier}}**Security Tier**: {{security_tier}}{{/if}}

---

## SECTION 1: MAJOR ISSUES (🔴 Must Fix)

These issues must be resolved before merge. They include security vulnerabilities, logic errors, breaking changes, and critical performance problems.

### 1.1 Security Vulnerabilities

{{#language_security language}}
Generate language-specific security checks:
- For TypeScript/JavaScript: XSS, prototype pollution, eval usage, dependency vulnerabilities
- For Python: SQL injection, pickle deserialization, command injection, SSRF
- For Go: race conditions, unsafe pointer usage, goroutine leaks
- For Rust: unsafe blocks, memory safety violations
- For Java: deserialization attacks, XXE, LDAP injection
{{/language_security}}

{{#project_security project_type}}
Generate project-type-specific security checks:
- For web_app: CSRF, session management, authentication bypass, CORS misconfiguration
- For api: Rate limiting, input validation, authentication/authorization, API key exposure
- For mobile_app: Insecure storage, certificate pinning, root/jailbreak detection
- For embedded: Buffer overflows, firmware update security, physical access controls
- For data_pipeline: Data leakage, access controls, encryption at rest/transit
{{/project_security}}

**Checklist Items**:
- [ ] 🔴 No hardcoded secrets, API keys, or credentials
- [ ] 🔴 All user inputs validated and sanitized
- [ ] 🔴 Authentication and authorization properly implemented
- [ ] 🔴 Sensitive data encrypted in transit and at rest
- [ ] 🔴 No SQL/NoSQL injection vulnerabilities
- [ ] 🔴 Dependencies scanned for known vulnerabilities
{{#if elevated_security}}
- [ ] 🔴 Security headers properly configured
- [ ] 🔴 Rate limiting implemented on sensitive endpoints
- [ ] 🔴 Audit logging for security-relevant events
{{/if}}

### 1.2 Logic Errors

- [ ] 🔴 Business logic correctly implements requirements
- [ ] 🔴 Edge cases handled (null, empty, boundary values)
- [ ] 🔴 Error handling covers all failure modes
- [ ] 🔴 Race conditions prevented in concurrent code
- [ ] 🔴 State mutations are intentional and controlled
- [ ] 🔴 Loop termination conditions are correct
- [ ] 🔴 Off-by-one errors checked in array/string operations

### 1.3 Breaking Changes

- [ ] 🔴 API contracts maintained (no unintended breaking changes)
- [ ] 🔴 Database migrations are backward compatible
- [ ] 🔴 Configuration changes documented and communicated
- [ ] 🔴 Deprecation warnings added before removal
- [ ] 🔴 Version bumps follow semantic versioning

### 1.4 Critical Performance Issues

- [ ] 🔴 No N+1 query patterns
- [ ] 🔴 No unbounded memory growth
- [ ] 🔴 No blocking operations in async contexts
- [ ] 🔴 Resource cleanup (connections, file handles, memory)
- [ ] 🔴 Timeout handling for external calls

---

## SECTION 2: MINOR RECOMMENDATIONS (🟡 Should Fix)

These issues improve code quality but are not blocking. They include style improvements, documentation gaps, and optional enhancements.

### 2.1 Language-Specific Coding Standards

{{#language_standards language}}
Generate language-specific style and convention checks:

**TypeScript**:
- [ ] 🟡 Strict mode enabled, no `any` types without justification
- [ ] 🟡 Interfaces preferred over type aliases for object shapes
- [ ] 🟡 Async/await used consistently (no mixing with .then())
- [ ] 🟡 Null checks use optional chaining (?.) and nullish coalescing (??)
- [ ] 🟡 Enums used for fixed sets of values
- [ ] 🟡 Generic types properly constrained

**Python**:
- [ ] 🟡 Type hints on all public functions
- [ ] 🟡 PEP 8 style compliance
- [ ] 🟡 Context managers used for resource handling
- [ ] 🟡 List comprehensions preferred over map/filter where readable
- [ ] 🟡 f-strings used for string formatting
- [ ] 🟡 Dataclasses or Pydantic for data structures

**Go**:
- [ ] 🟡 Error handling follows Go idioms (no panic for recoverable errors)
- [ ] 🟡 Interfaces defined by consumer, not provider
- [ ] 🟡 Context propagation for cancellation
- [ ] 🟡 Defer used for cleanup
- [ ] 🟡 Struct embedding used appropriately
- [ ] 🟡 golint/staticcheck passes

**Rust**:
- [ ] 🟡 Ownership and borrowing used idiomatically
- [ ] 🟡 Result/Option used instead of panics
- [ ] 🟡 Clippy warnings addressed
- [ ] 🟡 Lifetimes explicit only when necessary
- [ ] 🟡 Traits used for abstraction

**Java**:
- [ ] 🟡 Optional used instead of null returns
- [ ] 🟡 Streams used for collection operations
- [ ] 🟡 Records used for immutable data
- [ ] 🟡 Try-with-resources for AutoCloseable
- [ ] 🟡 Lombok used judiciously
{{/language_standards}}

### 2.2 Project-Type Best Practices

{{#project_practices project_type}}
Generate project-type-specific best practices:

**Web Application**:
- [ ] 🟡 Components follow single responsibility principle
- [ ] 🟡 State management is predictable and traceable
- [ ] 🟡 Accessibility (a11y) requirements met
- [ ] 🟡 Responsive design implemented
- [ ] 🟡 Loading and error states handled in UI

**API**:
- [ ] 🟡 RESTful conventions followed (or GraphQL schema well-designed)
- [ ] 🟡 Pagination implemented for list endpoints
- [ ] 🟡 Consistent error response format
- [ ] 🟡 API versioning strategy applied
- [ ] 🟡 OpenAPI/Swagger documentation updated

**Mobile App**:
- [ ] 🟡 Offline-first patterns where appropriate
- [ ] 🟡 Battery and data usage optimized
- [ ] 🟡 Deep linking configured
- [ ] 🟡 Push notification handling robust
- [ ] 🟡 App lifecycle events handled correctly

**Embedded System**:
- [ ] 🟡 Memory footprint minimized
- [ ] 🟡 Real-time constraints documented and met
- [ ] 🟡 Hardware abstraction layer used
- [ ] 🟡 Watchdog timers configured
- [ ] 🟡 Power management considered

**Data Pipeline**:
- [ ] 🟡 Idempotency ensured for reprocessing
- [ ] 🟡 Schema evolution handled gracefully
- [ ] 🟡 Backpressure mechanisms in place
- [ ] 🟡 Data lineage tracked
- [ ] 🟡 Monitoring and alerting configured
{{/project_practices}}

### 2.3 Documentation

- [ ] 🟡 Public APIs documented with JSDoc/docstrings
- [ ] 🟡 Complex algorithms explained in comments
- [ ] 🟡 README updated if behavior changes
- [ ] 🟡 CHANGELOG entry added for user-facing changes
- [ ] 🟡 Architecture decision records (ADRs) for significant choices

### 2.4 Testing

- [ ] 🟡 Unit tests cover new functionality
- [ ] 🟡 Edge cases have test coverage
- [ ] 🟡 Integration tests for external dependencies
- [ ] 🟡 Test names describe behavior, not implementation
- [ ] 🟡 Mocks/stubs used appropriately (not over-mocked)
{{#if complex}}
- [ ] 🟡 Property-based tests for complex logic
- [ ] 🟡 Performance benchmarks for critical paths
- [ ] 🟡 Chaos/fault injection tests for resilience
{{/if}}

---

## SECTION 3: PERFORMANCE OPTIMIZATION

{{#complexity_scaling complexity}}
Scale performance analysis depth:

**Simple Complexity**:
- [ ] 🟡 No obvious O(n²) or worse algorithms for large inputs
- [ ] 🟡 Database queries use indexes
- [ ] 🟡 Caching considered for repeated computations

**Moderate Complexity**:
- [ ] 🟡 Algorithm complexity documented and justified
- [ ] 🟡 Database query plans reviewed
- [ ] 🟡 Connection pooling configured
- [ ] 🟡 Lazy loading used where appropriate
- [ ] 🟡 Batch operations for bulk data

**Complex**:
- [ ] 🟡 Profiling data supports performance claims
- [ ] 🟡 Memory allocation patterns optimized
- [ ] 🟡 Concurrency model appropriate for workload
- [ ] 🟡 Cache invalidation strategy documented
- [ ] 🟡 Load testing results reviewed
- [ ] 🟡 Horizontal scaling considerations addressed
{{/complexity_scaling}}

### Language-Specific Performance

{{#language_performance language}}
**TypeScript/JavaScript**:
- [ ] 🟡 Bundle size impact assessed
- [ ] 🟡 Tree-shaking friendly exports
- [ ] 🟡 Memoization for expensive computations
- [ ] 🟡 Web Workers for CPU-intensive tasks

**Python**:
- [ ] 🟡 Generator expressions for large sequences
- [ ] 🟡 NumPy/Pandas vectorization where applicable
- [ ] 🟡 Async I/O for concurrent operations
- [ ] 🟡 C extensions considered for hot paths

**Go**:
- [ ] 🟡 Goroutine pool for bounded concurrency
- [ ] 🟡 sync.Pool for frequently allocated objects
- [ ] 🟡 Escape analysis considered
- [ ] 🟡 pprof profiling for hot paths

**Rust**:
- [ ] 🟡 Zero-copy parsing where possible
- [ ] 🟡 Stack allocation preferred over heap
- [ ] 🟡 SIMD intrinsics for vectorizable operations
- [ ] 🟡 Async runtime appropriate for use case

**Java**:
- [ ] 🟡 JVM tuning parameters documented
- [ ] 🟡 Object pooling for expensive allocations
- [ ] 🟡 Virtual threads (Java 21+) for I/O-bound work
- [ ] 🟡 GC pause impact assessed
{{/language_performance}}

---

## SECTION 4: REFACTORING OPPORTUNITIES

After reviewing the code, identify opportunities for improvement:

### 4.1 Code Smells to Address

- [ ] 💡 Long methods (>50 lines) that could be extracted
- [ ] 💡 Deep nesting (>3 levels) that could be flattened
- [ ] 💡 Duplicate code that could be abstracted
- [ ] 💡 God classes that violate single responsibility
- [ ] 💡 Feature envy (methods using other class's data excessively)
- [ ] 💡 Primitive obsession (using primitives instead of value objects)

### 4.2 Design Pattern Opportunities

- [ ] 💡 Strategy pattern for algorithm selection
- [ ] 💡 Factory pattern for object creation
- [ ] 💡 Observer pattern for event handling
- [ ] 💡 Decorator pattern for behavior extension
- [ ] 💡 Repository pattern for data access

### 4.3 Preferred Implementation Examples

When suggesting changes, provide concrete examples:

```
Instead of:
  if (user.role === 'admin' || user.role === 'superadmin' || user.role === 'moderator') {
    // allow action
  }

Prefer:
  const PRIVILEGED_ROLES = new Set(['admin', 'superadmin', 'moderator']);
  if (PRIVILEGED_ROLES.has(user.role)) {
    // allow action
  }
```

---

## SECTION 5: RESOURCES AND REFERENCES

### Documentation Links

{{#language_resources language}}
**TypeScript**:
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)
- [Effective TypeScript](https://effectivetypescript.com/)

**Python**:
- [PEP 8 Style Guide](https://peps.python.org/pep-0008/)
- [Python Type Hints](https://docs.python.org/3/library/typing.html)
- [Real Python Best Practices](https://realpython.com/)

**Go**:
- [Effective Go](https://go.dev/doc/effective_go)
- [Go Code Review Comments](https://github.com/golang/go/wiki/CodeReviewComments)
- [Uber Go Style Guide](https://github.com/uber-go/guide/blob/master/style.md)

**Rust**:
- [Rust Book](https://doc.rust-lang.org/book/)
- [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/)
- [Clippy Lints](https://rust-lang.github.io/rust-clippy/)

**Java**:
- [Google Java Style Guide](https://google.github.io/styleguide/javaguide.html)
- [Effective Java](https://www.oreilly.com/library/view/effective-java/9780134686097/)
- [Java Concurrency in Practice](https://jcip.net/)
{{/language_resources}}

### Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [NIST Secure Coding Guidelines](https://www.nist.gov/itl/ssd/software-quality-group)

---

## OUTPUT FORMAT

Present the checklist in this structure:

```
# Code Review Checklist
**PR**: [PR Title/Number]
**Reviewer**: [Name]
**Date**: [Date]
**Language**: {{language}} | **Project**: {{project_type}} | **Complexity**: {{complexity}}

---

## 🔴 MAJOR ISSUES (Must Fix Before Merge)

### Security
- [ ] Issue 1: [Description] — **File**: `path/to/file.ts:42`
  - **Risk**: [Impact description]
  - **Fix**: [Suggested remediation]

### Logic Errors
- [ ] Issue 2: [Description] — **File**: `path/to/file.ts:87`
  - **Expected**: [Correct behavior]
  - **Actual**: [Current behavior]

### Breaking Changes
- [ ] Issue 3: [Description]
  - **Impact**: [Who/what is affected]
  - **Migration**: [Required steps]

---

## 🟡 MINOR RECOMMENDATIONS (Should Fix)

### Code Quality
- [ ] Recommendation 1: [Description] — **File**: `path/to/file.ts:15`
  - **Rationale**: [Why this matters]
  - **Example**: [Preferred implementation]

### Documentation
- [ ] Recommendation 2: [Description]

### Testing
- [ ] Recommendation 3: [Description]

---

## 💡 REFACTORING OPPORTUNITIES (Consider for Future)

- [ ] Opportunity 1: [Description]
  - **Benefit**: [Expected improvement]
  - **Effort**: [Low/Medium/High]

---

## ✅ POSITIVE OBSERVATIONS

- [What was done well]
- [Good patterns to continue]

---

## SUMMARY

| Category | Count |
|----------|-------|
| 🔴 Major Issues | X |
| 🟡 Minor Recommendations | Y |
| 💡 Refactoring Opportunities | Z |

**Recommendation**: [Approve / Request Changes / Needs Discussion]
```

---

## ADAPTABILITY RULES

### Complexity Scaling

| Complexity | Checklist Depth | Performance Analysis | Security Scrutiny |
|------------|-----------------|---------------------|-------------------|
| Simple | Core items only | Basic checks | Standard |
| Moderate | Full standard checklist | Query/algorithm review | Elevated |
| Complex | Extended + custom sections | Profiling required | Critical |

### Conditional Sections

Activate additional sections based on:

- **`security_tier: critical`** → Add penetration testing checklist, threat modeling review
- **`codebase_age: legacy`** → Add backward compatibility emphasis, deprecation tracking
- **`team_size: large`** → Add consistency checks, naming convention enforcement
- **`framework: React`** → Add React-specific hooks rules, component patterns

---

## USAGE EXAMPLE

**Input**:
```yaml
language: TypeScript
project_type: api
complexity: moderate
framework: NestJS
security_tier: elevated
```

**Generated Checklist** will include:
- TypeScript-specific type safety checks
- API-specific REST/GraphQL conventions
- NestJS decorator and module patterns
- Elevated security checks (rate limiting, audit logging)
- Moderate-depth performance analysis

---

**Last Updated**: January 9, 2026
**Version**: 1.0.0
