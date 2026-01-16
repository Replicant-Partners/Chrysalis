/**
 * Browser Manager
 *
 * Manages embedded browser tabs:
 * - Tab lifecycle (create, close, activate)
 * - URL validation and security
 * - Navigation
 * - PostMessage communication with iframes
 */

import { EventEmitter } from 'events';
import {
  BrowserTab,
  TabState,
  CreateTabOptions,
  NavigationRequest,
  NavigationResult,
  BrowserSecurityConfig,
  BrowserConfig,
  BrowserMessage,
  BrowserMessageType,
  BrowserEvent,
  BrowserEventType,
  DEFAULT_BROWSER_CONFIG,
  DEFAULT_BROWSER_SECURITY,
} from './types';

// =============================================================================
// URL Validator
// =============================================================================

export class URLValidator {
  private allowPatterns: RegExp[];
  private denyPatterns: RegExp[];
  private config: BrowserSecurityConfig;

  constructor(config: BrowserSecurityConfig) {
    this.config = config;
    this.allowPatterns = config.allowedUrlPatterns.map(p => new RegExp(p, 'i'));
    this.denyPatterns = config.deniedUrlPatterns.map(p => new RegExp(p, 'i'));
  }

  /**
   * Validate a URL against security policy.
   */
  validate(url: string): { valid: boolean; reason?: string; sanitizedUrl?: string } {
    // Check deny list first
    for (const pattern of this.denyPatterns) {
      if (pattern.test(url)) {
        return { valid: false, reason: `URL matches deny pattern: ${pattern.source}` };
      }
    }

    // Check allow list
    let allowed = false;
    for (const pattern of this.allowPatterns) {
      if (pattern.test(url)) {
        allowed = true;
        break;
      }
    }

    if (!allowed) {
      return { valid: false, reason: 'URL does not match any allowed pattern' };
    }

    // Sanitize URL
    let sanitizedUrl = url;

    // Strip credentials if configured
    if (this.config.stripCredentials) {
      try {
        const parsed = new URL(url);
        if (parsed.username || parsed.password) {
          parsed.username = '';
          parsed.password = '';
          sanitizedUrl = parsed.toString();
        }
      } catch {
        // Invalid URL will be caught elsewhere
      }
    }

    // Block mixed content
    if (this.config.blockMixedContent) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol === 'http:' && typeof window !== 'undefined' &&
            window.location.protocol === 'https:') {
          return { valid: false, reason: 'Mixed content blocked (HTTP on HTTPS page)' };
        }
      } catch {
        // Invalid URL
      }
    }

    return { valid: true, sanitizedUrl };
  }

  /**
   * Parse a search query or URL input.
   */
  parseInput(input: string, searchEngine: string): string {
    const trimmed = input.trim();

    // Check if it looks like a URL
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    // Check if it's a domain-like string
    if (/^[\w-]+(\.[\w-]+)+/.test(trimmed) && !trimmed.includes(' ')) {
      return `https://${trimmed}`;
    }

    // Treat as search query
    return searchEngine.replace('%s', encodeURIComponent(trimmed));
  }
}

// =============================================================================
// Browser Manager
// =============================================================================

export class BrowserManager {
  private tabs: Map<string, BrowserTab> = new Map();
  private activeTabId: string | null = null;
  private config: BrowserConfig;
  private validator: URLValidator;
  private emitter = new EventEmitter();
  private messageHandlers: Map<string, (response: unknown) => void> = new Map();
  private tabIdCounter = 0;
  private messageIdCounter = 0;

  // iframe references (set by the UI layer)
  private iframeRefs: Map<string, HTMLIFrameElement> = new Map();

  constructor(config?: Partial<BrowserConfig>) {
    this.config = { ...DEFAULT_BROWSER_CONFIG, ...config };
    this.validator = new URLValidator(this.config.security);
  }

  // ===========================================================================
  // Tab Management
  // ===========================================================================

  /**
   * Create a new browser tab.
   */
  createTab(options: CreateTabOptions): BrowserTab | null {
    // Check tab limit
    if (this.tabs.size >= this.config.security.maxTabs) {
      this.emit('security:warning', undefined, {
        message: `Maximum tabs (${this.config.security.maxTabs}) reached`
      });
      return null;
    }

    // Validate URL
    const validation = this.validator.validate(options.url);
    if (!validation.valid) {
      this.emit('navigation:blocked', undefined, {
        url: options.url,
        reason: validation.reason
      });
      return null;
    }

    const id = `tab_${++this.tabIdCounter}`;
    const tab: BrowserTab = {
      id,
      url: validation.sanitizedUrl || options.url,
      title: options.title || 'New Tab',
      state: 'loading',
      createdAt: Date.now(),
      lastNavigatedAt: Date.now(),
      isActive: options.active ?? true,
      canGoBack: false,
      canGoForward: false,
      isLoading: true,
      loadProgress: 0,
      security: {
        isSecure: options.url.startsWith('https://'),
      },
    };

    this.tabs.set(id, tab);

    // Deactivate other tabs if this one is active
    if (tab.isActive) {
      this.tabs.forEach((t, tabId) => {
        if (tabId !== id) t.isActive = false;
      });
      this.activeTabId = id;
    }

    this.emit('tab:created', id, { tab });

    if (tab.isActive) {
      this.emit('tab:activated', id, { previousTabId: this.activeTabId });
    }

    return tab;
  }

