# Embedding Service Improvements - Implementation Checklist

## Quick Start Guide

### Prerequisites
- [ ] Review and approve implementation plan
- [ ] Create feature branch: `feature/embedding-service-improvements`
- [ ] Set up development environment
- [ ] Ensure all existing tests pass

---

## Phase 1: Foundation & Shared Library

### 1.1 Create Shared Library Structure
- [ ] Create `shared/embedding/` directory structure
- [ ] Create `shared/embedding/__init__.py` with exports
- [ ] Create `shared/embedding/__version__.py`
- [ ] Create `shared/embedding/exceptions.py`
- [ ] Create `shared/embedding/providers/` directory
- [ ] Create `shared/embedding/providers/__init__.py`
- [ ] Create `shared/embedding/tests/` directory

### 1.2 Provider Abstractions
- [ ] Create `shared/embedding/providers/base.py` (ABC)
- [ ] Create `shared/embedding/providers/voyage.py`
  - [ ] Extract Voyage SDK logic
  - [ ] Extract Voyage HTTP fallback
  - [ ] Implement EmbeddingProvider interface
  - [ ] Add cost estimation
  - [ ] Add batch support
- [ ] Create `shared/embedding/providers/openai.py`
  - [ ] Extract OpenAI logic
  - [ ] Implement EmbeddingProvider interface
  - [ ] Add cost estimation
  - [ ] Add batch support
- [ ] Create `shared/embedding/providers/deterministic.py`
  - [ ] Extract deterministic logic
  - [ ] Implement EmbeddingProvider interface
  - [ ] Ensure reproducibility

### 1.3 Telemetry Adapter
- [ ] Create `shared/embedding/telemetry.py`
- [ ] Implement `EmbeddingTelemetry` class
- [ ] Add `record_success()` method
- [ ] Add `record_error()` method
- [ ] Add `record_dimension_mismatch()` method
- [ ] Test with SkillBuilder TelemetryWriter
- [ ] Test with KnowledgeBuilder TelemetryRecorder
- [ ] Handle missing telemetry gracefully

### 1.4 Core EmbeddingService
- [ ] Create `shared/embedding/service.py`
- [ ] Implement `_create_provider()` factory method
- [ ] Refactor `embed()` method:
  - [ ] Use provider abstraction
  - [ ] Add telemetry hooks
  - [ ] Add dimension validation
  - [ ] Add structured logging
- [ ] Implement `embed_batch()` method
- [ ] Implement `get_provider_info()` method
- [ ] Implement `_classify_error()` method
- [ ] Implement `_build_log_context()` method
- [ ] Implement `_validate_dimensions()` method
- [ ] Add `estimate_cost()` method
- [ ] Maintain backward compatibility

### 1.5 Custom Exceptions
- [ ] Create exception hierarchy
- [ ] Implement `EmbeddingError` base
- [ ] Implement `EmbeddingProviderError`
- [ ] Implement `EmbeddingDimensionMismatchError`
- [ ] Implement `EmbeddingRateLimitError`
- [ ] Implement `EmbeddingAuthenticationError`

### 1.6 Phase 1 Testing
- [ ] Write tests for base provider (ABC)
- [ ] Write tests for VoyageProvider
- [ ] Write tests for OpenAIProvider
- [ ] Write tests for DeterministicProvider
- [ ] Write tests for EmbeddingService
- [ ] Write tests for EmbeddingTelemetry
- [ ] Write tests for error classification
- [ ] Write tests for dimension validation
- [ ] Achieve 90%+ test coverage
- [ ] All tests pass

---

## Phase 2: Enhanced Logging & Error Classification

### 2.1 Structured Logging
- [ ] Add logging import and setup
- [ ] Implement `_build_log_context()` method
  - [ ] Provider name
  - [ ] Model name
  - [ ] Dimensions
  - [ ] Text length
  - [ ] Text hash (privacy-safe)
- [ ] Add latency tracking
- [ ] Add success logging with context
- [ ] Add error logging with context
- [ ] Add dimension mismatch logging
- [ ] Verify log format is parseable

### 2.2 Error Classification
- [ ] Implement `_classify_error()` method
- [ ] Test timeout error classification
- [ ] Test rate limit error classification (429)
- [ ] Test authentication error classification (401, 403)
- [ ] Test quota exceeded classification
- [ ] Test network error classification
- [ ] Test unknown error fallback
- [ ] Ensure classification is stable

### 2.3 Dimension Validation
- [ ] Implement `_validate_dimensions()` method
- [ ] Add dimension mismatch detection
- [ ] Add warning logging for mismatches
- [ ] Add telemetry for mismatches
- [ ] Add strict mode support (env var)
- [ ] Test dimension validation
- [ ] Test strict mode behavior

### 2.4 Phase 2 Testing
- [ ] Write tests for structured logging
- [ ] Write tests for error classification
- [ ] Write tests for dimension validation
- [ ] Verify logs are structured correctly
- [ ] Verify error classification accuracy
- [ ] All tests pass

---

## Phase 3: Integration & Migration

### 3.1 KnowledgeBuilder Migration
- [ ] Update `projects/KnowledgeBuilder/src/utils/embeddings.py`
  - [ ] Replace with shared library import
  - [ ] Maintain backward compatibility
  - [ ] Add deprecation notice if needed
- [ ] Update `projects/KnowledgeBuilder/src/pipeline/simple_pipeline.py`
  - [ ] Import EmbeddingTelemetry
  - [ ] Initialize telemetry adapter
  - [ ] Pass telemetry to EmbeddingService
