/**
 * Tests for Bridge Error Types
 * 
 * @module tests/bridge/errors
 */

import {
  BridgeError,
  ValidationError,
  TranslationError,
  StorageError,
  ConfigurationError,
  ConnectionError,
  TimeoutError,
  AbortError,
  DisposedError,
  NotFoundError,
  ConflictError,
  TemporalConflictError,
  PermissionError,
  RateLimitError,
  ErrorCode,
  isBridgeError,
  wrapError,
  isRecoverableError,
  getErrorChain,
  serializeError,
} from '../../src/bridge/errors';

describe('BridgeError', () => {
  describe('construction', () => {
    it('should create error with message', () => {
      const error = new BridgeError('Test error');
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(error.name).toBe('BridgeError');
      expect(error.context).toEqual({});
      expect(error.cause).toBeUndefined();
    });

    it('should create error with context', () => {
      const error = new BridgeError('Test error', {
        component: 'TestComponent',
        operation: 'testOp',
      });
      
      expect(error.context).toEqual({
        component: 'TestComponent',
        operation: 'testOp',
      });
    });

    it('should create error with custom code', () => {
      const error = new BridgeError('Test error', {}, ErrorCode.VALIDATION_ERROR);
      
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('should create error with cause', () => {
      const cause = new Error('Original error');
      const error = new BridgeError('Wrapped error', {}, ErrorCode.INTERNAL_ERROR, cause);
      
      expect(error.cause).toBe(cause);
    });

    it('should capture stack trace', () => {
      const error = new BridgeError('Test error');
      
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('BridgeError');
    });
  });

  describe('toJSON', () => {
    it('should serialize to JSON', () => {
      const error = new BridgeError('Test error', { key: 'value' }, ErrorCode.VALIDATION_ERROR);
      const json = error.toJSON();
      
      expect(json).toEqual({
        name: 'BridgeError',
        message: 'Test error',
        code: ErrorCode.VALIDATION_ERROR,
        context: { key: 'value' },
      });
    });

    it('should include cause in JSON', () => {
      const cause = new BridgeError('Cause error');
      const error = new BridgeError('Test error', {}, ErrorCode.INTERNAL_ERROR, cause);
      const json = error.toJSON();
      
      expect(json.cause).toBeDefined();
      expect(json.cause?.message).toBe('Cause error');
    });
  });
});

describe('ValidationError', () => {
  it('should create with VALIDATION_ERROR code', () => {
    const error = new ValidationError('Invalid input');
    
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.name).toBe('ValidationError');
  });

  it('should include field context', () => {
    const error = new ValidationError('Invalid email', { field: 'email' });
    
    expect(error.context.field).toBe('email');
  });
});

describe('TranslationError', () => {
  it('should create with TRANSLATION_ERROR code', () => {
    const error = new TranslationError('Cannot translate');
    
    expect(error.code).toBe(ErrorCode.TRANSLATION_ERROR);
    expect(error.name).toBe('TranslationError');
  });

  it('should include source and target framework', () => {
    const error = new TranslationError('Translation failed', {
      sourceFramework: 'USA',
      targetFramework: 'LMOS',
    });
    
    expect(error.context.sourceFramework).toBe('USA');
    expect(error.context.targetFramework).toBe('LMOS');
  });
});

describe('StorageError', () => {
  it('should create with STORAGE_ERROR code', () => {
    const error = new StorageError('Database error');
    
    expect(error.code).toBe(ErrorCode.STORAGE_ERROR);
    expect(error.name).toBe('StorageError');
  });
});

describe('ConfigurationError', () => {
  it('should create with CONFIGURATION_ERROR code', () => {
    const error = new ConfigurationError('Invalid config');
    
    expect(error.code).toBe(ErrorCode.CONFIGURATION_ERROR);
    expect(error.name).toBe('ConfigurationError');
  });
});

describe('ConnectionError', () => {
  it('should create with CONNECTION_ERROR code', () => {
    const error = new ConnectionError('Connection refused');
    
    expect(error.code).toBe(ErrorCode.CONNECTION_ERROR);
    expect(error.name).toBe('ConnectionError');
  });
});

describe('TimeoutError', () => {
  it('should create with TIMEOUT_ERROR code', () => {
    const error = new TimeoutError('Request', 5000);
    
    expect(error.code).toBe(ErrorCode.TIMEOUT_ERROR);
    expect(error.name).toBe('TimeoutError');
    expect(error.message).toContain('Request');
    expect(error.message).toContain('5000ms');
    expect(error.context.timeoutMs).toBe(5000);
  });
});

describe('AbortError', () => {
  it('should create with ABORT_ERROR code', () => {
    const error = new AbortError('Operation cancelled');
    
    expect(error.code).toBe(ErrorCode.ABORT_ERROR);
    expect(error.name).toBe('AbortError');
  });
});

describe('DisposedError', () => {
  it('should create with DISPOSED_ERROR code', () => {
    const error = new DisposedError('Connection');
    
    expect(error.code).toBe(ErrorCode.DISPOSED_ERROR);
    expect(error.name).toBe('DisposedError');
    expect(error.message).toContain('Connection');
    expect(error.message).toContain('disposed');
  });
});

describe('NotFoundError', () => {
  it('should create with NOT_FOUND code', () => {
    const error = new NotFoundError('Agent', 'agent-123');
    
    expect(error.code).toBe(ErrorCode.NOT_FOUND);
    expect(error.name).toBe('NotFoundError');
    expect(error.message).toContain('Agent');
    expect(error.message).toContain('agent-123');
    expect(error.context.resourceType).toBe('Agent');
    expect(error.context.resourceId).toBe('agent-123');
  });
});

describe('ConflictError', () => {
  it('should create with CONFLICT code', () => {
    const error = new ConflictError('Resource already exists');
    
    expect(error.code).toBe(ErrorCode.CONFLICT);
    expect(error.name).toBe('ConflictError');
  });
});

describe('TemporalConflictError', () => {
  it('should create with TEMPORAL_CONFLICT code', () => {
    const error = new TemporalConflictError('Concurrent modification detected');
    
    expect(error.code).toBe(ErrorCode.TEMPORAL_CONFLICT);
    expect(error.name).toBe('TemporalConflictError');
  });
});

describe('PermissionError', () => {
  it('should create with PERMISSION_DENIED code', () => {
    const error = new PermissionError('read', 'agent');
    
    expect(error.code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(error.name).toBe('PermissionError');
    expect(error.message).toContain('read');
    expect(error.message).toContain('agent');
    expect(error.context.action).toBe('read');
    expect(error.context.resource).toBe('agent');
  });
});

describe('RateLimitError', () => {
  it('should create with RATE_LIMITED code', () => {
    const error = new RateLimitError(60);
    
    expect(error.code).toBe(ErrorCode.RATE_LIMITED);
    expect(error.name).toBe('RateLimitError');
    expect(error.message).toContain('60');
    expect(error.context.retryAfterSeconds).toBe(60);
  });
});

describe('isBridgeError', () => {
  it('should return true for BridgeError', () => {
    expect(isBridgeError(new BridgeError('test'))).toBe(true);
  });

  it('should return true for specialized errors', () => {
    expect(isBridgeError(new ValidationError('test'))).toBe(true);
    expect(isBridgeError(new StorageError('test'))).toBe(true);
    expect(isBridgeError(new TimeoutError('op', 1000))).toBe(true);
  });

  it('should return false for regular Error', () => {
    expect(isBridgeError(new Error('test'))).toBe(false);
  });

  it('should return false for non-errors', () => {
    expect(isBridgeError('test')).toBe(false);
    expect(isBridgeError(null)).toBe(false);
    expect(isBridgeError(undefined)).toBe(false);
  });
});

describe('wrapError', () => {
  it('should wrap regular Error', () => {
    const original = new Error('Original');
    const wrapped = wrapError(original, 'Wrapped');
    
    expect(wrapped).toBeInstanceOf(BridgeError);
    expect(wrapped.message).toBe('Wrapped');
    expect(wrapped.cause).toBe(original);
  });

  it('should return BridgeError as-is', () => {
    const original = new ValidationError('Validation');
    const wrapped = wrapError(original, 'Wrapped');
    
    expect(wrapped).toBe(original);
  });

  it('should handle non-Error values', () => {
    const wrapped = wrapError('string error', 'Wrapped');
    
    expect(wrapped).toBeInstanceOf(BridgeError);
    expect(wrapped.message).toBe('Wrapped');
  });

  it('should include context', () => {
    const wrapped = wrapError(new Error('test'), 'Wrapped', { key: 'value' });
    
    expect(wrapped.context.key).toBe('value');
  });
});

describe('isRecoverableError', () => {
  it('should return true for timeout errors', () => {
    expect(isRecoverableError(new TimeoutError('op', 1000))).toBe(true);
  });

  it('should return true for connection errors', () => {
    expect(isRecoverableError(new ConnectionError('failed'))).toBe(true);
  });

  it('should return true for rate limit errors', () => {
    expect(isRecoverableError(new RateLimitError(60))).toBe(true);
  });

  it('should return true for temporal conflict errors', () => {
    expect(isRecoverableError(new TemporalConflictError('conflict'))).toBe(true);
  });

  it('should return false for validation errors', () => {
    expect(isRecoverableError(new ValidationError('invalid'))).toBe(false);
  });

  it('should return false for permission errors', () => {
    expect(isRecoverableError(new PermissionError('read', 'resource'))).toBe(false);
  });
});

describe('getErrorChain', () => {
  it('should return chain of errors', () => {
    const error1 = new Error('First');
    const error2 = new BridgeError('Second', {}, ErrorCode.INTERNAL_ERROR, error1);
    const error3 = new BridgeError('Third', {}, ErrorCode.INTERNAL_ERROR, error2);
    
    const chain = getErrorChain(error3);
    
    expect(chain).toHaveLength(3);
    expect(chain[0].message).toBe('Third');
    expect(chain[1].message).toBe('Second');
    expect(chain[2].message).toBe('First');
  });

  it('should handle errors without cause', () => {
    const error = new BridgeError('Single');
    const chain = getErrorChain(error);
    
    expect(chain).toHaveLength(1);
    expect(chain[0]).toBe(error);
  });
});

describe('serializeError', () => {
  it('should serialize BridgeError', () => {
    const error = new ValidationError('Invalid', { field: 'email' });
    const serialized = serializeError(error);
    
    expect(serialized.name).toBe('ValidationError');
    expect(serialized.message).toBe('Invalid');
    expect(serialized.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(serialized.context?.field).toBe('email');
    expect(serialized.stack).toBeDefined();
  });

  it('should serialize regular Error', () => {
    const error = new Error('Regular');
    const serialized = serializeError(error);
    
    expect(serialized.name).toBe('Error');
    expect(serialized.message).toBe('Regular');
    expect(serialized.code).toBeUndefined();
    expect(serialized.stack).toBeDefined();
  });

  it('should serialize cause chain', () => {
    const cause = new Error('Cause');
    const error = new BridgeError('Main', {}, ErrorCode.INTERNAL_ERROR, cause);
    const serialized = serializeError(error);
    
    expect(serialized.cause).toBeDefined();
    expect(serialized.cause?.message).toBe('Cause');
  });
});
