/**
 * Chrysalis Unified Adapter Interface
 * 
 * Bridge interface unifying the two existing adapter patterns in Chrysalis:
 * 1. RDF-Based Pattern (BaseAdapter) - toCanonical()/fromCanonical() with RDF Quads
 * 2. USA-Based Pattern (FrameworkAdapter) - toUniversal()/fromUniversal() with USA v2
 * 
 * Enables incremental migration and cross-pattern interoperability.
 * 
 * @module adapters/unified-adapter
 * @version 1.0.0
 * @see {@link ../plans/phase-1a-enhanced-type-system-spec.md}
 */

import { AgentFramework, PROTOCOL_METADATA, ProtocolMaturity } from './protocol-types';
import { 
  UniversalMessage, 
  UniversalPayload,
  UniversalMessageType,
  UniversalError,
  TraceContext,
  createMessage,
  createError
} from './protocol-messages';
import { 
  ProtocolCapability, 
  ProtocolFeature, 
  CapabilityLevel,
  getProtocolCapability,
  supportsFeature
} from './protocol-capabilities';
import {
  ProtocolVersionInfo,
  VersionCompatibility,
  getEffectiveVersionInfo,
  checkVersionCompatibility,
  getProtocolHealth
} from './protocol-registry';

// ============================================================================
// Adapter Pattern Types
// ============================================================================

/**
 * Identifies which adapter pattern an implementation uses.
 */
export type AdapterPattern = 
  | 'rdf-based'    // BaseAdapter pattern with toCanonical/fromCanonical
  | 'usa-based'    // FrameworkAdapter pattern with toUniversal/fromUniversal
  | 'unified';     // New unified pattern

/**
 * Adapter health status.
 */
export interface AdapterHealth {
  /** Protocol this adapter handles */
  protocol: AgentFramework;
  /** Adapter status */
  status: AdapterStatus;
  /** Health score (0-100) */
  healthScore: number;
  /** Is adapter connected and operational */
  isConnected: boolean;
  /** Last successful operation timestamp */
  lastSuccess?: string;
  /** Last error if any */
  lastError?: UniversalError;
  /** Adapter latency in milliseconds (average) */
  avgLatencyMs?: number;
  /** Number of errors in last hour */
  recentErrors: number;
  /** Protocol health status */
  protocolHealth: ReturnType<typeof getProtocolHealth>;
}

/**
 * Adapter operational status.
 */
export type AdapterStatus = 
  | 'healthy'      // Fully operational
  | 'degraded'     // Operational with issues
  | 'error'        // Non-operational due to errors
  | 'disconnected' // Not connected
  | 'initializing' // Starting up
  | 'unknown';     // Status unknown

// ============================================================================
// Unified Adapter Interface
// ============================================================================

/**
 * Unified adapter interface bridging both existing Chrysalis adapter patterns.
 * 
 * This interface provides a consistent API for all protocol adapters regardless
 * of their underlying implementation pattern (RDF-based or USA-based).
 * 
 * @example
 * ```typescript
 * // Create adapter for MCP
 * const mcpAdapter = createUnifiedAdapter('mcp', existingMcpAdapter);
 * 
 * // Convert to universal message
 * const message = await mcpAdapter.toUniversalMessage(mcpPayload);
 * 
 * // Check capabilities
 * if (mcpAdapter.supportsFeature('tool-invocation')) {
 *   await mcpAdapter.invokeOperation('tool-invoke', toolParams);
 * }
 * ```
 */
export interface UnifiedAdapter {
  // === Identity ===
  
  /** Protocol this adapter handles */
  readonly protocol: AgentFramework;
  
  /** Adapter pattern used by underlying implementation */
  readonly pattern: AdapterPattern;
  
  /** Adapter version */
  readonly version: string;
  
  // === Capability Discovery ===
  
  /** Get adapter capabilities */
  getCapabilities(): ProtocolCapability;
  
  /** Check if adapter supports a specific feature */
  supportsFeature(feature: ProtocolFeature): boolean;
  
