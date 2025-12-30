/**
 * MCP Adapter - Cline/Roo Code Style Implementation
 * 
 * Converts Uniform Semantic Agent to MCP-based single-agent implementation
 * (IDE-integrated, conversational, system prompt driven).
 */

import { FrameworkAdapterV2 } from '../core/FrameworkAdapterV2';
import { type EncryptedShadow } from '../core/FrameworkAdapter';
import { UniformSemanticAgentV2, type ValidationResult } from '../core/UniformSemanticAgentV2';
import { generateFingerprint } from '../core/Encryption';

/**
 * MCP-based agent configuration (Cline-style)
 */
export interface MCPAgentConfig {
  agent_config: {
    name: string;
    version: string;
    system_prompt: string;
    capabilities: string[];
  };
  mcp_servers: Record<string, {
    command: string;
    args: string[];
    env: Record<string, string>;
  }>;
  execution: {
    llm: {
      provider: string;
      model: string;
      temperature: number;
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
 * MCP Adapter (Cline/Roo Code style)
 */
export class MCPAdapter extends FrameworkAdapterV2 {
  readonly name = 'mcp';
  readonly version = '2.0.0';
  readonly supports_shadow = true;
  readonly supports_experience_sync = true;
  
  /**
   * Convert Uniform Semantic Agent to MCP-based configuration
   */
  async toUniversal(config: MCPAgentConfig): Promise<UniformSemanticAgentV2> {
    const now = new Date().toISOString();
    
    const fingerprint = generateFingerprint({
      name: config.agent_config.name,
      designation: config.agent_config.name,
      created: now,
      id: crypto.randomUUID()
    });
    
    const universal: UniformSemanticAgentV2 = {
      schema_version: '2.0.0',
      
      identity: {
        id: crypto.randomUUID(),
        name: config.agent_config.name,
        designation: config.agent_config.name,
        bio: this.extractBioFromPrompt(config.agent_config.system_prompt),
        fingerprint,
        created: now,
        version: config.agent_config.version
      },
      
      personality: {
        core_traits: this.extractTraitsFromPrompt(config.agent_config.system_prompt),
        values: [],
        quirks: []
      },
      
      communication: {
        style: {
          all: ['Professional', 'Clear', 'Helpful']
        },
        signature_phrases: []
      },
      
      capabilities: {
        primary: config.agent_config.capabilities,
        secondary: [],
        domains: [],
        tools: this.convertMCPServers(config.mcp_servers),
        learned_skills: []
      },
      
      knowledge: {
        facts: [],
        topics: [],
        expertise: config.agent_config.capabilities,
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
      
      training: {
        accumulated_examples: []
      },
      
      instances: {
        active: [],
        terminated: []
      },
      
      experience_sync: {
        enabled: true,
        default_protocol: 'streaming',
        transport: {
          type: 'https',
          https: {
            endpoint: 'https://localhost:8443/sync'
          }
        },
        streaming: {
          enabled: true,
          interval_ms: 500,
          batch_size: 10,
          priority_threshold: 0.7
        },
        merge_strategy: {
          conflict_resolution: 'latest_wins',
          memory_deduplication: true,
          skill_aggregation: 'max',
          knowledge_verification_threshold: 0.7
        }
      },
      
      protocols: {
        mcp: {
          enabled: true,
          role: 'client',
          servers: Object.entries(config.mcp_servers).map(([name, cfg]) => ({
            name,
            command: cfg.command,
            args: cfg.args,
            env: cfg.env
          })),
          tools: Object.keys(config.mcp_servers)
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
          timeout: 300,
          max_iterations: 20,
          error_handling: 'graceful'
        }
      },
      
      deployment: {
        preferred_contexts: ['ide'],
        environment: {}
      },
      
      metadata: {
        version: config.agent_config.version,
        schema_version: '2.0.0',
        created: now,
        updated: now,
        source_framework: 'mcp',
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
   * Convert Uniform Semantic Agent to MCP-based configuration
   */
  async fromUniversal(universal: UniformSemanticAgentV2): Promise<MCPAgentConfig> {
    const config: MCPAgentConfig = {
      agent_config: {
        name: universal.identity.name,
        version: universal.identity.version,
        system_prompt: this.buildSystemPrompt(universal),
        capabilities: universal.capabilities.primary
      },
      mcp_servers: this.buildMCPServers(universal),
      execution: {
        llm: {
          provider: universal.execution.llm.provider,
          model: universal.execution.llm.model,
          temperature: universal.execution.llm.temperature
        }
      }
    };
    
    return config;
  }
  
  /**
   * Embed shadow data
   */
  async embedShadow(
    config: MCPAgentConfig,
    shadow: EncryptedShadow
  ): Promise<MCPAgentConfig> {
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
   * Extract shadow data
   */
  async extractShadow(config: MCPAgentConfig): Promise<EncryptedShadow | null> {
    return config._agent_metadata?.morphable_agent?.shadow || null;
  }
  
  /**
   * Validate configuration
   */
  async validate(config: MCPAgentConfig): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!config.agent_config) errors.push('Missing agent_config');
    if (!config.agent_config?.name) errors.push('Missing agent_config.name');
    if (!config.mcp_servers) errors.push('Missing mcp_servers');
    
    if (Object.keys(config.mcp_servers || {}).length === 0) {
      warnings.push('No MCP servers configured');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  // Helper methods
  
  private buildSystemPrompt(universal: UniformSemanticAgentV2): string {
    const bio = Array.isArray(universal.identity.bio)
      ? universal.identity.bio.join('\n')
      : universal.identity.bio;
    
    let prompt = `You are ${universal.identity.name}, a ${universal.identity.designation}.\n\n`;
    prompt += `${bio}\n\n`;
    
    if (universal.personality.core_traits.length > 0) {
      prompt += `Your personality traits: ${universal.personality.core_traits.join(', ')}\n\n`;
    }
    
    if (universal.capabilities.learned_skills && universal.capabilities.learned_skills.length > 0) {
      prompt += `You have learned the following skills:\n`;
      universal.capabilities.learned_skills.forEach(skill => {
        prompt += `- ${skill.name} (proficiency: ${skill.proficiency.toFixed(2)})\n`;
      });
      prompt += '\n';
    }
    
    if (universal.protocols.mcp?.enabled) {
      prompt += `You have access to tools via MCP:\n`;
      universal.capabilities.tools?.forEach(tool => {
        prompt += `- ${tool.name}\n`;
      });
      prompt += '\n';
    }
    
    return prompt;
  }
  
  private buildMCPServers(universal: UniformSemanticAgentV2): Record<string, any> {
    if (!universal.protocols.mcp?.servers) return {};
    
    const servers: Record<string, any> = {};
    
    for (const server of universal.protocols.mcp.servers) {
      servers[server.name] = {
        command: server.command,
        args: server.args,
        env: server.env
      };
    }
    
    return servers;
  }
  
  private extractBioFromPrompt(prompt: string): string {
    // Extract bio from system prompt (simplified)
    const lines = prompt.split('\n');
    return lines.slice(0, 3).join('\n');
  }
  
  private extractTraitsFromPrompt(prompt: string): string[] {
    // Extract traits from system prompt (simplified)
    const traitsMatch = prompt.match(/personality traits?: ([^\n]+)/i);
    if (traitsMatch) {
      return traitsMatch[1].split(',').map(t => t.trim());
    }
    return ['helpful', 'thorough', 'professional'];
  }
  
  private convertMCPServers(servers: Record<string, any>): any[] {
    return Object.entries(servers).map(([name, config]) => ({
      name,
      protocol: 'mcp',
      config
    }));
  }
}
