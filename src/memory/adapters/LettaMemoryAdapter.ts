/**
 * Letta Memory Adapter
 *
 * Integrates Letta's memory-first architecture as a memory backend for Chrysalis.
 * Provides persistent, cross-session memory with skill learning capabilities.
 *
 * Features:
 * - Persistent memory blocks (persona, project, human)
 * - Skill learning from trajectories
 * - Cross-model portability
 * - Cloud-hosted memory storage via Letta Platform
 *
 * @module memory/adapters/LettaMemoryAdapter
 * @see https://github.com/letta-ai/letta-code
 * @see https://docs.letta.com/letta-code
 */

import { EventEmitter } from 'events';

// =============================================================================
// Types
// =============================================================================

/**
 * Letta memory block labels
 */
export type LettaBlockLabel =
  | 'persona' // Global: agent personality
  | 'human'  // Global: user information
  | 'project' // Project: current project context
  | 'skills' // Project: learned skills (read-only)
  | 'loaded_skills'; // Project: currently loaded skills (read-only)

/**
 * Letta memory block
 */
export interface LettaMemoryBlock {
  label: LettaBlockLabel;
  content: string;
  scope: 'global' | 'project';
  readOnly: boolean;
  isolated: boolean;
  lastModified: number;
}

/**
 * Letta agent information
 */
export interface LettaAgent {
  id: string;
  name: string;
  model: string;
  created_at: string;
  updated_at: string;
  memory_blocks: LettaMemoryBlock[];
}

/**
 * Letta message format
 */
export interface LettaMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls?: LettaToolCall[];
}

/**
 * Letta tool call
 */
export interface LettaToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
}

/**
 * Letta skill definition
 */
export interface LettaSkill {
  id: string;
  name: string;
  description: string;
  content: string;
  triggers: string[];
  created_at: string;
}

/**
 * Letta API response wrapper
 */
export interface LettaResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Letta adapter configuration
 */
export interface LettaAdapterConfig {
  apiKey: string;
  baseUrl: string;
  agentId?: string;
  model?: string;
  timeout: number;
  retryAttempts: number;
  debug: boolean;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_LETTA_CONFIG: LettaAdapterConfig = {
  apiKey: process.env.LETTA_API_KEY || '',
  baseUrl: process.env.LETTA_BASE_URL || 'https://api.letta.com/v1',
  agentId: undefined, // Will be created or loaded
  model: 'gpt-4o', // Default model
  timeout: 30000,
  retryAttempts: 3,
  debug: false,
};

// =============================================================================
// Letta Memory Adapter
// =============================================================================

/**
 * Adapter for Letta's memory-first agent platform
 */
export class LettaMemoryAdapter extends EventEmitter {
  private config: LettaAdapterConfig;
  private agent: LettaAgent | null = null;
  private memoryBlocks: Map<LettaBlockLabel, LettaMemoryBlock> = new Map();
  private conversationHistory: LettaMessage[] = [];
  private skills: Map<string, LettaSkill> = new Map();
  private initialized: boolean = false;