  /** Get feature implementation level */
  getFeatureLevel(feature: ProtocolFeature): CapabilityLevel;
  
  // === Version Information ===
  
  /** Get protocol version info */
  getVersionInfo(): ProtocolVersionInfo;
  
  /** Check version compatibility */
  checkCompatibility(version: string): VersionCompatibility;
  
  // === Message Conversion ===
  
  /**
   * Convert protocol-specific payload to universal message format.
   * 
   * @param protocolPayload - Protocol-specific data structure
   * @param messageType - Type of message being converted
   * @param options - Conversion options
   * @returns Universal message envelope
   */
  toUniversalMessage(
    protocolPayload: unknown,
    messageType: UniversalMessageType,
    options?: ConversionOptions
  ): Promise<UniversalMessage>;
  
  /**
   * Convert universal message to protocol-specific format.
   * 
   * @param message - Universal message envelope
   * @param options - Conversion options
   * @returns Protocol-specific data structure
   */
  fromUniversalMessage(
    message: UniversalMessage,
    options?: ConversionOptions
  ): Promise<unknown>;
  
  // === Operations ===
  
  /**
   * Invoke a protocol operation.
   * 
   * @param operation - Operation type
   * @param params - Operation parameters
   * @param options - Invocation options
   * @returns Operation result wrapped in universal message
   */
  invokeOperation(
    operation: UniversalMessageType,
    params: UniversalPayload,
    options?: InvocationOptions
  ): Promise<UniversalMessage>;
  
  // === Health & Status ===
  
  /** Get current adapter health status */
  getHealth(): Promise<AdapterHealth>;
  
  /** Check if adapter is ready for operations */
  isReady(): boolean;
  
  // === Lifecycle ===
  
  /** Initialize the adapter */
  initialize(): Promise<void>;
  
  /** Shutdown the adapter gracefully */
  shutdown(): Promise<void>;
  
  /** Reset adapter state */
  reset(): Promise<void>;
}

/**
 * Options for message conversion.
 */
export interface ConversionOptions {
  /** Include raw protocol data in message */
  preserveRaw?: boolean;
  /** Validate output against schema */
  validate?: boolean;
  /** Tracing context */
  trace?: TraceContext;
  /** Custom converters for specific fields */
  converters?: Record<string, (value: unknown) => unknown>;
}

/**
 * Options for operation invocation.
 */
export interface InvocationOptions {
  /** Request timeout in milliseconds */
  timeoutMs?: number;
  /** Retry count on transient failures */
  retries?: number;
  /** Tracing context */
  trace?: TraceContext;
  /** Correlation ID for request tracking */
  correlationId?: string;
  /** Priority (0.0 - 1.0) */
  priority?: number;
}

// ============================================================================
// Legacy Adapter Interfaces (for wrapping)
// ============================================================================

/**
 * RDF-based adapter interface (BaseAdapter pattern).
 * 
 * Used by: mcp-adapter.ts, langchain-adapter.ts
 */
export interface RdfBasedAdapter {
  frameworkType: string;
  toCanonical(agent: unknown): Promise<unknown>; // Returns RDF Quad[]
  fromCanonical(quads: unknown): Promise<unknown>; // Takes RDF Quad[]
  validateSync?(agent: unknown): unknown[];
}

/**
 * USA-based adapter interface (FrameworkAdapter pattern).
 * 
 * Used by: MCPAdapter.ts, CrewAIAdapter.ts
 */
export interface UsaBasedAdapter {
  frameworkType: AgentFramework;
  toUniversal?(agent: unknown): unknown; // Returns UniformSemanticAgentV2
  fromUniversal?(agent: unknown): unknown; // Takes UniformSemanticAgentV2
  toUniversalAsync?(agent: unknown): Promise<unknown>;
  fromUniversalAsync?(agent: unknown): Promise<unknown>;
}

// ============================================================================
// Adapter Wrapper Factory
// ============================================================================

/**
 * Wrap an RDF-based adapter (BaseAdapter) to provide unified interface.
 * 
 * @param protocol - Protocol identifier
 * @param adapter - Legacy RDF-based adapter instance
 * @returns Unified adapter wrapper
 */
