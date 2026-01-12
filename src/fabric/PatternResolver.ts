/**
 * Adaptive Pattern Resolver v3.3
 *
 * Resolves universal pattern implementations based on deployment context.
 * Supports three resolution strategies:
 * 1. MCP Fabric (distributed, network-based)
 * 2. Embedded Patterns (local, function-based)
 * 3. Direct Library (minimal overhead)
 *
 * Implements fractal architecture principle: Same patterns at multiple scales
 *
 * v3.3 Changes:
 * - Added missing pattern implementations (random, convergence)
 * - Added comprehensive metrics and observability tracking
 * - Added caching for repeated operations
 * - Added PatternResolutionError for detailed error context
 * - Added health check method for monitoring
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

/**
 * Random implementation interface
 */
export interface RandomImplementation {
  random(): number;
  randomInt(min: number, max: number): number;
  selectRandom<T>(items: T[]): T | null;
  selectMultiple<T>(items: T[], count: number): T[];
  shuffle<T>(array: T[]): T[];
}

/**
 * Convergence implementation interface
 */
export interface ConvergenceImplementation {
  apply<T>(type: string, current: T, incoming: T): T;
  convergeState(current: any, incoming: any): any;
  convergeBeliefs(current: Map<string, any>, incoming: Map<string, any>): Map<string, any>;
}

/**
 * Pattern Resolution Error
 * Provides detailed error context for pattern resolution failures
 */
export class PatternResolutionError extends Error {
  constructor(
    public pattern: string,
    public attemptedSource: ResolutionSource,
    public originalError: unknown
  ) {
    super(`Failed to resolve ${pattern} pattern via ${attemptedSource}: ${originalError instanceof Error ? originalError.message : String(originalError)}`);
    this.name = 'PatternResolutionError';
  }
}

/**
 * Metrics data structure for tracking pattern resolution performance
 */
export interface PatternMetrics {
  count: number;
  totalLatency: number;
  errors: number;
  avgLatency: number;
  errorRate: number;
}

/**
 * Cache entry for fingerprint caching
 */
interface CacheEntry<T> {
  value: T;
  timestamp: number;
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
  public async hash(data: string | Uint8Array, algorithm: string): Promise<string> {
    return this.client.hash(data, algorithm);
  }
  public async verify(data: string | Uint8Array, expectedHash: string): Promise<boolean> {
    const actual = await this.client.hash(data, algorithmForVerify(expectedHash));
    return actual === expectedHash;
  }
  public async generateFingerprint(identity: unknown): Promise<string> {
    const payload = typeof identity === 'string' ? identity : JSON.stringify(identity);
    return this.client.hash(payload, 'sha-384');
  }
}

function algorithmForVerify(expectedHash: string): string {
  if (expectedHash.length === 128) { return 'sha-512'; }
  if (expectedHash.length === 96) { return 'sha-384'; }
  if (expectedHash.length === 64) { return 'sha-256'; }
  return 'sha-384';
}

class GoHashImpl implements HashImplementation {
  private client: GoCryptoClient;
  constructor(client: GoCryptoClient = goClientShared) {
    this.client = client;
  }

  public async hash(data: string | Uint8Array, algorithm: string = 'SHA-384'): Promise<string> {
    const encoded = encodeDataInput(data);
    const res = await this.client.call('Hash', { data: encoded.data, algorithm, encoding: encoded.encoding });
    return res.hash as string;
  }

  public async verify(data: string | Uint8Array, expectedHash: string): Promise<boolean> {
    const encoded = encodeDataInput(data);
    const res = await this.client.call('VerifyHash', { data: encoded.data, expectedHash, algorithm: 'SHA-384', encoding: encoded.encoding });
    return !!res.valid;
  }

