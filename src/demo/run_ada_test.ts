import { AgentBuilderAdapter, RoleModel } from '../integrations/agentbuilder/AgentBuilderAdapter';
import { AgentId } from '../sync/events/types';
import { MemoryItem } from '../memory/types';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function main() {
  console.log('--- Starting Ada Lovelace Builder Test ---');

  const agentId: AgentId = 'ada-lovelace-agent-v1';
  const roleModel: RoleModel = {
    name: 'Ada Lovelace',
    occupation: 'Mathematician and Metaphysician',
  };
  const deepeningCycles = 3;
  const apiKeys: Record<string, string> = {};
  if (process.env.BRAVE_API_KEY) {
    apiKeys['BRAVE_API_KEY'] = process.env.BRAVE_API_KEY;
  }
  if (process.env.TAVILY_API_KEY) {
    apiKeys['TAVILY_API_KEY'] = process.env.TAVILY_API_KEY;
  }

  console.log(`Building agent '${agentId}' based on Role Model:`, roleModel);
  console.log(`Configuring with ${deepeningCycles} deepening cycles.`);

  const builder = new AgentBuilderAdapter();

  try {
    if (Object.keys(apiKeys).length === 0) {
      console.warn('API keys for BRAVE_API_KEY or TAVILY_API_KEY are not set in .env file. The builder may not function correctly.');
    }
    await builder.buildAgentCapabilities(agentId, roleModel, deepeningCycles, apiKeys);

    console.log('\n--- Agent Build Complete ---');
    console.log('Retrieving learned items from Unified Memory...');

    const memory = builder.getMemory();

    const skills = memory.filter((item: MemoryItem) => item.type === 'skill');
    const knowledge = memory.filter((item: MemoryItem) => item.type === 'knowledge_claim');

    console.log(`\n--- ${skills.length} Skills Learned ---`);
    skills.forEach((item: MemoryItem) => {
      console.log(`Skill: ${item.payload.name}`);
      console.log(`  Description: ${item.payload.description}`);
      console.log(`  Confidence: ${item.payload.confidence}`);
      console.log('---');
    });

    console.log(`\n--- ${knowledge.length} Knowledge Items Learned ---`);
    knowledge.forEach((item: MemoryItem) => {
      console.log(`Knowledge Claim: ${item.payload.name} (${item.payload.type})`);
      console.log(`  ID: ${item.payload.id}`);
      console.log(`  Summary: ${item.payload.text}`);
      console.log(`  Trust Score: ${item.payload.trust_score}`);
      console.log('---');
    });

    console.log('\n--- Test Complete ---');

  } catch (error) {
    console.error('An error occurred during the build process:', error);
    process.exit(1);
  }
}

main();