export function wrapRdfAdapter(
  protocol: AgentFramework,
  adapter: RdfBasedAdapter
): UnifiedAdapter {
  return new RdfAdapterWrapper(protocol, adapter);
}

/**
 * Wrap a USA-based adapter (FrameworkAdapter) to provide unified interface.
 * 
 * @param protocol - Protocol identifier
 * @param adapter - Legacy USA-based adapter instance
 * @returns Unified adapter wrapper
 */
export function wrapUsaAdapter(
  protocol: AgentFramework,
  adapter: UsaBasedAdapter
): UnifiedAdapter {
  return new UsaAdapterWrapper(protocol, adapter);
}

/**
 * Create a unified adapter from either legacy pattern.
 * 
 * @param protocol - Protocol identifier
 * @param adapter - Legacy adapter instance (either pattern)
 * @returns Unified adapter wrapper
 */
export function createUnifiedAdapter(
  protocol: AgentFramework,
  adapter: RdfBasedAdapter | UsaBasedAdapter
): UnifiedAdapter {
  // Detect pattern by interface
  if ('toCanonical' in adapter && 'fromCanonical' in adapter) {
    return wrapRdfAdapter(protocol, adapter as RdfBasedAdapter);
  } else if ('toUniversal' in adapter || 'toUniversalAsync' in adapter) {
    return wrapUsaAdapter(protocol, adapter as UsaBasedAdapter);
  }
  throw new Error(`Unknown adapter pattern for protocol: ${protocol}`);
}

// ============================================================================
// RDF Adapter Wrapper Implementation
// ============================================================================

/**
 * Wrapper for RDF-based adapters.
 */
class RdfAdapterWrapper implements UnifiedAdapter {
  readonly protocol: AgentFramework;
  readonly pattern: AdapterPattern = 'rdf-based';
  readonly version: string;
  
  private readonly adapter: RdfBasedAdapter;
  private ready = false;
  private lastError?: UniversalError;
  private operationCount = 0;
  private errorCount = 0;
  private totalLatencyMs = 0;
  
  constructor(protocol: AgentFramework, adapter: RdfBasedAdapter) {
    this.protocol = protocol;
    this.adapter = adapter;
    this.version = getEffectiveVersionInfo(protocol).adapterVersion;
  }
  
  getCapabilities(): ProtocolCapability {
    return getProtocolCapability(this.protocol);
  }
  
  supportsFeature(feature: ProtocolFeature): boolean {
    return supportsFeature(this.protocol, feature);
  }
  
  getFeatureLevel(feature: ProtocolFeature): CapabilityLevel {
    const cap = this.getCapabilities();
    const featureDecl = cap.features.find(f => f.feature === feature);
    return featureDecl?.level ?? 'unsupported';
  }
  
  getVersionInfo(): ProtocolVersionInfo {
    return getEffectiveVersionInfo(this.protocol);
  }
  
  checkCompatibility(version: string): VersionCompatibility {
    return checkVersionCompatibility(this.protocol, version);
  }
  
  async toUniversalMessage(
    protocolPayload: unknown,
    messageType: UniversalMessageType,
    options?: ConversionOptions
  ): Promise<UniversalMessage> {
    const startTime = Date.now();
    try {
      // Convert via RDF canonical form
      const canonical = await this.adapter.toCanonical(protocolPayload);
      
      // Create universal message with canonical data in raw
      const message = createMessage(messageType, this.protocol, {
        raw: options?.preserveRaw ? { canonical, original: protocolPayload } : { canonical }
      }, {
        trace: options?.trace
      });
      
      this.recordSuccess(Date.now() - startTime);
      return message;
    } catch (error) {
      this.recordError(error);
      throw error;
    }
  }
  
