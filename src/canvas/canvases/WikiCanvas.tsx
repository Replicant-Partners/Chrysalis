import React from 'react';
import { BaseCanvasWithProvider, BaseCanvasProps } from '../BaseCanvas';
import { createWidgetRegistry } from '../WidgetRegistry';
import type { CanvasPolicy } from '../types';

const WIKI_POLICY: CanvasPolicy = {
  maxNodes: 1000,
  maxEdges: 2000,
  rateLimit: { actions: 30, windowMs: 1000 },
  allowedWidgetTypes: ['wiki_page', 'wiki_section', 'wiki_link'],
};

export const WikiCanvas: React.FC<Omit<BaseCanvasProps, 'canvasKind' | 'registry' | 'policy'>> = (props) => {
  const registry = React.useMemo(() => createWidgetRegistry('wiki', WIKI_POLICY.allowedWidgetTypes), []);
  return <BaseCanvasWithProvider {...props} canvasKind="wiki" registry={registry} policy={WIKI_POLICY} />;
};

export default WikiCanvas;
