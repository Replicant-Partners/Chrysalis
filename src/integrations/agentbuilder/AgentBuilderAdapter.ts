// @ts-nocheck
import axios from 'axios';
import { UnifiedMemoryClient } from '../../memory/UnifiedMemoryClient';
import { MemoryItem } from '../../memory/types';
import { AgentId } from '../../sync/events/types';
import yaml from 'js-yaml';
import { createLogger } from '../../shared/logger';

export interface RoleModel {
  name: string;
  occupation: string;
}

export class AgentBuilderAdapter {
  private agentBuilderUrl = 'http://localhost:5000';
  private memoryClient: UnifiedMemoryClient;
  private log = createLogger('agentbuilder-adapter');

  constructor() {
    this.memoryClient = new UnifiedMemoryClient();
  }

  async buildAgentCapabilities(agentId: AgentId, roleModel: RoleModel, deepeningCycles: number = 0, apiKeys: Record<string, string> = {}): Promise<void> {
    const response = await axios.post(`${this.agentBuilderUrl}/build`, { agentId, roleModel, deepeningCycles, apiKeys });
    const buildData = response.data;

    this.log.info('received build data', { agentId, roleModel, deepeningCycles });

    if (buildData.generated_skills) {
      for (const res of buildData.generated_skills) {
        const skillData: any = yaml.load(res.skill);
        if (res.embedding) {
          const memoryItem: MemoryItem = {
            id: `${agentId}:skill:${skillData.skill.replace(/\s/g, '_')}`,
            content: skillData.description || skillData.skill,
            type: 'skill',
            timestamp: new Date().toISOString(),
            source: 'agent',
            embedding: res.embedding,
            metadata: { source_type: 'skillbuilder' },
            privacy: 'PRIVATE',
            payload: {
              name: skillData.skill,
              description: skillData.description,
              confidence: skillData.confidence,
              source: 'skillbuilder',
            },
          };
          this.log.info('inserting skill', { id: memoryItem.id, source: 'skillbuilder' });
          await this.memoryClient.insert(memoryItem);
        }
      }
    }

    if (buildData.generated_knowledge) {
      for (const knowledge of buildData.generated_knowledge) {
        if (knowledge.embedding) {
          const memoryItem: MemoryItem = {
            id: `${agentId}:kc:${knowledge.entity.id}`,
            content: knowledge.entity.text || knowledge.entity.name || '',
            type: 'knowledge_claim',
            timestamp: new Date().toISOString(),
            source: 'agent',
            embedding: knowledge.embedding,
            metadata: { entity_type: knowledge.entity.type || 'unknown' },
            privacy: 'PRIVATE',
            payload: {
              ...knowledge.entity,
              ...knowledge.attributes,
            },
          };
          this.log.info('inserting knowledge', { id: memoryItem.id, source: 'skillbuilder' });
          await this.memoryClient.insert(memoryItem);
        }
      }
    }
  }

  getMemory(): MemoryItem[] {
    return this.memoryClient.getMemory();
  }
}