  /**
   * Close a tab.
   */
  closeTab(tabId: string): boolean {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    this.tabs.delete(tabId);
    this.iframeRefs.delete(tabId);

    // If this was the active tab, activate another
    if (this.activeTabId === tabId) {
      const remainingTabs = Array.from(this.tabs.keys());
      this.activeTabId = remainingTabs.length > 0 ? remainingTabs[0] : null;
      if (this.activeTabId) {
        const newActive = this.tabs.get(this.activeTabId)!;
        newActive.isActive = true;
        this.emit('tab:activated', this.activeTabId, { previousTabId: tabId });
      }
    }

    this.emit('tab:closed', tabId, { tab });
    return true;
  }

  /**
   * Get a tab by ID.
   */
  getTab(tabId: string): BrowserTab | undefined {
    return this.tabs.get(tabId);
  }

  /**
   * Get all tabs.
   */
  getTabs(): BrowserTab[] {
    return Array.from(this.tabs.values());
  }

  /**
   * Get the active tab.
   */
  getActiveTab(): BrowserTab | undefined {
    return this.activeTabId ? this.tabs.get(this.activeTabId) : undefined;
  }

  /**
   * Activate a tab.
   */
  activateTab(tabId: string): boolean {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    const previousTabId = this.activeTabId;

    // Deactivate all tabs
    this.tabs.forEach(t => t.isActive = false);

    // Activate this tab
    tab.isActive = true;
    this.activeTabId = tabId;

    this.emit('tab:activated', tabId, { previousTabId });
    return true;
  }

  /**
   * Get tab count.
   */
  getTabCount(): number {
    return this.tabs.size;
  }

  // ===========================================================================
  // Navigation
  // ===========================================================================

  /**
   * Navigate a tab to a URL.
   */
  navigate(request: NavigationRequest): NavigationResult {
    const tab = this.tabs.get(request.tabId);
    if (!tab) {
      return { success: false, url: request.url, blocked: true, blockReason: 'Tab not found' };
    }

    // Validate URL
    const validation = this.validator.validate(request.url);
    if (!validation.valid) {
      this.emit('navigation:blocked', request.tabId, {
        url: request.url,
        reason: validation.reason
      });
      return {
        success: false,
        url: request.url,
        blocked: true,
        blockReason: validation.reason
      };
    }

    const sanitizedUrl = validation.sanitizedUrl || request.url;

    // Update tab state
    tab.state = 'loading';
    tab.isLoading = true;
    tab.loadProgress = 0;
    tab.lastNavigatedAt = Date.now();
    tab.security.isSecure = sanitizedUrl.startsWith('https://');

    this.emit('navigation:start', request.tabId, { url: sanitizedUrl });

    // Send navigation message to iframe
    this.sendToIframe(request.tabId, 'navigate', {
      url: sanitizedUrl,
      replace: request.replace
    });

    return { success: true, url: sanitizedUrl };
  }

  /**
   * Navigate using search/URL input.
   */
  navigateToInput(tabId: string, input: string): NavigationResult {
    const url = this.validator.parseInput(input, this.config.searchEngine);
    return this.navigate({ tabId, url });
  }

  /**
   * Go back in history.
   */
  goBack(tabId: string): void {
    const tab = this.tabs.get(tabId);
    if (tab?.canGoBack) {
      this.sendToIframe(tabId, 'goBack', undefined);
    }
  }

  /**
   * Go forward in history.
   */
  goForward(tabId: string): void {
    const tab = this.tabs.get(tabId);
    if (tab?.canGoForward) {
      this.sendToIframe(tabId, 'goForward', undefined);
    }
  }

  /**
   * Reload the page.
   */
  reload(tabId: string, hard = false): void {
    this.sendToIframe(tabId, 'reload', { hard });
  }

  /**
   * Stop loading.
   */
  stop(tabId: string): void {
    this.sendToIframe(tabId, 'stop', undefined);
  }

  /**
   * Go to home page.
   */
  goHome(tabId: string): void {
    this.navigate({ tabId, url: this.config.homePage });
  }

