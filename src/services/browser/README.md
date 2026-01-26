# Browser Service

Embedded browser management service for the Chrysalis canvas system.

## Overview

The BrowserService provides a platform-agnostic API for managing embedded browser tabs within the canvas. This allows agents and users to interact with web content directly within the Chrysalis workspace.

## Architecture

```
┌─────────────────────────────────────────┐
│ BrowserTabWidget (React Component)      │
├─────────────────────────────────────────┤
│ - URL input & navigation controls       │
│ - Status display & error handling       │
│ - Event subscription (updates)          │
└──────────────┬──────────────────────────┘
               │ JavaScript API
               ↓
┌─────────────────────────────────────────┐
│ BrowserService (TypeScript)             │
├─────────────────────────────────────────┤
│ - Tab lifecycle management              │
│ - URL validation & security             │
│ - Event emission (created/updated/closed)│
│ - Platform abstraction layer            │
└──────────────┬──────────────────────────┘
               │ Platform-Specific Implementation
               ↓
┌─────────────────────────────────────────┐
│ Browser Engine Integration              │
├─────────────────────────────────────────┤
│ Option A: Electron <webview>            │
│ Option B: iframe (limited)              │
│ Option C: Chrome Extension API          │
└─────────────────────────────────────────┘
```

## Current Status

**Implementation**: ⚠️ **PLACEHOLDER**

The current implementation provides the API structure but **does not include actual browser embedding**. To complete the integration, you need to:

1. Choose a platform (Electron, Web, Extension)
2. Implement platform-specific browser embedding
3. Wire up IPC/messaging between widget and browser
4. Add security sandboxing

## Platform Options

### Option A: Electron App

**Pros**:
- Full browser embedding with Chromium
- Complete control over navigation
- Script injection support
- Screenshot capabilities

**Implementation**:
```tsx
// In BrowserTabWidget
<webview
  id={tabId}
  src={url}
  style={{ width: '100%', height: '400px' }}
  preload="./preload.js"
  allowpopups
/>

// In BrowserService
const webview = document.querySelector(`webview#${tabId}`);
webview.loadURL(options.url);
```

### Option B: Web App (iframe)

**Pros**:
- No additional dependencies
- Works in browser environment

**Cons**:
- Limited by same-origin policy
- Cannot inject scripts cross-origin
- Limited control over navigation

**Implementation**:
```tsx
// In BrowserTabWidget
<iframe
  id={tabId}
  src={url}
  sandbox="allow-scripts allow-same-origin"
  style={{ width: '100%', height: '400px' }}
/>

// Note: Very limited capabilities
```

### Option C: Chrome Extension

**Pros**:
- Full browser control
- Access to Chrome tabs API
- Can inject scripts

**Cons**:
- Chrome-only
- Extension approval process

**Implementation**:
```typescript
// Use chrome.tabs API
const tab = await chrome.tabs.create({ url });
```

## API Reference

### BrowserService

#### Methods

**createTab(url: string): string**
Creates a new browser tab.

```typescript
const tabId = browserService.createTab('https://example.com');
```

**navigate(tabId: string, options: NavigationOptions): Promise<void>**
Navigates tab to a new URL.

```typescript
await browserService.navigate(tabId, {
  url: 'https://example.com',
  timeout: 30000,
  waitUntil: 'networkidle'
});
```

**goBack(tabId: string): Promise<void>**
Navigates back in history.

**goForward(tabId: string): Promise<void>**
Navigates forward in history.

**reload(tabId: string): Promise<void>**
Reloads the current page.

**stop(tabId: string): Promise<void>**
Stops loading the current page.

**getContent(tabId: string): Promise<ContentMetadata>**
Gets page metadata (title, URL, favicon).

**screenshot(tabId: string, options?: ScreenshotOptions): Promise<Blob>**
Captures a screenshot of the page.

**executeScript(tabId: string, options: ExecuteScriptOptions): Promise<any>**
Executes JavaScript in the page context.

**injectCSS(tabId: string, css: string): Promise<void>**
Injects CSS into the page.

**closeTab(tabId: string): void**
Closes the tab.

**on(event: string, handler: (tab: BrowserTab) => void): () => void**
Subscribes to tab events.

#### Events

- **created**: Tab was created
- **updated**: Tab status/content changed
- **closed**: Tab was closed

### Usage Example

```typescript
import { browserService } from '@/services/browser/BrowserService';

// Create tab
const tabId = browserService.createTab('https://example.com');

// Subscribe to updates
const unsubscribe = browserService.on('updated', (tab) => {
  console.log('Tab updated:', tab);
  if (tab.status === 'loaded') {
    // Take screenshot
    browserService.screenshot(tab.id, { format: 'png' })
      .then(blob => {
        // Save or display screenshot
      });
  }
});

// Navigate
await browserService.navigate(tabId, {
  url: 'https://github.com',
  waitUntil: 'networkidle'
});

// Execute script
const result = await browserService.executeScript(tabId, {
  script: 'document.title',
});

// Cleanup
unsubscribe();
browserService.closeTab(tabId);
```

## Security Considerations

### URL Validation

The service validates URLs before navigation:
- **Allowed protocols**: http, https
- **Blocked domains**: Configurable blocklist
- **Malformed URLs**: Rejected

### Sandboxing

**Electron**: Use preload scripts and context isolation
```javascript
// preload.js
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('browser', {
  navigate: (url) => ipcRenderer.invoke('browser:navigate', url)
});
```

**Web (iframe)**: Use sandbox attribute
```html
<iframe sandbox="allow-scripts allow-same-origin"></iframe>
```

### Content Security Policy

Add CSP headers to restrict what embedded content can do:
```
Content-Security-Policy: frame-src https:; script-src 'self'
```

## Integration Checklist

- [ ] Choose platform (Electron/Web/Extension)
- [ ] Implement browser embedding
- [ ] Wire up navigation controls
- [ ] Add event listeners
- [ ] Implement screenshot capture
- [ ] Add script injection (if needed)
- [ ] Configure security sandbox
- [ ] Test cross-origin behavior
- [ ] Add error handling
- [ ] Document platform-specific requirements

## Testing

```bash
# Unit tests
npm run test src/services/browser/

# Integration tests
npm run test:e2e browser-integration.test.ts
```

## Future Enhancements

1. **Tab Groups**: Group related tabs
2. **Session Storage**: Persist tabs across restarts
3. **Developer Tools**: Expose devtools for debugging
4. **Network Interception**: Intercept/modify network requests
5. **Accessibility**: Screen reader support for embedded content

## References

- [Electron WebView](https://www.electronjs.org/docs/latest/api/webview-tag)
- [iframe Sandbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#attr-sandbox)
- [Chrome Extension Tabs API](https://developer.chrome.com/docs/extensions/reference/tabs/)
