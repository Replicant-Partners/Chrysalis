import { AgentSpecSummary } from './common-types';
import { CanvasAgent, AgentPosition, createCanvasAgent } from './agent-canvas';

export interface ImportResult {
  agent: CanvasAgent;
  sourceFormat: string;
}

export interface ImportPipelineConfig {}

export class AgentImportPipeline {
  importAgent(spec: any, position: AgentPosition): ImportResult {
    const summary: AgentSpecSummary = {
      name: spec?.identity?.name || 'Agent',
      role: spec?.identity?.role || 'agent',
      goal: spec?.identity?.goal || 'goal',
      version: spec?.version || '1.0.0',
      tools: spec?.capabilities?.tools,
      skills: spec?.capabilities?.skills,
      backstory: spec?.identity?.backstory,
      tags: spec?.metadata?.tags
    };
    const agent = createCanvasAgent(summary, position);
    return { agent, sourceFormat: spec?.sourceFormat || 'usa' };
  }
}

export function getDefaultImportPipeline(): AgentImportPipeline {
  return new AgentImportPipeline();
}
