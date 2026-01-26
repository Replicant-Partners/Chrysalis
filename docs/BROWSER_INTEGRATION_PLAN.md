# Embedded Browser Integration Plan

## Status: API Complete, Implementation Pending

**Date**: 2026-01-25
**Integration Progress**: 60% (API/UI Complete, Engine Pending)

---

## Executive Summary

The embedded browser interface has been **structurally integrated** with a complete API layer and enhanced UI controls. The remaining work involves selecting a platform and implementing the actual browser engine integration.

---

## Completed Items ✅

### 1. BrowserService API Layer
- ✅ Created `src/services/browser/BrowserService.ts`
- ✅ Defined complete BrowserAPI interface
- ✅ Implemented tab lifecycle management
- ✅ Added URL validation and security checks
- ✅ Implemented event system (created/updated/closed)
- ✅ Added comprehensive error handling

### 2. Enhanced BrowserTabWidget
- ✅ Integrated with BrowserService
- ✅ Added navigation controls (back/forward/reload/stop)
- ✅ Implemented URL input with keyboard support
- ✅ Added real-time status updates via events
- ✅ Enhanced error display
- ✅ Improved visual design

### 3. Documentation
- ✅ Created comprehensive README (`src/services/browser/README.md`)
- ✅ Documented all three platform options (Electron/Web/Extension)
- ✅ Provided usage examples and API reference
- ✅ Added security considerations
- ✅ Created integration checklist

### 4. Security Foundation
- ✅ URL protocol validation (http/https only)
- ✅ Domain blocklist infrastructure
- ✅ Error handling for malformed URLs
- ✅ Documented CSP requirements
- ✅ Outlined sandboxing strategies

---

## Remaining Tasks 🔲

### Phase 1: Platform Selection (Decision Required)

**Choose one of the following**:

#### Option A: Electron Application
**Best for**: Desktop-first experience with full control

```bash
# Install Electron
npm install --save-dev electron electron-builder

# Configure main process
# See: src/services/browser/README.md - Electron section
```

**Pros**:
- Full Chromium embedding
- Complete navigation control
- Script injection capability
- Screenshot support
- Best user experience

**Cons**:
- Requires Electron app packaging
- Larger distribution size
- More complex build process

#### Option B: Web Application (iframe)
**Best for**: Simple web deployment

```tsx
// Limited but no dependencies
<iframe
  src={url}
  sandbox="allow-scripts allow-same-origin"
  style={{ width: '100%', height: '400px' }}
/>
```

**Pros**:
- No additional dependencies
- Works in browser
- Simple deployment

**Cons**:
- Limited by same-origin policy
- Cannot inject scripts cross-origin
- Limited screenshot capability
- Restricted navigation control

#### Option C: Chrome Extension
**Best for**: Browser-integrated experience

```typescript
// Use Chrome tabs API
chrome.tabs.create({ url });
```

**Pros**:
- Full browser control
- Native Chrome integration
- Can inject scripts anywhere

**Cons**:
- Chrome-only
- Extension approval process
- Users must install extension

---

### Phase 2: Implementation Tasks

Once platform is selected, complete these tasks:

#### 2.1 Browser Engine Integration
- [ ] Implement actual browser embedding (per chosen platform)
- [ ] Wire up navigation methods to real browser
- [ ] Connect event listeners to browser events
- [ ] Test cross-origin behavior

#### 2.2 Core Features
- [ ] Implement `navigate()` with actual browser
- [ ] Implement `goBack()` / `goForward()` / `reload()`
- [ ] Implement `getContent()` to extract page metadata
- [ ] Implement `screenshot()` capability
- [ ] Test timeout handling

#### 2.3 Advanced Features (Optional)
- [ ] Implement `executeScript()` for JS injection
- [ ] Implement `injectCSS()` for style injection
- [ ] Add developer tools integration
- [ ] Add network request interception

#### 2.4 Security Hardening
- [ ] Configure proper CSP headers
- [ ] Implement sandboxing (per platform)
- [ ] Add domain whitelist/blacklist configuration
- [ ] Test XSS prevention
- [ ] Add user consent for navigation

#### 2.5 Testing
- [ ] Write unit tests for BrowserService
- [ ] Write integration tests for BrowserTabWidget
- [ ] Add E2E tests for navigation flows
- [ ] Test error scenarios (timeout, 404, etc.)
- [ ] Performance testing with multiple tabs