  async fromUniversalMessage(
    message: UniversalMessage,
    options?: ConversionOptions
  ): Promise<unknown> {
    const startTime = Date.now();
    try {
      // Extract canonical form from message
      const canonical = message.payload.raw?.canonical;
      if (!canonical) {
        throw new Error('No canonical form in message');
      }
      
      // Convert from canonical
      const result = await this.adapter.fromCanonical(canonical);
      this.recordSuccess(Date.now() - startTime);
      return result;
    } catch (error) {
      this.recordError(error);
      throw error;
    }
  }
  
  async invokeOperation(
    operation: UniversalMessageType,
    params: UniversalPayload,
    options?: InvocationOptions
  ): Promise<UniversalMessage> {
    // RDF-based adapters don't have direct operation invocation
    // They're primarily for data conversion
    return createError(
      this.protocol,
      'UNSUPPORTED_OPERATION',
      'RDF-based adapters do not support direct operation invocation',
      { retryable: false }
    );
  }
  
  async getHealth(): Promise<AdapterHealth> {
    const avgLatency = this.operationCount > 0 
      ? this.totalLatencyMs / this.operationCount 
      : undefined;
    
    return {
      protocol: this.protocol,
      status: this.ready ? (this.lastError ? 'degraded' : 'healthy') : 'disconnected',
      healthScore: this.calculateHealthScore(),
      isConnected: this.ready,
      lastError: this.lastError,
      avgLatencyMs: avgLatency,
      recentErrors: this.errorCount,
      protocolHealth: getProtocolHealth(this.protocol)
    };
  }
  
  isReady(): boolean {
    return this.ready;
  }
  
  async initialize(): Promise<void> {
    this.ready = true;
  }
  
  async shutdown(): Promise<void> {
    this.ready = false;
  }
  
  async reset(): Promise<void> {
    this.lastError = undefined;
    this.operationCount = 0;
    this.errorCount = 0;
    this.totalLatencyMs = 0;
  }
  
  private recordSuccess(latencyMs: number): void {
    this.operationCount++;
    this.totalLatencyMs += latencyMs;
  }
  
  private recordError(error: unknown): void {
    this.errorCount++;
    this.lastError = {
      code: 'ADAPTER_ERROR',
      message: error instanceof Error ? error.message : String(error),
      retryable: false,
      sourceProtocol: this.protocol
    };
  }
  
  private calculateHealthScore(): number {
    let score = 100;
    if (!this.ready) score -= 50;
    if (this.lastError) score -= 20;
    if (this.errorCount > 5) score -= 20;
    return Math.max(0, score);
  }
}

// ============================================================================
// USA Adapter Wrapper Implementation
// ============================================================================

/**
 * Wrapper for USA-based adapters.
 */
class UsaAdapterWrapper implements UnifiedAdapter {
  readonly protocol: AgentFramework;
  readonly pattern: AdapterPattern = 'usa-based';
  readonly version: string;
  
  private readonly adapter: UsaBasedAdapter;
  private ready = false;
  private lastError?: UniversalError;
  private operationCount = 0;
  private errorCount = 0;
  private totalLatencyMs = 0;
  
  constructor(protocol: AgentFramework, adapter: UsaBasedAdapter) {
    this.protocol = protocol;
    this.adapter = adapter;
    this.version = getEffectiveVersionInfo(protocol).adapterVersion;
  }
  
  getCapabilities(): ProtocolCapability {
    return getProtocolCapability(this.protocol);
  }
  
  supportsFeature(feature: ProtocolFeature): boolean {
    return supportsFeature(this.protocol, feature);
  }
  
  getFeatureLevel(feature: ProtocolFeature): CapabilityLevel {
    const cap = this.getCapabilities();
    const featureDecl = cap.features.find(f => f.feature === feature);
    return featureDecl?.level ?? 'unsupported';
  }
  
  getVersionInfo(): ProtocolVersionInfo {
    return getEffectiveVersionInfo(this.protocol);
  }
  
  checkCompatibility(version: string): VersionCompatibility {
    return checkVersionCompatibility(this.protocol, version);
  }
  
