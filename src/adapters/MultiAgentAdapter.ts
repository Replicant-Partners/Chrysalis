/**
 * Multi-Agent Adapter - CrewAI Style Implementation
 * 
 * Converts Uniform Semantic Agent to multi-agent system with specialized
 * roles, A2A protocol support, and collaborative execution.
 */

import { FrameworkAdapterV2 } from '../core/FrameworkAdapterV2';
import { type EncryptedShadow } from '../core/FrameworkAdapter';
import { UniformSemanticAgentV2, type ValidationResult } from '../core/UniformSemanticAgentV2';
import { generateFingerprint } from '../core/Encryption';

/**
 * Multi-agent system configuration (CrewAI-style)
 */
export interface MultiAgentConfig {
  agents: {
    role: string;
    goal: string;
    backstory: string;
    tools: string[];
    max_iter: number;
    allow_delegation: boolean;
    memory: boolean;
  }[];
  
  crew_config: {
    process: 'sequential' | 'hierarchical';
    verbose: boolean;
  };
  
  a2a_config?: {
    enabled: boolean;
    agent_card: any;
    endpoint: string;
  };
  
  _agent_metadata?: {
    morphable_agent?: {
      shadow: EncryptedShadow;
      framework_version: string;
      created: string;
    };
  };
}

/**
 * Multi-Agent Adapter (CrewAI style)
 */
export class MultiAgentAdapter extends FrameworkAdapterV2 {
  readonly name = 'multi_agent';
  readonly version = '2.0.0';
  readonly supports_shadow = true;
  readonly supports_experience_sync = true;
  
  /**
   * Convert Multi-Agent config to Uniform Semantic Agent
   */
  async toUniversal(config: MultiAgentConfig): Promise<UniformSemanticAgentV2> {
    const now = new Date().toISOString();
    
    // Use primary agent for identity
    const primary_agent = config.agents[0];
    
    const fingerprint = generateFingerprint({
      name: primary_agent.role,
      designation: primary_agent.role,
      created: now,
      id: crypto.randomUUID()
    });
    
    const universal: UniformSemanticAgentV2 = {
      schema_version: '2.0.0',
      
      identity: {
        id: crypto.randomUUID(),
        name: primary_agent.role,
        designation: primary_agent.role,
        bio: primary_agent.backstory,
        fingerprint,
        created: now,
        version: '1.0.0'
      },
      
      personality: {
        core_traits: this.extractTraits(primary_agent.backstory),
        values: [],
        quirks: []
      },
      
      communication: {
        style: {
          all: ['Professional', 'Systematic', 'Collaborative']
        },
        signature_phrases: []
      },
      
      capabilities: {
        primary: config.agents.map(a => a.role),
        secondary: [],
        domains: [],
        tools: this.aggregateTools(config.agents),
        learned_skills: []
      },
      
      knowledge: {
        facts: [],
        topics: [],
        expertise: config.agents.map(a => a.role),
        accumulated_knowledge: []
      },
      
      memory: {
        type: 'hybrid',
        provider: 'lance',  // LanceDB (qdrant deprecated)
        settings: {},
        collections: {
          episodic: [],
          semantic: []
        }
      },
      
      beliefs: {
        who: [],
        what: [],
        why: [],
        how: []
      },
      
      instances: {
        active: [],
        terminated: []
      },
      
      experience_sync: {
        enabled: true,
        default_protocol: 'lumped',
        lumped: {
          enabled: true,
          batch_interval: '1h',
          max_batch_size: 1000,
          compression: true
        },
        merge_strategy: {
          conflict_resolution: 'weighted_merge',
          memory_deduplication: true,
          skill_aggregation: 'weighted',
          knowledge_verification_threshold: 0.7
        }
      },
      
      protocols: {
        mcp: {
          enabled: false,
          role: 'client',
          servers: [],
          tools: []
        },
        a2a: config.a2a_config?.enabled ? {
          enabled: true,
          role: 'server',
          endpoint: config.a2a_config.endpoint,
          agent_card: config.a2a_config.agent_card,
          authentication: { type: 'jwt', config: {} },
          peers: []
        } : undefined
      },
      
      execution: {
        llm: {
          provider: 'openai',
          model: 'gpt-4',
          temperature: 0.7,
          max_tokens: 4096,
          parameters: {}
        },
        runtime: {
          timeout: 300,
          max_iterations: primary_agent.max_iter,
          error_handling: 'retry'
        }
      },
      
      deployment: {
        preferred_contexts: ['api', 'multi_agent'],
        environment: {}
      },
      
      metadata: {
        version: '1.0.0',
        schema_version: '2.0.0',
        created: now,
        updated: now,
        source_framework: 'multi_agent',
        evolution: {
          total_deployments: 0,
          total_syncs: 0,
          total_skills_learned: 0,
          total_knowledge_acquired: 0,
          total_conversations: 0,
          last_evolution: now,
          evolution_rate: 0
        }
      }
    };
    
    return universal;
  }
  
