# User Testing Setup Guide

**Date**: January 15, 2026  
**Version**: 3.1.1  
**Status**: In Progress

---

## Overview

This guide outlines the setup required to prepare Chrysalis for user testing, including backend integration, error tracking, and feedback mechanisms.

---

## 1. Terminal WebSocket Backend

### Installation

```bash
# Install node-pty for PTY support
npm install node-pty
npm install --save-dev @types/node-pty

# Install WebSocket server
npm install ws
npm install --save-dev @types/ws
```

### Starting the Server

```typescript
import { startTerminalServer } from './src/api/terminal/websocket-server';

// Start terminal WebSocket server
await startTerminalServer({
  port: 3001,
  shell: '/bin/bash',
  maxSessions: 100
});

console.log('Terminal server running on ws://localhost:3001');
```

### Frontend Integration

The UI Terminal canvas automatically connects to `ws://localhost:3001` when enabled.

```typescript
// ui/src/components/TerminalCanvas/TerminalCanvas.tsx
const terminalWs = new WebSocket('ws://localhost:3001?id=term-1&cols=80&rows=24');
```

---

## 2. VoyeurBus Observability

### Backend SSE Server

The VoyeurWebServer provides Server-Sent Events for real-time observability:

```typescript
import { VoyeurWebServer } from './src/observability/VoyeurWebServer';

const server = new VoyeurWebServer({ port: 8787 });
await server.start();

// Events are automatically streamed to /voyeur-stream
```

### Frontend Integration

Use the `useVoyeurEvents` hook to subscribe to events:

```typescript
import { useVoyeurEvents } from './hooks/useVoyeurEvents';

function ObservabilityPanel() {
  const { events, isConnected, metrics } = useVoyeurEvents({
    filter: ['memory.add', 'embed.request'],
    maxEvents: 500,
    autoConnect: true
  });

  return (
    <div>
      <p>Connected: {isConnected ? 'Yes' : 'No'}</p>
      <p>Total Events: {metrics.totalEvents}</p>
      <p>Events/sec: {metrics.eventsPerSecond}</p>
      
      {events.map(event => (
        <div key={event.timestamp}>
          {event.kind}: {JSON.stringify(event.data)}
        </div>
      ))}
    </div>
  );
}
```

---

## 3. Error Tracking

### Phase 1: Built-in Error Boundary (✅ Complete)

The `ErrorBoundary` component catches React errors and displays user-friendly messages:

```typescript
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <YourApp />
    </ErrorBoundary>
  );
}
```

Features:
- User-friendly error display
- "Try Again" recovery option
- Error details copy to clipboard
- Development mode stack traces

### Phase 2: Sentry Integration (📋 Planned)

```bash
# Install Sentry
npm install @sentry/react @sentry/vite-plugin

# Add to vite.config.ts
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default {
  plugins: [
    react(),
    sentryVitePlugin({
      org: 'chrysalis',
      project: 'chrysalis-ui',
      authToken: process.env.SENTRY_AUTH_TOKEN
    })
  ]
}
```

```typescript
// Initialize Sentry
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: 'your-sentry-dsn',
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration()
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0
});
```

---

## 4. User Feedback

### Feedback Widget (✅ Complete)

The `FeedbackWidget` provides an in-app feedback mechanism:

```typescript
import { FeedbackWidget } from './components/FeedbackWidget';

function App() {
  const handleFeedback = async (feedback) => {
    // Send to backend or external service
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feedback)
    });
  };

  return (
    <>
      <YourApp />
      <FeedbackWidget onSubmit={handleFeedback} onClose={() => {}} />
    </>
  );
}
```

Features:
- Bug reports
- Feature requests
- General feedback
- Optional email for follow-up
- Automatic metadata collection (URL, user agent, timestamp)

---

## 5. Analytics Setup

### Plausible Analytics (Recommended)

```bash
# Install Plausible tracker
npm install plausible-tracker
```

```typescript
// src/analytics/plausible.ts
import Plausible from 'plausible-tracker';

export const plausible = Plausible({
  domain: 'chrysalis.app',
  apiHost: 'https://plausible.io'
});

// Track page views
plausible.enableAutoPageviews();

// Track custom events
plausible.trackEvent('canvas_created', {
  props: { canvasType: 'board' }
});
```

