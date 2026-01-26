/**
 * BrowserService - Embedded Browser Management
 * 
 * Manages browser tab instances and provides IPC communication layer
 * for the embedded browser interface.
 * 
 * @module services/browser/BrowserService
 */

export interface BrowserTab {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  status: 'loading' | 'loaded' | 'error';
  error?: string;
}

export interface NavigationOptions {
  url: string;
  timeout?: number;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
}

export interface ScreenshotOptions {
  format?: 'png' | 'jpeg';
  quality?: number;
  fullPage?: boolean;
}

export interface ExecuteScriptOptions {
  script: string;
  args?: any[];
}

/**
 * Browser API interface
 */
export interface BrowserAPI {
  navigate(tabId: string, options: NavigationOptions): Promise<void>;
  goBack(tabId: string): Promise<void>;
  goForward(tabId: string): Promise<void>;
  reload(tabId: string): Promise<void>;
  stop(tabId: string): Promise<void>;
  getContent(tabId: string): Promise<{ title: string; url: string; favicon: string | null }>;
  screenshot(tabId: string, options?: ScreenshotOptions): Promise<Blob>;
  executeScript(tabId: string, options: ExecuteScriptOptions): Promise<any>;
  injectCSS(tabId: string, css: string): Promise<void>;
}

/**
 * Browser service implementation
 * 
 * Note: This is a placeholder implementation that provides the API structure.
 * Actual browser embedding requires platform-specific implementation:
 * - Electron: Use <webview> tags with IPC
 * - Web: Use <iframe> with limitations
 * - Extension: Use chrome.tabs API
 */
export class BrowserService implements BrowserAPI {
  private tabs = new Map<string, BrowserTab>();
  private eventHandlers = new Map<string, Set<(tab: BrowserTab) => void>>();

