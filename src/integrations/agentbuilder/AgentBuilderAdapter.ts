import axios from 'axios';
import { UnifiedMemoryClient } from '../../memory/UnifiedMemoryClient';
import { MemoryItem } from '../../memory/types';
import { AgentId } from '../../sync/events/types';
import yaml from 'js-yaml';

export interface RoleModel {
  name: string;
  occupation: string;
}

export class AgentBuilderAdapter {
  private agentBuilderUrl = 'http://localhost:5000';
  private memoryClient: UnifiedMemoryClient;

  constructor() {
    this.memoryClient = new UnifiedMemoryClient();
  }

  async buildAgentCapabilities(agentId: AgentId, roleModel: RoleModel, deepeningCycles: number = 0, apiKeys: Record<string, string> = {}): Promise<void> {
    const response = await axios.post(`${this.agentBuilderUrl}/build`, { agentId, roleModel, deepeningCycles, apiKeys });
    const buildData = response.data;

    if (buildData.generated_skills) {
      for (const res of buildData.generated_skills) {
        const skillData: any = yaml.load(res.skill);
        if (res.embedding) {
          const memoryItem: MemoryItem = {
            id: `${agentId}:skill:${skillData.skill.replace(/\s/g, '_')}`,
            type: 'skill',
            embedding: res.embedding,
            payload: {
              name: skillData.skill,
              description: skillData.description,
              confidence: skillData.confidence,
              source: 'skillbuilder',
            },
            createdAt: new Date().toISOString(),
          };
          await this.memoryClient.insert(memoryItem);
        }
      }
    }

    if (buildData.generated_knowledge && buildData.generated_knowledge.embedding) {
      const knowledge = buildData.generated_knowledge;
      const memoryItem: MemoryItem = {
        id: `${agentId}:kc:${knowledge.entity.id}`,
        type: 'knowledge_claim',
        embedding: knowledge.embedding,
        payload: {
          ...knowledge.entity,
          ...knowledge.attributes,
        },
        createdAt: new Date().toISOString(),
      };
      await this.memoryClient.insert(memoryItem);
    }
  }

  getMemory(): MemoryItem[] {
    return this.memoryClient.getMemory();
  }
}
