import React from 'react';
import { BaseCanvasWithProvider, BaseCanvasProps } from '../BaseCanvas';
import { createWidgetRegistry } from '../WidgetRegistry';
import type { CanvasPolicy } from '../types';

const AGENT_POLICY: CanvasPolicy = {
  maxNodes: 100,
  maxEdges: 200,
  rateLimit: { actions: 50, windowMs: 1000 },
  allowedWidgetTypes: ['agent_card', 'team_group'],
};

export const AgentCanvas: React.FC<Omit<BaseCanvasProps, 'canvasKind' | 'registry' | 'policy'>> = (props) => {
  const registry = React.useMemo(() => createWidgetRegistry('agent', AGENT_POLICY.allowedWidgetTypes), []);
  return <BaseCanvasWithProvider {...props} canvasKind="agent" registry={registry} policy={AGENT_POLICY} />;
};

export default AgentCanvas;
