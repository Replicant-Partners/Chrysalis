/**
 * CrewAI Framework Adapter
 * 
 * Bidirectional conversion between CrewAI agent format
 * and Universal Agent format.
 */

import { FrameworkAdapter, type EncryptedShadow, type FieldMapping } from '../core/FrameworkAdapter';
import { UniversalAgent, ValidationResult, SCHEMA_VERSION } from '../core/UniversalAgent';
import { generateFingerprint } from '../core/Encryption';

/**
 * CrewAI Agent configuration
 */
export interface CrewAIAgent {
  agent: {
    role: string;
    goal: string;
    backstory: string;
    tools: string[];
    verbose?: boolean;
    allow_delegation?: boolean;
    max_iter?: number;
    max_rpm?: number;
    temperature?: number;
  };
  system_prompt?: string;
  tools_config?: Array<{
    name: string;
    import_statement: string;
  }>;
  _agent_metadata?: {
    morphable_agent?: {
      shadow: EncryptedShadow;
      framework_version: string;
      created: string;
    };
  };
}

/**
 * CrewAI Framework Adapter
 */
export class CrewAIAdapter extends FrameworkAdapter {
  readonly name = 'crewai';
  readonly version = '1.0.0';
  readonly supports_shadow = true;
  
  protected fieldMapping: FieldMapping = {
    direct: {
      'identity.designation': 'agent.role',
      'identity.bio': 'agent.backstory'
    },
    derived: {
      'agent.goal': (agent) => this.deriveGoal(agent)
    },
    nonMappable: [
      'agent.max_iter',
      'agent.max_rpm',
      'agent.allow_delegation',
      'agent.verbose',
      'tools_config'
    ]
  };
  
  /**
   * Convert CrewAI agent to Universal Agent
   */
  async toUniversal(crewai: CrewAIAgent): Promise<UniversalAgent> {
    const now = new Date().toISOString();
    
    // Extract traits from backstory
    const traits = this.extractTraits(crewai.agent.backstory);
    
    // Generate fingerprint
    const fingerprint = generateFingerprint({
      name: crewai.agent.role,
      designation: crewai.agent.role,
      created: now,
      id: crypto.randomUUID()
    });
    
    const universal: UniversalAgent = {
      schema_version: SCHEMA_VERSION,
      
      identity: {
        id: crypto.randomUUID(),
        name: crewai.agent.role,
        designation: crewai.agent.role,
        bio: crewai.agent.backstory,
        fingerprint
      },
      
      personality: {
        core_traits: traits,
        values: [],
        quirks: []
      },
      
      communication: {
        style: {
          all: ['Be professional', 'Be thorough', 'Complete tasks systematically']
        },
        signature_phrases: []
      },
      
      capabilities: {
        primary: [crewai.agent.role.toLowerCase()],
        secondary: [],
        domains: this.inferDomains(crewai.agent.goal),
        tools: crewai.agent.tools.map(t => t.replace('()', ''))
      },
      
      knowledge: {
        facts: [],
        topics: this.inferTopics(crewai.agent.goal),
        expertise: [crewai.agent.role]
      },
      
      memory: {
        type: 'hybrid',
        provider: 'qdrant',
        settings: {}
      },
      
      beliefs: {
        who: [],
        what: [],
        why: [],
        how: []
      },
      
      training: undefined,
      
      metadata: {
        version: '1.0.0',
        created: now,
        updated: now,
        source_framework: 'crewai'
      }
    };
    
    return universal;
  }
  
  /**
   * Convert Universal Agent to CrewAI agent
   */
  async fromUniversal(universal: UniversalAgent): Promise<CrewAIAgent> {
    const crewai: CrewAIAgent = {
      agent: {
        role: universal.identity.designation,
        goal: this.deriveGoalFromUniversal(universal),
        backstory: this.buildBackstory(universal),
        tools: this.mapTools(universal.capabilities.tools || []),
        verbose: true,
        allow_delegation: false
      },
      system_prompt: this.buildSystemPrompt(universal),
      tools_config: this.buildToolsConfig(universal.capabilities.tools || [])
    };
    
    return crewai;
  }
  
  /**
   * Embed encrypted shadow in CrewAI agent
   */
  async embedShadow(
    crewai: CrewAIAgent,
    shadow: EncryptedShadow
  ): Promise<CrewAIAgent> {
    return {
      ...crewai,
      _agent_metadata: {
        morphable_agent: {
          shadow,
          framework_version: this.version,
          created: new Date().toISOString()
        }
      }
    };
  }
  
