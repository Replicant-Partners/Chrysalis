/**
 * ElizaOS Framework Adapter
 * 
 * Bidirectional conversion between ElizaOS character format
 * and Universal Agent format.
 */

import { FrameworkAdapter, type EncryptedShadow, type FieldMapping } from '../core/FrameworkAdapter';
import { UniversalAgent, ValidationResult, SCHEMA_VERSION } from '../core/UniversalAgent';
import { generateFingerprint } from '../core/Encryption';

/**
 * ElizaOS Character interface (subset)
 */
export interface ElizaOSCharacter {
  name: string;
  username?: string;
  bio: string | string[];
  system?: string;
  templates?: Record<string, string>;
  adjectives?: string[];
  topics?: string[];
  knowledge?: Array<string | any>;
  messageExamples?: Array<Array<{
    name: string;
    content: { text: string };
  }>>;
  postExamples?: string[];
  style?: {
    all?: string[];
    chat?: string[];
    post?: string[];
    [key: string]: string[] | undefined;
  };
  plugins?: string[];
  settings?: Record<string, any>;
  secrets?: Record<string, string>;
  beliefs?: {
    who?: Array<{ content: string; conviction: number; privacy: string; source: string }>;
    what?: Array<{ content: string; conviction: number; privacy: string; source: string }>;
    why?: Array<{ content: string; conviction: number; privacy: string; source: string }>;
    how?: Array<{ content: string; conviction: number; privacy: string; source: string }>;
    huh?: Array<{ content: string; conviction: number; privacy: string; source: string }>;
  };
}

/**
 * ElizaOS Framework Adapter
 */
export class ElizaOSAdapter extends FrameworkAdapter {
  readonly name = 'elizaos';
  readonly version = '1.0.0';
  readonly supports_shadow = true;
  
  protected fieldMapping: FieldMapping = {
    direct: {
      'identity.name': 'name',
      'identity.username': 'username',
      'identity.bio': 'bio',
      'personality.core_traits': 'adjectives',
      'knowledge.topics': 'topics',
      'beliefs': 'beliefs'
    },
    partial: {
      'communication.style': (agent) => agent.style || { all: [] },
      'knowledge.facts': (agent) => this.extractFacts(agent.knowledge),
      'training.conversations': (agent) => this.convertMessageExamples(agent.messageExamples)
    },
    nonMappable: []  // ElizaOS is feature-rich, most things map
  };
  
  /**
   * Convert ElizaOS character to Universal Agent
   */
  async toUniversal(character: ElizaOSCharacter): Promise<UniversalAgent> {
    const now = new Date().toISOString();
    
    // Generate fingerprint
    const fingerprint = generateFingerprint({
      name: character.name,
      designation: character.name,
      created: now,
      id: crypto.randomUUID()
    });
    
    const universal: UniversalAgent = {
      schema_version: SCHEMA_VERSION,
      
      identity: {
        id: crypto.randomUUID(),
        name: character.name,
        designation: character.name,  // ElizaOS doesn't have separate designation
        bio: character.bio,
        username: character.username,
        fingerprint
      },
      
      personality: {
        core_traits: character.adjectives || [],
        values: this.extractValues(character),
        quirks: this.extractQuirks(character),
        fears: [],
        aspirations: []
      },
      
      communication: {
        style: {
          all: character.style?.all || [],
          ...character.style
        },
        signature_phrases: [],
        voice: undefined
      },
      
      capabilities: {
        primary: character.topics?.slice(0, 3) || [],
        secondary: character.topics?.slice(3) || [],
        domains: character.topics || [],
        tools: this.extractTools(character.plugins)
      },
      
      knowledge: {
        facts: this.extractFacts(character.knowledge),
        topics: character.topics || [],
        expertise: character.topics || [],
        sources: this.extractKnowledgeSources(character.knowledge)
      },
      
      memory: {
        type: 'hybrid',
        provider: 'qdrant',
        settings: character.settings || {}
      },
      
      beliefs: {
        who: this.normalizeBeliefsArray(character.beliefs?.who),
        what: this.normalizeBeliefsArray(character.beliefs?.what),
        why: this.normalizeBeliefsArray(character.beliefs?.why),
        how: this.normalizeBeliefsArray(character.beliefs?.how),
        huh: character.beliefs?.huh ? this.normalizeBeliefsArray(character.beliefs.huh) : undefined
      },
      
      training: {
        conversations: this.convertMessageExamples(character.messageExamples),
        demonstrations: character.postExamples?.map(post => ({
          input: 'social_post',
          output: post
        }))
      },
      
      metadata: {
        version: '1.0.0',
        created: now,
        updated: now,
        source_framework: 'elizaos'
      }
    };
    
    return universal;
  }
  
