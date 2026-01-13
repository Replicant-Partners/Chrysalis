/**
 * SystemAgentLoader
 *
 * Loads persona configurations from JSON files in Agents/system-agents/
 * and creates SystemAgentBinding instances for runtime use.
 *
 * @module agents/system/SystemAgentLoader
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  SystemAgentBinding,
  SystemAgentPersonaId,
  PersonaConfig,
  ChatPaneConfig,
  PERSONA_IDS,
  PERSONA_ICONS,
  PERSONA_DISPLAY_NAMES,
} from './types';

// =============================================================================
// Configuration Paths
// =============================================================================

/**
 * Default paths for system agent configurations
 */
export const DEFAULT_CONFIG_PATHS = {
  /** Base directory for system agent configs */
  baseDir: path.resolve(__dirname, '../../../Agents/system-agents'),

  /** Persona config files */
  personaConfigs: {
    ada: 'ada_config.json',
    lea: 'lea_config.json',
    phil: 'phil_config.json',
    david: 'david_config.json',
  },

  /** Routing configuration */
  routingConfig: 'routing_config.json',

  /** Prompt registry */
  promptRegistry: 'prompt_registry.json',
};

// =============================================================================
// Loader Configuration
// =============================================================================

export interface SystemAgentLoaderConfig {
  /** Base directory for config files */
  configDir?: string;

  /** Whether to validate configs on load */
  validateOnLoad?: boolean;

  /** Whether to cache loaded configs */
  enableCache?: boolean;

  /** Logger function */
  logger?: (message: string, level: 'info' | 'warn' | 'error') => void;
}

const DEFAULT_LOADER_CONFIG: Required<SystemAgentLoaderConfig> = {
  configDir: DEFAULT_CONFIG_PATHS.baseDir,
  validateOnLoad: true,
  enableCache: true,
  logger: (msg, level) => console[level](`[SystemAgentLoader] ${msg}`),
};

// =============================================================================
// SystemAgentLoader Class
// =============================================================================

/**
 * Loads and manages system agent persona configurations
 */
export class SystemAgentLoader {
  private config: Required<SystemAgentLoaderConfig>;
  private bindingCache: Map<SystemAgentPersonaId, SystemAgentBinding> = new Map();
  private personaConfigCache: Map<SystemAgentPersonaId, PersonaConfig> = new Map();
  private routingConfigCache: Record<string, ChatPaneConfig> | null = null;
  private initialized: boolean = false;

  constructor(config?: SystemAgentLoaderConfig) {
    this.config = { ...DEFAULT_LOADER_CONFIG, ...config };
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  /**
   * Initialize the loader and load all persona configurations
   */
  async initialize(): Promise<void> {
    if (this.initialized && this.config.enableCache) {
      this.config.logger('Already initialized, using cached configs', 'info');
      return;
    }

    this.config.logger('Initializing system agent loader...', 'info');

    // Load all persona configs
    for (const personaId of PERSONA_IDS) {
      await this.loadPersonaConfig(personaId);
    }

    // Load routing config
    await this.loadRoutingConfig();

    this.initialized = true;
    this.config.logger(`Loaded ${this.bindingCache.size} system agent bindings`, 'info');
  }

  // ===========================================================================
  // Config Loading
  // ===========================================================================

  /**
   * Load a persona configuration from JSON file
   */
  private async loadPersonaConfig(personaId: SystemAgentPersonaId): Promise<PersonaConfig> {
    // Check cache
    if (this.config.enableCache && this.personaConfigCache.has(personaId)) {
      return this.personaConfigCache.get(personaId)!;
    }

    const configFile = DEFAULT_CONFIG_PATHS.personaConfigs[personaId];
    const configPath = path.join(this.config.configDir, configFile);

    this.config.logger(`Loading persona config: ${configFile}`, 'info');

    try {
      const configContent = await fs.promises.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent) as PersonaConfig;

      // Validate if enabled
      if (this.config.validateOnLoad) {
        this.validatePersonaConfig(config, personaId);
      }

      // Cache
      this.personaConfigCache.set(personaId, config);

      // Create binding
      const binding = this.createBindingFromConfig(config);
      this.bindingCache.set(personaId, binding);

      return config;
    } catch (error) {
      this.config.logger(`Failed to load ${configFile}: ${error}`, 'error');
      throw new Error(`Failed to load persona config for ${personaId}: ${error}`);
    }
  }

