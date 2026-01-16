/**
 * Browser Widget Types
 *
 * Defines the embedded browser for the Terminal-Browser canvas:
 * - Security configuration (sandbox, CSP)
 * - Tab management
 * - Navigation
 * - PostMessage communication
 */

// =============================================================================
// Security Configuration
// =============================================================================

/**
 * iframe sandbox flags.
 * See: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#sandbox
 */
export type SandboxFlag =
  | 'allow-downloads'
  | 'allow-forms'
  | 'allow-modals'
  | 'allow-orientation-lock'
  | 'allow-pointer-lock'
  | 'allow-popups'
  | 'allow-popups-to-escape-sandbox'
  | 'allow-presentation'
  | 'allow-same-origin'
  | 'allow-scripts'
  | 'allow-top-navigation'
  | 'allow-top-navigation-by-user-activation'
  | 'allow-top-navigation-to-custom-protocols';

/**
 * Browser security configuration.
 */
export interface BrowserSecurityConfig {
  /** Sandbox flags to enable */
  sandboxFlags: SandboxFlag[];

  /** Allow list of URL patterns (regex) */
  allowedUrlPatterns: string[];

  /** Deny list of URL patterns (regex) - checked before allow list */
  deniedUrlPatterns: string[];

  /** Allow navigation to external URLs? */
  allowExternalNavigation: boolean;

  /** Strip credentials from URLs? */
  stripCredentials: boolean;

  /** Block mixed content (HTTP on HTTPS page)? */
  blockMixedContent: boolean;

  /** Referrer policy */
  referrerPolicy: ReferrerPolicy;

  /** Maximum concurrent tabs */
  maxTabs: number;
}

export const DEFAULT_BROWSER_SECURITY: BrowserSecurityConfig = {
  sandboxFlags: [
    'allow-same-origin',
    'allow-scripts',
    'allow-forms',
    'allow-popups',
  ],
  allowedUrlPatterns: ['.*'], // Allow all by default
  deniedUrlPatterns: [
    '^file://',           // Block file:// URLs
    '^javascript:',       // Block javascript: URLs
    '^data:text/html',    // Block data:text/html (XSS vector)
  ],
  allowExternalNavigation: true,
  stripCredentials: true,
  blockMixedContent: true,
  referrerPolicy: 'strict-origin-when-cross-origin',
  maxTabs: 20,
};

/**
 * Strict security profile for untrusted content.
 */
export const STRICT_BROWSER_SECURITY: BrowserSecurityConfig = {
  sandboxFlags: [
    'allow-scripts', // No allow-same-origin
  ],
  allowedUrlPatterns: [
    '^https://',      // HTTPS only
  ],
  deniedUrlPatterns: [
    '^file://',
    '^javascript:',
    '^data:',
    '^blob:',
  ],
  allowExternalNavigation: false,
  stripCredentials: true,
  blockMixedContent: true,
  referrerPolicy: 'no-referrer',
  maxTabs: 5,
};

// =============================================================================
// Tab Management
// =============================================================================

/**
 * Browser tab state.
 */
export type TabState =
  | 'loading'
  | 'loaded'
  | 'error'
  | 'blocked';

/**
 * Browser tab information.
 */
export interface BrowserTab {
  /** Unique tab ID */
  id: string;

  /** Current URL */
  url: string;

  /** Page title */
  title: string;

  /** Favicon URL */
  favicon?: string;

  /** Current state */
  state: TabState;

  /** Error message if state is 'error' */
  error?: string;

  /** Block reason if state is 'blocked' */
  blockReason?: string;

  /** Created timestamp */
  createdAt: number;

  /** Last navigation timestamp */
  lastNavigatedAt: number;

  /** Is this the active tab? */
  isActive: boolean;

  /** Can go back? */
  canGoBack: boolean;

  /** Can go forward? */
  canGoForward: boolean;

  /** Is currently loading? */
  isLoading: boolean;

  /** Load progress (0-100) */
  loadProgress: number;

  /** Security info */
  security: {
    isSecure: boolean;
    certificate?: {
      issuer: string;
      validFrom: string;
      validTo: string;
    };
  };
}

/**
 * Options for creating a new tab.
 */
export interface CreateTabOptions {
  url: string;
  title?: string;
  active?: boolean;
  /** Position in tab list (undefined = end) */
  index?: number;
}