### Privacy-First Approach

- No cookies
- No PII collection
- Anonymous usage metrics only
- GDPR compliant by default

---

## 6. Development Workflow

### Running Everything Locally

```bash
# Terminal 1: TypeScript core
npm run build

# Terminal 2: Terminal WebSocket server
node dist/api/terminal/run-terminal-server.js

# Terminal 3: VoyeurBus SSE server  
node dist/observability/run-voyeur-server.js

# Terminal 4: UI development server
cd ui && npm run dev

# Terminal 5: Python memory system (optional)
cd memory_system && python3 -m http.server 8000
```

### Environment Variables

```bash
# .env
VITE_TERMINAL_WS_URL=ws://localhost:3001
VITE_VOYEUR_SSE_URL=http://localhost:8787
VITE_SENTRY_DSN=your-sentry-dsn
VITE_PLAUSIBLE_DOMAIN=chrysalis.app
```

---

## 7. Testing Checklist

### Before User Testing

- [ ] TypeScript build passing
- [ ] UI build passing  
- [ ] Terminal WebSocket functional
- [ ] VoyeurBus streaming events
- [ ] Error boundary catches errors
- [ ] Feedback widget functional
- [ ] Analytics tracking events
- [ ] All test suites passing

### User Testing Scenarios

1. **Agent Creation**
   - Create new agent
   - Configure settings
   - Verify settings saved

2. **Canvas System**
   - Create canvas
   - Add widgets
   - Drag/resize widgets
   - Switch canvas types

3. **Terminal Integration**
   - Open terminal canvas
   - Execute commands
   - Verify output

4. **Error Handling**
   - Trigger intentional error
   - Verify error boundary shows
   - Test "Try Again" recovery

5. **Feedback Flow**
   - Submit bug report
   - Submit feature request
   - Verify submission

---

## 8. Known Limitations

### Current State

| Feature | Status | Notes |
|---------|--------|-------|
| Terminal WebSocket | ✅ Complete | Needs deployment testing |
| VoyeurBus UI | ✅ Complete | SSE connection implemented |
| Error Boundary | ✅ Complete | Basic recovery working |
| Feedback Widget | ✅ Complete | Backend integration needed |
| Sentry | 📋 Planned | Week 1 priority |
| Analytics | 📋 Planned | Week 1 priority |
| Session Replay | 📋 Planned | Week 2 priority |

### Browser Support

- Chrome/Edge 90+: ✅ Full support
- Firefox 88+: ✅ Full support
- Safari 14+: ⚠️ Limited testing
- Mobile browsers: ⚠️ Not optimized

---

## 9. Troubleshooting

### Terminal WebSocket Not Connecting

1. Check WebSocket server is running:
   ```bash
   netstat -an | grep 3001
   ```

2. Verify firewall allows WebSocket connections

3. Check browser console for errors

### VoyeurBus Events Not Streaming

1. Verify SSE endpoint is accessible:
   ```bash
   curl http://localhost:8787/voyeur-stream
   ```

2. Check browser EventSource support

3. Verify CORS headers if cross-origin

### Feedback Widget Not Submitting

1. Check network tab for failed requests
2. Verify backend endpoint exists
3. Check console for JavaScript errors

---

## 10. Next Steps

### Week 1 Priorities

1. Deploy Terminal WebSocket to staging
2. Integrate Sentry for error tracking
3. Set up Plausible analytics
4. Create backend endpoint for feedback

### Week 2 Priorities

1. Add session replay (LogRocket/Sentry)
2. Implement E2E tests with Playwright
3. Optimize bundle size with code-splitting
4. Write user documentation

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [USER_TESTING_READINESS_PLAN](../../plans/USER_TESTING_READINESS_PLAN_2026-01-15.md) | Overall plan |
| [ARCHITECTURE](../../ARCHITECTURE.md) | System architecture |
| [STATUS](../STATUS.md) | Current status |

---

**Document Owner**: Engineering Team  
**Last Updated**: January 15, 2026