  /**
   * Load routing configuration
   */
  private async loadRoutingConfig(): Promise<Record<string, ChatPaneConfig>> {
    if (this.config.enableCache && this.routingConfigCache) {
      return this.routingConfigCache;
    }

    const configPath = path.join(this.config.configDir, DEFAULT_CONFIG_PATHS.routingConfig);

    try {
      const configContent = await fs.promises.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      this.routingConfigCache = config.chatPanes as Record<string, ChatPaneConfig>;
      return this.routingConfigCache;
    } catch (error) {
      this.config.logger(`Failed to load routing config: ${error}`, 'error');
      throw new Error(`Failed to load routing config: ${error}`);
    }
  }

  // ===========================================================================
  // Binding Creation
  // ===========================================================================

  /**
   * Create a SystemAgentBinding from a PersonaConfig
   */
  private createBindingFromConfig(personaConfig: PersonaConfig): SystemAgentBinding {
    return {
      // Base AgentBinding fields
      agentId: `system-agent-${personaConfig.id}`,
      agentName: personaConfig.name,
      agentType: personaConfig.id === 'ada' ? 'primary' : 'secondary',
      avatarUrl: undefined, // Could be loaded from persona source

      // SystemAgentBinding extensions
      personaId: personaConfig.id,
      config: personaConfig,
      defaultPrompt: `${personaConfig.id.toUpperCase()}_EVALUATION_PROMPT`,
      availablePrompts: this.getAvailablePrompts(personaConfig),
      memoryNamespace: personaConfig.memoryConfig.namespace,
      fireproofDbName: personaConfig.memoryConfig.integration.fireproofService.dbName,
      modelTier: personaConfig.modelConfig.modelTier,
      interactionState: 'responsive',
      dependencies: personaConfig.dependencies,
      icon: PERSONA_ICONS[personaConfig.id],
      // Placeholder evaluate function - will be wired to actual LLM later
      evaluate: async (prompt: string, options: { temperature: number; maxTokens: number; timeout: number }) => {
        // This is a stub - actual implementation will use modelConfig routing
        return {
          scorecard: {},
          riskScore: 0.5,
          confidence: 0.5,
          recommendations: ['Evaluation stub - not yet implemented'],
          requiresHumanReview: true,
        };
      },
    };
  }

  /**
   * Get available prompts for a persona
   */
  private getAvailablePrompts(config: PersonaConfig): string[] {
    // These match the prompt registry structure
    const basePrompts: Record<SystemAgentPersonaId, string[]> = {
      ada: [
        'STRUCTURE_EVALUATION_PROMPT',
        'PATTERN_RECOGNITION_PROMPT',
        'COMPOSITION_GRAPH_PROMPT',
      ],
      lea: [
        'IMPLEMENTATION_REVIEW_PROMPT',
        'DOCUMENTATION_QUALITY_PROMPT',
        'ERROR_HANDLING_AUDIT_PROMPT',
      ],
      phil: [
        'FORECAST_ANALYSIS_PROMPT',
        'PREDICTION_TRACKING_PROMPT',
        'CALIBRATION_REPORT_PROMPT',
      ],
      david: [
        'METACOGNITIVE_AUDIT_PROMPT',
        'BIAS_DETECTION_PROMPT',
        'BLIND_SPOT_SCAN_PROMPT',
        'SELF_ASSESSMENT_CALIBRATION_PROMPT',
      ],
    };

    return basePrompts[config.id] || [];
  }

  // ===========================================================================
  // Validation
  // ===========================================================================