// =============================================================================
// Navigation
// =============================================================================

/**
 * Navigation request.
 */
export interface NavigationRequest {
  tabId: string;
  url: string;
  /** Replace current history entry instead of pushing */
  replace?: boolean;
}

/**
 * Navigation result.
 */
export interface NavigationResult {
  success: boolean;
  url: string;
  blocked?: boolean;
  blockReason?: string;
  redirected?: boolean;
  finalUrl?: string;
}

// =============================================================================
// PostMessage Communication
// =============================================================================

/**
 * Message types for host ↔ iframe communication.
 */
export type BrowserMessageType =
  // Host → iframe
  | 'navigate'
  | 'goBack'
  | 'goForward'
  | 'reload'
  | 'stop'
  | 'executeScript'
  | 'getTitle'
  | 'getUrl'
  | 'screenshot'

  // iframe → host
  | 'ready'
  | 'titleChanged'
  | 'urlChanged'
  | 'loadStart'
  | 'loadProgress'
  | 'loadComplete'
  | 'loadError'
  | 'navigationBlocked'
  | 'scriptResult'
  | 'screenshotResult';

/**
 * Message structure for PostMessage.
 */
export interface BrowserMessage<T = unknown> {
  type: BrowserMessageType;
  tabId: string;
  messageId: string;
  payload: T;
  timestamp: number;
}

/**
 * Message payloads by type.
 */
export interface MessagePayloads {
  navigate: { url: string; replace?: boolean };
  goBack: undefined;
  goForward: undefined;
  reload: { hard?: boolean };
  stop: undefined;
  executeScript: { script: string };
  getTitle: undefined;
  getUrl: undefined;
  screenshot: { format?: 'png' | 'jpeg'; quality?: number };

  ready: { userAgent: string };
  titleChanged: { title: string };
  urlChanged: { url: string; canGoBack: boolean; canGoForward: boolean };
  loadStart: { url: string };
  loadProgress: { progress: number };
  loadComplete: { url: string; title: string };
  loadError: { url: string; error: string; code?: number };
  navigationBlocked: { url: string; reason: string };
  scriptResult: { result: unknown; error?: string };
  screenshotResult: { dataUrl: string } | { error: string };
}

// =============================================================================
// Browser Widget Data
// =============================================================================

/**
 * Data stored in a browser widget node.
 */
export interface BrowserWidgetData {
  /** Active tab ID */
  activeTabId?: string;

  /** All tabs */
  tabs: BrowserTab[];

  /** Security configuration */
  security: BrowserSecurityConfig;

  /** Show toolbar? */
  showToolbar: boolean;

  /** Show tab bar? */
  showTabBar: boolean;

  /** User agent override */
  userAgent?: string;

  /** Zoom level (1 = 100%) */
  zoom: number;
}

export const DEFAULT_BROWSER_WIDGET_DATA: BrowserWidgetData = {
  tabs: [],
  security: DEFAULT_BROWSER_SECURITY,
  showToolbar: true,
  showTabBar: true,
  zoom: 1,
};

// =============================================================================
// Browser Events
// =============================================================================

export type BrowserEventType =
  | 'tab:created'
  | 'tab:closed'
  | 'tab:activated'
  | 'tab:updated'
  | 'navigation:start'
  | 'navigation:complete'
  | 'navigation:error'
  | 'navigation:blocked'
  | 'security:warning'
  | 'devtools:opened'
  | 'devtools:closed';

export interface BrowserEvent<T = unknown> {
  type: BrowserEventType;
  tabId?: string;
  timestamp: number;
  payload: T;
}

// =============================================================================
// Browser Configuration
// =============================================================================

export interface BrowserConfig {
  /** Security settings */
  security: BrowserSecurityConfig;

  /** Default home page */
  homePage: string;

  /** Default search engine URL (use %s for query) */
  searchEngine: string;

  /** Enable developer tools (if supported) */
  enableDevTools: boolean;

  /** Default user agent */
  defaultUserAgent?: string;

  /** Preload script to inject (for controlled environments) */
  preloadScript?: string;
}

export const DEFAULT_BROWSER_CONFIG: BrowserConfig = {
  security: DEFAULT_BROWSER_SECURITY,
  homePage: 'about:blank',
  searchEngine: 'https://duckduckgo.com/?q=%s',
  enableDevTools: false,
};
