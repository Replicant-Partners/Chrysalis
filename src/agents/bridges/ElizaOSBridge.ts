/**
 * ElizaOSBridge - Agent bridge for ElizaOS characters
 * 
 * Adapts ElizaOS character definitions to work with ChrysalisTerminal.
 * Supports evaluator modes (Tetlock, Shannon, Kata, Calibration).
 * 
 * Based on projects/Ludwig/eliza_bridge.py
 * 
 * @module agents/bridges/ElizaOSBridge
 */

import { BaseBridge } from './BaseBridge';
import {
  BridgeConfig,
  AgentInfo,
  AgentMessage,
  AgentResponse,
  AgentContext,
  AgentCapability,
  AgentType
} from './types';
import { LLMHydrationService } from '../../services/llm/LLMHydrationService';
import { AgentLLMClient } from '../../services/llm/AgentLLMClient';

/**
 * ElizaOS character configuration (from JSON file)
 */
export interface ElizaCharacter {
  name: string;
  bio?: string[];
  lore?: string[];
  knowledge?: string[];
  messageExamples?: Array<{
    user: string;
    content: { text: string };
  }[]>;
  postExamples?: string[];
  topics?: string[];
  style?: {
    all?: string[];
    chat?: string[];
    post?: string[];
  };
  adjectives?: string[];
}

/**
 * Evaluator mode definitions
 */
export type EvaluatorMode = 'tetlock' | 'shannon' | 'kata' | 'calibration';

/**
 * Evaluator mode configuration
 */
interface EvaluatorModeConfig {
  name: string;
  description: string;
  analyticalLens: string;
  systemPromptAddition: string;
}

/**
 * Predefined evaluator modes from Ludwig
 */
const EVALUATOR_MODES: Record<EvaluatorMode, EvaluatorModeConfig> = {
  tetlock: {
    name: 'tetlock',
    description: 'Superforecasting and belief updating analysis',
    analyticalLens: 'probabilistic judgment, evidence integration, fox-hedgehog thinking',
    systemPromptAddition: `
In Tetlock mode, you analyze:
- How beliefs evolve over time
- Evidence integration patterns
- Probabilistic vs deterministic language
- Fox (multi-perspective) vs Hedgehog (single-framework) thinking
- Prediction tracking and accuracy

Ask questions like:
- "What would change your belief about this?"
- "On a scale of 0-100%, how confident are you?"
- "What evidence supports/contradicts this?"
`
  },
  shannon: {
    name: 'shannon',
    description: 'Information theory and entropy analysis',
    analyticalLens: 'information density, redundancy, compression, signal-to-noise',
    systemPromptAddition: `
In Shannon mode, you analyze:
- Information density (unique relations per concept)
- Redundancy patterns (duplicate information)
- Entropy (diversity of relationship types)
- Compression opportunities (abstraction potential)
- Signal vs noise (meaningful vs trivial information)

Ask questions like:
- "Is this concept adding new information or repeating what's known?"
- "Could these concepts be compressed into a higher-level abstraction?"
- "What's the information density here?"
`
  },
  kata: {
    name: 'kata',
    description: 'Incremental skill building and mastery progression',
    analyticalLens: 'skill gaps, depth, progression stages, deliberate practice',
    systemPromptAddition: `
In Kata mode, you analyze:
- Concept depth (number of relationships)
- Skill progression (foundation → integration → deepening → mastery)
- Practice opportunities (shallow concepts to develop)
- Mastery indicators (well-connected, deep concepts)

Ask questions like:
- "What concepts need more depth?"
- "Where are you in the learning progression?"
- "What would move you from integration to mastery?"
`
  },
  calibration: {
    name: 'calibration',
    description: 'Epistemic confidence and evidence alignment',
    analyticalLens: 'confidence levels, evidence support, over/underconfidence',
    systemPromptAddition: `
In Calibration mode, you analyze:
- Evidence-to-confidence ratios
- Overconfidence (strong claims, weak evidence)
- Underconfidence (hedging on well-supported claims)
- Calibration health (alignment between confidence and accuracy)

Ask questions like:
- "How confident are you in this claim (0-100%)?"
- "What evidence supports this level of confidence?"
- "Could you be overconfident here?"
`
  }
};

/**
 * ElizaOS-specific configuration
 */
export interface ElizaOSConfig extends BridgeConfig {
  type: 'eliza';
  
  // Character definition (inline or file path)
  character?: ElizaCharacter;
  characterFile?: string;
  
  // Evaluator mode
  evaluatorMode?: EvaluatorMode;
  
