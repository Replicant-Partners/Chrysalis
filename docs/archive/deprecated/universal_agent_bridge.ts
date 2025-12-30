/**
 * Universal Agent Bridge
 * 
 * Converts universal agent definitions to framework-specific configurations.
 */

import type {
  UniversalAgent,
  CrewAIConfig,
  ElizaOSConfig,
  UniversalMemory,
  UniversalContext,
  Belief
} from './universal_agent_types';

/**
 * Main bridge class for converting between agent formats
 */
export class AgentBridge {
  constructor(private agent: UniversalAgent) {}

  /**
   * Convert universal agent to CrewAI configuration
   */
  toCrewAI(): CrewAIConfig {
    const adapter = this.agent.adapters?.crewai;

    return {
      agent: {
        role: adapter?.agent?.role || this.agent.identity.designation,
        goal: adapter?.agent?.goal || this.deriveGoalFromAgent(),
        backstory: adapter?.agent?.backstory || this.buildCrewAIBackstory(),
        tools: this.mapToolsForCrewAI(),
        verbose: adapter?.agent?.verbose ?? true,
        allow_delegation: adapter?.agent?.allow_delegation ?? false,
        max_iter: adapter?.agent?.max_iter,
        max_rpm: adapter?.agent?.max_rpm,
      },
      system_prompt: adapter?.system_prompt || this.buildCrewAISystemPrompt(),
      tools_config: this.buildCrewAIToolsConfig()
    };
  }

  /**
   * Convert universal agent to ElizaOS character configuration
   */
  toElizaOS(): ElizaOSConfig {
    const adapter = this.agent.adapters?.elizaos;

    return {
      name: this.agent.identity.name,
      username: this.agent.identity.username,
      bio: this.agent.identity.bio,
      system: adapter?.character?.system || this.buildElizaOSSystemPrompt(),
      templates: adapter?.character?.templates,
      adjectives: adapter?.character?.adjectives || this.agent.personality.core_traits,
      topics: this.agent.knowledge.topics,
      knowledge: this.mapKnowledgeForElizaOS(),
      messageExamples: this.buildElizaOSMessageExamples(),
      postExamples: this.agent.examples?.posts,
      style: this.mapCommunicationStyle(),
      plugins: adapter?.plugins || this.derivePlugins(),
      settings: this.buildElizaOSSettings(adapter?.settings),
      secrets: adapter?.secrets,
      beliefs: this.agent.beliefs
    };
  }

  /**
   * Generate a Python file for CrewAI
   */
  toCrewAIPython(): string {
    const config = this.toCrewAI();
    
    return `# CrewAI Agent: ${this.agent.identity.name}
# Generated from Universal Agent Configuration

from crewai import Agent
${config.tools_config.map(t => t.import_statement).join('\n')}

${this.toPythonVariableName(this.agent.identity.name)}_agent = Agent(
    role="${config.agent.role}",
    goal="${config.agent.goal}",
    backstory="""${config.agent.backstory}""",
    tools=[${config.agent.tools.join(', ')}],
    verbose=${config.agent.verbose ? 'True' : 'False'},
    allow_delegation=${config.agent.allow_delegation ? 'True' : 'False'},
    ${config.agent.max_iter ? `max_iter=${config.agent.max_iter},` : ''}
    ${config.agent.max_rpm ? `max_rpm=${config.agent.max_rpm},` : ''}
)

# System Prompt
SYSTEM_PROMPT = """
${config.system_prompt}
"""
`;
  }

  /**
   * Generate a TypeScript/JSON file for ElizaOS
   */
  toElizaOSJSON(): string {
    const config = this.toElizaOS();
    return JSON.stringify(config, null, 2);
  }

  /**
   * Generate a TypeScript file for ElizaOS
   */
  toElizaOSTypeScript(): string {
    const config = this.toElizaOS();
    
    return `// ElizaOS Character: ${this.agent.identity.name}
// Generated from Universal Agent Configuration

import { Character } from '@elizaos/core';

export const ${this.toCamelCase(this.agent.identity.name)}: Character = ${JSON.stringify(config, null, 2)};
`;
  }

