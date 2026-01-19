/**
 * SystemAgentLoader
 *
 * Loads system agents (Ada, Lea, Phil, David, Milton) from JSON configs
 * and prepares them for integration with the ChrysalisWorkspace.
 *
 * @module agents/system/SystemAgentLoader
 */

import * as fs from 'fs';
import * as path from 'path';
import { AgentBinding } from '../../components/ChrysalisWorkspace/types';

// =============================================================================
// Types
// =============================================================================

/**
 * System agent configuration (from JSON files)
 */
export interface SystemAgentConfig {
  id: string;
  name: string;
  fullName?: string;
  role: string;
  description: string;
  personaSource?: string;

  modelConfig: {
    modelTier: 'local' | 'hybrid' | 'cloud_llm' | 'local_slm';
    localModel: {
      provider: string;
      model: string;
      useCases: string[];
    };
    fallbackModel?: {
      provider: string;
      model: string;
      useCases: string[];
    };
    contextWindow: number;
    defaultTemperature: number;
    latencyBudgetMs: number;
  };

  evaluationDimensions?: Record<string, {
    weight: number;
    description: string;
  }>;

  memoryConfig?: {
    access: string;
    namespace: string;
    scopes: Record<string, unknown>;
    integration: Record<string, unknown>;
  };

  collaborators?: Record<string, {
    relationship: string;
    handoff: string;
  }>;

  dependencies?: string[];
  promptSetId?: string;
  version?: string;
}

/**
 * Loaded system agent with binding and config
 */
export interface LoadedSystemAgent {
  binding: AgentBinding;
  config: SystemAgentConfig;
  modelInfo: {
    provider: string;
    model: string;
    contextWindow: number;
  };
}

/**
 * System agent roster
 */
export interface SystemAgentRoster {
  ada?: LoadedSystemAgent;
  lea?: LoadedSystemAgent;
  phil?: LoadedSystemAgent;
  david?: LoadedSystemAgent;
  milton?: LoadedSystemAgent;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Default system agents directory
 */
const DEFAULT_AGENTS_DIR = path.resolve(__dirname, '../../../Agents/system-agents');

/**
 * Avatar mappings for system agents
 */
const AGENT_AVATARS: Record<string, string> = {
  ada: '🔬',    // Algorithmic Architect
  lea: '📝',    // Implementation Reviewer
  phil: '📊',   // Forecast Analyst
  david: '🧠',  // Metacognitive Guardian
  milton: '🔧', // Ops Caretaker
};

/**
 * Role descriptions for UI display
 */
const AGENT_ROLES: Record<string, string> = {
  ada: 'Algorithmic Architect',
  lea: 'Implementation Reviewer',
  phil: 'Forecast Analyst',
  david: 'Metacognitive Guardian',
  milton: 'Ops Caretaker',
};

// =============================================================================
// Loader Class
// =============================================================================

/**
 * SystemAgentLoader - loads and prepares system agents
 */
export class SystemAgentLoader {
  private agentsDir: string;
  private loadedAgents: Map<string, LoadedSystemAgent> = new Map();

  constructor(agentsDir?: string) {
    this.agentsDir = agentsDir || DEFAULT_AGENTS_DIR;
  }

  /**
   * Load a single agent by ID
   */
  async loadAgent(agentId: string): Promise<LoadedSystemAgent | null> {
    // Check cache
    if (this.loadedAgents.has(agentId)) {
      return this.loadedAgents.get(agentId)!;
    }

    // Find config file (handle case variations like Milton_config.json)
    const possibleFiles = [
      `${agentId}_config.json`,
      `${agentId.toLowerCase()}_config.json`,
      `${agentId.charAt(0).toUpperCase() + agentId.slice(1)}_config.json`,
    ];

    let configPath: string | null = null;
    for (const file of possibleFiles) {
      const fullPath = path.join(this.agentsDir, file);
      if (fs.existsSync(fullPath)) {
        configPath = fullPath;
        break;
      }
    }

    if (!configPath) {
      console.warn(`[SystemAgentLoader] Config not found for agent: ${agentId}`);
      return null;
    }

    try {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config: SystemAgentConfig = JSON.parse(configContent);

      const loaded: LoadedSystemAgent = {
        binding: {
          agentId: config.id,
          agentName: config.name,
          agentType: agentId === 'ada' ? 'primary' : 'secondary',
          avatarUrl: AGENT_AVATARS[agentId.toLowerCase()],
        },
        config,
        modelInfo: {
          provider: config.modelConfig.localModel.provider,
          model: config.modelConfig.localModel.model,
          contextWindow: config.modelConfig.contextWindow,
        },
      };

      this.loadedAgents.set(agentId, loaded);
      return loaded;

    } catch (error) {
      console.error(`[SystemAgentLoader] Error loading agent ${agentId}:`, error);
      return null;
    }
  }