  /**
   * Validate URL for security
   */
  private validateURL(url: string): void {
    const ALLOWED_PROTOCOLS = ['http:', 'https:'];
    const BLOCKED_DOMAINS = ['malware.example.com']; // Add actual blocked domains

    try {
      const parsed = new URL(url);
      
      if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
        throw new Error(`Protocol ${parsed.protocol} not allowed`);
      }

      if (BLOCKED_DOMAINS.includes(parsed.hostname)) {
        throw new Error(`Domain ${parsed.hostname} is blocked`);
      }
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error('Invalid URL format');
      }
      throw error;
    }
  }

  /**
   * Create a new browser tab
   */
  public createTab(url: string): string {
    this.validateURL(url);

    const id = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const tab: BrowserTab = {
      id,
      url,
      title: 'Loading...',
      status: 'loading',
    };

    this.tabs.set(id, tab);
    this.emitEvent('created', tab);

    // Simulate loading (replace with actual implementation)
    setTimeout(() => {
      const updatedTab = this.tabs.get(id);
      if (updatedTab) {
        updatedTab.status = 'loaded';
        updatedTab.title = 'Page Title'; // Get from actual page
        this.emitEvent('updated', updatedTab);
      }
    }, 1000);

    return id;
  }

  /**
   * Navigate to URL
   */
  public async navigate(tabId: string, options: NavigationOptions): Promise<void> {
    this.validateURL(options.url);

    const tab = this.tabs.get(tabId);
    if (!tab) {
      throw new Error(`Tab ${tabId} not found`);
    }

    tab.status = 'loading';
    tab.url = options.url;
    tab.error = undefined;
    this.emitEvent('updated', tab);

    try {
      // TODO: Implement actual navigation
      // For Electron: webview.loadURL(options.url)
      // For iframe: iframe.src = options.url
      await this.simulateNavigation(options.timeout || 30000);

      tab.status = 'loaded';
      tab.title = 'New Page Title'; // Get from actual page
      this.emitEvent('updated', tab);
    } catch (error) {
      tab.status = 'error';
      tab.error = error instanceof Error ? error.message : 'Navigation failed';
      this.emitEvent('updated', tab);
      throw error;
    }
  }

  /**
   * Go back in history
   */
  public async goBack(tabId: string): Promise<void> {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      throw new Error(`Tab ${tabId} not found`);
    }

    // TODO: Implement actual back navigation
    // For Electron: webview.goBack()
    // For iframe: Limited support
    console.log(`[BrowserService] Going back in tab ${tabId}`);
  }

  /**
   * Go forward in history
   */
  public async goForward(tabId: string): Promise<void> {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      throw new Error(`Tab ${tabId} not found`);
    }

    // TODO: Implement actual forward navigation
    console.log(`[BrowserService] Going forward in tab ${tabId}`);
  }

  /**
   * Reload current page
   */
  public async reload(tabId: string): Promise<void> {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      throw new Error(`Tab ${tabId} not found`);
    }

    await this.navigate(tabId, { url: tab.url });
  }

  /**
   * Stop loading
   */
  public async stop(tabId: string): Promise<void> {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      throw new Error(`Tab ${tabId} not found`);
    }

    // TODO: Implement actual stop
    // For Electron: webview.stop()
    tab.status = 'loaded';
    this.emitEvent('updated', tab);
  }

  /**
   * Get page content metadata
   */
  public async getContent(tabId: string): Promise<{ title: string; url: string; favicon: string | null }> {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      throw new Error(`Tab ${tabId} not found`);
    }

    // TODO: Implement actual content extraction
    // For Electron: webview.getTitle(), webview.getURL()
    return {
      title: tab.title,
      url: tab.url,
      favicon: tab.favicon || null,
    };
  }

  /**
   * Take screenshot
   */
  public async screenshot(tabId: string, options: ScreenshotOptions = {}): Promise<Blob> {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      throw new Error(`Tab ${tabId} not found`);
    }

    // TODO: Implement actual screenshot
    // For Electron: webview.capturePage()
    // For iframe: html2canvas or similar
    
    // Placeholder: Return empty blob
    return new Blob([], { type: `image/${options.format || 'png'}` });
  }

  /**
   * Execute JavaScript in page context
   */
  public async executeScript(tabId: string, options: ExecuteScriptOptions): Promise<any> {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      throw new Error(`Tab ${tabId} not found`);
    }

    // TODO: Implement actual script execution
    // For Electron: webview.executeJavaScript(options.script)
    // For iframe: postMessage with content script
    
    console.log(`[BrowserService] Executing script in tab ${tabId}:`, options.script);
    return null;
  }

  /**
   * Inject CSS into page
   */
  public async injectCSS(tabId: string, css: string): Promise<void> {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      throw new Error(`Tab ${tabId} not found`);
    }

    // TODO: Implement actual CSS injection
    // For Electron: webview.insertCSS(css)
    console.log(`[BrowserService] Injecting CSS in tab ${tabId}`);
  }

  /**
   * Close tab
   */
  public closeTab(tabId: string): void {
    const tab = this.tabs.get(tabId);
    if (tab) {
      this.tabs.delete(tabId);
      this.emitEvent('closed', tab);
    }
  }

  /**
   * Get tab by ID
   */
  public getTab(tabId: string): BrowserTab | undefined {
    return this.tabs.get(tabId);
  }

  /**
   * Get all tabs
   */
  public getAllTabs(): BrowserTab[] {
    return Array.from(this.tabs.values());
  }

  /**
   * Subscribe to tab events
   */
  public on(event: string, handler: (tab: BrowserTab) => void): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        handlers.delete(handler);
      }
    };
  }

  /**
   * Emit event to subscribers
   */
  private emitEvent(event: string, tab: BrowserTab): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(tab));
    }
  }

  /**
   * Simulate navigation (for testing)
   */
  private async simulateNavigation(timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Navigation timeout'));
      }, timeout);

      // Simulate successful navigation after 500ms
      setTimeout(() => {
        clearTimeout(timer);
        resolve();
      }, 500);
    });
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    this.tabs.clear();
    this.eventHandlers.clear();
  }
}

// Export singleton instance
export const browserService = new BrowserService();

export default BrowserService;
