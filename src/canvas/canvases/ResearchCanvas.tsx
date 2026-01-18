import React from 'react';
import { BaseCanvasWithProvider, BaseCanvasProps } from '../BaseCanvas';
import { createWidgetRegistry } from '../WidgetRegistry';
import type { CanvasPolicy } from '../types';

const RESEARCH_POLICY: CanvasPolicy = {
  maxNodes: 300,
  maxEdges: 600,
  rateLimit: { actions: 40, windowMs: 1000 },
  allowedWidgetTypes: ['source', 'citation', 'synthesis', 'hypothesis'],
};

export interface ResearchCanvasProps extends Omit<BaseCanvasProps, 'canvasKind' | 'registry' | 'policy'> {}

export const ResearchCanvas: React.FC<ResearchCanvasProps> = (props) => {
  const registry = React.useMemo(
    () => createWidgetRegistry('research', RESEARCH_POLICY.allowedWidgetTypes),
    []
  );

  return (
    <BaseCanvasWithProvider
      {...props}
      canvasKind="research"
      registry={registry}
      policy={RESEARCH_POLICY}
    />
  );
};

export default ResearchCanvas;
