import React from 'react';

import { BaseCanvasWithProvider } from '../BaseCanvas';
import { createWidgetRegistry } from '../WidgetRegistry';
import { AgentCardWidget } from '../widgets/AgentCardWidget';
import { TeamGroupWidget } from '../widgets/TeamGroupWidget';

import type { BaseCanvasProps } from '../BaseCanvas';
import type { CanvasPolicy, WidgetDefinition } from '../types';
import type { AgentCardData } from '../widgets/AgentCardWidget';
import type { TeamGroupWidgetData } from '../widgets/TeamGroupWidget';

const AGENT_POLICY: CanvasPolicy = {
  maxNodes: 100,
  maxEdges: 200,
  rateLimit: { actions: 50, windowMs: 1000 },
  allowedWidgetTypes: ['agent_card', 'team_group'],
};

const agentCardWidgetDef: WidgetDefinition<AgentCardData> = {
  type: 'agent_card',
  displayName: 'Agent Card',
  renderer: AgentCardWidget,
  capabilities: ['read', 'control'],
  defaultData: {
    agentName: 'New Agent',
    state: 'created',
    memoryStack: undefined
  },
  category: 'agents',
  icon: '🤖'
};

const teamGroupWidgetDef: WidgetDefinition<TeamGroupWidgetData> = {
  type: 'team_group',
  displayName: 'Team Group',
  renderer: TeamGroupWidget,
  capabilities: ['read', 'manage'],
  defaultData: {
    groupName: 'New Team',
    members: [],
    purpose: ''
  },
  category: 'organization',
  icon: '👥'
};

export const AgentCanvas: React.FC<Omit<BaseCanvasProps, 'canvasKind' | 'registry' | 'policy'>> = (props) => {
  const registry = React.useMemo(() => {
    const reg = createWidgetRegistry('agent', AGENT_POLICY.allowedWidgetTypes);
    reg.register(agentCardWidgetDef);
    reg.register(teamGroupWidgetDef);
    return reg;
  }, []);

  return <BaseCanvasWithProvider {...props} canvasKind="agent" registry={registry} policy={AGENT_POLICY} />;
};

export default AgentCanvas;
