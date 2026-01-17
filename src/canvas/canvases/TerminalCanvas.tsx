/**
 * Terminal Canvas
 * 
 * Canvas for terminal session widgets.
 * Whitelist: TerminalSession only
 * 
 * @module canvas/canvases/TerminalCanvas
 */

import React from 'react';
import { BaseCanvas, BaseCanvasProps } from '../BaseCanvas';
import { createWidgetRegistry } from '../WidgetRegistry';
import type { CanvasKind, CanvasPolicy, CanvasLogger } from '../types';
import { TerminalSessionWidget } from '../widgets/TerminalSessionWidget';
import { createLogger } from '../../shared/logger';

// =============================================================================
// Terminal Widget Types
// =============================================================================

export type TerminalWidgetType = 'terminal_session';

// =============================================================================
// Terminal Canvas Configuration
// =============================================================================

const TERMINAL_POLICY: CanvasPolicy = {
  allowlist: ['terminal_session'],
  denylist: [],
  maxNodes: 20, // Limit concurrent terminal sessions
  maxEdges: 50,
  rateLimit: {
    maxActionsPerMinute: 100,
    maxCreationsPerMinute: 10,
  },
};

/**
 * Create terminal canvas widget registry
 */
function createTerminalRegistry(logger: CanvasLogger) {
  const registry = createWidgetRegistry<TerminalWidgetType>(
    'terminal',
    ['terminal_session'],
    logger,
    {
      capabilities: ['terminal:execute', 'terminal:resize'],
    }
  );
  
  // Register terminal session widget
  registry.register({
    type: 'terminal_session',
    displayName: 'Terminal Session',
    description: 'Interactive terminal session with PTY backend',
    icon: 'terminal',
    renderer: TerminalSessionWidget,
    defaultSize: { width: 600, height: 400 },
    capabilities: ['terminal:execute'],
    schema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
        shell: { type: 'string' },
        cwd: { type: 'string' },
      },
      required: ['sessionId'],
    },
  });
  
  return registry;
}

// =============================================================================
// Terminal Canvas Component
// =============================================================================

export interface TerminalCanvasProps extends Omit<BaseCanvasProps<TerminalWidgetType>, 'canvasKind' | 'registry' | 'policy'> {
  /** Override default policy */
  policy?: Partial<CanvasPolicy>;
}

export function TerminalCanvas(props: TerminalCanvasProps) {
  const logger = props.logger || createLogger('canvas-terminal');
  const registry = React.useMemo(() => createTerminalRegistry(logger), [logger]);
  
  const mergedPolicy: CanvasPolicy = {
    ...TERMINAL_POLICY,
    ...props.policy,
    allowlist: props.policy?.allowlist || TERMINAL_POLICY.allowlist,
  };
  
  return (
    <BaseCanvas
      canvasKind="terminal"
      registry={registry}
      policy={mergedPolicy}
      {...props}
    />
  );
}

export default TerminalCanvas;