  // ===== Private Helper Methods =====

  private deriveGoalFromAgent(): string {
    const primaryCaps = this.agent.capabilities.primary;
    const values = this.agent.personality.values;
    
    let goal = primaryCaps.slice(0, 2).join(' and ');
    
    if (values.length > 0) {
      goal += ` while upholding ${values.slice(0, 2).join(' and ')}`;
    }
    
    return goal;
  }

  private buildCrewAIBackstory(): string {
    const bio = Array.isArray(this.agent.identity.bio)
      ? this.agent.identity.bio.join(' ')
      : this.agent.identity.bio;
    
    const traits = this.agent.personality.core_traits.join(', ');
    
    let backstory = `${bio}\n\n`;
    backstory += `Known for being ${traits}.\n`;
    
    if (this.agent.personality.values.length > 0) {
      backstory += `\nCore values: ${this.agent.personality.values.join(', ')}.`;
    }
    
    if (this.agent.personality.aspirations && this.agent.personality.aspirations.length > 0) {
      backstory += `\n\nAspirations: ${this.agent.personality.aspirations.join(', ')}.`;
    }
    
    return backstory;
  }

  private buildCrewAISystemPrompt(): string {
    const communication = this.agent.communication.style.all.join('\n- ');
    const beliefs = this.extractPublicBeliefs();
    
    let prompt = `You are ${this.agent.identity.name}, ${this.agent.identity.designation}.\n\n`;
    
    prompt += `Core principles:\n- ${communication}\n\n`;
    
    if (this.agent.personality.quirks.length > 0) {
      prompt += `Your unique traits:\n- ${this.agent.personality.quirks.join('\n- ')}\n\n`;
    }
    
    if (beliefs.length > 0) {
      prompt += `Your core beliefs:\n${beliefs.map(b => `- ${b.content}`).join('\n')}\n\n`;
    }
    
    if (this.agent.communication.signature_phrases && this.agent.communication.signature_phrases.length > 0) {
      prompt += `Your signature phrases:\n${this.agent.communication.signature_phrases.map(p => `- "${p}"`).join('\n')}\n`;
    }
    
    return prompt;
  }

  private mapToolsForCrewAI(): string[] {
    const tools: string[] = [];
    const adapter = this.agent.adapters?.crewai;
    
    if (adapter?.tools) {
      return adapter.tools.map(t => t.name);
    }
    
    // Map capabilities to common CrewAI tools
    for (const capability of this.agent.capabilities.primary) {
      const normalized = capability.toLowerCase().replace(/_/g, ' ');
      
      if (normalized.includes('search') || normalized.includes('research')) {
        tools.push('SerperDevTool()');
      }
      if (normalized.includes('web') || normalized.includes('browse')) {
        tools.push('WebScraperTool()');
      }
      if (normalized.includes('file') || normalized.includes('document')) {
        tools.push('FileReadTool()');
      }
      if (normalized.includes('code') || normalized.includes('programming')) {
        tools.push('CodeInterpreterTool()');
      }
    }
    
    return tools.length > 0 ? tools : ['BaseTool()'];
  }

  private buildCrewAIToolsConfig() {
    const adapter = this.agent.adapters?.crewai;
    
    if (adapter?.tools) {
      return adapter.tools.map(t => ({
        name: t.name,
        import_statement: `from ${t.import_path} import ${t.name}`
      }));
    }
    
    // Default imports based on capabilities
    const imports: Array<{name: string; import_statement: string}> = [];
    const toolNames = this.mapToolsForCrewAI();
    
    if (toolNames.includes('SerperDevTool()')) {
      imports.push({
        name: 'SerperDevTool',
        import_statement: 'from crewai_tools import SerperDevTool'
      });
    }
    if (toolNames.includes('WebScraperTool()')) {
      imports.push({
        name: 'WebScraperTool',
        import_statement: 'from crewai_tools import WebScraperTool'
      });
    }
    if (toolNames.includes('FileReadTool()')) {
      imports.push({
        name: 'FileReadTool',
        import_statement: 'from crewai_tools import FileReadTool'
      });
    }
    
    return imports;
  }

