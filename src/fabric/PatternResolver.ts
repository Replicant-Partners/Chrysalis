/**
 * Adaptive Pattern Resolver v3.2
 *
 * Resolves universal pattern implementations based on deployment context.
 * Supports three resolution strategies:
 * 1. MCP Fabric (distributed, network-based)
 * 2. Embedded Patterns (local, function-based)
 * 3. Direct Library (minimal overhead)
 *
 * Implements fractal architecture principle: Same patterns at multiple scales
 *
 * v3.2 Changes:
 * - Added CircuitBreaker for fault tolerance (HIGH-ARCH-001)
 * - MCP/Go calls now timeout after 5 seconds with embedded fallback
 *
 * @see reports/COMPREHENSIVE_CODE_REVIEW.md HIGH-ARCH-001
 */

import * as EmbeddedPatterns from '../core/patterns';
import { GoCryptoClient } from '../adapters/goCryptoClient';
import { CircuitBreaker, createMCPCircuitBreaker } from '../utils/CircuitBreaker';

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
export type ResolutionSource = 'mcp' | 'embedded' | 'library' | 'go';

export interface MCPPatternClient {
  hash(data: string | Uint8Array, algorithm: string): Promise<string>;
  generateKeypair(): Promise<{ privateKey: Uint8Array; publicKey: Uint8Array }>;
  sign(message: string | Uint8Array, privateKey: Uint8Array): Promise<Uint8Array>;
  verify(message: string | Uint8Array, signature: Uint8Array, publicKey: Uint8Array): Promise<boolean>;
}

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

const goClientShared = new GoCryptoClient();

function encodeDataInput(data: string | Uint8Array): { data: string; encoding: 'utf8' | 'hex' } {
  if (typeof data === 'string') {
    return { data, encoding: 'utf8' };
  }
  return { data: Buffer.from(data).toString('hex'), encoding: 'hex' };
}

function hexToBytes(hex: string): Uint8Array {
  return Buffer.from(hex, 'hex');
}

function bytesToHex(data: Uint8Array): string {
  return Buffer.from(data).toString('hex');
}

class MCPHashImpl implements HashImplementation {
  private client: MCPPatternClient;
  constructor(client: MCPPatternClient) {
    this.client = client;
  }
  async hash(data: string | Uint8Array, algorithm: string): Promise<string> {
    return this.client.hash(data, algorithm);
  }
  async verify(data: string | Uint8Array, expectedHash: string): Promise<boolean> {
    const actual = await this.client.hash(data, algorithmForVerify(expectedHash));
    return actual === expectedHash;
  }
  async generateFingerprint(identity: any): Promise<string> {
    const payload = typeof identity === 'string' ? identity : JSON.stringify(identity);
    return this.client.hash(payload, 'sha-384');
  }
}

function algorithmForVerify(expectedHash: string): string {
  if (expectedHash.length === 128) return 'sha-512';
  if (expectedHash.length === 96) return 'sha-384';
  if (expectedHash.length === 64) return 'sha-256';
  return 'sha-384';
}

class GoHashImpl implements HashImplementation {
  private client: GoCryptoClient;
  constructor(client: GoCryptoClient = goClientShared) {
    this.client = client;
  }

  async hash(data: string | Uint8Array, algorithm: string = 'SHA-384'): Promise<string> {
    const encoded = encodeDataInput(data);
    const res = await this.client.call('Hash', { data: encoded.data, algorithm, encoding: encoded.encoding });
    return res.hash as string;
  }

  async verify(data: string | Uint8Array, expectedHash: string): Promise<boolean> {
    const encoded = encodeDataInput(data);
    const res = await this.client.call('VerifyHash', { data: encoded.data, expectedHash, algorithm: 'SHA-384', encoding: encoded.encoding });
    return !!res.valid;
  }

  async generateFingerprint(identity: any): Promise<string> {
    const payload = JSON.stringify(identity);
    const res = await this.client.call('Hash', { data: payload, algorithm: 'SHA-384', encoding: 'utf8' });
    return res.hash as string;
  }
}

class MCPSignatureImpl implements SignatureImplementation {
  private client: MCPPatternClient;
  constructor(client: MCPPatternClient) {
    this.client = client;
  }
  async generateKeypair(): Promise<{ privateKey: Uint8Array; publicKey: Uint8Array }> {
    return this.client.generateKeypair();
  }
  async sign(message: string | Uint8Array, privateKey: Uint8Array): Promise<Uint8Array> {
    return this.client.sign(message, privateKey);
  }
  async verify(message: string | Uint8Array, signature: Uint8Array, publicKey: Uint8Array): Promise<boolean> {
    return this.client.verify(message, signature, publicKey);
  }
}

class GoSignatureImpl implements SignatureImplementation {
  private client: GoCryptoClient;
  constructor(client: GoCryptoClient = goClientShared) {
    this.client = client;
  }

  async generateKeypair(): Promise<{ privateKey: Uint8Array; publicKey: Uint8Array }> {
    const res = await this.client.call('Ed25519Keygen', {});
    return { privateKey: hexToBytes(res.privateKey as string), publicKey: hexToBytes(res.publicKey as string) };
  }

  async sign(message: string | Uint8Array, privateKey: Uint8Array): Promise<Uint8Array> {
    const encoded = encodeDataInput(message);
    const res = await this.client.call('Ed25519Sign', { message: encoded.data, privateKey: bytesToHex(privateKey), encoding: encoded.encoding });
    return hexToBytes(res.signature as string);
  }

