import { RoleModel } from '../../integrations/agentbuilder/AgentBuilderAdapter';

export type GroundingRequest = {
  agentId?: string;
  agent?: {
    designation: string;
    bio?: string;
    occupation?: string;
    sourceRef?: string;
  };
  query: string;
  entityType?: string;
  instanceId?: string; // service identity (defaults to capability-gateway:grounding)
};

export type SkillforgeRequest = {
  agentId?: string;
  agent?: {
    designation: string;
    bio?: string;
    occupation?: string;
    sourceRef?: string;
  };
  occupation: string;
  instanceId?: string; // service identity (defaults to capability-gateway:skillforge)
};

export type BuildRequest = {
  agentId?: string;
  agent?: {
    designation: string;
    bio?: string;
    occupation?: string;
    sourceRef?: string;
  };
  roleModel: RoleModel;
  instanceId?: string;
};

export type CapabilityResponse = {
  ok: true;
  agentId: string;
  committed: number;
  txIds: string[];
};