  // LLM settings
  llmService?: LLMHydrationService;
  model?: string;
  temperature?: number;
}

/**
 * Default ElizaOS configuration
 */
const DEFAULT_ELIZA_CONFIG: Partial<ElizaOSConfig> = {
  temperature: 0.8,
  timeout: 60000
};

/**
 * ElizaOSBridge - Connects ElizaOS characters to ChrysalisTerminal
 */
export class ElizaOSBridge extends BaseBridge {
  private character: ElizaCharacter;
  private elizaConfig: ElizaOSConfig;
  private llmService?: LLMHydrationService;
  private llmClient?: AgentLLMClient;
  private evaluatorMode?: EvaluatorModeConfig;
  private conversationHistory: AgentMessage[] = [];
  
  constructor(config: ElizaOSConfig) {
    super({
      ...DEFAULT_ELIZA_CONFIG,
      ...config
    });
    
    this.elizaConfig = {
      ...DEFAULT_ELIZA_CONFIG,
      ...config
    } as ElizaOSConfig;
    
    // Load character
    if (config.character) {
      this.character = config.character;
    } else if (config.characterFile) {
      // Character will be loaded on connect
      this.character = { name: 'Unknown' };
    } else {
      throw new Error('Either character or characterFile must be provided');
    }
    
    // Set evaluator mode if specified
    if (config.evaluatorMode) {
      this.evaluatorMode = EVALUATOR_MODES[config.evaluatorMode];
    }
    
    this.llmService = config.llmService;
  }
  
  // ============================================================================
  // Identity
  // ============================================================================
  
  get agentType(): AgentType {
    return 'eliza';
  }
  
  get capabilities(): AgentCapability[] {
    return ['chat', 'multi_turn'];
  }
  
  get info(): AgentInfo {
    return {
      id: this.id,
      name: this.config.name,
      type: 'eliza',
      description: this.buildDescription(),
      capabilities: this.capabilities,
      status: this.status,
      version: '1.0.0',
      metadata: {
        characterName: this.character.name,
        evaluatorMode: this.evaluatorMode?.name,
        topics: this.character.topics,
        knowledge: this.character.knowledge
      }
    };
  }
  
  /**
   * Build character description
   */
  private buildDescription(): string {
    const parts: string[] = [this.character.name];
    
    if (this.evaluatorMode) {
      parts.push(`operating in ${this.evaluatorMode.name} mode`);
    }
    
    parts.push('-');
    
    if (this.character.bio && this.character.bio.length > 0) {
      parts.push(this.character.bio[0]);
    }
    
    return parts.join(' ');
  }
  
  // ============================================================================
  // Connection
  // ============================================================================
  
  /**
   * Connect to the LLM service and load character
   */
  async connect(): Promise<void> {
    if (this.status === 'connected') {
      return;
    }
    
    this.setStatus('connecting');
    
    try {
      // Load character from file if needed
      if (this.elizaConfig.characterFile && this.character.name === 'Unknown') {
        await this.loadCharacterFromFile(this.elizaConfig.characterFile);
      }
      
      // Create or use provided LLM service
      if (!this.llmService) {
        this.llmService = new LLMHydrationService({
          defaultProvider: 'anthropic'
        });
      }
      
      // Create agent client with character system prompt
      this.llmClient = new AgentLLMClient(this.llmService, {
        agentId: this.id,
        agentName: this.character.name,
        systemPrompt: this.buildSystemPrompt(),
        defaultModel: this.elizaConfig.model,
        defaultTemperature: this.elizaConfig.temperature,
        maxHistoryMessages: 50
      });
      
      this.setStatus('connected');
      this.emit({
        type: 'connected',
        bridgeId: this.id,
        timestamp: Date.now(),
        payload: {
          characterName: this.character.name,
          evaluatorMode: this.evaluatorMode?.name
        }
      });
    } catch (error) {
      this.setStatus('error');
      throw error;
    }
  }
  
  /**
   * Disconnect from the LLM service
   */
  async disconnect(): Promise<void> {
    if (this.status === 'disconnected') {
      return;
    }
    
    this.llmClient = undefined;
    
    this.setStatus('disconnected');
    this.emit({
      type: 'disconnected',
      bridgeId: this.id,
      timestamp: Date.now(),
      payload: {}
    });
  }
  
  // ============================================================================
  // Character Loading
  // ============================================================================
  
