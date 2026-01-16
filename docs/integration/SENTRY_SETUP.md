# Sentry Error Tracking Setup

**Version**: 3.1.1  
**Date**: January 15, 2026  
**Status**: Production Ready

---

## Overview

Sentry provides comprehensive error tracking, performance monitoring, and session replay for Chrysalis.

---

## Quick Start

### 1. Create Sentry Account

1. Go to [sentry.io](https://sentry.io)
2. Create account or sign in
3. Create new project: **React**
4. Copy your DSN

### 2. Configure Environment Variables

```bash
# ui/.env.production
VITE_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
VITE_APP_VERSION=3.1.1

# For source map upload (CI/CD only)
SENTRY_ORG=your-org-name
SENTRY_PROJECT=chrysalis-ui
SENTRY_AUTH_TOKEN=your-auth-token
```

### 3. Build and Deploy

```bash
cd ui
npm run build
npm run preview
```

---

## Features Enabled

### ✅ Error Tracking

**Automatic Error Capture**:
- JavaScript exceptions
- Unhandled promise rejections
- React component errors (via ErrorBoundary)
- Network errors

**Manual Error Capture**:
```typescript
import { captureException } from './utils/sentry';

try {
  // risky operation
} catch (error) {
  captureException(error as Error, {
    context: 'user-action',
    userId: user.id
  });
}
```

### ✅ Performance Monitoring

**Automatic Tracking**:
- Page load times
- Navigation performance
- Component render times
- API call duration

**Manual Transactions**:
```typescript
import { startTransaction } from './utils/sentry';

const transaction = startTransaction('data-processing', 'task');
try {
  // long running task
} finally {
  transaction.finish();
}
```

### ✅ Session Replay

**Configuration**:
- 10% of normal sessions recorded
- 100% of error sessions recorded
- Text and media masked for privacy

**What's Captured**:
- User interactions (clicks, scrolls)
- DOM mutations
- Network requests
- Console logs

**Privacy**:
- All text masked by default
- All media blocked by default
- Can be configured per-element

### ✅ User Context

**Set User Information**:
```typescript
import { setUser } from './utils/sentry';

setUser({
  id: user.id,
  email: user.email,
  username: user.username
});

// Clear on logout
setUser(null);
```

### ✅ Breadcrumbs

**Automatic Breadcrumbs**:
- Navigation
- Console logs
- Network requests
- DOM events

**Manual Breadcrumbs**:
```typescript
import { addBreadcrumb } from './utils/sentry';

addBreadcrumb({
  message: 'User clicked generate button',
  category: 'user-action',
  level: 'info',
  data: {
    buttonId: 'generate-btn',
    timestamp: Date.now()
  }
});
```

---

## Configuration

### Sampling Rates

```typescript
// ui/src/utils/sentry.ts
{
  tracesSampleRate: 0.1,           // 10% of transactions
  replaysSessionSampleRate: 0.1,   // 10% of sessions  
  replaysOnErrorSampleRate: 1.0    // 100% of error sessions
}
```

**Adjust based on traffic**:
- Low traffic (<1k users/day): 1.0 (100%)
- Medium traffic (1k-10k): 0.1 (10%)
- High traffic (>10k): 0.01 (1%)

### Ignored Errors

```typescript
ignoreErrors: [
  'ResizeObserver loop limit exceeded',
  'ResizeObserver loop completed with undelivered notifications',
  'Non-Error promise rejection captured',
]
```

Add more patterns as needed.

### Environment Detection

```typescript
beforeSend(event) {
  if (environment === 'development') {
    console.log('[Sentry] Would send:', event);
    return null; // Don't send in development
  }
  return event;
}
```

---

## Source Maps

### Why Source Maps?

Source maps allow Sentry to show original TypeScript code instead of minified JavaScript in error stack traces.

### Setup

```bash
# Install Sentry CLI
npm install -g @sentry/cli

# Login
sentry-cli login

# Upload source maps (automatic via Vite plugin)
npm run build
```

### Manual Upload

```bash
sentry-cli sourcemaps upload \
  --org your-org \
  --project chrysalis-ui \
  --release 3.1.1 \
  ./ui/dist
```

### Verify

```bash
sentry-cli releases files 3.1.1 list
```

---

## Integration with FeedbackWidget

```typescript
// ui/src/components/FeedbackWidget/FeedbackWidget.tsx
import { captureMessage } from '../../utils/sentry';

const handleSubmit = async (feedback) => {
  // Send to Sentry
  captureMessage(`User feedback: ${feedback.title}`, 'info', {
    type: feedback.type,
    description: feedback.description,
    email: feedback.email
  });
  
  // Also send to backend
  await onSubmit(feedback);
};
```

---

## Alerts & Notifications

### Email Alerts

1. Go to **Settings** → **Alerts**
2. Create new alert rule
3. Conditions:
   - Event is first seen
   - Event frequency is above X
   - Error rate increases by Y%

### Slack Integration

1. Go to **Settings** → **Integrations** → **Slack**
2. Connect workspace
3. Configure alert routing

### Webhook Integration

```bash
# Webhook URL
https://your-webhook.com/sentry

# Payload example
{
  "event": "error",
  "error": {
    "title": "TypeError: Cannot read property",
    "url": "https://app.com/dashboard",
    "user": { "id": "123" }
  }
}
```

---

## Monitoring Dashboard

### Key Metrics

1. **Error Rate**: Errors per session
2. **User Impact**: % users affected
3. **Crash-Free Sessions**: % sessions without crashes
4. **Performance**: P75/P95 load times

### Custom Dashboards

Create dashboards for:
- Critical errors (high impact)
- Performance regressions
- User experience metrics
- Feature adoption

---

## Best Practices

### ✅ DO

- Set user context on login
- Add breadcrumbs for important actions
- Use meaningful error messages
- Group similar errors with fingerprints
- Review errors weekly
- Set up meaningful alerts

### ❌ DON'T

- Log sensitive data (passwords, tokens)
- Send PII without consent
- Ignore warning-level events
- Set sample rate too high (cost)
- Disable source maps
- Leave errors unresolved

---

## Troubleshooting

### Errors Not Appearing in Sentry

1. Check DSN is correct
2. Verify `VITE_SENTRY_DSN` in `.env`
3. Check browser console for Sentry init
4. Ensure production build (`npm run build`)

### Source Maps Not Working

1. Verify `sourcemap: true` in `vite.config.ts`
2. Check auth token is valid
3. Verify release matches deployed version
4. Run `sentry-cli releases files <version> list`

### Too Many Events

1. Reduce sample rates
2. Add more ignored errors
3. Implement rate limiting
4. Use event fingerprinting

### High Costs

1. Lower `tracesSampleRate`
2. Lower `replaysSessionSampleRate`
3. Filter out low-value errors
4. Use conditional capturing

---

## Cost Optimization

### Free Tier

- 5,000 errors/month
- 1 GB attachments
- 30 days retention

### Paid Plans

Start at $26/month:
- 50,000 errors/month
- 10 GB attachments
- 90 days retention

### Optimization Strategies

1. **Smart Sampling**:
   ```typescript
   tracesSampleRate: user.isPaid ? 1.0 : 0.1
   ```

2. **Conditional Replay**:
   ```typescript
   replaysSessionSampleRate: isImportantPage ? 0.5 : 0.1
   ```

3. **Filter Low-Value Errors**:
   ```typescript
   beforeSend(event) {
     if (event.level === 'warning') return null;
     return event;
   }
   ```

---

## Security & Privacy

### Data Scrubbing

```typescript
beforeSend(event) {
  // Remove sensitive data
  if (event.request?.headers) {
    delete event.request.headers['Authorization'];
    delete event.request.headers['Cookie'];
  }
  return event;
}
```

### GDPR Compliance

1. Add privacy policy disclosure
2. Allow users to opt-out
3. Delete user data on request
4. Set data retention limits

### IP Anonymization

Enable in Sentry settings:
**Settings** → **Security & Privacy** → **Data Scrubbing**

---

## Advanced Features

### Release Tracking

```bash
# Create release
sentry-cli releases new 3.1.1

# Associate commits
sentry-cli releases set-commits 3.1.1 --auto

# Deploy
sentry-cli releases deploys 3.1.1 new -e production
```

### Custom Tags

```typescript
Sentry.setTag('user_plan', 'premium');
Sentry.setTag('feature_flag', 'new_ui');
```

### Performance Monitoring

```typescript
import * as Sentry from '@sentry/react';

const transaction = Sentry.startTransaction({
  op: 'page_load',
  name: 'Dashboard'
});

const span = transaction.startChild({
  op: 'fetch',
  description: 'GET /api/data'
});

// ... operation ...

span.finish();
transaction.finish();
```

---

## Testing

### Local Testing

```typescript
// ui/src/utils/sentry.ts
// Temporarily enable in development
enabled: true // Override for testing
```

### Staging Environment

```bash
# .env.staging
VITE_SENTRY_DSN=https://staging-dsn
VITE_SENTRY_ENVIRONMENT=staging
```

### Production Validation

1. Deploy to production
2. Trigger test error
3. Verify in Sentry dashboard
4. Check source maps resolve
5. Verify user context captured

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [ERROR_HANDLING](ERROR_HANDLING.md) | Error handling patterns |
| [DEPLOYMENT_GUIDE](../deployment/DEPLOYMENT_GUIDE.md) | Deployment instructions |
| [MONITORING](MONITORING.md) | Monitoring overview |

---

**Document Owner**: DevOps Team  
**Last Updated**: January 15, 2026