  constructor(config: Partial<LettaAdapterConfig> = {}) {
    super();
    this.config = { ...DEFAULT_LETTA_CONFIG, ...config };

    if (!this.config.apiKey) {
      console.warn('[LettaAdapter] No API key provided. Set LETTA_API_KEY environment variable.');
    }
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  /**
   * Initialize the Letta adapter
   * Creates or loads an agent
   */
  async initialize(agentName?: string): Promise<boolean> {
    if (this.initialized) return true;

    try {
      if (this.config.agentId) {
        // Load existing agent
        await this.loadAgent(this.config.agentId);
      } else if (agentName) {
        // Create new agent
        await this.createAgent(agentName);
      } else {
        // List agents and use first one, or create default
        const agents = await this.listAgents();
        if (agents.length > 0) {
          await this.loadAgent(agents[0].id);
        } else {
          await this.createAgent('chrysalis-agent');
        }
      }

      this.initialized = true;
      this.emit('initialized', { agentId: this.agent?.id });
      return true;
    } catch (error) {
      this.emit('error', { type: 'initialization', error });
      return false;
    }
  }

  // ===========================================================================
  // Agent Management
  // ===========================================================================

  /**
   * Create a new Letta agent
   */
  async createAgent(name: string): Promise<LettaAgent> {
    const response = await this.request<LettaAgent>('POST', '/agents', {
      name,
      model: this.config.model,
      memory_blocks: [
        { label: 'persona', content: 'I am a helpful AI assistant.', scope: 'global' },
        { label: 'human', content: 'The user.', scope: 'global' },
        { label: 'project', content: '', scope: 'project' },
      ],
    });

    if (response.success && response.data) {
      this.agent = response.data;
      this.syncMemoryBlocks();
      return this.agent;
    }

    throw new Error(response.error || 'Failed to create agent');
  }

  /**
   * Load an existing Letta agent
   */
  async loadAgent(agentId: string): Promise<LettaAgent> {
    const response = await this.request<LettaAgent>('GET', `/agents/${agentId}`);

    if (response.success && response.data) {
      this.agent = response.data;
      this.config.agentId = agentId;
      this.syncMemoryBlocks();
      return this.agent;
    }

    throw new Error(response.error || 'Failed to load agent');
  }

  /**
   * List all agents
   */
  async listAgents(): Promise<LettaAgent[]> {
    const response = await this.request<LettaAgent[]>('GET', '/agents');
    return response.data || [];
  }

  // ===========================================================================
  // Memory Block Operations
  // ===========================================================================

  /**
   * Get a memory block by label
   */
  getBlock(label: LettaBlockLabel): LettaMemoryBlock | undefined {
    return this.memoryBlocks.get(label);
  }

  /**
   * Update a memory block
   */
  async updateBlock(label: LettaBlockLabel, content: string): Promise<boolean> {
    if (!this.agent) {
      throw new Error('Agent not initialized');
    }

    const block = this.memoryBlocks.get(label);
    if (block?.readOnly) {
      throw new Error(`Cannot update read-only block: ${label}`);
    }

    const response = await this.request('PATCH', `/agents/${this.agent.id}/memory/${label}`, {
      content,
    });

    if (response.success) {
      this.memoryBlocks.set(label, {
        ...block!,
        content,
        lastModified: Date.now(),
      });
      this.emit('block:updated', { label, content });
      return true;
    }

    return false;
  }

  /**
   * Get persona block (who the agent is)
   */
  getPersona(): string {
    return this.memoryBlocks.get('persona')?.content || '';
  }

  /**
   * Set persona block
   */
  async setPersona(content: string): Promise<boolean> {
    return this.updateBlock('persona', content);
  }

  /**
   * Get human block (who the user is)
   */
  getHuman(): string {
    return this.memoryBlocks.get('human')?.content || '';
  }

  /**
   * Set human block
   */
  async setHuman(content: string): Promise<boolean> {
    return this.updateBlock('human', content);
  }

  /**
   * Get project context
   */
  getProjectContext(): string {
    return this.memoryBlocks.get('project')?.content || '';
  }

  /**
   * Set project context
   */
  async setProjectContext(content: string): Promise<boolean> {
    return this.updateBlock('project', content);
  }

  // ===========================================================================
  // Conversation & Chat
  // ===========================================================================

  /**
   * Send a message and get response
   */
  async chat(message: string): Promise<LettaMessage> {
    if (!this.agent) {
      throw new Error('Agent not initialized');
    }

    // Add user message to history
    const userMessage: LettaMessage = { role: 'user', content: message };
    this.conversationHistory.push(userMessage);

    const response = await this.request<{ messages: LettaMessage[] }>(
      'POST',
      `/agents/${this.agent.id}/messages`,
      { message }
    );

    if (response.success && response.data?.messages) {
      const assistantMessages = response.data.messages;
      this.conversationHistory.push(...assistantMessages);

      // Return last assistant message
      const lastMessage = assistantMessages[assistantMessages.length - 1];
      this.emit('message', { message: lastMessage });
      return lastMessage;
    }

    throw new Error(response.error || 'Failed to send message');
  }

  /**
   * Clear conversation history (but keep memory)
   */
  clearConversation(): void {
    this.conversationHistory = [];
    this.emit('conversation:cleared');
  }

  /**
   * Get conversation history
   */
  getHistory(): LettaMessage[] {
    return [...this.conversationHistory];
  }

  // ===========================================================================
  // Skill Learning (Letta's /skill command)
  // ===========================================================================

  /**
   * Learn a skill from current conversation trajectory
   * Implements Letta's /skill command
   */
  async learnSkillFromTrajectory(instruction?: string): Promise<LettaSkill> {
    if (!this.agent) {
      throw new Error('Agent not initialized');
    }

    const response = await this.request<LettaSkill>(
      'POST',
      `/agents/${this.agent.id}/skills/learn`,
      {
        trajectory: this.conversationHistory,
        instruction: instruction || 'Learn a reusable skill from this conversation',
      }
    );

    if (response.success && response.data) {
      const skill = response.data;
      this.skills.set(skill.id, skill);
      this.emit('skill:learned', { skill });
      return skill;
    }

    throw new Error(response.error || 'Failed to learn skill');
  }

  /**
   * Remember something explicitly (Letta's /remember command)
   */
  async remember(instruction?: string): Promise<boolean> {
    if (!this.agent) {
      throw new Error('Agent not initialized');
    }

    const response = await this.request(
      'POST',
      `/agents/${this.agent.id}/memory/remember`,
      {
        trajectory: this.conversationHistory.slice(-10), // Last 10 messages
        instruction: instruction || 'Remember important information from this conversation',
      }
    );

    if (response.success) {
      // Refresh memory blocks
      await this.refreshMemoryBlocks();
      this.emit('memory:updated');
      return true;
    }

    return false;
  }

  /**
   * Get all learned skills
   */
  getSkills(): LettaSkill[] {
    return Array.from(this.skills.values());
  }

  // ===========================================================================
  // Integration with Chrysalis Memory System
  // ===========================================================================

  /**
   * Export Letta memory to Chrysalis format
   */
  exportToChrysalis(): {
    episodic: Array<{ content: string; timestamp: number }>;
    semantic: Array<{ content: string; importance: number }>;
    procedural: Array<{ name: string; content: string }>;
  } {
    return {
      episodic: this.conversationHistory.map((msg, i) => ({
        content: `[${msg.role}] ${msg.content}`,
        timestamp: Date.now() - (this.conversationHistory.length - i) * 1000,
      })),
      semantic: [
        { content: this.getPersona(), importance: 0.9 },
        { content: this.getHuman(), importance: 0.8 },
        { content: this.getProjectContext(), importance: 0.7 },
      ].filter(m => m.content),
      procedural: Array.from(this.skills.values()).map(skill => ({
        name: skill.name,
        content: skill.content,
      })),
    };
  }

  /**
   * Import from Chrysalis memory format
   */
  async importFromChrysalis(data: {
    persona?: string;
    human?: string;
    project?: string;
    skills?: Array<{ name: string; content: string }>;
  }): Promise<void> {
    if (data.persona) await this.setPersona(data.persona);
    if (data.human) await this.setHuman(data.human);
    if (data.project) await this.setProjectContext(data.project);

    // Skills would need Letta's skill format
    if (data.skills) {
      for (const skill of data.skills) {
        // Note: This assumes Letta has an API for importing skills
        try {
          await this.request('POST', `/agents/${this.agent?.id}/skills`, {
            name: skill.name,
            content: skill.content,
          });
        } catch {
          console.warn(`Failed to import skill: ${skill.name}`);
        }
      }
    }
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Check if adapter is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get current agent info
   */
  getAgent(): LettaAgent | null {
    return this.agent;
  }

  /**
   * Refresh memory blocks from API
   */
  async refreshMemoryBlocks(): Promise<void> {
    if (!this.agent) return;

    const response = await this.request<LettaAgent>('GET', `/agents/${this.agent.id}`);
    if (response.success && response.data) {
      this.agent = response.data;
      this.syncMemoryBlocks();
    }
  }

  /**
   * Sync memory blocks from agent data
   */
  private syncMemoryBlocks(): void {
    if (!this.agent?.memory_blocks) return;

    for (const block of this.agent.memory_blocks) {
      this.memoryBlocks.set(block.label, {
        ...block,
        lastModified: Date.now(),
      });
    }
  }

  // ===========================================================================
  // HTTP Client
  // ===========================================================================

  /**
   * Make authenticated request to Letta API
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<LettaResponse<T>> {
    const url = `${this.config.baseUrl}${path}`;

    if (this.config.debug) {
      console.log(`[LettaAdapter] ${method} ${path}`);
    }

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const data = await response.json();
      return { success: true, data: data as T };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('error', { type: 'request', path, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create Letta adapter from environment
 */
export function createLettaAdapter(config?: Partial<LettaAdapterConfig>): LettaMemoryAdapter {
  return new LettaMemoryAdapter({
    apiKey: process.env.LETTA_API_KEY || '',
    baseUrl: process.env.LETTA_BASE_URL || 'https://api.letta.com/v1',
    ...config,
  });
}

/**
 * Create and initialize Letta adapter
 */
export async function initializeLettaAdapter(
  agentName?: string,
  config?: Partial<LettaAdapterConfig>
): Promise<LettaMemoryAdapter> {
  const adapter = createLettaAdapter(config);
  await adapter.initialize(agentName);
  return adapter;
}

// =============================================================================
// (Exports are inline with class definitions above)
// =============================================================================
