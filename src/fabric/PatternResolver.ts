/**
 * Adaptive Pattern Resolver v3.1
 * 
 * Resolves universal pattern implementations based on deployment context.
 * Supports three resolution strategies:
 * 1. MCP Fabric (distributed, network-based)
 * 2. Embedded Patterns (local, function-based)
 * 3. Direct Library (minimal overhead)
 * 
 * Implements fractal architecture principle: Same patterns at multiple scales
 */

import * as EmbeddedPatterns from '../core/patterns';

/**
 * Pattern types that can be resolved
 */
export type PatternType = 
  | 'hash' 
  | 'signature'
  | 'random'
  | 'dag'
  | 'time'
  | 'threshold'
  | 'convergence';

/**
 * Resolution sources (in preference order)
 */
export type ResolutionSource = 'mcp' | 'embedded' | 'library';

/**
 * Deployment context for resolution decisions
 */
export interface DeploymentContext {
  distributed: boolean;           // Multi-node deployment?
  mcp_available: boolean;          // MCP servers accessible?
  performance_critical: boolean;   // Latency < 1ms required?
  prefer_reusability: boolean;     // Favor shared services?
}

/**
 * Pattern resolution result
 */
export interface PatternResolution<T> {
  source: ResolutionSource;
  implementation: T;
  latency_estimate_ms: number;
  reason: string;
}

/**
 * Hash implementation interface
 */
export interface HashImplementation {
  hash(data: string | Uint8Array, algorithm: string): Promise<string>;
  verify(data: string | Uint8Array, expectedHash: string): Promise<boolean>;
  generateFingerprint(identity: any): Promise<string>;
}

/**
 * Signature implementation interface
 */
export interface SignatureImplementation {
  generateKeypair(): Promise<{ privateKey: Uint8Array; publicKey: Uint8Array }>;
  sign(message: string | Uint8Array, privateKey: Uint8Array): Promise<Uint8Array>;
  verify(message: string | Uint8Array, signature: Uint8Array, publicKey: Uint8Array): Promise<boolean>;
}

/**
 * DAG implementation interface
 */
export interface DAGImplementation {
  createGraph(): any;
  addNode(graph: any, nodeId: string, data?: any): void;
  addEdge(graph: any, from: string, to: string): void;
  topologicalSort(graph: any): string[];
  ancestors(graph: any, nodeId: string): Set<string>;
}

/**
 * Time implementation interface
 */
export interface TimeImplementation {
  createLamportClock(nodeId: string): any;
  createVectorClock(nodeId: string, numNodes: number, mapping: Map<string, number>): any;
  consensusTimestamp(timestamps: number[]): number;
}

/**
 * Threshold implementation interface
 */
export interface ThresholdImplementation {
  trimmedMean(values: number[], trimPercent?: number): number;
  median(values: number[]): number;
  hasSupermajority(yes: number, total: number, threshold?: number): boolean;
  byzantineAgreement<T>(values: T[]): T | null;
}

/**
 * Embedded Hash Implementation (Pattern #1)
 */
class EmbeddedHashImpl implements HashImplementation {
  async hash(data: string | Uint8Array, algorithm: string = 'SHA-384'): Promise<string> {
    return EmbeddedPatterns.hashToHex(data, algorithm as any);
  }
  
  async verify(data: string | Uint8Array, expectedHash: string): Promise<boolean> {
    return EmbeddedPatterns.verifyHash(data, expectedHash);
  }
  
  async generateFingerprint(identity: any): Promise<string> {
    return EmbeddedPatterns.generateAgentFingerprint(identity);
  }
}

/**
 * Embedded Signature Implementation (Pattern #2)
 */
class EmbeddedSignatureImpl implements SignatureImplementation {
  async generateKeypair() {
    return await EmbeddedPatterns.generateKeypair('ed25519');
  }
  
  async sign(message: string | Uint8Array, privateKey: Uint8Array) {
    return await EmbeddedPatterns.sign(message, privateKey, 'ed25519');
  }
  
  async verify(message: string | Uint8Array, signature: Uint8Array, publicKey: Uint8Array) {
    return await EmbeddedPatterns.verify(message, signature, publicKey, 'ed25519');
  }
}

/**
 * Embedded Threshold Implementation (Pattern #8)
 */
class EmbeddedThresholdImpl implements ThresholdImplementation {
  trimmedMean(values: number[], trimPercent: number = 0.2): number {
    return EmbeddedPatterns.trimmedMean(values, trimPercent);
  }
  
  median(values: number[]): number {
    return EmbeddedPatterns.median(values);
  }
  
  hasSupermajority(yes: number, total: number, threshold: number = 2/3): boolean {
    return EmbeddedPatterns.hasSupermajority(yes, total, threshold);
  }
  
  byzantineAgreement<T>(values: T[]): T | null {
    return EmbeddedPatterns.byzantineAgreement(values);
  }
}

