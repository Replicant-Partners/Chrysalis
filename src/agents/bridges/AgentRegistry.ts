/**
 * AgentRegistry - Central registry for managing agent bridges
 * 
 * Provides:
 * - Agent registration and discovery
 * - Capability-based lookup
 * - Connection management
 * - Event aggregation
 * 
 * @module agents/bridges/AgentRegistry
 */

import {
  IAgentBridge,
  IAgentRegistry,
  AgentInfo,
  AgentType,
  AgentCapability,
  BridgeConfig,
  BridgeEvent,
  BridgeEventHandler,
  BridgeEventType
} from './types';
import { SerenaBridge, SerenaConfig, createSerenaBridge } from './SerenaBridge';
import { DirectLLMBridge, DirectLLMConfig, createDirectLLMBridge } from './DirectLLMBridge';
import { ElizaOSBridge, ElizaOSConfig, createElizaOSBridge } from './ElizaOSBridge';

/**
 * Registry event types
 */
export type RegistryEventType =
  | 'agent:registered'
  | 'agent:unregistered'
  | 'agent:connected'
  | 'agent:disconnected'
  | 'agent:error';

/**
 * Registry event
 */
export interface RegistryEvent {
  type: RegistryEventType;
  agentId: string;
  timestamp: number;
  payload: unknown;
}

export type RegistryEventHandler = (event: RegistryEvent) => void;

/**
 * AgentRegistry - Central registry for managing agent bridges
 */
export class AgentRegistry implements IAgentRegistry {
  private bridges: Map<string, IAgentBridge> = new Map();
  private eventHandlers: Map<RegistryEventType, Set<RegistryEventHandler>> = new Map();
  private bridgeEventUnsubscribers: Map<string, () => void> = new Map();
  
  constructor() {}
  
  // ============================================================================
  // Registration
  // ============================================================================
  
  /**
   * Register an agent bridge
   */
  register(bridge: IAgentBridge): void {
    if (this.bridges.has(bridge.id)) {
      throw new Error(`Agent with id '${bridge.id}' is already registered`);
    }
    
    this.bridges.set(bridge.id, bridge);
    
    // Forward bridge events
    const unsubscribe = this.forwardBridgeEvents(bridge);
    this.bridgeEventUnsubscribers.set(bridge.id, unsubscribe);
    
    this.emit({
      type: 'agent:registered',
      agentId: bridge.id,
      timestamp: Date.now(),
      payload: { info: bridge.info }
    });
  }
  
  /**
   * Unregister an agent bridge
   */
  unregister(bridgeId: string): void {
    const bridge = this.bridges.get(bridgeId);
    if (!bridge) {
      return;
    }
    
    // Clean up event forwarding
    const unsubscribe = this.bridgeEventUnsubscribers.get(bridgeId);
    if (unsubscribe) {
      unsubscribe();
      this.bridgeEventUnsubscribers.delete(bridgeId);
    }
    
    this.bridges.delete(bridgeId);
    
    this.emit({
      type: 'agent:unregistered',
      agentId: bridgeId,
      timestamp: Date.now(),
      payload: { info: bridge.info }
    });
  }
  
  /**
   * Forward events from a bridge to registry listeners
   */
  private forwardBridgeEvents(bridge: IAgentBridge): () => void {
    const unsubscribers: (() => void)[] = [];
    
    unsubscribers.push(
      bridge.on('connected', () => {
        this.emit({
          type: 'agent:connected',
          agentId: bridge.id,
          timestamp: Date.now(),
          payload: { info: bridge.info }
        });
      })
    );
    
    unsubscribers.push(
      bridge.on('disconnected', () => {
        this.emit({
          type: 'agent:disconnected',
          agentId: bridge.id,
          timestamp: Date.now(),
          payload: { info: bridge.info }
        });
      })
    );
    
    unsubscribers.push(
      bridge.on('error', (event) => {
        this.emit({
          type: 'agent:error',
          agentId: bridge.id,
          timestamp: Date.now(),
          payload: event.payload
        });
      })
    );
    
    return () => unsubscribers.forEach(u => u());
  }
  
  // ============================================================================
  // Lookup
  // ============================================================================
  
  /**
   * Get a bridge by ID
   */
  get(bridgeId: string): IAgentBridge | undefined {
    return this.bridges.get(bridgeId);
  }
  
  /**
   * List all registered agents
   */
  list(): AgentInfo[] {
    return Array.from(this.bridges.values()).map(b => b.info);
  }
  
  /**
   * Find bridges by type
   */
  findByType(type: AgentType): IAgentBridge[] {
    return Array.from(this.bridges.values()).filter(
      b => b.info.type === type
    );
  }
  
  /**
   * Find bridges by capability
   */
  findByCapability(capability: AgentCapability): IAgentBridge[] {
    return Array.from(this.bridges.values()).filter(
      b => b.info.capabilities.includes(capability)
    );
  }
  
  /**
   * Find bridges by status
   */
  findByStatus(status: string): IAgentBridge[] {
    return Array.from(this.bridges.values()).filter(
      b => b.info.status === status
    );
  }
  