  // ===========================================================================
  // iframe Communication
  // ===========================================================================

  /**
   * Register an iframe for a tab (called by UI layer).
   */
  registerIframe(tabId: string, iframe: HTMLIFrameElement): void {
    this.iframeRefs.set(tabId, iframe);
  }

  /**
   * Unregister an iframe.
   */
  unregisterIframe(tabId: string): void {
    this.iframeRefs.delete(tabId);
  }

  /**
   * Send a message to an iframe.
   */
  private sendToIframe<T>(tabId: string, type: BrowserMessageType, payload: T): string {
    const iframe = this.iframeRefs.get(tabId);
    const messageId = `msg_${++this.messageIdCounter}`;

    if (iframe?.contentWindow) {
      const message: BrowserMessage<T> = {
        type,
        tabId,
        messageId,
        payload,
        timestamp: Date.now(),
      };

      iframe.contentWindow.postMessage(message, '*');
    }

    return messageId;
  }

  /**
   * Handle a message from an iframe.
   */
  handleIframeMessage(message: BrowserMessage): void {
    const { type, tabId, payload } = message;
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    switch (type) {
      case 'ready':
        // iframe is ready
        break;

      case 'titleChanged':
        tab.title = (payload as { title: string }).title;
        this.emit('tab:updated', tabId, { field: 'title', value: tab.title });
        break;

      case 'urlChanged': {
        const urlPayload = payload as { url: string; canGoBack: boolean; canGoForward: boolean };

        // Validate the new URL
        const validation = this.validator.validate(urlPayload.url);
        if (!validation.valid) {
          this.emit('navigation:blocked', tabId, {
            url: urlPayload.url,
            reason: validation.reason
          });
          // Could send a message to navigate back or to about:blank
          return;
        }

        tab.url = urlPayload.url;
        tab.canGoBack = urlPayload.canGoBack;
        tab.canGoForward = urlPayload.canGoForward;
        tab.security.isSecure = urlPayload.url.startsWith('https://');
        this.emit('tab:updated', tabId, { field: 'url', value: tab.url });
        break;
      }

      case 'loadStart':
        tab.state = 'loading';
        tab.isLoading = true;
        tab.loadProgress = 0;
        break;

      case 'loadProgress':
        tab.loadProgress = (payload as { progress: number }).progress;
        break;

      case 'loadComplete': {
        const completePayload = payload as { url: string; title: string };
        tab.state = 'loaded';
        tab.isLoading = false;
        tab.loadProgress = 100;
        tab.url = completePayload.url;
        tab.title = completePayload.title;
        this.emit('navigation:complete', tabId, { url: tab.url, title: tab.title });
        break;
      }

      case 'loadError': {
        const errorPayload = payload as { url: string; error: string; code?: number };
        tab.state = 'error';
        tab.isLoading = false;
        tab.error = errorPayload.error;
        this.emit('navigation:error', tabId, errorPayload);
        break;
      }

      case 'navigationBlocked': {
        const blockedPayload = payload as { url: string; reason: string };
        tab.state = 'blocked';
        tab.blockReason = blockedPayload.reason;
        this.emit('navigation:blocked', tabId, blockedPayload);
        break;
      }
    }
  }

  /**
   * Generate sandbox attribute value.
   */
  getSandboxAttribute(): string {
    return this.config.security.sandboxFlags.join(' ');
  }

  /**
   * Get referrer policy.
   */
  getReferrerPolicy(): string {
    return this.config.security.referrerPolicy;
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  /**
   * Update security configuration.
   */
  updateSecurityConfig(config: Partial<BrowserSecurityConfig>): void {
    this.config.security = { ...this.config.security, ...config };
    this.validator = new URLValidator(this.config.security);
  }

  /**
   * Get current configuration.
   */
  getConfig(): BrowserConfig {
    return { ...this.config };
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  on(event: BrowserEventType, handler: (e: BrowserEvent) => void): void {
    this.emitter.on(event, handler);
  }

  off(event: BrowserEventType, handler: (e: BrowserEvent) => void): void {
    this.emitter.off(event, handler);
  }

  private emit<T>(type: BrowserEventType, tabId: string | undefined, payload: T): void {
    const event: BrowserEvent<T> = {
      type,
      tabId,
      timestamp: Date.now(),
      payload,
    };
    this.emitter.emit(type, event);
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  /**
   * Close all tabs and clean up.
   */
  dispose(): void {
    this.tabs.forEach((_, tabId) => this.closeTab(tabId));
    this.iframeRefs.clear();
    this.messageHandlers.clear();
    this.emitter.removeAllListeners();
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createBrowserManager(config?: Partial<BrowserConfig>): BrowserManager {
  return new BrowserManager(config);
}