  /**
   * Load all system agents
   */
  async loadAllAgents(): Promise<SystemAgentRoster> {
    const agentIds = ['ada', 'lea', 'phil', 'david', 'milton'];
    const roster: SystemAgentRoster = {};

    for (const id of agentIds) {
      const loaded = await this.loadAgent(id);
      if (loaded) {
        (roster as any)[id] = loaded;
      }
    }

    return roster;
  }

  /**
   * Get agent binding for use in ChrysalisWorkspace
   */
  getBinding(agentId: string): AgentBinding | null {
    const loaded = this.loadedAgents.get(agentId);
    return loaded?.binding || null;
  }

  /**
   * Get all loaded bindings
   */
  getAllBindings(): AgentBinding[] {
    return Array.from(this.loadedAgents.values()).map(a => a.binding);
  }

  /**
   * Get model configuration for an agent
   */
  getModelConfig(agentId: string): LoadedSystemAgent['modelInfo'] | null {
    const loaded = this.loadedAgents.get(agentId);
    return loaded?.modelInfo || null;
  }

  /**
   * Create a default Ada binding for quick start
   */
  static createDefaultAdaBinding(): AgentBinding {
    return {
      agentId: 'ada',
      agentName: 'Ada',
      agentType: 'primary',
      avatarUrl: AGENT_AVATARS.ada,
    };
  }

  /**
   * Create a default secondary agent binding
   */
  static createDefaultSecondaryBinding(agentId: 'lea' | 'phil' | 'david' | 'milton' = 'lea'): AgentBinding {
    return {
      agentId,
      agentName: agentId.charAt(0).toUpperCase() + agentId.slice(1),
      agentType: 'secondary',
      avatarUrl: AGENT_AVATARS[agentId],
    };
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Quick load of system agents for workspace initialization
 */
export async function loadSystemAgentsForWorkspace(
  primaryId: string = 'ada',
  secondaryId?: string
): Promise<{ primary: AgentBinding; secondary?: AgentBinding }> {
  const loader = new SystemAgentLoader();

  const primary = await loader.loadAgent(primaryId);
  if (!primary) {
    // Fallback to default Ada
    return {
      primary: SystemAgentLoader.createDefaultAdaBinding(),
      secondary: secondaryId ? SystemAgentLoader.createDefaultSecondaryBinding(secondaryId as any) : undefined,
    };
  }

  let secondary: LoadedSystemAgent | null = null;
  if (secondaryId) {
    secondary = await loader.loadAgent(secondaryId);
  }

  return {
    primary: primary.binding,
    secondary: secondary?.binding,
  };
}

/**
 * Get recommended agent pair for a given task type
 */
export function getRecommendedAgentPair(taskType: string): { primary: string; secondary: string } {
  const recommendations: Record<string, { primary: string; secondary: string }> = {
    'code_review': { primary: 'lea', secondary: 'ada' },
    'architecture': { primary: 'ada', secondary: 'phil' },
    'forecasting': { primary: 'phil', secondary: 'david' },
    'bias_check': { primary: 'david', secondary: 'phil' },
    'operations': { primary: 'milton', secondary: 'lea' },
    'default': { primary: 'ada', secondary: 'lea' },
  };

  return recommendations[taskType] || recommendations.default;
}

export default SystemAgentLoader;