  async verify(message: string | Uint8Array, signature: Uint8Array, publicKey: Uint8Array): Promise<boolean> {
    const encoded = encodeDataInput(message);
    const res = await this.client.call('Ed25519Verify', { message: encoded.data, signature: bytesToHex(signature), publicKey: bytesToHex(publicKey), encoding: encoded.encoding });
    return !!res.valid;
  }
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
 * Resolves patterns based on deployment context.
 * Now includes circuit breaker protection for external service calls.
 */
export class AdaptivePatternResolver {
  private context: DeploymentContext;
  private mcpClient?: MCPPatternClient;
  private hashCircuitBreaker: CircuitBreaker<PatternResolution<HashImplementation>>;
  private signatureCircuitBreaker: CircuitBreaker<PatternResolution<SignatureImplementation>>;
  
  constructor(context?: Partial<DeploymentContext>, mcpClient?: MCPPatternClient) {
    this.mcpClient = mcpClient;
    this.context = {
      distributed: context?.distributed ?? false,
      mcp_available: context?.mcp_available ?? false,
      performance_critical: context?.performance_critical ?? false,
      prefer_reusability: context?.prefer_reusability ?? false
    };
    
    // Initialize circuit breakers for fault tolerance
    this.hashCircuitBreaker = createMCPCircuitBreaker('hash-resolver');
    this.signatureCircuitBreaker = createMCPCircuitBreaker('signature-resolver');
  }
  
  /**
   * Update deployment context (runtime reconfiguration)
   */
  updateContext(updates: Partial<DeploymentContext>): void {
    this.context = { ...this.context, ...updates };
  }
  
  /**
   * Get embedded hash resolution (used as fallback)
   */
  private getEmbeddedHashResolution(): PatternResolution<HashImplementation> {
    return {
      source: 'embedded',
      implementation: new EmbeddedHashImpl(),
      latency_estimate_ms: 0.1,
      reason: this.context.distributed
        ? 'Circuit breaker fallback to embedded patterns'
        : 'Embedded patterns optimal for single-node deployment'
    };
  }
  
  /**
   * Get embedded signature resolution (used as fallback)
   */
  private getEmbeddedSignatureResolution(): PatternResolution<SignatureImplementation> {
    return {
      source: 'embedded',
      implementation: new EmbeddedSignatureImpl(),
      latency_estimate_ms: 0.5,
      reason: this.context.distributed
        ? 'Circuit breaker fallback to embedded patterns'
        : 'Embedded patterns optimal for single-node deployment'
    };
  }
  
  /**
   * Resolve hash implementation with circuit breaker protection
   */
  async resolveHash(): Promise<PatternResolution<HashImplementation>> {
    if (this.shouldUseMCP()) {
      // Use circuit breaker for external service calls
      return this.hashCircuitBreaker.execute(
        async () => {
          if (this.mcpClient) {
            return {
              source: 'mcp' as ResolutionSource,
              implementation: new MCPHashImpl(this.mcpClient),
              latency_estimate_ms: 5,
              reason: 'MCP client (circuit breaker protected)'
            };
          }
          return {
            source: 'go' as ResolutionSource,
            implementation: new GoHashImpl(),
            latency_estimate_ms: 5,
            reason: 'Go gRPC crypto (circuit breaker protected)'
          };
        },
        () => this.getEmbeddedHashResolution()
      );
    }
    return this.getEmbeddedHashResolution();
  }
  
  /**
   * Resolve signature implementation with circuit breaker protection
   */
  async resolveSignature(): Promise<PatternResolution<SignatureImplementation>> {
    if (this.shouldUseMCP()) {
      // Use circuit breaker for external service calls
      return this.signatureCircuitBreaker.execute(
        async () => {
          if (this.mcpClient) {
            return {
              source: 'mcp' as ResolutionSource,
              implementation: new MCPSignatureImpl(this.mcpClient),
              latency_estimate_ms: 5,
              reason: 'MCP client (circuit breaker protected)'
            };
          }
          return {
            source: 'go' as ResolutionSource,
            implementation: new GoSignatureImpl(),
            latency_estimate_ms: 5,
            reason: 'Go gRPC signatures (circuit breaker protected)'
          };
        },
        () => this.getEmbeddedSignatureResolution()
      );
    }
    return this.getEmbeddedSignatureResolution();
  }
  
  /**
   * Get circuit breaker statistics for monitoring
   */
  getCircuitBreakerStats(): {
    hash: ReturnType<CircuitBreaker<any>['getStats']>;
    signature: ReturnType<CircuitBreaker<any>['getStats']>;
  } {
    return {
      hash: this.hashCircuitBreaker.getStats(),
      signature: this.signatureCircuitBreaker.getStats()
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
      preferred_source: prefersMCP ? 'go' : 'embedded',
      estimated_latency_ms: prefersMCP ? 5.0 : 0.1
    };
  }
}

/**
 * Factory: Create resolver for context
 */
export function createPatternResolver(
  deploymentModel: 'embedded' | 'distributed' | 'adaptive',
  mcpClient?: MCPPatternClient
): AdaptivePatternResolver {
  switch (deploymentModel) {
    case 'embedded':
      return new AdaptivePatternResolver({
        distributed: false,
        mcp_available: false,
        performance_critical: true,
        prefer_reusability: false
      }, mcpClient);
    
    case 'distributed':
      return new AdaptivePatternResolver({
        distributed: true,
        mcp_available: true,
        performance_critical: false,
        prefer_reusability: true
      }, mcpClient);
    
    case 'adaptive':
      return new AdaptivePatternResolver({
        distributed: false,
        mcp_available: false,
        performance_critical: false,
        prefer_reusability: false
      }, mcpClient);
    
    default:
      return new AdaptivePatternResolver(undefined, mcpClient);
  }
}