#### 2.6 Documentation
- [ ] Update README with actual implementation details
- [ ] Add platform-specific setup instructions
- [ ] Document deployment requirements
- [ ] Create troubleshooting guide

---

## Integration Architecture

```
User Interaction
    ↓
BrowserTabWidget (React)
    ↓ (JavaScript API)
BrowserService (TypeScript)
    ↓ (Platform Bridge)
Browser Engine
    ├─ Electron: <webview> + IPC
    ├─ Web: <iframe> (limited)
    └─ Extension: chrome.tabs
```

---

## Security Checklist

- [x] URL validation (protocol check)
- [x] Domain blocklist infrastructure
- [ ] CSP header configuration
- [ ] Sandbox attribute configuration
- [ ] User permission system
- [ ] XSS prevention testing
- [ ] CSRF token validation
- [ ] Secure communication channel

---

## Testing Strategy

### Unit Tests
```typescript
describe('BrowserService', () => {
  test('validates URLs correctly', () => {
    expect(() => browserService.createTab('ftp://evil.com'))
      .toThrow('Protocol ftp: not allowed');
  });

  test('manages tab lifecycle', () => {
    const tabId = browserService.createTab('https://example.com');
    expect(browserService.getTab(tabId)).toBeDefined();
    browserService.closeTab(tabId);
    expect(browserService.getTab(tabId)).toBeUndefined();
  });
});
```

### Integration Tests
```typescript
describe('BrowserTabWidget Integration', () => {
  test('navigates to URL on button click', async () => {
    const { getByPlaceholderText, getByText } = render(
      <BrowserTabWidget data={...} />
    );
    
    const input = getByPlaceholderText('Enter URL...');
    fireEvent.change(input, { target: { value: 'https://example.com' } });
    fireEvent.click(getByText('Go'));
    
    await waitFor(() => {
      expect(browserService.getTab(tabId).status).toBe('loaded');
    });
  });
});
```

### E2E Tests
```typescript
describe('Browser Integration E2E', () => {
  test('full navigation flow', async () => {
    // Create canvas with browser widget
    // Navigate to URL
    // Verify page loads
    // Go back
    // Verify history works
    // Take screenshot
    // Verify screenshot captured
  });
});
```

---

## Performance Considerations

### Current Limits
- **Max Tabs**: Limited by canvas policy (200 for terminal-browser canvas)
- **Memory**: Each tab adds ~50-100MB (depends on page content)
- **CPU**: Video/animations can increase CPU usage

### Recommendations
- Implement tab suspension for inactive tabs
- Add memory usage monitoring
- Limit concurrent tab creation
- Add tab limit warnings

---

## Deployment Requirements

### Electron Deployment
```bash
# Build distributable
npm run build:electron

# Package for platforms
npm run dist:mac
npm run dist:win
npm run dist:linux
```

### Web Deployment
```bash
# Standard Vite build
npm run build

# Deploy to static hosting
npm run deploy
```

### Extension Deployment
1. Create manifest.json
2. Package extension
3. Submit to Chrome Web Store
4. Users install from store

---

## Migration Path

For projects already using the placeholder widget:

1. **No Breaking Changes**: The updated `BrowserTabWidget` is backward compatible
2. **Data Migration**: Existing widget data structure unchanged
3. **Feature Activation**: Browser features activate once engine integrated
4. **Gradual Rollout**: Can deploy API layer first, engine implementation later

---

## Next Steps (Recommended)

1. **Decision**: Choose platform (Electron recommended for full features)
2. **Prototype**: Implement basic navigation in chosen platform
3. **Test**: Validate core flows work
4. **Iterate**: Add advanced features incrementally
5. **Deploy**: Package and distribute

---

## Resources

- [BrowserService API Reference](../src/services/browser/README.md)
- [Electron WebView Docs](https://www.electronjs.org/docs/latest/api/webview-tag)
- [iframe Sandbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#attr-sandbox)
- [Chrome Extension Tabs API](https://developer.chrome.com/docs/extensions/reference/tabs/)

---

## Questions or Issues?

- Check [INTEGRATION_ANALYSIS_2026-01-25.md](./INTEGRATION_ANALYSIS_2026-01-25.md) Section 6 for detailed assessment
- Review [src/services/browser/README.md](../src/services/browser/README.md) for usage examples
- Open GitHub issue for implementation questions

---

*Integration progress: API complete ✅ | Engine implementation pending 🔲*
