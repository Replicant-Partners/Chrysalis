export type AgentId = string;
export type InstanceId = string;

export type Primitive =
  | 'persona'
  | 'rights'
  | 'skills'
  | 'episodic_memory'
  | 'semantic_memory';

export type EventType =
  | 'PersonaUpdated'
  | 'RightGranted'
  | 'RightRevoked'
  | 'SkillAdded'
  | 'SkillDeprecated'
  | 'EpisodicMemoryAdded'
  | 'SemanticClaimUpserted'
  | 'ResolutionEvent'
  | 'KeyRotated';

export interface AgentEvent<TPayload = unknown> {
  agentId: AgentId;
  eventId: string;
  type: EventType;
  primitive: Primitive;
  createdAt: string; // ISO
  payload: TPayload;
  prev?: string; // previous event hash (optional)
}

export interface SemanticClaimPayload {
  key: string;
  value: string;
  confidence: number; // 0..1
  provenance: {
    source: string;
    uri?: string;
    collectedAt?: string;
  };
}

export interface ResolutionEventPayload {
  key: string;
  winnerClaimHash: string;
  suppressedClaimHashes: string[];
  decidedBy: 'ground_truth_service' | 'poll';
  poll?: {
    quorumRequired: number;
    quorumReached: number;
    votes: Record<string, string>; // instanceId -> claimHash
  };
}

export interface KeyRotatedPayload {
  instanceId: InstanceId;
  newPublicKeyBase64: string;
}

export interface SkillAddedPayload {
  name: string;
  description: string;
  confidence: number;
  provenance: {
    source: string;
  };
  embedding?: number[];
}