  async toUniversalMessage(
    protocolPayload: unknown,
    messageType: UniversalMessageType,
    options?: ConversionOptions
  ): Promise<UniversalMessage> {
    const startTime = Date.now();
    try {
      // Convert via USA format
      let universal: unknown;
      if (this.adapter.toUniversalAsync) {
        universal = await this.adapter.toUniversalAsync(protocolPayload);
      } else if (this.adapter.toUniversal) {
        universal = this.adapter.toUniversal(protocolPayload);
      } else {
        throw new Error('Adapter does not support toUniversal conversion');
      }
      
      // Create universal message with USA data in raw
      const message = createMessage(messageType, this.protocol, {
        raw: options?.preserveRaw 
          ? { usa: universal, original: protocolPayload } 
          : { usa: universal }
      }, {
        trace: options?.trace
      });
      
      this.recordSuccess(Date.now() - startTime);
      return message;
    } catch (error) {
      this.recordError(error);
      throw error;
    }
  }
  
  async fromUniversalMessage(
    message: UniversalMessage,
    options?: ConversionOptions
  ): Promise<unknown> {
    const startTime = Date.now();
    try {
      // Extract USA form from message
      const usa = message.payload.raw?.usa;
      if (!usa) {
        throw new Error('No USA form in message');
      }
      
      // Convert from USA
      let result: unknown;
      if (this.adapter.fromUniversalAsync) {
        result = await this.adapter.fromUniversalAsync(usa);
      } else if (this.adapter.fromUniversal) {
        result = this.adapter.fromUniversal(usa);
      } else {
        throw new Error('Adapter does not support fromUniversal conversion');
      }
      
      this.recordSuccess(Date.now() - startTime);
      return result;
    } catch (error) {
      this.recordError(error);
      throw error;
    }
  }
  
  async invokeOperation(
    operation: UniversalMessageType,
    params: UniversalPayload,
    options?: InvocationOptions
  ): Promise<UniversalMessage> {
    // USA-based adapters are also primarily for conversion
    // Actual invocation would go to the underlying framework
    return createError(
      this.protocol,
      'UNSUPPORTED_OPERATION',
      'USA-based adapters do not support direct operation invocation',
      { retryable: false }
    );
  }
  
  async getHealth(): Promise<AdapterHealth> {
    const avgLatency = this.operationCount > 0 
      ? this.totalLatencyMs / this.operationCount 
      : undefined;
    
    return {
      protocol: this.protocol,
      status: this.ready ? (this.lastError ? 'degraded' : 'healthy') : 'disconnected',
      healthScore: this.calculateHealthScore(),
      isConnected: this.ready,
      lastError: this.lastError,
      avgLatencyMs: avgLatency,
      recentErrors: this.errorCount,
      protocolHealth: getProtocolHealth(this.protocol)
    };
  }
  
  isReady(): boolean {
    return this.ready;
  }
  
  async initialize(): Promise<void> {
    this.ready = true;
  }
  
  async shutdown(): Promise<void> {
    this.ready = false;
  }
  
  async reset(): Promise<void> {
    this.lastError = undefined;
    this.operationCount = 0;
    this.errorCount = 0;
    this.totalLatencyMs = 0;
  }
  
  private recordSuccess(latencyMs: number): void {
    this.operationCount++;
    this.totalLatencyMs += latencyMs;
  }
  
  private recordError(error: unknown): void {
    this.errorCount++;
    this.lastError = {
      code: 'ADAPTER_ERROR',
      message: error instanceof Error ? error.message : String(error),
      retryable: false,
      sourceProtocol: this.protocol
    };
  }
  
  private calculateHealthScore(): number {
    let score = 100;
    if (!this.ready) score -= 50;
    if (this.lastError) score -= 20;
    if (this.errorCount > 5) score -= 20;
    return Math.max(0, score);
  }
}

// ============================================================================
// Adapter Registry
// ============================================================================

/**
 * Registry of unified adapters.
 */
class AdapterRegistry {
  private adapters: Map<AgentFramework, UnifiedAdapter> = new Map();
  
  /**
   * Register a unified adapter.
   */
  register(adapter: UnifiedAdapter): void {
    this.adapters.set(adapter.protocol, adapter);
  }
  
