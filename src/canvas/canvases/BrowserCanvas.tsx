/**
 * Browser Canvas
 * 
 * Canvas for sandboxed browser tabs.
 * Whitelist: BrowserTab
 * Security: iframe sandbox, URL allowlist, CSP
 * 
 * @module canvas/canvases/BrowserCanvas
 */

import React from 'react';
import { BaseCanvas, BaseCanvasProps } from '../BaseCanvas';
import { createWidgetRegistry } from '../WidgetRegistry';
import type { CanvasPolicy, CanvasLogger } from '../types';
import { createLogger } from '../../shared/logger';

// =============================================================================
// Browser Widget Types
// =============================================================================

export type BrowserWidgetType = 'browser_tab';

// =============================================================================
// Browser Canvas Configuration
// =============================================================================

const BROWSER_POLICY: CanvasPolicy = {
  allowlist: ['browser_tab'],
  denylist: [],
  maxNodes: 10, // Limit browser tabs for performance
  maxEdges: 20,
  rateLimit: {
    maxActionsPerMinute: 60,
    maxCreationsPerMinute: 5,
  },
};

/**
 * Create browser canvas widget registry
 */
function createBrowserRegistry(logger: CanvasLogger) {
  const registry = createWidgetRegistry<BrowserWidgetType>(
    'browser',
    ['browser_tab'],
    logger,
    {
      capabilities: ['browser:navigate', 'browser:sandbox'],
    }
  );
  
  // Register browser tab widget
  // TODO: Implement BrowserTabWidget with iframe sandbox
  
  return registry;
}

// =============================================================================
// Browser Canvas Component
// =============================================================================

export interface BrowserCanvasProps extends Omit<BaseCanvasProps<BrowserWidgetType>, 'canvasKind' | 'registry' | 'policy'> {
  policy?: Partial<CanvasPolicy>;
  /** URL allowlist for security */
  urlAllowlist?: string[];
}

export function BrowserCanvas(props: BrowserCanvasProps) {
  const logger = props.logger || createLogger('canvas-browser');
  const registry = React.useMemo(() => createBrowserRegistry(logger), [logger]);
  
  const mergedPolicy: CanvasPolicy = {
    ...BROWSER_POLICY,
    ...props.policy,
    allowlist: props.policy?.allowlist || BROWSER_POLICY.allowlist,
  };
  
  return (
    <BaseCanvas
      canvasKind="browser"
      registry={registry}
      policy={mergedPolicy}
      {...props}
    />
  );
}

export default BrowserCanvas;