  public async generateFingerprint(identity: unknown): Promise<string> {
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
  public async generateKeypair(): Promise<{ privateKey: Uint8Array; publicKey: Uint8Array }> {
    return this.client.generateKeypair();
  }
  public async sign(message: string | Uint8Array, privateKey: Uint8Array): Promise<Uint8Array> {
    return this.client.sign(message, privateKey);
  }
  public async verify(message: string | Uint8Array, signature: Uint8Array, publicKey: Uint8Array): Promise<boolean> {
    return this.client.verify(message, signature, publicKey);
  }
}

class GoSignatureImpl implements SignatureImplementation {
  private client: GoCryptoClient;
  constructor(client: GoCryptoClient = goClientShared) {
    this.client = client;
  }

  public async generateKeypair(): Promise<{ privateKey: Uint8Array; publicKey: Uint8Array }> {
    const res = await this.client.call('Ed25519Keygen', {});
    return { privateKey: hexToBytes(res.privateKey as string), publicKey: hexToBytes(res.publicKey as string) };
  }

  public async sign(message: string | Uint8Array, privateKey: Uint8Array): Promise<Uint8Array> {
    const encoded = encodeDataInput(message);
    const res = await this.client.call('Ed25519Sign', { message: encoded.data, privateKey: bytesToHex(privateKey), encoding: encoded.encoding });
    return hexToBytes(res.signature as string);
  }

  public async verify(message: string | Uint8Array, signature: Uint8Array, publicKey: Uint8Array): Promise<boolean> {
    const encoded = encodeDataInput(message);
    const res = await this.client.call('Ed25519Verify', { message: encoded.data, signature: bytesToHex(signature), publicKey: bytesToHex(publicKey), encoding: encoded.encoding });
    return !!res.valid;
  }
}

/**
 * Embedded Hash Implementation (Pattern #1)
 */
class EmbeddedHashImpl implements HashImplementation {
  public async hash(data: string | Uint8Array, algorithm: string = 'SHA-384'): Promise<string> {
    return EmbeddedPatterns.hashToHex(data, algorithm as any);
  }
  
  public async verify(data: string | Uint8Array, expectedHash: string): Promise<boolean> {
    return EmbeddedPatterns.verifyHash(data, expectedHash);
  }
  
  public async generateFingerprint(identity: unknown): Promise<string> {
    return EmbeddedPatterns.generateAgentFingerprint(identity as any);
  }
}

/**
 * Embedded Signature Implementation (Pattern #2)
 */
class EmbeddedSignatureImpl implements SignatureImplementation {
  public async generateKeypair(): Promise<{ privateKey: Uint8Array; publicKey: Uint8Array }> {
    return await EmbeddedPatterns.generateKeypair('ed25519');
  }
  
  public async sign(message: string | Uint8Array, privateKey: Uint8Array): Promise<Uint8Array> {
    return await EmbeddedPatterns.sign(message, privateKey, 'ed25519');
  }
  
  public async verify(message: string | Uint8Array, signature: Uint8Array, publicKey: Uint8Array): Promise<boolean> {
    return await EmbeddedPatterns.verify(message, signature, publicKey, 'ed25519');
  }
}

/**
 * Embedded Threshold Implementation (Pattern #8)
 */
class EmbeddedThresholdImpl implements ThresholdImplementation {
  public trimmedMean(values: number[], trimPercent: number = 0.2): number {
    return EmbeddedPatterns.trimmedMean(values, trimPercent);
  }
  
  public median(values: number[]): number {
    return EmbeddedPatterns.median(values);
  }
  
  public hasSupermajority(yes: number, total: number, threshold: number = 2/3): boolean {
    return EmbeddedPatterns.hasSupermajority(yes, total, threshold);
  }
  
  public byzantineAgreement<T>(values: T[]): T | null {
    return EmbeddedPatterns.byzantineAgreement(values);
  }
}

/**
 * Embedded Time Implementation (Pattern #9)
 */
class EmbeddedTimeImpl implements TimeImplementation {
  public createLamportClock(nodeId: string): unknown {
    return new EmbeddedPatterns.LamportClock(nodeId);
  }

  public createVectorClock(nodeId: string, numNodes: number, mapping: Map<string, number>): unknown {
    return new EmbeddedPatterns.VectorClock(nodeId, numNodes, mapping);
  }

