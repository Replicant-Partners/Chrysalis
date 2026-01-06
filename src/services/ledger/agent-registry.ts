import crypto from 'crypto';

export type AgentProfile = {
  designation: string;
  bio?: string;
  occupation?: string;
  sourceRef?: string; // optional pointer to a file/artifact
};

export type RegisteredAgent = {
  agentId: string;
  createdAt: string;
  ownerKeyId?: string;
  profile: AgentProfile;
};

export function makeAgentId(profile: AgentProfile, createdAtIso: string): string {
  const slug = slugify(profile.designation || 'replicant');
  const seed = `${profile.sourceRef || ''}\n${profile.designation}\n${profile.occupation || ''}\n${createdAtIso}\n${crypto
    .randomBytes(16)
    .toString('hex')}`;
  const h = crypto.createHash('sha384').update(seed, 'utf8').digest('hex').slice(0, 16);
  return `replicant:${slug}:${h}`;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'replicant';
}
