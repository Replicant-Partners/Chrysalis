/**
 * Orchestrated Adapter - Agent Protocol Implementation
 * 
 * Converts Uniform Semantic Agent to orchestrated REST API agent
 * with standardized task/step/artifact interface.
 */

import { FrameworkAdapterV2 } from '../core/FrameworkAdapterV2';
import { type EncryptedShadow } from '../core/FrameworkAdapter';
import { UniformSemanticAgentV2, type ValidationResult } from '../core/UniformSemanticAgentV2';
import { generateFingerprint } from '../core/Encryption';

/**
 * Orchestrated agent configuration (Agent Protocol style)
 */
export interface OrchestratedAgentConfig {
  agent: {
    name: string;
    version: string;
    description: string;
    capabilities: string[];
  };
  
  endpoints: {
    tasks: string;          // POST /ap/v1/agent/tasks
    task_steps: string;     // POST /ap/v1/agent/tasks/{id}/steps
    artifacts: string;      // GET /ap/v1/agent/tasks/{id}/artifacts
  };
  
  execution: {
    llm: {
      provider: string;
      model: string;
      temperature: number;
    };
    runtime: {
      timeout: number;
      max_iterations: number;
    };
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
 * Orchestrated Adapter (Agent Protocol style)
 */
export class OrchestratedAdapter extends FrameworkAdapterV2 {
  readonly name = 'orchestrated';
  readonly version = '2.0.0';
  readonly supports_shadow = true;
  readonly supports_experience_sync = true;
  
  /**
   * Convert Orchestrated config to Uniform Semantic Agent
   */
  async toUniversal(config: OrchestratedAgentConfig): Promise<UniformSemanticAgentV2> {
    const now = new Date().toISOString();
    
    const fingerprint = generateFingerprint({
      name: config.agent.name,
      designation: config.agent.name,
      created: now,
      id: crypto.randomUUID()
    });
    
    const universal: UniformSemanticAgentV2 = {
      schema_version: '2.0.0',
      
      identity: {
        id: crypto.randomUUID(),
        name: config.agent.name,
        designation: config.agent.name,
        bio: config.agent.description,
        fingerprint,
        created: now,
        version: config.agent.version
      },
      
      personality: {
        core_traits: ['systematic', 'task-oriented', 'reliable'],
        values: ['accuracy', 'efficiency'],
        quirks: []
      },
      
      communication: {
        style: {
          all: ['Clear', 'Task-focused', 'Efficient']
        },
        signature_phrases: []
      },
      
      capabilities: {
        primary: config.agent.capabilities,
        secondary: [],
        domains: [],
        tools: [],
        learned_skills: []
      },
      
      knowledge: {
        facts: [],
        topics: config.agent.capabilities,
        expertise: config.agent.capabilities,
        accumulated_knowledge: []
      },
      
      memory: {
        type: 'hybrid',
        provider: 'local',
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
        default_protocol: 'check_in',
        check_in: {
          enabled: true,
          schedule: '0 */6 * * *',  // Every 6 hours
          include_full_state: true
        },
        merge_strategy: {
          conflict_resolution: 'latest_wins',
          memory_deduplication: true,
          skill_aggregation: 'max',
          knowledge_verification_threshold: 0.7
        }
      },
      
      protocols: {
        agent_protocol: {
          enabled: true,
          endpoint: '/ap/v1',
          capabilities: config.agent.capabilities,
          task_types: ['general', 'research', 'analysis']
        }
      },
      
      execution: {
        llm: {
          provider: config.execution.llm.provider,
          model: config.execution.llm.model,
          temperature: config.execution.llm.temperature,
          max_tokens: 4096,
          parameters: {}
        },
        runtime: {
          timeout: config.execution.runtime.timeout,
          max_iterations: config.execution.runtime.max_iterations,
          error_handling: 'graceful'
        }
      },
      
      deployment: {
        preferred_contexts: ['api', 'service'],
        environment: {}
      },
      
      metadata: {
        version: config.agent.version,
        schema_version: '2.0.0',
        created: now,
        updated: now,
        source_framework: 'orchestrated',
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
   * Convert Uniform Semantic Agent to Orchestrated configuration
   */
  async fromUniversal(universal: UniformSemanticAgentV2): Promise<OrchestratedAgentConfig> {
    const bio = Array.isArray(universal.identity.bio)
      ? universal.identity.bio.join(' ')
      : universal.identity.bio;
    
    const config: OrchestratedAgentConfig = {
      agent: {
        name: universal.identity.name,
        version: universal.identity.version,
        description: bio,
        capabilities: universal.capabilities.primary
      },
      
      endpoints: {
        tasks: '/ap/v1/agent/tasks',
        task_steps: '/ap/v1/agent/tasks/{id}/steps',
        artifacts: '/ap/v1/agent/tasks/{id}/artifacts'
      },
      
      execution: {
        llm: {
          provider: universal.execution.llm.provider,
          model: universal.execution.llm.model,
          temperature: universal.execution.llm.temperature
        },
        runtime: {
          timeout: universal.execution.runtime.timeout,
          max_iterations: universal.execution.runtime.max_iterations
        }
      }
    };
    
    return config;
  }
  
  /**
   * Embed shadow
   */
  async embedShadow(
    config: OrchestratedAgentConfig,
    shadow: EncryptedShadow
  ): Promise<OrchestratedAgentConfig> {
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
  async extractShadow(config: OrchestratedAgentConfig): Promise<EncryptedShadow | null> {
    return config._agent_metadata?.morphable_agent?.shadow || null;
  }
  
  /**
   * Validate
   */
  async validate(config: OrchestratedAgentConfig): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!config.agent) errors.push('Missing agent');
    if (!config.agent?.name) errors.push('Missing agent.name');
    if (!config.endpoints) errors.push('Missing endpoints');
    
    if (!config.agent?.capabilities || config.agent.capabilities.length === 0) {
      warnings.push('No capabilities defined');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  // Helper methods
  
  private extractTraits(backstory: string): string[] {
    const match = backstory.match(/Known for being ([^.]+)/);
    if (match) {
      return match[1].split(',').map(t => t.trim());
    }
    return ['systematic', 'reliable', 'task-focused'];
  }
}