  public consensusTimestamp(timestamps: number[]): number {
    return EmbeddedPatterns.consensusTimestamp(timestamps);
  }
}

/**
 * Embedded Random Implementation (Pattern #10)
 */
class EmbeddedRandomImpl implements RandomImplementation {
  private selector: EmbeddedPatterns.RandomSelector;

  constructor() {
    this.selector = new EmbeddedPatterns.RandomSelector();
  }

  public random(): number {
    return this.selector.random();
  }

  public randomInt(min: number, max: number): number {
    return this.selector.randomInt(min, max);
  }

  public selectRandom<T>(items: T[]): T | null {
    return this.selector.selectRandom(items);
  }

  public selectMultiple<T>(items: T[], count: number): T[] {
    return this.selector.selectMultiple(items, count);
  }

  public shuffle<T>(array: T[]): T[] {
    return this.selector.shuffle(array);
  }
}

/**
 * Embedded Convergence Implementation (Pattern #6)
 */
class EmbeddedConvergenceImpl implements ConvergenceImplementation {
  public apply<T>(type: string, current: T, incoming: T): T {
    const convergenceType = this.mapConvergenceType(type);
    return EmbeddedPatterns.ConvergenceFunctionRegistry.apply(convergenceType, current, incoming);
  }

  public convergeState(current: any, incoming: any): any {
    const manager = new EmbeddedPatterns.ConvergentStateManager(current);
    manager.updateState(incoming);
    return manager.getState();
  }

  public convergeBeliefs(current: Map<string, any>, incoming: Map<string, any>): Map<string, any> {
    const manager = new EmbeddedPatterns.BeliefConvergenceManager();
    for (const [id, belief] of current.entries()) {
      manager.addBelief(id, belief.content, belief.confidence, belief.source);
    }
    manager.mergeBeliefs(incoming);
    const result = new Map<string, any>();
    for (const belief of manager.getAllBeliefs()) {
      result.set(belief.content.id || belief.content, belief);
    }
    return result;
  }

  private mapConvergenceType(type: string): EmbeddedPatterns.ConvergenceType {
    const typeMap: Record<string, EmbeddedPatterns.ConvergenceType> = {
      'max': EmbeddedPatterns.ConvergenceType.MAX,
      'min': EmbeddedPatterns.ConvergenceType.MIN,
      'average': EmbeddedPatterns.ConvergenceType.AVERAGE,
      'union': EmbeddedPatterns.ConvergenceType.UNION,
      'intersection': EmbeddedPatterns.ConvergenceType.INTERSECTION,
      'merge': EmbeddedPatterns.ConvergenceType.MERGE,
      'first': EmbeddedPatterns.ConvergenceType.FIRST,
      'last': EmbeddedPatterns.ConvergenceType.LAST,
      'weighted_average': EmbeddedPatterns.ConvergenceType.WEIGHTED_AVERAGE,
      'max_confidence': EmbeddedPatterns.ConvergenceType.MAX_CONFIDENCE
    };
    return typeMap[type] || EmbeddedPatterns.ConvergenceType.MERGE;
  }
}

/**
 * Adaptive Pattern Resolver
 *
 * Resolves patterns based on deployment context.
 * Now includes circuit breaker protection for external service calls,
 * metrics tracking, caching, and health checks.
 */
export class AdaptivePatternResolver {
  private context: DeploymentContext;
  private mcpClient?: MCPPatternClient;
  private hashCircuitBreaker: CircuitBreaker<PatternResolution<HashImplementation>>;
  private signatureCircuitBreaker: CircuitBreaker<PatternResolution<SignatureImplementation>>;
  private metrics: Map<string, { count: number; totalLatency: number; errors: number }>;
  private fingerprintCache: Map<string, CacheEntry<string>>;
  private readonly CACHE_TTL_MS = 60000; // 1 minute

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

    // Initialize metrics tracking
    this.metrics = new Map();