  /**
   * Load character from file (JSON)
   */
  private async loadCharacterFromFile(filePath: string): Promise<void> {
    // In Node.js environment
    const fs = await import('fs').then(m => m.promises);
    const content = await fs.readFile(filePath, 'utf-8');
    this.character = JSON.parse(content) as ElizaCharacter;
  }
  
  /**
   * Build system prompt from character and evaluator mode
   */
  private buildSystemPrompt(): string {
    const parts: string[] = [];
    
    // Name and bio
    parts.push(`You are ${this.character.name}.`);
    if (this.character.bio && this.character.bio.length > 0) {
      parts.push(this.character.bio.join('\n'));
    }
    
    // Knowledge and expertise
    if (this.character.knowledge && this.character.knowledge.length > 0) {
      parts.push('\nYour knowledge areas:');
      parts.push(...this.character.knowledge.map(k => `- ${k}`));
    }
    
    // Personality and style
    if (this.character.adjectives && this.character.adjectives.length > 0) {
      parts.push(`\nYour personality: ${this.character.adjectives.join(', ')}`);
    }
    
    if (this.character.style?.all && this.character.style.all.length > 0) {
      parts.push('\nCommunication style:');
      parts.push(...this.character.style.all.map(s => `- ${s}`));
    }
    
    // Topics of interest
    if (this.character.topics && this.character.topics.length > 0) {
      parts.push(`\nTopics you discuss: ${this.character.topics.join(', ')}`);
    }
    
    // Lore and background
    if (this.character.lore && this.character.lore.length > 0) {
      parts.push('\nBackground:');
      parts.push(...this.character.lore.map(l => `- ${l}`));
    }
    
    // Add evaluator mode if set
    if (this.evaluatorMode) {
      parts.push('\n' + '='.repeat(50));
      parts.push(`\n**EVALUATOR MODE: ${this.evaluatorMode.name.toUpperCase()}**`);
      parts.push(this.evaluatorMode.systemPromptAddition);
      parts.push("\nYou combine your character's personality and expertise");
      parts.push(`with ${this.evaluatorMode.name}'s analytical framework.`);
    }
    
    return parts.join('\n');
  }
  
  // ============================================================================
  // Messaging
  // ============================================================================
  
  /**
   * Send a message to the ElizaOS character
   */
  async send(message: AgentMessage, context?: AgentContext): Promise<AgentResponse> {
    if (!this.llmClient || this.status !== 'connected') {
      return this.createErrorResponse('Not connected to ElizaOS');
    }
    
    this.emit({
      type: 'message',
      bridgeId: this.id,
      timestamp: Date.now(),
      payload: { message }
    });
    
    try {
      // Format the message with context
      let fullMessage = message.content;
      
      // Add memory context if available
      if (context?.memoryContext) {
        fullMessage = `[Context]\n${context.memoryContext}\n\n[User Message]\n${fullMessage}`;
      }
      
      // Call the LLM with character personality
      const responseText = await this.withTimeout(
        this.llmClient.chat(fullMessage),
        this.config.timeout
      );
      
      // Store in conversation history
      this.conversationHistory.push(message);
      const responseMessage: AgentMessage = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        content: responseText,
        role: 'assistant',
        timestamp: Date.now()
      };
      this.conversationHistory.push(responseMessage);
      
      // Create response
      const response = this.createResponse(responseText, 'success', {
        characterName: this.character.name,
        evaluatorMode: this.evaluatorMode?.name
      });
      
      this.emit({
        type: 'response',
        bridgeId: this.id,
        timestamp: Date.now(),
        payload: { response }
      });
      
      return response;
    } catch (error) {
      const errorResponse = this.createErrorResponse(
        error instanceof Error ? error : new Error(String(error))
      );
      
      this.emit({
        type: 'error',
        bridgeId: this.id,
        timestamp: Date.now(),
        payload: { error }
      });
      
      return errorResponse;
    }
  }
  
  /**
   * Stream responses (delegated to LLM service)
   */
  async *stream(
    message: AgentMessage,
    context?: AgentContext
  ): AsyncIterable<AgentResponse> {
    // ElizaOS uses standard LLM streaming
    // For now, we just yield the full response
    const response = await this.send(message, context);
    yield response;
  }
  
  // ============================================================================
  // Character Management
  // ============================================================================
  
  /**
   * Get the current character
   */
  getCharacter(): ElizaCharacter {
    return { ...this.character };
  }
  
  /**
   * Set a new character
   */
  setCharacter(character: ElizaCharacter): void {
    this.character = character;
    
    // Update LLM client with new system prompt
    if (this.llmClient) {
      this.llmClient.setSystemPrompt(this.buildSystemPrompt());
    }
  }
  
  /**
   * Get the current evaluator mode
   */
  getEvaluatorMode(): EvaluatorModeConfig | undefined {
    return this.evaluatorMode;
  }
  
  /**
   * Set evaluator mode
   */
  setEvaluatorMode(mode: EvaluatorMode | undefined): void {
    this.evaluatorMode = mode ? EVALUATOR_MODES[mode] : undefined;
    
    // Update LLM client with new system prompt
    if (this.llmClient) {
      this.llmClient.setSystemPrompt(this.buildSystemPrompt());
    }
  }
  
  /**
   * Get character capabilities based on knowledge/topics
   */
  getCharacterCapabilities(): Array<{ name: string; description: string }> {
    const capabilities: Array<{ name: string; description: string }> = [];
    
    // Knowledge areas as capabilities
    if (this.character.knowledge) {
      for (const k of this.character.knowledge) {
        capabilities.push({
          name: k.toLowerCase().replace(/\s+/g, '_'),
          description: `Expertise in ${k}`
        });
      }
    }
    
    // Topics as capabilities
    if (this.character.topics) {
      for (const topic of this.character.topics) {
        const capName = topic.toLowerCase().replace(/\s+/g, '_');
        if (!capabilities.some(c => c.name === capName)) {
          capabilities.push({
            name: capName,
            description: `Can discuss ${topic}`
          });
        }
      }
    }
    
    return capabilities;
  }
  
  // ============================================================================
  // Conversation Management
  // ============================================================================
  
  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
    if (this.llmClient) {
      this.llmClient.clearHistory();
    }
  }
  
  /**
   * Get conversation history
   */
  getHistory(): AgentMessage[] {
    return [...this.conversationHistory];
  }
  
  // ============================================================================
  // Lifecycle
  // ============================================================================
  
  async destroy(): Promise<void> {
    await super.destroy();
    this.conversationHistory = [];
    this.llmClient = undefined;
  }
}