  private buildElizaOSSystemPrompt(): string {
    const bio = Array.isArray(this.agent.identity.bio)
      ? this.agent.identity.bio.join('\n')
      : this.agent.identity.bio;
    
    let prompt = `You are ${this.agent.identity.name}.\n\n${bio}\n\n`;
    
    if (this.agent.personality.core_traits.length > 0) {
      prompt += `Your personality: ${this.agent.personality.core_traits.join(', ')}\n\n`;
    }
    
    const workStyle = this.agent.communication.style.work;
    if (workStyle && workStyle.length > 0) {
      prompt += `Communication style:\n${workStyle.map(s => `- ${s}`).join('\n')}\n\n`;
    }
    
    if (this.agent.knowledge.topics.length > 0) {
      prompt += `Topics you discuss: ${this.agent.knowledge.topics.join(', ')}\n\n`;
    }
    
    return prompt;
  }

  private mapKnowledgeForElizaOS(): Array<string | any> {
    const knowledge: Array<string | any> = [
      ...this.agent.knowledge.facts,
      ...this.agent.knowledge.expertise.map(e => `Expert in ${e}`)
    ];
    
    if (this.agent.knowledge.sources) {
      knowledge.push(...this.agent.knowledge.sources);
    }
    
    return knowledge;
  }

  private buildElizaOSMessageExamples() {
    if (!this.agent.examples?.conversations) {
      return undefined;
    }
    
    return this.agent.examples.conversations.map(conversation =>
      conversation.map(msg => ({
        name: msg.role === 'user' ? '{{user}}' : this.agent.identity.name,
        content: { text: msg.content }
      }))
    );
  }

  private mapCommunicationStyle() {
    const style: any = {
      all: this.agent.communication.style.all
    };
    
    if (this.agent.communication.style.casual) {
      style.chat = this.agent.communication.style.casual;
    }
    
    if (this.agent.communication.style.social) {
      style.post = this.agent.communication.style.social;
    }
    
    return style;
  }

  private derivePlugins(): string[] {
    const plugins: string[] = [
      '@elizaos/plugin-bootstrap',  // Always include
      '@elizaos/plugin-sql'         // Memory storage
    ];
    
    // Add plugins based on capabilities
    const capabilities = this.agent.capabilities.primary.map(c => c.toLowerCase());
    
    if (capabilities.some(c => c.includes('search') || c.includes('web'))) {
      plugins.push('@elizaos/plugin-web-search');
    }
    
    if (capabilities.some(c => c.includes('image') || c.includes('visual'))) {
      plugins.push('@elizaos/plugin-image');
    }
    
    if (capabilities.some(c => c.includes('voice') || c.includes('audio'))) {
      plugins.push('@elizaos/plugin-voice');
    }
    
    return plugins;
  }

  private buildElizaOSSettings(adapterSettings?: Record<string, any>) {
    const settings: Record<string, any> = {
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 2000,
      ...adapterSettings
    };
    
    if (this.agent.avatar) {
      settings.avatar = this.agent.avatar.image_url || this.agent.avatar.description;
    }
    
    if (this.agent.voice) {
      settings.voice = {
        model: this.agent.voice.model,
        speaker: this.agent.voice.speaker,
        speed: this.agent.voice.speed,
        pitch: this.agent.voice.pitch
      };
    }
    
    return settings;
  }

  private extractPublicBeliefs(): Belief[] {
    const allBeliefs = [
      ...this.agent.beliefs.who,
      ...this.agent.beliefs.what,
      ...this.agent.beliefs.why,
      ...this.agent.beliefs.how,
      ...(this.agent.beliefs.huh || [])
    ];
    
    return allBeliefs
      .filter(b => b.privacy === 'PUBLIC' && b.conviction > 0.7)
      .sort((a, b) => b.conviction - a.conviction);
  }

  private toPythonVariableName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  private toCamelCase(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .split(' ')
      .map((word, index) => 
        index === 0 
          ? word.toLowerCase() 
          : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join('');
  }
}

/**
 * Memory Bridge - Manages shared memory across frameworks
 */
export class MemoryBridge {
  private memories: Map<string, UniversalMemory> = new Map();