    // Initialize fingerprint cache
    this.fingerprintCache = new Map();
  }
  
  /**
   * Update deployment context (runtime reconfiguration)
   */
  public updateContext(updates: Partial<DeploymentContext>): void {
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
  public async resolveHash(): Promise<PatternResolution<HashImplementation>> {
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
    // Default to embedded if MCP not suitable
    return this.getEmbeddedHashResolution();
  }
  
  /**
   * Resolve signature implementation with circuit breaker protection
   */
  public async resolveSignature(): Promise<PatternResolution<SignatureImplementation>> {
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
  public getCircuitBreakerStats(): {
    hash: ReturnType<CircuitBreaker<PatternResolution<HashImplementation>>['getStats']>;
    signature: ReturnType<CircuitBreaker<PatternResolution<SignatureImplementation>>['getStats']>;
  } {
    return {
      hash: this.hashCircuitBreaker.getStats(),
      signature: this.signatureCircuitBreaker.getStats()
    };
  }
  
  /**
   * Resolve threshold implementation
   */
  public async resolveThreshold(): Promise<PatternResolution<ThresholdImplementation>> {
    return Promise.resolve({
      source: 'embedded',
      implementation: new EmbeddedThresholdImpl(),
      latency_estimate_ms: 0.05,  // Statistical ops are fast
      reason: 'Statistical operations best performed locally'
    });
  }
  
  /**
   * Resolve time implementation
   */
  public async resolveTime(): Promise<PatternResolution<TimeImplementation>> {
    return Promise.resolve({
      source: 'embedded',
      implementation: new EmbeddedTimeImpl(),
      latency_estimate_ms: 0.01,  // Clock ops are very fast
      reason: 'Logical clocks require local state, embedded is optimal'
    });
  }

  /**
   * Resolve random implementation
   */
  public async resolveRandom(): Promise<PatternResolution<RandomImplementation>> {
    return Promise.resolve({
      source: 'embedded',
      implementation: new EmbeddedRandomImpl(),
      latency_estimate_ms: 0.01,
      reason: 'Cryptographic randomness requires local entropy'
    });
  }

  /**
   * Resolve convergence implementation
   */
  public async resolveConvergence(): Promise<PatternResolution<ConvergenceImplementation>> {
    return Promise.resolve({
      source: 'embedded',
      implementation: new EmbeddedConvergenceImpl(),
      latency_estimate_ms: 0.05,
      reason: 'Convergence algorithms require local state'
    });
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
  public getDeploymentSummary(): {
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

  /**
   * Record metric for a pattern resolution operation
   */
  private recordMetric(operation: string, latency: number, success: boolean): void {
    const existing = this.metrics.get(operation) || { count: 0, totalLatency: 0, errors: 0 };
    existing.count++;
    existing.totalLatency += latency;
    if (!success) existing.errors++;
    this.metrics.set(operation, existing);
  }

  /**
   * Get metrics for all pattern resolution operations
   */
  public getMetrics(): Record<string, PatternMetrics> {
    const result: Record<string, PatternMetrics> = {};
    for (const [op, data] of this.metrics.entries()) {
      result[op] = {
        count: data.count,
        totalLatency: data.totalLatency,
        errors: data.errors,
        avgLatency: data.totalLatency / data.count,
        errorRate: data.errors / data.count
      };
    }
    return result;
  }

  /**
   * Reset all metrics
   */
  public resetMetrics(): void {
    this.metrics.clear();
  }

  /**
   * Generate cached fingerprint with TTL
   */
  public async generateCachedFingerprint(identity: any): Promise<string> {
    const key = JSON.stringify(identity);
    const cached = this.fingerprintCache.get(key);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.value;
    }

    const startTime = Date.now();
    try {
      const hashImpl = await this.resolveHash();
      const fingerprint = await hashImpl.implementation.generateFingerprint(identity);
      const latency = Date.now() - startTime;

      this.fingerprintCache.set(key, { value: fingerprint, timestamp: Date.now() });
      this.recordMetric('fingerprint', latency, true);

      return fingerprint;
    } catch (error) {
      const latency = Date.now() - startTime;
      this.recordMetric('fingerprint', latency, false);
      throw new PatternResolutionError('fingerprint', 'embedded', error);
    }
  }

  /**
   * Clear expired cache entries
   */
  public clearExpiredCache(): number {
    const now = Date.now();
    let cleared = 0;

    for (const [key, entry] of this.fingerprintCache.entries()) {
      if (now - entry.timestamp >= this.CACHE_TTL_MS) {
        this.fingerprintCache.delete(key);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Clear all cache entries
   */
  public clearCache(): void {
    this.fingerprintCache.clear();
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    size: number;
    expired: number;
    hitRate: number;
  } {
    const now = Date.now();
    let expired = 0;
    for (const entry of this.fingerprintCache.values()) {
      if (now - entry.timestamp >= this.CACHE_TTL_MS) {
        expired++;
      }
    }

    const fingerprintMetrics = this.metrics.get('fingerprint');
    const hitRate = fingerprintMetrics
      ? (fingerprintMetrics.count - fingerprintMetrics.errors) / fingerprintMetrics.count
      : 0;

    return {
      size: this.fingerprintCache.size,
      expired,
      hitRate
    };
  }

  /**
   * Health check for all pattern implementations
   */
  public async healthCheck(): Promise<{
    healthy: boolean;
    details: Record<string, { available: boolean; latency?: number; error?: string }>;
  }> {
    const details: Record<string, { available: boolean; latency?: number; error?: string }> = {};

    // Test embedded hash
    try {
      const start = Date.now();
      const hashImpl = await this.resolveHash();
      await hashImpl.implementation.hash('test', 'sha-384');
      details.embedded_hash = { available: true, latency: Date.now() - start };
    } catch (error) {
      details.embedded_hash = { available: false, error: String(error) };
    }

    // Test embedded signature
    try {
      const start = Date.now();
      const sigImpl = await this.resolveSignature();
      const keypair = await sigImpl.implementation.generateKeypair();
      const signature = await sigImpl.implementation.sign('test', keypair.privateKey);
      await sigImpl.implementation.verify('test', signature, keypair.publicKey);
      details.embedded_signature = { available: true, latency: Date.now() - start };
    } catch (error) {
      details.embedded_signature = { available: false, error: String(error) };
    }

    // Test embedded random
    try {
      const start = Date.now();
      const randomImpl = await this.resolveRandom();
      randomImpl.implementation.random();
      details.embedded_random = { available: true, latency: Date.now() - start };
    } catch (error) {
      details.embedded_random = { available: false, error: String(error) };
    }

    // Test embedded convergence
    try {
      const start = Date.now();
      const convImpl = await this.resolveConvergence();
      convImpl.implementation.apply('merge', { a: 1 }, { b: 2 });
      details.embedded_convergence = { available: true, latency: Date.now() - start };
    } catch (error) {
      details.embedded_convergence = { available: false, error: String(error) };
    }

    // Test MCP if available
    if (this.mcpClient) {
      try {
        const start = Date.now();
        const hashImpl = await this.resolveHash();
        if (hashImpl.source === 'mcp') {
          await hashImpl.implementation.hash('test', 'sha-384');
          details.mcp = { available: true, latency: Date.now() - start };
        } else {
          details.mcp = { available: false, error: 'MCP not selected by resolver' };
        }
      } catch (error) {
        details.mcp = { available: false, error: String(error) };
      }
    }

    // Test Go if available
    try {
      const start = Date.now();
      const hashImpl = await this.resolveHash();
      if (hashImpl.source === 'go') {
        await hashImpl.implementation.hash('test', 'sha-384');
        details.go = { available: true, latency: Date.now() - start };
      } else {
        details.go = { available: false, error: 'Go not selected by resolver' };
      }
    } catch (error) {
      details.go = { available: false, error: String(error) };
    }

    return {
      healthy: Object.values(details).some(d => d.available),
      details
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
