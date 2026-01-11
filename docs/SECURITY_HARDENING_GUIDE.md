# Security Hardening Guide - Chrysalis Integration Platform

**Document Version:** 1.0  
**Last Updated:** January 11, 2026  
**Classification:** Internal Use  
**Status:** Production Ready

---

## Executive Summary

This guide provides comprehensive security hardening recommendations for deploying the Chrysalis Integration Platform in production environments. It covers authentication, encryption, network security, input validation, and operational security best practices.

---

## Table of Contents

1. [Authentication & Authorization](#1-authentication--authorization)
2. [Encryption & Key Management](#2-encryption--key-management)
3. [Input Validation & Sanitization](#3-input-validation--sanitization)
4. [Network Security](#4-network-security)
5. [API Security](#5-api-security)
6. [Logging & Monitoring](#6-logging--monitoring)
7. [Secrets Management](#7-secrets-management)
8. [Dependency Security](#8-dependency-security)
9. [Container Security](#9-container-security)
10. [Security Checklist](#10-security-checklist)

---

## 1. Authentication & Authorization

### 1.1 API Key Management

The Chrysalis platform uses the `ApiKeyWallet` for secure credential storage with AES-256-GCM encryption.

#### Best Practices

```typescript
import { ApiKeyWallet } from '@chrysalis/security';

// Initialize wallet with strong password
const wallet = await ApiKeyWallet.create({
  password: process.env.WALLET_PASSWORD, // Use secure secret management
  pbkdf2Iterations: 100000, // Recommended minimum
  saltLength: 32
});

// Store keys with metadata
await wallet.storeKey('openai', {
  value: process.env.OPENAI_API_KEY,
  provider: 'openai',
  permissions: ['chat', 'embeddings'],
  expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
});
```

#### Key Rotation Strategy

1. **Automatic Rotation**: Implement 90-day rotation for all API keys
2. **Emergency Rotation**: Immediate rotation procedure for compromised keys
3. **Audit Trail**: Log all key access and modifications

```typescript
// Example rotation procedure
async function rotateApiKey(provider: string, wallet: ApiKeyWallet): Promise<void> {
  const oldKey = await wallet.getKey(provider);
  const newKey = await generateNewKey(provider); // Provider-specific
  
  // Update with zero-downtime
  await wallet.storeKey(provider, {
    value: newKey,
    rotatedAt: new Date().toISOString(),
    previousKeyHash: hashKey(oldKey) // For audit
  });
  
  // Verify new key works before removing old
  await verifyKey(provider, newKey);
  
  // Log rotation event
  auditLog.info('API key rotated', { provider, timestamp: Date.now() });
}
```

### 1.2 A2A Client Authentication

The A2A client supports multiple authentication schemes:

```typescript
import { A2AClient } from '@chrysalis/a2a-client';

// Bearer token authentication (recommended)
const client = new A2AClient({
  agentCard: 'https://agent.example.com/.well-known/agent.json',
  auth: {
    scheme: 'Bearer',
    token: process.env.A2A_TOKEN
  }
});

// Basic authentication (when required)
const clientBasic = new A2AClient({
  agentCard: 'https://agent.example.com/.well-known/agent.json',
  auth: {
    scheme: 'Basic',
    username: process.env.A2A_USERNAME,
    password: process.env.A2A_PASSWORD
  }
});
```

#### Authentication Recommendations

| Scheme | Use Case | Security Level |
|--------|----------|----------------|
| Bearer | Production APIs | ✅ High |
| Basic | Legacy systems | ⚠️ Medium |
| APIKey | Internal services | ⚠️ Medium |
| mTLS | High-security environments | ✅ High |

---

## 2. Encryption & Key Management

### 2.1 At-Rest Encryption

All sensitive data is encrypted using AES-256-GCM:

```typescript
// Encryption configuration
const encryptionConfig = {
  algorithm: 'aes-256-gcm',
  keyDerivation: 'pbkdf2',
  pbkdf2Iterations: 100000,
  saltLength: 32,
  ivLength: 12,
  authTagLength: 16
};
```

### 2.2 In-Transit Encryption

**Minimum Requirements:**
- TLS 1.3 (preferred) or TLS 1.2
- No SSLv3, TLS 1.0, or TLS 1.1
- Strong cipher suites only

```nginx
# Nginx configuration example
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_timeout 1d;
ssl_session_cache shared:SSL:50m;
ssl_session_tickets off;
```

### 2.3 Key Derivation

For password-based key derivation:

```typescript
import { deriveKey } from '@chrysalis/security/crypto';

// Derive encryption key from password
const key = await deriveKey({
  password: userPassword,
  salt: randomSalt,
  iterations: 100000,
  keyLength: 32,
  algorithm: 'sha384'
});
```

---

## 3. Input Validation & Sanitization

### 3.1 Runtime Schema Validation

The platform uses Zod for runtime validation of all external inputs:

```typescript
import { z } from 'zod';
import { StreamEventSchema, parseStreamEvent } from '@chrysalis/a2a-client/schemas';

// Validate stream events
const result = parseStreamEvent(untrustedData);
if (!result.success) {
  logger.error('Invalid stream event', { 
    error: result.error,
    source: connectionId 
  });
  throw new ValidationError('Invalid event format');
}

// Custom schema validation
const UserInputSchema = z.object({
  message: z.string().max(10000).trim(),
  skillId: z.string().optional(),
  sessionId: z.string().uuid().optional()
});
```

### 3.2 Content Security

#### XSS Prevention

```typescript
// Sanitize HTML content
import DOMPurify from 'dompurify';

function sanitizeContent(content: string): string {
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong'],
    ALLOWED_ATTR: []
  });
}
```

#### SQL Injection Prevention

```typescript
// Use parameterized queries
const query = 'SELECT * FROM agents WHERE id = $1';
const result = await db.query(query, [agentId]);

// NEVER do this:
// const query = `SELECT * FROM agents WHERE id = '${agentId}'`; // VULNERABLE
```

### 3.3 Request Size Limits

```typescript
// Configure request limits
const serverConfig = {
  maxRequestBodySize: '1mb',
  maxJsonDepth: 10,
  maxArrayLength: 1000,
  maxStringLength: 100000
};
```

---

## 4. Network Security

### 4.1 Security Headers

The MCP server should include these security headers:

```typescript
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

// Apply headers middleware
app.use((req, res, next) => {
  Object.entries(securityHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  next();
});
```

### 4.2 Rate Limiting

Use the built-in rate limiter to prevent DoS attacks:

```typescript
import { RateLimiter, RateLimitExceededError } from '@chrysalis/shared';

const rateLimiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 60000 // 100 requests per minute
});

// Middleware
async function rateLimitMiddleware(req, res, next) {
  const key = req.ip || req.headers['x-forwarded-for'];
  const result = rateLimiter.tryRequest(key);
  
  if (!result.allowed) {
    res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil(result.resetIn / 1000)
    });
    return;
  }
  
  // Add rate limit headers
  res.set({
    'X-RateLimit-Limit': result.limit,
    'X-RateLimit-Remaining': result.remaining,
    'X-RateLimit-Reset': result.resetAt
  });
  
  next();
}
```

### 4.3 CORS Configuration

```typescript
const corsConfig = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  credentials: true,
  maxAge: 86400 // 24 hours
};
```

---

## 5. API Security

### 5.1 JSON-RPC Security

The platform uses JSON-RPC 2.0. Ensure proper error handling:

```typescript
// Validate JSON-RPC requests
function validateJsonRpcRequest(request: unknown): JsonRpcRequest {
  const schema = z.object({
    jsonrpc: z.literal('2.0'),
    id: z.union([z.string(), z.number(), z.null()]),
    method: z.string().max(100),
    params: z.unknown().optional()
  });
  
  return schema.parse(request);
}

// Error response without leaking internals
function createErrorResponse(id: JsonRpcId, code: number, message: string): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      // NEVER include stack traces in production
      // data: error.stack // VULNERABLE
    }
  };
}
```

### 5.2 Error Handling

Never expose internal details in error responses:

```typescript
// Good: Generic error message
throw new A2AError(
  A2A_ERROR_CODES.INTERNAL_ERROR,
  'An internal error occurred. Please try again.'
);

// Bad: Exposes internal details
throw new A2AError(
  A2A_ERROR_CODES.INTERNAL_ERROR,
  `Database connection failed: ${dbError.message}` // VULNERABLE
);
```

---

## 6. Logging & Monitoring

### 6.1 Security Logging

Log security-relevant events without sensitive data:

```typescript
// Good logging
logger.info('Authentication successful', {
  userId: user.id,
  method: 'Bearer',
  ip: req.ip,
  timestamp: Date.now()
});

// Bad logging - exposes secrets
logger.info('Authentication', {
  token: req.headers.authorization, // NEVER LOG TOKENS
  password: req.body.password // NEVER LOG PASSWORDS
});
```

### 6.2 Audit Logging Requirements

| Event | Log Level | Required Fields |
|-------|-----------|-----------------|
| Authentication success | INFO | userId, method, ip, timestamp |
| Authentication failure | WARN | attemptedUser, method, ip, reason |
| Authorization denied | WARN | userId, resource, action, reason |
| API key rotation | INFO | provider, rotatedBy, timestamp |
| Rate limit exceeded | WARN | key, limit, timestamp |
| Configuration change | INFO | field, oldValue (masked), newValue (masked) |

### 6.3 Log Retention

- Security logs: 1 year minimum
- Access logs: 90 days minimum
- Audit logs: 7 years (compliance)

---

## 7. Secrets Management

### 7.1 Environment Variables

```bash
# .env.example - Document required secrets
WALLET_PASSWORD=          # Strong password for ApiKeyWallet
OPENAI_API_KEY=          # OpenAI API key
ANTHROPIC_API_KEY=       # Anthropic API key
A2A_AUTH_TOKEN=          # A2A authentication token
DATABASE_URL=            # Database connection string
```

### 7.2 Production Recommendations

1. **Use a secrets manager**: AWS Secrets Manager, HashiCorp Vault, Azure Key Vault
2. **Never commit secrets**: Use .gitignore for all .env files
3. **Rotate secrets regularly**: Implement automated rotation
4. **Principle of least privilege**: Grant minimal necessary permissions

```typescript
// Example: Loading secrets from AWS Secrets Manager
import { SecretsManager } from '@aws-sdk/client-secrets-manager';

async function loadSecrets(): Promise<Record<string, string>> {
  const client = new SecretsManager({ region: 'us-east-1' });
  const response = await client.getSecretValue({ SecretId: 'chrysalis/production' });
  return JSON.parse(response.SecretString || '{}');
}
```

---

## 8. Dependency Security

### 8.1 Vulnerability Scanning

Run dependency audits regularly:

```bash
# NPM audit
npm audit --audit-level=high

# Snyk scanning
snyk test

# OWASP Dependency-Check
dependency-check --project chrysalis --scan .
```

### 8.2 Dependency Update Policy

| Severity | SLA | Action |
|----------|-----|--------|
| Critical | 24 hours | Immediate update |
| High | 7 days | Priority update |
| Medium | 30 days | Scheduled update |
| Low | 90 days | Next release |

### 8.3 Lock File Management

Always commit lock files:

```bash
# Verify integrity
npm ci  # Use ci instead of install in CI/CD
```

---

## 9. Container Security

### 9.1 Docker Hardening

```dockerfile
# Use specific version, not :latest
FROM node:20-alpine AS base

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S chrysalis -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy only necessary files
COPY --chown=chrysalis:nodejs package*.json ./
COPY --chown=chrysalis:nodejs dist/ ./dist/

# Run as non-root
USER chrysalis

# Use read-only filesystem where possible
RUN chmod -R 555 /app/dist

# Expose only necessary ports
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
```

### 9.2 Kubernetes Security

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: chrysalis-server
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1001
    fsGroup: 1001
  containers:
  - name: chrysalis
    image: chrysalis:latest
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
          - ALL
    resources:
      limits:
        memory: "512Mi"
        cpu: "500m"
      requests:
        memory: "256Mi"
        cpu: "250m"
```

---

## 10. Security Checklist

### Pre-Deployment Checklist

#### Authentication & Authorization
- [ ] All endpoints require authentication
- [ ] API keys stored securely in ApiKeyWallet
- [ ] Key rotation procedure documented and tested
- [ ] Least privilege principle applied

#### Encryption
- [ ] TLS 1.2+ enabled for all connections
- [ ] Strong cipher suites configured
- [ ] At-rest encryption enabled
- [ ] Certificate expiration monitored

#### Input Validation
- [ ] All inputs validated with Zod schemas
- [ ] Request size limits configured
- [ ] Content-Type validation enabled
- [ ] SQL injection prevention verified

#### Network Security
- [ ] Security headers configured
- [ ] CORS policy restricted
- [ ] Rate limiting enabled
- [ ] Firewall rules configured

#### Logging & Monitoring
- [ ] Security events logged
- [ ] No sensitive data in logs
- [ ] Log retention configured
- [ ] Alerting configured for security events

#### Secrets Management
- [ ] No hardcoded secrets in code
- [ ] Environment variables documented
- [ ] Secrets manager integrated
- [ ] .gitignore includes all sensitive files

#### Dependencies
- [ ] npm audit passing
- [ ] Snyk scan passing
- [ ] Lock file committed
- [ ] Dependency update policy followed

#### Container Security
- [ ] Non-root user configured
- [ ] Read-only filesystem where possible
- [ ] Resource limits set
- [ ] Health checks configured

---

## Incident Response

### Security Incident Procedure

1. **Detect**: Monitor logs and alerts
2. **Contain**: Isolate affected systems
3. **Investigate**: Determine scope and cause
4. **Remediate**: Apply fixes
5. **Recover**: Restore normal operations
6. **Review**: Document lessons learned

### Emergency Contacts

| Role | Contact |
|------|---------|
| Security Lead | security@chrysalis.dev |
| On-Call Engineer | oncall@chrysalis.dev |
| Incident Commander | incident@chrysalis.dev |

---

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [CIS Benchmarks](https://www.cisecurity.org/cis-benchmarks)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

---

*This document should be reviewed quarterly and updated as threats evolve.*
