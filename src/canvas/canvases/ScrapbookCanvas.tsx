import React from 'react';
import { BaseCanvasWithProvider, BaseCanvasProps } from '../BaseCanvas';
import { createWidgetRegistry } from '../WidgetRegistry';
import type { CanvasPolicy } from '../types';

const SCRAPBOOK_POLICY: CanvasPolicy = {
  maxNodes: 500,
  maxEdges: 1000,
  rateLimit: { actions: 50, windowMs: 1000 },
  allowedWidgetTypes: ['artifact', 'note', 'link', 'group'],
};

export interface ScrapbookCanvasProps extends Omit<BaseCanvasProps, 'canvasKind' | 'registry' | 'policy'> {}

export const ScrapbookCanvas: React.FC<ScrapbookCanvasProps> = (props) => {
  const registry = React.useMemo(
    () => createWidgetRegistry('scrapbook', SCRAPBOOK_POLICY.allowedWidgetTypes),
    []
  );

  return (
    <BaseCanvasWithProvider
      {...props}
      canvasKind="scrapbook"
      registry={registry}
      policy={SCRAPBOOK_POLICY}
    />
  );
};

export default ScrapbookCanvas;