- [ ] Update KnowledgeBuilder tests
  - [ ] Update imports
  - [ ] Test telemetry integration
  - [ ] Test new features
  - [ ] All existing tests pass
- [ ] Verify KnowledgeBuilder server still works
- [ ] Test end-to-end KnowledgeBuilder pipeline

### 3.2 SkillBuilder Migration
- [ ] Update `projects/SkillBuilder/skill_builder/pipeline/embeddings.py`
  - [ ] Replace with shared library import
  - [ ] Maintain backward compatibility
  - [ ] Add deprecation notice if needed
- [ ] Update `projects/SkillBuilder/skill_builder/pipeline/runner.py`
  - [ ] Import EmbeddingTelemetry
  - [ ] Initialize telemetry adapter
  - [ ] Pass telemetry to EmbeddingService
- [ ] Update SkillBuilder tests
  - [ ] Update imports
  - [ ] Test telemetry integration
  - [ ] Test new features
  - [ ] All existing tests pass
- [ ] Verify SkillBuilder server still works
- [ ] Test end-to-end SkillBuilder pipeline

### 3.3 Documentation Updates
- [ ] Update `projects/KnowledgeBuilder/README.md`
  - [ ] Document shared library usage
  - [ ] Document telemetry integration
  - [ ] Document new features
- [ ] Update `projects/SkillBuilder/README.md`
  - [ ] Document shared library usage
  - [ ] Document telemetry integration
  - [ ] Document new features
- [ ] Create `shared/embedding/README.md`
  - [ ] Usage examples
  - [ ] API documentation
  - [ ] Migration guide
  - [ ] Configuration options

### 3.4 Phase 3 Testing
- [ ] Run all KnowledgeBuilder tests
- [ ] Run all SkillBuilder tests
- [ ] Run integration tests
- [ ] Verify telemetry events are emitted
- [ ] Verify logs are structured
- [ ] Verify dimension validation works
- [ ] All tests pass

---

## Phase 4: Validation & Cleanup

### 4.1 Integration Testing
- [ ] Test KnowledgeBuilder end-to-end
  - [ ] Verify embeddings generated
  - [ ] Verify telemetry emitted
  - [ ] Verify logs structured
  - [ ] Verify no regressions
- [ ] Test SkillBuilder end-to-end
  - [ ] Verify embeddings generated
  - [ ] Verify telemetry emitted
  - [ ] Verify logs structured
  - [ ] Verify no regressions
- [ ] Test error scenarios
  - [ ] Timeout errors
  - [ ] Rate limit errors
  - [ ] Authentication errors
  - [ ] Network errors
- [ ] Test dimension mismatch scenarios
- [ ] Performance benchmarks
  - [ ] Compare before/after latency
  - [ ] Measure telemetry overhead
  - [ ] Check memory usage
  - [ ] Verify thread safety

### 4.2 Cleanup
- [ ] Remove old duplicate code
- [ ] Update all imports
- [ ] Remove unused helper functions
- [ ] Clean up deprecated code
- [ ] Update .gitignore if needed
- [ ] Verify no broken imports

### 4.3 Final Validation
- [ ] All tests pass
- [ ] Code coverage > 90%
- [ ] Documentation complete
- [ ] No breaking changes
- [ ] Performance validated
- [ ] Telemetry working
- [ ] Logging working
- [ ] Ready for code review

---

## Deployment Checklist

### Pre-Deployment
- [ ] Code review completed
- [ ] All tests pass
- [ ] Documentation reviewed
- [ ] Performance benchmarks acceptable
- [ ] Rollback plan prepared

### Deployment
- [ ] Merge to main/develop branch
- [ ] Deploy to staging environment
- [ ] Verify staging deployment
- [ ] Monitor telemetry in staging
- [ ] Deploy to production
- [ ] Monitor production metrics

### Post-Deployment
- [ ] Verify telemetry collection
- [ ] Verify log aggregation
- [ ] Monitor for errors
- [ ] Check performance metrics
- [ ] Gather user feedback

---

## Rollback Plan

If issues are discovered:

1. **Immediate Rollback**
   - [ ] Revert merge commit
   - [ ] Deploy previous version
   - [ ] Verify system stability

2. **Partial Rollback** (if possible)
   - [ ] Disable telemetry via feature flag
   - [ ] Disable dimension validation
   - [ ] Keep shared library benefits

3. **Investigation**
   - [ ] Review logs and telemetry
   - [ ] Identify root cause
   - [ ] Create fix
   - [ ] Test fix thoroughly
   - [ ] Re-deploy

---

## Success Criteria Review

### Code Quality ✅
- [ ] Zero code duplication
- [ ] 90%+ test coverage
- [ ] All tests pass
- [ ] No breaking changes

### Observability ✅
- [ ] 100% telemetry emission
- [ ] Structured logging
- [ ] Error classification > 95% accuracy
- [ ] Dimension validation working

### Performance ✅
- [ ] < 5% latency overhead
- [ ] < 10MB memory overhead
- [ ] No performance regressions

### Adoption ✅
- [ ] Both projects migrated
- [ ] Documentation complete
- [ ] Migration guide available

---

## Notes & Issues

Use this section to track blockers, questions, or issues:

```
[Date] [Issue/Blockers]
- Issue description
- Resolution (if any)
```

---

## Progress Tracking

- **Phase 1**: ___% Complete
- **Phase 2**: ___% Complete
- **Phase 3**: ___% Complete
- **Phase 4**: ___% Complete

**Overall Progress**: ___% Complete
