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
  | 'ResolutionEvent';

export interface AgentEvent<TPayload = unknown> {
  agentId: AgentId;
  eventId: string; // unique within agent
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

export interface LedgerCommitRequest {
  agentId: AgentId;
  instanceId: InstanceId;
  publicKeyBase64: string;
  event: AgentEvent;
  eventHash: string;
  signatureBase64: string; // signature over eventHash bytes
}

export interface LedgerCommitResponse {
  txId: string;
  acceptedAt: string;
}

export interface LedgerKeyRotateRequest {
  agentId: AgentId;
  instanceId: InstanceId;
  newPublicKeyBase64: string;
  signatureBase64: string; // signature over sha384(`${agentId}:${instanceId}:keyrotate:${newPublicKeyBase64}`)
}

export interface LedgerKeyRotateResponse {
  txId: string;
  acceptedAt: string;
  publicKeyBase64: string;
}

export interface RegistryRegisterRequest {
  agentId: AgentId;
  instanceId: InstanceId;
  publicKeyBase64: string;
  signatureBase64: string; // signature over `${agentId}:${instanceId}:${ts}`
  ts: string;
}

export interface RegistryRegisterResponse {
  ok: true;
  registeredAt: string;
}

export interface PollStartRequest {
  agentId: AgentId;
  key: string;
  candidates: string[]; // claim hashes
}

export interface PollStartResponse {
  pollId: string;
  quorumRequired: number;
}

export interface PollVoteRequest {
  agentId: AgentId;
  pollId: string;
  instanceId: InstanceId;
  publicKeyBase64: string;
  claimHash: string;
  signatureBase64: string; // signature over `${pollId}:${claimHash}`
}

export interface PollStatusResponse {
  pollId: string;
  agentId: AgentId;
  key: string;
  quorumRequired: number;
  votes: Record<string, string>;
  winnerClaimHash?: string;
  decidedAt?: string;
}
