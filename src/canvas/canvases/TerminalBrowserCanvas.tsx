import React from 'react';

import { BaseCanvasWithProvider } from '../BaseCanvas';
import { createWidgetRegistry } from '../WidgetRegistry';
import { BrowserTabWidget } from '../widgets/BrowserTabWidget';
import { CodeEditorWidget } from '../widgets/CodeEditorWidget';
import { TerminalSessionWidget } from '../widgets/TerminalSessionWidget';

import type { BaseCanvasProps } from '../BaseCanvas';
import type { CanvasPolicy, WidgetDefinition } from '../types';
import type { BrowserTabWidgetData } from '../widgets/BrowserTabWidget';
import type { CodeEditorWidgetData } from '../widgets/CodeEditorWidget';
import type { TerminalSessionWidgetData } from '../widgets/TerminalSessionWidget';



const TERMINAL_BROWSER_POLICY: CanvasPolicy = {
  maxNodes: 200,
  maxEdges: 400,
  rateLimit: { actions: 100, windowMs: 1000 },
  allowedWidgetTypes: ['terminal_session', 'browser_tab', 'code_editor'],
};

const terminalSessionWidgetDef: WidgetDefinition<TerminalSessionWidgetData> = {
  type: 'terminal_session',
  displayName: 'Terminal Session',
  renderer: TerminalSessionWidget,
  capabilities: ['execute', 'read'],
  defaultData: {
    sessionId: crypto.randomUUID(),
    workingDirectory: '/home',
    status: 'idle',
    lastCommand: undefined
  },
  category: 'development',
  icon: '💻'
};

const browserTabWidgetDef: WidgetDefinition<BrowserTabWidgetData> = {
  type: 'browser_tab',
  displayName: 'Browser Tab',
  renderer: BrowserTabWidget,
  capabilities: ['read', 'navigate'],
  defaultData: {
    url: 'https://example.com',
    title: 'New Tab',
    favicon: undefined,
    status: 'loaded'
  },
  category: 'browser',
  icon: '🌐'
};

const codeEditorWidgetDef: WidgetDefinition<CodeEditorWidgetData> = {
  type: 'code_editor',
  displayName: 'Code Editor',
  renderer: CodeEditorWidget,
  capabilities: ['read', 'edit'],
  defaultData: {
    filename: 'untitled.txt',
    language: 'typescript',
    code: '',
    isDirty: false
  },
  category: 'development',
  icon: '📝'
};

export const TerminalBrowserCanvas: React.FC<Omit<BaseCanvasProps, 'canvasKind' | 'registry' | 'policy'>> = (props) => {
  const registry = React.useMemo(() => {
    const reg = createWidgetRegistry('terminal-browser', TERMINAL_BROWSER_POLICY.allowedWidgetTypes);
    reg.register(terminalSessionWidgetDef);
    reg.register(browserTabWidgetDef);
    reg.register(codeEditorWidgetDef);
    return reg;
  }, []);

  return <BaseCanvasWithProvider {...props} canvasKind="terminal-browser" registry={registry} policy={TERMINAL_BROWSER_POLICY} />;
};

export default TerminalBrowserCanvas;