  /**
   * Get adapter for a protocol.
   */
  get(protocol: AgentFramework): UnifiedAdapter | undefined {
    return this.adapters.get(protocol);
  }
  
  /**
   * Check if adapter is registered.
   */
  has(protocol: AgentFramework): boolean {
    return this.adapters.has(protocol);
  }
  
  /**
   * Get all registered adapters.
   */
  getAll(): UnifiedAdapter[] {
    return Array.from(this.adapters.values());
  }
  
  /**
   * Get all registered protocols.
   */
  getProtocols(): AgentFramework[] {
    return Array.from(this.adapters.keys());
  }
  
  /**
   * Get adapters supporting a specific feature.
   */
  getByFeature(feature: ProtocolFeature): UnifiedAdapter[] {
    return this.getAll().filter(a => a.supportsFeature(feature));
  }
  
  /**
   * Get adapter health for all registered adapters.
   */
  async getAllHealth(): Promise<AdapterHealth[]> {
    return Promise.all(this.getAll().map(a => a.getHealth()));
  }
  
  /**
   * Initialize all registered adapters.
   */
  async initializeAll(): Promise<void> {
    await Promise.all(this.getAll().map(a => a.initialize()));
  }
  
  /**
   * Shutdown all registered adapters.
   */
  async shutdownAll(): Promise<void> {
    await Promise.all(this.getAll().map(a => a.shutdown()));
  }
  
  /**
   * Remove an adapter.
   */
  remove(protocol: AgentFramework): boolean {
    return this.adapters.delete(protocol);
  }
  
  /**
   * Clear all adapters.
   */
  clear(): void {
    this.adapters.clear();
  }
}

/**
 * Global adapter registry instance.
 */
export const adapterRegistry = new AdapterRegistry();

// ============================================================================
// Protocol Bridge
// ============================================================================

/**
 * Bridge messages between protocols.
 */
export class ProtocolBridge {
  private registry: AdapterRegistry;
  
  constructor(registry: AdapterRegistry = adapterRegistry) {
    this.registry = registry;
  }
  
  /**
   * Translate a message from one protocol to another.
   * 
   * @param message - Source message
   * @param targetProtocol - Target protocol
   * @returns Translated message for target protocol
   */
  async translate(
    message: UniversalMessage,
    targetProtocol: AgentFramework
  ): Promise<UniversalMessage> {
    const sourceAdapter = this.registry.get(message.sourceProtocol);
    const targetAdapter = this.registry.get(targetProtocol);
    
    if (!sourceAdapter) {
      throw new Error(`No adapter for source protocol: ${message.sourceProtocol}`);
    }
    if (!targetAdapter) {
      throw new Error(`No adapter for target protocol: ${targetProtocol}`);
    }
    
    // Convert to intermediate format
    const intermediate = await sourceAdapter.fromUniversalMessage(message);
    
    // Convert to target protocol format, then back to universal
    return targetAdapter.toUniversalMessage(
      intermediate, 
      message.type,
      { trace: message.trace }
    );
  }
  
  /**
   * Route a message to the appropriate adapter.
   * 
   * @param message - Message to route
   * @returns Adapter for the message's target protocol
   */
  getTargetAdapter(message: UniversalMessage): UnifiedAdapter | undefined {
    const target = message.targetProtocol ?? message.sourceProtocol;
    return this.registry.get(target);
  }
  
  /**
   * Check if translation is possible between two protocols.
   */
  canTranslate(sourceProtocol: AgentFramework, targetProtocol: AgentFramework): boolean {
    return this.registry.has(sourceProtocol) && this.registry.has(targetProtocol);
  }
}

/**
 * Global protocol bridge instance.
 */
export const protocolBridge = new ProtocolBridge();

// ============================================================================
// Exports
// ============================================================================

export default {
  wrapRdfAdapter,
  wrapUsaAdapter,
  createUnifiedAdapter,
  adapterRegistry,
  protocolBridge,
  ProtocolBridge,
  AdapterRegistry
};
