import React from 'react';
import { BaseCanvasWithProvider, BaseCanvasProps } from '../BaseCanvas';
import { createWidgetRegistry } from '../WidgetRegistry';
import type { CanvasPolicy } from '../types';

const TERMINAL_BROWSER_POLICY: CanvasPolicy = {
  maxNodes: 50,
  maxEdges: 100,
  rateLimit: { actions: 100, windowMs: 1000 },
  allowedWidgetTypes: ['terminal_session', 'browser_tab', 'code_editor'],
};

export const TerminalBrowserCanvas: React.FC<Omit<BaseCanvasProps, 'canvasKind' | 'registry' | 'policy'>> = (props) => {
  const registry = React.useMemo(() => createWidgetRegistry('terminal-browser', TERMINAL_BROWSER_POLICY.allowedWidgetTypes), []);
  return <BaseCanvasWithProvider {...props} canvasKind="terminal-browser" registry={registry} policy={TERMINAL_BROWSER_POLICY} />;
};

export default TerminalBrowserCanvas;