/**
 * Create an ElizaOS bridge instance
 */
export function createElizaOSBridge(config: ElizaOSConfig): ElizaOSBridge {
  return new ElizaOSBridge(config);
}

/**
 * Available evaluator modes
 */
export { EVALUATOR_MODES };

/**
 * Factory for creating ElizaOS characters with preset modes
 */
export const ElizaOSFactory = {
  /**
   * Create a character with Tetlock mode (superforecasting)
   */
  withTetlockMode(character: ElizaCharacter, options?: Partial<ElizaOSConfig>): ElizaOSBridge {
    return createElizaOSBridge({
      id: `eliza-${character.name.toLowerCase()}-tetlock`,
      name: `${character.name} (Tetlock)`,
      type: 'eliza',
      enabled: true,
      character,
      evaluatorMode: 'tetlock',
      ...options
    });
  },
  
  /**
   * Create a character with Shannon mode (information theory)
   */
  withShannonMode(character: ElizaCharacter, options?: Partial<ElizaOSConfig>): ElizaOSBridge {
    return createElizaOSBridge({
      id: `eliza-${character.name.toLowerCase()}-shannon`,
      name: `${character.name} (Shannon)`,
      type: 'eliza',
      enabled: true,
      character,
      evaluatorMode: 'shannon',
      ...options
    });
  },
  
  /**
   * Create a character with Kata mode (skill building)
   */
  withKataMode(character: ElizaCharacter, options?: Partial<ElizaOSConfig>): ElizaOSBridge {
    return createElizaOSBridge({
      id: `eliza-${character.name.toLowerCase()}-kata`,
      name: `${character.name} (Kata)`,
      type: 'eliza',
      enabled: true,
      character,
      evaluatorMode: 'kata',
      ...options
    });
  },
  
  /**
   * Create a character with Calibration mode (epistemic)
   */
  withCalibrationMode(character: ElizaCharacter, options?: Partial<ElizaOSConfig>): ElizaOSBridge {
    return createElizaOSBridge({
      id: `eliza-${character.name.toLowerCase()}-calibration`,
      name: `${character.name} (Calibration)`,
      type: 'eliza',
      enabled: true,
      character,
      evaluatorMode: 'calibration',
      ...options
    });
  },
  
  /**
   * Create a pure character (no evaluator mode)
   */
  pure(character: ElizaCharacter, options?: Partial<ElizaOSConfig>): ElizaOSBridge {
    return createElizaOSBridge({
      id: `eliza-${character.name.toLowerCase()}`,
      name: character.name,
      type: 'eliza',
      enabled: true,
      character,
      ...options
    });
  }
};