  async store(memory: UniversalMemory): Promise<void> {
    this.memories.set(memory.id, memory);
    // TODO: Implement actual vector DB storage
  }

  async retrieve(agentId: string, query: string, limit: number = 10): Promise<UniversalMemory[]> {
    // TODO: Implement semantic search
    return Array.from(this.memories.values())
      .filter(m => m.agentId === agentId)
      .slice(0, limit);
  }

  async search(embedding: number[], limit: number = 10): Promise<UniversalMemory[]> {
    // TODO: Implement vector similarity search
    return Array.from(this.memories.values()).slice(0, limit);
  }

  /**
   * Format memories for CrewAI context
   */
  toCrewAIContext(memories: UniversalMemory[]): string {
    return memories
      .map(m => `[${m.type}] ${m.content}`)
      .join('\n');
  }

  /**
   * Format memories for ElizaOS context
   */
  toElizaOSContext(memories: UniversalMemory[]): {
    text: string;
    data: Record<string, any>;
  } {
    return {
      text: memories.map(m => m.content).join('\n\n'),
      data: {
        memories: memories.map(m => ({
          id: m.id,
          type: m.type,
          content: m.content,
          timestamp: m.timestamp
        }))
      }
    };
  }
}

/**
 * Utility functions for agent conversion
 */
export class AgentConverter {
  /**
   * Convert ElizaOS character to Universal Agent
   */
  static fromElizaOS(character: any): UniversalAgent {
    return {
      identity: {
        name: character.name,
        designation: character.designation || character.name,
        bio: character.bio,
        username: character.username
      },
      personality: {
        core_traits: character.adjectives || [],
        values: character.personality?.values || [],
        quirks: character.personality?.quirks || [],
        fears: character.personality?.fears,
        aspirations: character.personality?.aspirations
      },
      communication: {
        style: character.style || { all: [] },
        signature_phrases: character.signature_phrases,
        emotional_ranges: character.emotional_ranges
      },
      capabilities: {
        primary: character.capabilities?.primary || [],
        secondary: character.capabilities?.secondary || [],
        domains: character.topics || []
      },
      knowledge: {
        facts: Array.isArray(character.knowledge) 
          ? character.knowledge.filter((k: any) => typeof k === 'string')
          : [],
        topics: character.topics || [],
        expertise: character.expertise || [],
        sources: Array.isArray(character.knowledge)
          ? character.knowledge.filter((k: any) => typeof k === 'object')
          : [],
        lore: character.lore
      },
      memory: {
        type: 'vector',
        provider: 'qdrant',
        settings: {
          collection: `${character.name.toLowerCase().replace(/\s+/g, '_')}_memories`
        }
      },
      beliefs: character.beliefs || { who: [], what: [], why: [], how: [] },
      examples: {
        conversations: character.messageExamples,
        posts: character.postExamples
      }
    };
  }

  /**
   * Convert CrewAI agent definition to Universal Agent
   */
  static fromCrewAI(agent: any): UniversalAgent {
    // Extract traits from backstory
    const traits = agent.backstory?.match(/Known for being ([^.]+)/)?.[1]
      ?.split(',').map((t: string) => t.trim()) || [];
    
    return {
      identity: {
        name: agent.role,
        designation: agent.role,
        bio: agent.backstory || ''
      },
      personality: {
        core_traits: traits,
        values: [],
        quirks: []
      },
      communication: {
        style: {
          all: ['Be professional', 'Be thorough', 'Be helpful']
        }
      },
      capabilities: {
        primary: [agent.role.toLowerCase()],
        secondary: [],
        domains: [],
        tools: agent.tools?.map((t: any) => t.name || t) || []
      },
      knowledge: {
        facts: [],
        topics: [],
        expertise: [agent.role]
      },
      memory: {
        type: 'vector',
        provider: 'qdrant',
        settings: {}
      },
      beliefs: {
        who: [],
        what: [],
        why: [],
        how: []
      }
    };
  }
}