  /**
   * Convert Universal Agent to ElizaOS character
   */
  async fromUniversal(universal: UniversalAgent): Promise<ElizaOSCharacter> {
    const character: ElizaOSCharacter = {
      name: universal.identity.name,
      username: universal.identity.username,
      bio: universal.identity.bio,
      system: this.buildSystemPrompt(universal),
      adjectives: universal.personality.core_traits,
      topics: universal.knowledge.topics,
      knowledge: [
        ...universal.knowledge.facts,
        ...(universal.knowledge.sources || [])
      ],
      messageExamples: this.convertToMessageExamples(universal.training?.conversations),
      postExamples: universal.training?.demonstrations?.map(d => d.output),
      style: universal.communication.style,
      plugins: this.inferPlugins(universal),
      settings: universal.memory.settings,
      beliefs: universal.beliefs
    };
    
    return character;
  }
  
  /**
   * Embed encrypted shadow in ElizaOS character
   */
  async embedShadow(
    character: ElizaOSCharacter,
    shadow: EncryptedShadow
  ): Promise<ElizaOSCharacter> {
    return {
      ...character,
      settings: {
        ...(character.settings || {}),
        _agent_metadata: {
          morphable_agent: {
            shadow,
            framework_version: this.version,
            created: new Date().toISOString()
          }
        }
      }
    };
  }
  
  /**
   * Extract encrypted shadow from ElizaOS character
   */
  async extractShadow(character: ElizaOSCharacter): Promise<EncryptedShadow | null> {
    const metadata = (character.settings as any)?._agent_metadata;
    return metadata?.morphable_agent?.shadow || null;
  }
  
  /**
   * Validate ElizaOS character
   */
  async validate(character: ElizaOSCharacter): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!character.name) errors.push('Missing name');
    if (!character.bio) errors.push('Missing bio');
    
    if (character.adjectives && !Array.isArray(character.adjectives)) {
      errors.push('adjectives must be an array');
    }
    
    if (!character.topics || character.topics.length === 0) {
      warnings.push('No topics defined');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  // Helper methods
  
  private extractValues(character: ElizaOSCharacter): string[] {
    // Extract values from bio or other fields
    return [];
  }
  
  private extractQuirks(character: ElizaOSCharacter): string[] {
    // Extract quirks from style or other fields
    return [];
  }
  
  private extractTools(plugins?: string[]): string[] {
    if (!plugins) return [];
    return plugins
      .filter(p => !p.includes('bootstrap') && !p.includes('sql'))
      .map(p => p.replace('@elizaos/plugin-', ''));
  }
  
  private extractFacts(knowledge?: Array<string | any>): string[] {
    if (!knowledge) return [];
    return knowledge.filter(k => typeof k === 'string') as string[];
  }
  
  private extractKnowledgeSources(knowledge?: Array<string | any>): any[] {
    if (!knowledge) return [];
    return knowledge.filter(k => typeof k === 'object');
  }
  
  private convertMessageExamples(
    examples?: Array<Array<{ name: string; content: { text: string } }>>
  ): Array<{ messages: Array<{ role: 'user' | 'agent' | 'system'; content: string }> }> {
    if (!examples) return [];
    
    return examples.map(conversation => ({
      messages: conversation.map(msg => ({
        role: msg.name === '{{user}}' ? 'user' as const : 'agent' as const,
        content: msg.content.text
      }))
    }));
  }
  
  private convertToMessageExamples(
    conversations?: Array<{ messages: Array<{ role: string; content: string }> }>
  ): Array<Array<{ name: string; content: { text: string } }>> | undefined {
    if (!conversations) return undefined;
    
    return conversations.map(conv =>
      conv.messages.map(msg => ({
        name: msg.role === 'user' ? '{{user}}' : 'Agent',
        content: { text: msg.content }
      }))
    );
  }
  
  private buildSystemPrompt(universal: UniversalAgent): string {
    let prompt = `You are ${universal.identity.name}.\n\n`;
    
    const bio = Array.isArray(universal.identity.bio)
      ? universal.identity.bio.join('\n')
      : universal.identity.bio;
    
    prompt += `${bio}\n\n`;
    
    if (universal.personality.core_traits.length > 0) {
      prompt += `Your personality: ${universal.personality.core_traits.join(', ')}\n\n`;
    }
    
    return prompt;
  }
  
  private inferPlugins(universal: UniversalAgent): string[] {
    const plugins = ['@elizaos/plugin-bootstrap', '@elizaos/plugin-sql'];
    
    // Infer plugins from capabilities
    const tools = universal.capabilities.tools || [];
    
    if (tools.some(t => t.includes('search') || t.includes('web'))) {
      plugins.push('@elizaos/plugin-web-search');
    }
    
    if (tools.some(t => t.includes('image'))) {
      plugins.push('@elizaos/plugin-image');
    }
    
    return plugins;
  }
  
  /**
   * Normalize beliefs array to ensure correct types
   */
  private normalizeBeliefsArray(
    beliefs?: Array<{ content: string; conviction: number; privacy: string; source: string }>
  ): Array<{ content: string; conviction: number; privacy: 'PUBLIC' | 'PRIVATE'; source: string; tags?: string[] }> {
    if (!beliefs) return [];
    
    return beliefs.map(b => ({
      content: b.content,
      conviction: b.conviction,
      privacy: (b.privacy === 'PUBLIC' || b.privacy === 'PRIVATE') 
        ? b.privacy 
        : 'PUBLIC' as 'PUBLIC' | 'PRIVATE',
      source: b.source,
      tags: []
    }));
  }
}