  /**
   * Convert Uniform Semantic Agent to Multi-Agent configuration
   */
  async fromUniversal(universal: UniformSemanticAgentV2): Promise<MultiAgentConfig> {
    // Create specialized agents from capabilities
    const agents = this.createSpecializedAgents(universal);
    
    const config: MultiAgentConfig = {
      agents,
      crew_config: {
        process: 'sequential',
        verbose: true
      },
      a2a_config: universal.protocols.a2a?.enabled ? {
        enabled: true,
        agent_card: this.buildAgentCard(universal),
        endpoint: universal.protocols.a2a.endpoint
      } : undefined
    };
    
    return config;
  }
  
  /**
   * Embed shadow
   */
  async embedShadow(
    config: MultiAgentConfig,
    shadow: EncryptedShadow
  ): Promise<MultiAgentConfig> {
    return {
      ...config,
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
   * Extract shadow
   */
  async extractShadow(config: MultiAgentConfig): Promise<EncryptedShadow | null> {
    return config._agent_metadata?.morphable_agent?.shadow || null;
  }
  
  /**
   * Validate
   */
  async validate(config: MultiAgentConfig): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!config.agents || config.agents.length === 0) {
      errors.push('No agents defined');
    }
    
    for (const agent of config.agents || []) {
      if (!agent.role) errors.push(`Agent missing role`);
      if (!agent.goal) errors.push(`Agent missing goal`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  // Helper methods
  
  private createSpecializedAgents(universal: UniformSemanticAgentV2): any[] {
    // Create one specialized agent per primary capability
    return universal.capabilities.primary.map(capability => ({
      role: `${capability} Specialist`,
      goal: `Execute ${capability} tasks excellently`,
      backstory: this.buildBackstory(universal, capability),
      tools: this.mapTools(universal),
      max_iter: universal.execution.runtime.max_iterations,
      allow_delegation: true,
            memory: true
    }));
  }
  
  private buildBackstory(universal: UniformSemanticAgentV2, capability: string): string {
    const bio = Array.isArray(universal.identity.bio)
      ? universal.identity.bio.join(' ')
      : universal.identity.bio;
    
    return `${bio}\n\nSpecialized in ${capability}.`;
  }
  
  private mapTools(universal: UniformSemanticAgentV2): string[] {
    return universal.capabilities.tools?.map(t => `${t.name}()`) || [];
  }
  
  private aggregateTools(agents: any[]): any[] {
    const allTools = new Set<string>();
    agents.forEach(agent => {
      agent.tools?.forEach((tool: string) => allTools.add(tool));
    });
    
    return Array.from(allTools).map(name => ({
      name: name.replace(/\(\)$/, ''),
      protocol: 'mcp',
      config: {}
    }));
  }
  
  private extractTraits(backstory: string): string[] {
    const match = backstory.match(/Known for being ([^.]+)/);
    if (match) {
      return match[1].split(',').map(t => t.trim());
    }
    return ['collaborative', 'systematic', 'autonomous'];
  }
  
  private buildAgentCard(universal: UniformSemanticAgentV2): any {
    return {
      name: universal.identity.name,
      version: universal.identity.version,
      protocol_version: '0.3.0',
      capabilities: universal.capabilities.primary,
      skills: (universal.capabilities.learned_skills || []).map(s => ({
        name: s.name,
        proficiency: s.proficiency
      })),
      endpoint: universal.protocols.a2a?.endpoint || ''
    };
  }
}