  /**
   * Extract encrypted shadow from CrewAI agent
   */
  async extractShadow(crewai: CrewAIAgent): Promise<EncryptedShadow | null> {
    return crewai._agent_metadata?.morphable_agent?.shadow || null;
  }
  
  /**
   * Validate CrewAI agent
   */
  async validate(crewai: CrewAIAgent): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!crewai.agent) errors.push('Missing agent object');
    if (!crewai.agent?.role) errors.push('Missing agent.role');
    if (!crewai.agent?.goal) errors.push('Missing agent.goal');
    if (!crewai.agent?.backstory) errors.push('Missing agent.backstory');
    
    if (crewai.agent?.tools && !Array.isArray(crewai.agent.tools)) {
      errors.push('agent.tools must be an array');
    }
    
    if (!crewai.agent?.tools || crewai.agent.tools.length === 0) {
      warnings.push('No tools defined');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  // Helper methods
  
  private deriveGoal(agent: any): string {
    // This is for the field mapping - not used in toUniversal
    return agent.agent?.goal || '';
  }
  
  private deriveGoalFromUniversal(universal: UniversalAgent): string {
    const primaryCaps = universal.capabilities.primary.slice(0, 2).join(' and ');
    const values = universal.personality.values.slice(0, 2);
    
    let goal = primaryCaps || `Assist with ${universal.identity.designation}`;
    
    if (values.length > 0) {
      goal += ` while upholding ${values.join(' and ')}`;
    }
    
    return goal;
  }
  
  private buildBackstory(universal: UniversalAgent): string {
    const bio = Array.isArray(universal.identity.bio)
      ? universal.identity.bio.join(' ')
      : universal.identity.bio;
    
    const traits = universal.personality.core_traits.join(', ');
    
    let backstory = `${bio}\n\n`;
    
    if (traits) {
      backstory += `Known for being ${traits}.\n`;
    }
    
    if (universal.personality.values.length > 0) {
      backstory += `\nCore values: ${universal.personality.values.join(', ')}.`;
    }
    
    return backstory;
  }
  
  private buildSystemPrompt(universal: UniversalAgent): string {
    let prompt = `You are ${universal.identity.name}, ${universal.identity.designation}.\n\n`;
    
    const communication = universal.communication.style.all.join('\n- ');
    if (communication) {
      prompt += `Core principles:\n- ${communication}\n\n`;
    }
    
    return prompt;
  }
  
  private mapTools(universalTools: string[]): string[] {
    return universalTools.map(tool => {
      // Map universal tool names to CrewAI tool calls
      const normalized = tool.toLowerCase();
      
      if (normalized.includes('search') || normalized.includes('serper')) {
        return 'SerperDevTool()';
      }
      if (normalized.includes('web') || normalized.includes('scraper')) {
        return 'WebScraperTool()';
      }
      if (normalized.includes('file') || normalized.includes('read')) {
        return 'FileReadTool()';
      }
      
      return 'BaseTool()';
    });
  }
  
  private buildToolsConfig(universalTools: string[]): Array<{ name: string; import_statement: string }> {
    const config: Array<{ name: string; import_statement: string }> = [];
    
    for (const tool of universalTools) {
      const normalized = tool.toLowerCase();
      
      if (normalized.includes('search') || normalized.includes('serper')) {
        config.push({
          name: 'SerperDevTool',
          import_statement: 'from crewai_tools import SerperDevTool'
        });
      }
      if (normalized.includes('web') || normalized.includes('scraper')) {
        config.push({
          name: 'WebScraperTool',
          import_statement: 'from crewai_tools import WebScraperTool'
        });
      }
      if (normalized.includes('file') || normalized.includes('read')) {
        config.push({
          name: 'FileReadTool',
          import_statement: 'from crewai_tools import FileReadTool'
        });
      }
    }
    
    return config;
  }
  
  private extractTraits(backstory: string): string[] {
    const match = backstory.match(/Known for being ([^.]+)/);
    if (match) {
      return match[1].split(',').map(t => t.trim());
    }
    return ['professional', 'thorough', 'systematic'];
  }
  
  private inferDomains(goal: string): string[] {
    // Extract domain keywords from goal
    const words = goal.toLowerCase().split(' ');
    return words.filter(w => w.length > 5).slice(0, 5);
  }
  
  private inferTopics(goal: string): string[] {
    return this.inferDomains(goal);
  }
}