  /**
   * Get connected bridges
   */
  getConnected(): IAgentBridge[] {
    return this.findByStatus('connected');
  }
  
  /**
   * Check if an agent is registered
   */
  has(bridgeId: string): boolean {
    return this.bridges.has(bridgeId);
  }
  
  /**
   * Get the number of registered agents
   */
  get count(): number {
    return this.bridges.size;
  }
  
  // ============================================================================
  // Connection Management
  // ============================================================================
  
  /**
   * Connect all registered bridges
   */
  async connectAll(): Promise<{ success: string[]; failed: Array<{ id: string; error: Error }> }> {
    const success: string[] = [];
    const failed: Array<{ id: string; error: Error }> = [];
    
    for (const [id, bridge] of this.bridges) {
      try {
        await bridge.connect();
        success.push(id);
      } catch (error) {
        failed.push({
          id,
          error: error instanceof Error ? error : new Error(String(error))
        });
      }
    }
    
    return { success, failed };
  }
  
  /**
   * Disconnect all bridges
   */
  async disconnectAll(): Promise<void> {
    for (const bridge of this.bridges.values()) {
      try {
        await bridge.disconnect();
      } catch (error) {
        console.error(`Failed to disconnect ${bridge.id}:`, error);
      }
    }
  }
  
  /**
   * Connect a specific bridge
   */
  async connect(bridgeId: string): Promise<void> {
    const bridge = this.bridges.get(bridgeId);
    if (!bridge) {
      throw new Error(`Agent '${bridgeId}' not found`);
    }
    await bridge.connect();
  }
  
  /**
   * Disconnect a specific bridge
   */
  async disconnect(bridgeId: string): Promise<void> {
    const bridge = this.bridges.get(bridgeId);
    if (!bridge) {
      throw new Error(`Agent '${bridgeId}' not found`);
    }
    await bridge.disconnect();
  }
  
  // ============================================================================
  // Factory Methods
  // ============================================================================
  
  /**
   * Create and register a Serena agent
   */
  registerSerena(config: SerenaConfig): SerenaBridge {
    const bridge = createSerenaBridge(config);
    this.register(bridge);
    return bridge;
  }
  
  /**
   * Create and register a DirectLLM agent
   */
  registerDirectLLM(config: DirectLLMConfig): DirectLLMBridge {
    const bridge = createDirectLLMBridge(config);
    this.register(bridge);
    return bridge;
  }
  
  /**
   * Create and register an ElizaOS agent
   */
  registerElizaOS(config: ElizaOSConfig): ElizaOSBridge {
    const bridge = createElizaOSBridge(config);
    this.register(bridge);
    return bridge;
  }
  
  /**
   * Create and register an agent from config
   */
  registerFromConfig(config: BridgeConfig): IAgentBridge {
    switch (config.type) {
      case 'serena':
        return this.registerSerena(config as SerenaConfig);
      case 'direct_llm':
        return this.registerDirectLLM(config as DirectLLMConfig);
      case 'eliza':
        return this.registerElizaOS(config as ElizaOSConfig);
      default:
        throw new Error(`Unknown agent type: ${config.type}`);
    }
  }
  
  // ============================================================================
  // Events
  // ============================================================================
  
  /**
   * Subscribe to registry events
   */
  on(eventType: RegistryEventType, handler: RegistryEventHandler): () => void {
    const handlers = this.eventHandlers.get(eventType) ?? new Set();
    handlers.add(handler);
    this.eventHandlers.set(eventType, handlers);
    
    return () => this.off(eventType, handler);
  }
  
  /**
   * Unsubscribe from registry events
   */
  off(eventType: RegistryEventType, handler: RegistryEventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }
  
  /**
   * Emit a registry event
   */
  private emit(event: RegistryEvent): void {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (error) {
          console.error(`Registry event handler error for ${event.type}:`, error);
        }
      }
    }
  }
  
  // ============================================================================
  // Lifecycle
  // ============================================================================
  
  /**
   * Destroy all bridges and clean up
   */
  async destroy(): Promise<void> {
    // Disconnect all
    await this.disconnectAll();
    
    // Destroy all bridges
    for (const bridge of this.bridges.values()) {
      try {
        await bridge.destroy();
      } catch (error) {
        console.error(`Failed to destroy ${bridge.id}:`, error);
      }
    }
    
    // Clear registry
    this.bridges.clear();
    this.bridgeEventUnsubscribers.clear();
    this.eventHandlers.clear();
  }
}

/**
 * Singleton instance of the agent registry
 */
let globalRegistry: AgentRegistry | undefined;

/**
 * Get the global agent registry
 */
export function getAgentRegistry(): AgentRegistry {
  if (!globalRegistry) {
    globalRegistry = new AgentRegistry();
  }
  return globalRegistry;
}

/**
 * Create a new agent registry instance
 */
export function createAgentRegistry(): AgentRegistry {
  return new AgentRegistry();
}