  /**
   * Validate a persona configuration
   */
  private validatePersonaConfig(config: PersonaConfig, expectedId: SystemAgentPersonaId): void {
    const errors: string[] = [];

    if (config.id !== expectedId) {
      errors.push(`ID mismatch: expected ${expectedId}, got ${config.id}`);
    }

    if (!config.name || config.name.length === 0) {
      errors.push('Missing name');
    }

    if (!config.role || config.role.length === 0) {
      errors.push('Missing role');
    }

    if (!config.modelConfig) {
      errors.push('Missing modelConfig');
    }

    if (!config.memoryConfig) {
      errors.push('Missing memoryConfig');
    }

    if (!config.memoryConfig?.integration?.fireproofService?.dbName) {
      errors.push('Missing Fireproof database name');
    }

    if (errors.length > 0) {
      throw new Error(`Invalid persona config for ${expectedId}: ${errors.join(', ')}`);
    }
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Get a system agent binding by persona ID
   */
  getBinding(personaId: SystemAgentPersonaId): SystemAgentBinding | undefined {
    return this.bindingCache.get(personaId);
  }

  /**
   * Get all system agent bindings
   */
  getAllBindings(): Map<SystemAgentPersonaId, SystemAgentBinding> {
    return new Map(this.bindingCache);
  }

  /**
   * Get bindings as an array (useful for iteration)
   */
  getBindingsArray(): SystemAgentBinding[] {
    return Array.from(this.bindingCache.values());
  }

  /**
   * Get a persona configuration
   */
  getPersonaConfig(personaId: SystemAgentPersonaId): PersonaConfig | undefined {
    return this.personaConfigCache.get(personaId);
  }

  /**
   * Get routing config for a chat pane
   */
  getChatPaneConfig(mention: string): ChatPaneConfig | undefined {
    return this.routingConfigCache?.[mention];
  }

  /**
   * Get all chat pane configs
   */
  getAllChatPaneConfigs(): Record<string, ChatPaneConfig> | null {
    return this.routingConfigCache;
  }

  /**
   * Get bindings in pipeline order (respecting dependencies)
   */
  getBindingsInPipelineOrder(): SystemAgentBinding[] {
    const ordered: SystemAgentBinding[] = [];
    const visited = new Set<SystemAgentPersonaId>();

    const visit = (personaId: SystemAgentPersonaId) => {
      if (visited.has(personaId)) return;

      const binding = this.bindingCache.get(personaId);
      if (!binding) return;

      // Visit dependencies first
      for (const dep of binding.dependencies) {
        visit(dep);
      }

      visited.add(personaId);
      ordered.push(binding);
    };

    // Visit all personas
    for (const personaId of PERSONA_IDS) {
      visit(personaId);
    }

    return ordered;
  }

  /**
   * Check if loader is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Clear caches and reset state
   */
  reset(): void {
    this.bindingCache.clear();
    this.personaConfigCache.clear();
    this.routingConfigCache = null;
    this.initialized = false;
  }

  /**
   * Get display name for a persona
   */
  getDisplayName(personaId: SystemAgentPersonaId): string {
    return PERSONA_DISPLAY_NAMES[personaId];
  }

  /**
   * Get icon for a persona
   */
  getIcon(personaId: SystemAgentPersonaId): string {
    return PERSONA_ICONS[personaId];
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let loaderInstance: SystemAgentLoader | null = null;

/**
 * Get or create the singleton loader instance
 */
export function getSystemAgentLoader(config?: SystemAgentLoaderConfig): SystemAgentLoader {
  if (!loaderInstance) {
    loaderInstance = new SystemAgentLoader(config);
  }
  return loaderInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetSystemAgentLoader(): void {
  if (loaderInstance) {
    loaderInstance.reset();
    loaderInstance = null;
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Load all system agents and return bindings
 */
export async function loadSystemAgents(
  config?: SystemAgentLoaderConfig
): Promise<Map<SystemAgentPersonaId, SystemAgentBinding>> {
  const loader = getSystemAgentLoader(config);
  await loader.initialize();
  return loader.getAllBindings();
}

/**
 * Get a specific system agent binding
 */
export async function getSystemAgent(
  personaId: SystemAgentPersonaId,
  config?: SystemAgentLoaderConfig
): Promise<SystemAgentBinding | undefined> {
  const loader = getSystemAgentLoader(config);
  await loader.initialize();
  return loader.getBinding(personaId);
}

export default SystemAgentLoader;