/**
 * Embedded Time Implementation (Pattern #9)
 */
class EmbeddedTimeImpl implements TimeImplementation {
  createLamportClock(nodeId: string) {
    return new EmbeddedPatterns.LamportClock(nodeId);
  }
  
  createVectorClock(nodeId: string, numNodes: number, mapping: Map<string, number>) {
    return new EmbeddedPatterns.VectorClock(nodeId, numNodes, mapping);
  }
  
  consensusTimestamp(timestamps: number[]): number {
    return EmbeddedPatterns.consensusTimestamp(timestamps);
  }
}

/**
 * Adaptive Pattern Resolver
 * 
 * Resolves patterns based on deployment context
 */
export class AdaptivePatternResolver {
  private context: DeploymentContext;
  
  constructor(context?: Partial<DeploymentContext>) {
    // Default context: Single-node embedded
    this.context = {
      distributed: context?.distributed ?? false,
      mcp_available: context?.mcp_available ?? false,
      performance_critical: context?.performance_critical ?? false,
      prefer_reusability: context?.prefer_reusability ?? false
    };
  }
  
  /**
   * Update deployment context (runtime reconfiguration)
   */
  updateContext(updates: Partial<DeploymentContext>): void {
    this.context = { ...this.context, ...updates };
  }
  
  /**
   * Resolve hash implementation
   */
  async resolveHash(): Promise<PatternResolution<HashImplementation>> {
    // Decision logic based on context
    if (this.shouldUseMCP()) {
      // MCP fabric would go here
      // For now, fall through to embedded
    }
    
    // Use embedded (always available, fast)
    return {
      source: 'embedded',
      implementation: new EmbeddedHashImpl(),
      latency_estimate_ms: 0.1,
      reason: this.context.distributed 
        ? 'MCP not yet integrated, using embedded fallback'
        : 'Embedded patterns optimal for single-node deployment'
    };
  }
  
  /**
   * Resolve signature implementation
   */
  async resolveSignature(): Promise<PatternResolution<SignatureImplementation>> {
    return {
      source: 'embedded',
      implementation: new EmbeddedSignatureImpl(),
      latency_estimate_ms: 0.5,  // Signature ops are slower
      reason: this.context.distributed
        ? 'MCP not yet integrated, using embedded fallback'
        : 'Embedded patterns optimal for single-node deployment'
    };
  }
  
  /**
   * Resolve threshold implementation
   */
  async resolveThreshold(): Promise<PatternResolution<ThresholdImplementation>> {
    return {
      source: 'embedded',
      implementation: new EmbeddedThresholdImpl(),
      latency_estimate_ms: 0.05,  // Statistical ops are fast
      reason: 'Statistical operations best performed locally'
    };
  }
  
  /**
   * Resolve time implementation
   */
  async resolveTime(): Promise<PatternResolution<TimeImplementation>> {
    return {
      source: 'embedded',
      implementation: new EmbeddedTimeImpl(),
      latency_estimate_ms: 0.01,  // Clock ops are very fast
      reason: 'Logical clocks require local state, embedded is optimal'
    };
  }
  
  /**
   * Should use MCP fabric?
   */
  private shouldUseMCP(): boolean {
    // Only use MCP if:
    // 1. MCP servers are available, AND
    // 2. We're in distributed context, AND
    // 3. Performance is not critical, AND
    // 4. We prefer reusability
    
    return this.context.mcp_available &&
           this.context.distributed &&
           !this.context.performance_critical &&
           this.context.prefer_reusability;
  }
  
  /**
   * Get deployment summary
   */
  getDeploymentSummary(): {
    context: DeploymentContext;
    preferred_source: ResolutionSource;
    estimated_latency_ms: number;
  } {
    const prefersMCP = this.shouldUseMCP();
    
    return {
      context: this.context,
      preferred_source: prefersMCP ? 'mcp' : 'embedded',
      estimated_latency_ms: prefersMCP ? 5.0 : 0.1
    };
  }
}

/**
 * Factory: Create resolver for context
 */
export function createPatternResolver(
  deploymentModel: 'embedded' | 'distributed' | 'adaptive'
): AdaptivePatternResolver {
  switch (deploymentModel) {
    case 'embedded':
      return new AdaptivePatternResolver({
        distributed: false,
        mcp_available: false,
        performance_critical: true,
        prefer_reusability: false
      });
    
    case 'distributed':
      return new AdaptivePatternResolver({
        distributed: true,
        mcp_available: true,
        performance_critical: false,
        prefer_reusability: true
      });
    
    case 'adaptive':
      return new AdaptivePatternResolver({
        distributed: false,  // Start embedded
        mcp_available: false,
        performance_critical: false,
        prefer_reusability: false
      });
    
    default:
      return new AdaptivePatternResolver();
  }
}
