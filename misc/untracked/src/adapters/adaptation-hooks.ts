/**
 * Adaptation Hooks and Version Negotiation Layer
 * 
 * Provides anticipatory design patterns for adapter self-modification:
 * - Adaptation hooks at key intervention points
 * - Version negotiation for multi-version protocol support
 * - Extensibility points for AI-led maintenance integration
 * - Pattern detection sensors for autonomous monitoring
 * 
 * @module adapters/adaptation-hooks
 * @version 1.0.0
 * @see {@link ../ai-maintenance/adaptation-pipeline.ts}
 */

import { EventEmitter } from 'events';
import { AgentFramework } from './protocol-types';
import { UniversalMessage, UniversalError, TraceContext } from './protocol-messages';
import { ProtocolVersionInfo, VersionCompatibility } from './protocol-registry';
import { ProtocolFeature, CapabilityLevel } from './protocol-capabilities';

// ============================================================================
// Adaptation Hook Types
// ============================================================================

/**
 * Types of adaptation hooks that can be registered.
 */
export type AdaptationHookType =
  | 'pre-conversion'        // Before message conversion
  | 'post-conversion'       // After message conversion
  | 'pre-invocation'        // Before operation invocation
  | 'post-invocation'       // After operation invocation
  | 'on-error'              // When an error occurs
  | 'on-version-mismatch'   // When version compatibility fails
  | 'on-capability-change'  // When capabilities change
  | 'on-health-change'      // When adapter health changes
  | 'on-pattern-detected'   // When an evolutionary pattern is detected
  | 'pre-shutdown'          // Before adapter shutdown
  | 'post-initialize';      // After adapter initialization

/**
 * Hook execution priority levels.
 */
export type HookPriority = 'critical' | 'high' | 'normal' | 'low' | 'background';

/**
 * Hook execution result.
 */
export interface HookResult {
  /** Whether to continue to next hook */
  continueChain: boolean;
  /** Modified context (if any) */
  modifiedContext?: HookContext;
  /** Error if hook failed */
  error?: Error;
  /** Execution time in milliseconds */
  executionTimeMs: number;
  /** Additional metadata from hook */
  metadata?: Record<string, unknown>;
}

/**
 * Context passed to adaptation hooks.
 */
export interface HookContext {
  /** Protocol being processed */
  protocol: AgentFramework;
  /** Hook type */
  hookType: AdaptationHookType;
  /** Timestamp when hook was triggered */
  timestamp: string;
  /** Tracing context */
  trace?: TraceContext;
  
  // Conversion-related context
  /** Input message (for conversion hooks) */
  inputMessage?: UniversalMessage | unknown;
  /** Output message (for post-conversion hooks) */
  outputMessage?: UniversalMessage | unknown;
  /** Conversion direction */
  direction?: 'to-universal' | 'from-universal';
  
  // Error-related context
  /** Error that occurred */
  error?: UniversalError | Error;
  /** Number of retries attempted */
  retryCount?: number;
  
  // Version-related context
  /** Requested version */
  requestedVersion?: string;
  /** Available versions */
  availableVersions?: string[];
  /** Compatibility result */
  compatibility?: VersionCompatibility;
  
  // Pattern-related context
  /** Detected pattern ID */
  patternId?: string;
  /** Pattern confidence score */
  patternConfidence?: number;
  /** Pattern evidence */
  patternEvidence?: string[];
  
  // Health-related context
  /** Previous health score */
  previousHealthScore?: number;
  /** Current health score */
  currentHealthScore?: number;
  
  // Capability-related context
  /** Changed capability */
  capability?: ProtocolFeature;
  /** Previous capability level */
  previousLevel?: CapabilityLevel;
  /** New capability level */
  newLevel?: CapabilityLevel;
  
  /** Additional context data */
  additional?: Record<string, unknown>;
}

/**
 * Adaptation hook function signature.
 */
export type AdaptationHookFn = (context: HookContext) => Promise<HookResult> | HookResult;

/**
 * Registered hook definition.
 */
export interface RegisteredHook {
  /** Unique hook ID */
  hookId: string;
  /** Hook type */
  hookType: AdaptationHookType;
  /** Hook function */
  fn: AdaptationHookFn;
  /** Priority */
  priority: HookPriority;
  /** Protocols this hook applies to (undefined = all) */
  protocols?: AgentFramework[];
  /** Is hook enabled */
  enabled: boolean;
  /** Hook description */
  description?: string;
  /** Error handling strategy */
  onError: 'ignore' | 'warn' | 'fail';
  /** Timeout in milliseconds */
  timeoutMs: number;
  /** Tags for categorization */
  tags?: string[];
}

// ============================================================================
// Hook Executor
// ============================================================================

/**
 * Priority weights for ordering hooks.
 */
const PRIORITY_WEIGHTS: Record<HookPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
  background: 4,
};

/**
 * Executes adaptation hooks for a given hook type.
 */
export class AdaptationHookExecutor extends EventEmitter {
  private hooks: Map<string, RegisteredHook> = new Map();
  private hooksByType: Map<AdaptationHookType, Set<string>> = new Map();
  private executionStats: ExecutionStats;
  private hookIdCounter = 0;

  constructor() {
    super();
    this.executionStats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalExecutionTimeMs: 0,
      hookTypeStats: new Map(),
    };
  }

  /**
   * Register an adaptation hook.
   */
  registerHook(
    hookType: AdaptationHookType,
    fn: AdaptationHookFn,
    options: Partial<Omit<RegisteredHook, 'hookId' | 'hookType' | 'fn'>> = {}
  ): string {
    const hookId = `hook-${hookType}-${++this.hookIdCounter}`;
    
    const hook: RegisteredHook = {
      hookId,
      hookType,
      fn,
      priority: options.priority ?? 'normal',
      protocols: options.protocols,
      enabled: options.enabled ?? true,
      description: options.description,
      onError: options.onError ?? 'warn',
      timeoutMs: options.timeoutMs ?? 5000,
      tags: options.tags,
    };

    this.hooks.set(hookId, hook);
    
    // Index by type
    if (!this.hooksByType.has(hookType)) {
      this.hooksByType.set(hookType, new Set());
    }
    this.hooksByType.get(hookType)!.add(hookId);

    this.emit('hook:registered', hook);
    return hookId;
  }

  /**
   * Unregister a hook.
   */
  unregisterHook(hookId: string): boolean {
    const hook = this.hooks.get(hookId);
    if (!hook) return false;

    this.hooks.delete(hookId);
    this.hooksByType.get(hook.hookType)?.delete(hookId);
    
    this.emit('hook:unregistered', hook);
    return true;
  }

  /**
   * Enable or disable a hook.
   */
  setHookEnabled(hookId: string, enabled: boolean): boolean {
    const hook = this.hooks.get(hookId);
    if (!hook) return false;
    
    hook.enabled = enabled;
    this.emit('hook:toggled', hook, enabled);
    return true;
  }

  /**
   * Execute all hooks for a given type.
   */
  async executeHooks(
    hookType: AdaptationHookType,
    context: HookContext
  ): Promise<HookChainResult> {
    const hookIds = this.hooksByType.get(hookType);
    if (!hookIds || hookIds.size === 0) {
      return {
        success: true,
        executedHooks: [],
        finalContext: context,
        totalTimeMs: 0,
      };
    }

    // Get applicable hooks, sorted by priority
    const applicableHooks = Array.from(hookIds)
      .map(id => this.hooks.get(id)!)
      .filter(hook => this.isHookApplicable(hook, context))
      .sort((a, b) => PRIORITY_WEIGHTS[a.priority] - PRIORITY_WEIGHTS[b.priority]);

    const result: HookChainResult = {
      success: true,
      executedHooks: [],
      finalContext: context,
      totalTimeMs: 0,
    };

    let currentContext = { ...context };
    const startTime = Date.now();

    for (const hook of applicableHooks) {
      const hookResult = await this.executeHook(hook, currentContext);
      result.executedHooks.push({
        hookId: hook.hookId,
        result: hookResult,
      });

      // Update stats
      this.updateStats(hook.hookType, hookResult);

      if (hookResult.error) {
        this.emit('hook:error', hook, hookResult.error);
        
        if (hook.onError === 'fail') {
          result.success = false;
          result.error = hookResult.error;
          break;
        }
      }

      // Update context if modified
      if (hookResult.modifiedContext) {
        currentContext = hookResult.modifiedContext;
      }

      // Check if chain should continue
      if (!hookResult.continueChain) {
        break;
      }
    }

    result.totalTimeMs = Date.now() - startTime;
    result.finalContext = currentContext;

    this.emit('hooks:executed', hookType, result);
    return result;
  }

  /**
   * Execute a single hook with timeout.
   */
  private async executeHook(hook: RegisteredHook, context: HookContext): Promise<HookResult> {
    const startTime = Date.now();

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<HookResult>((_, reject) => {
        setTimeout(() => reject(new Error(`Hook ${hook.hookId} timed out`)), hook.timeoutMs);
      });

      // Execute hook with timeout
      const result = await Promise.race([
        Promise.resolve(hook.fn(context)),
        timeoutPromise,
      ]);

      this.executionStats.successfulExecutions++;
      return {
        ...result,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      this.executionStats.failedExecutions++;
      return {
        continueChain: hook.onError !== 'fail',
        error: error instanceof Error ? error : new Error(String(error)),
        executionTimeMs: Date.now() - startTime,
      };
    } finally {
      this.executionStats.totalExecutions++;
    }
  }

  /**
   * Check if a hook applies to the given context.
   */
  private isHookApplicable(hook: RegisteredHook, context: HookContext): boolean {
    if (!hook.enabled) return false;
    if (!hook.protocols || hook.protocols.length === 0) return true;
    return hook.protocols.includes(context.protocol);
  }

  /**
   * Update execution statistics.
   */
  private updateStats(hookType: AdaptationHookType, result: HookResult): void {
    this.executionStats.totalExecutionTimeMs += result.executionTimeMs;
    
    if (!this.executionStats.hookTypeStats.has(hookType)) {
      this.executionStats.hookTypeStats.set(hookType, {
        executions: 0,
        totalTimeMs: 0,
        errors: 0,
      });
    }
    
    const typeStats = this.executionStats.hookTypeStats.get(hookType)!;
    typeStats.executions++;
    typeStats.totalTimeMs += result.executionTimeMs;
    if (result.error) typeStats.errors++;
  }

  /**
   * Get registered hooks of a specific type.
   */
  getHooks(hookType?: AdaptationHookType): RegisteredHook[] {
    if (hookType) {
      const hookIds = this.hooksByType.get(hookType);
      if (!hookIds) return [];
      return Array.from(hookIds).map(id => this.hooks.get(id)!);
    }
    return Array.from(this.hooks.values());
  }

  /**
   * Get execution statistics.
   */
  getStats(): ExecutionStats {
    return { ...this.executionStats };
  }

  /**
   * Reset execution statistics.
   */
  resetStats(): void {
    this.executionStats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalExecutionTimeMs: 0,
      hookTypeStats: new Map(),
    };
  }
}

/**
 * Result of executing a chain of hooks.
 */
export interface HookChainResult {
  success: boolean;
  executedHooks: Array<{ hookId: string; result: HookResult }>;
  finalContext: HookContext;
  totalTimeMs: number;
  error?: Error;
}

/**
 * Hook execution statistics.
 */
export interface ExecutionStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  totalExecutionTimeMs: number;
  hookTypeStats: Map<AdaptationHookType, {
    executions: number;
    totalTimeMs: number;
    errors: number;
  }>;
}

// ============================================================================
// Version Negotiation Layer
// ============================================================================

/**
 * Version negotiation strategy.
 */
export type NegotiationStrategy =
  | 'latest'              // Use latest compatible version
  | 'stable'              // Prefer stable versions
  | 'minimum-compatible'  // Use minimum compatible version
  | 'exact'               // Require exact version
  | 'best-effort';        // Try best effort, fallback gracefully

/**
 * Version negotiation request.
 */
export interface NegotiationRequest {
  protocol: AgentFramework;
  requestedVersion?: string;
  minimumVersion?: string;
  maximumVersion?: string;
  strategy: NegotiationStrategy;
  features?: ProtocolFeature[];
}

/**
 * Version negotiation result.
 */
export interface NegotiationResult {
  success: boolean;
  selectedVersion?: string;
  compatibility: VersionCompatibility;
  fallbackUsed: boolean;
  fallbackVersion?: string;
  warnings: string[];
  unsupportedFeatures: ProtocolFeature[];
}

/**
 * Handles version negotiation for protocol adapters.
 */
export class VersionNegotiator extends EventEmitter {
  private versionCache: Map<string, ProtocolVersionInfo[]> = new Map();
  private negotiationHistory: NegotiationHistoryEntry[] = [];
  private fallbackVersions: Map<AgentFramework, string> = new Map();

  constructor() {
    super();
    this.initializeDefaultFallbacks();
  }

  /**
   * Initialize default fallback versions for protocols.
   */
  private initializeDefaultFallbacks(): void {
    this.fallbackVersions.set('mcp', '2024.11');
    this.fallbackVersions.set('a2a', '1.0.0');
    this.fallbackVersions.set('anp', '0.1.0');
    this.fallbackVersions.set('langchain', '0.1.0');
    this.fallbackVersions.set('openai', '1.0.0');
    this.fallbackVersions.set('autogen', '0.2.0');
    this.fallbackVersions.set('crewai', '0.1.0');
    this.fallbackVersions.set('semantic-kernel', '1.0.0');
    this.fallbackVersions.set('fipa', '1.0.0');
    this.fallbackVersions.set('jade', '4.5.0');
    this.fallbackVersions.set('ros2', 'humble');
    this.fallbackVersions.set('usa', '2.0.0');
    this.fallbackVersions.set('lmos', '1.0.0');
  }

  /**
   * Negotiate a version for a protocol.
   */
  async negotiate(request: NegotiationRequest): Promise<NegotiationResult> {
    const { protocol, requestedVersion, strategy, features } = request;
    
    const result: NegotiationResult = {
      success: false,
      compatibility: {
        compatible: false,
        level: 'none',
      },
      fallbackUsed: false,
      warnings: [],
      unsupportedFeatures: [],
    };

    try {
      // Get available versions
      const availableVersions = await this.getAvailableVersions(protocol);
      
      // Apply negotiation strategy
      const selectedVersion = this.selectVersion(
        availableVersions,
        requestedVersion,
        request.minimumVersion,
        request.maximumVersion,
        strategy
      );

      if (selectedVersion) {
        result.success = true;
        result.selectedVersion = selectedVersion;
        result.compatibility = {
          compatible: true,
          level: selectedVersion === requestedVersion ? 'full' : 'backward',
        };

        // Check feature support
        if (features && features.length > 0) {
          result.unsupportedFeatures = await this.checkFeatureSupport(
            protocol,
            selectedVersion,
            features
          );
          
          if (result.unsupportedFeatures.length > 0) {
            result.warnings.push(
              `${result.unsupportedFeatures.length} requested feature(s) not supported in ${selectedVersion}`
            );
          }
        }
      } else {
        // Try fallback
        const fallbackVersion = this.fallbackVersions.get(protocol);
        if (fallbackVersion && strategy !== 'exact') {
          result.success = true;
          result.selectedVersion = fallbackVersion;
          result.fallbackUsed = true;
          result.fallbackVersion = fallbackVersion;
          result.compatibility = {
            compatible: true,
            level: 'partial',
            upgradePath: [`Migration to ${fallbackVersion} may require adapter updates`],
          };
          result.warnings.push(`Using fallback version ${fallbackVersion}`);
        }
      }

      // Record history
      this.recordNegotiation(request, result);
      
      this.emit('negotiation:complete', request, result);
      return result;
    } catch (error) {
      result.warnings.push(error instanceof Error ? error.message : String(error));
      this.emit('negotiation:error', request, error);
      return result;
    }
  }

  /**
   * Get available versions for a protocol.
   */
  private async getAvailableVersions(protocol: AgentFramework): Promise<string[]> {
    // In real implementation, would query registry or upstream
    // For now, return reasonable defaults
    const defaults: Record<AgentFramework, string[]> = {
      mcp: ['2024.11', '2024.12', '2025.01'],
      a2a: ['1.0.0', '1.1.0'],
      anp: ['0.1.0', '0.2.0'],
      langchain: ['0.1.0', '0.2.0', '0.3.0'],
      openai: ['1.0.0', '1.1.0', '1.2.0'],
      autogen: ['0.2.0', '0.3.0'],
      crewai: ['0.1.0', '0.2.0', '0.3.0'],
      'semantic-kernel': ['1.0.0', '1.1.0'],
      'openai-agents': ['1.0.0'],
      autogpt: ['0.5.0'],
      agntcy: ['0.1.0'],
      acp: ['0.1.0'],
      fipa: ['1.0.0'],
      jade: ['4.5.0', '4.6.0'],
      ros2: ['humble', 'iron', 'jazzy'],
      usa: ['2.0.0', '2.1.0'],
      lmos: ['1.0.0'],
    };
    
    return defaults[protocol] || ['1.0.0'];
  }

  /**
   * Select version based on strategy.
   */
  private selectVersion(
    available: string[],
    requested?: string,
    minimum?: string,
    maximum?: string,
    strategy: NegotiationStrategy = 'stable'
  ): string | undefined {
    if (available.length === 0) return undefined;

    // Filter by constraints
    let candidates = [...available];
    
    if (minimum) {
      candidates = candidates.filter(v => this.compareVersions(v, minimum) >= 0);
    }
    if (maximum) {
      candidates = candidates.filter(v => this.compareVersions(v, maximum) <= 0);
    }

    if (candidates.length === 0) return undefined;

    switch (strategy) {
      case 'exact':
        return requested && candidates.includes(requested) ? requested : undefined;
      
      case 'latest':
        return candidates.sort((a, b) => this.compareVersions(b, a))[0];
      
      case 'stable':
        // Prefer versions without pre-release tags
        const stable = candidates.filter(v => !v.includes('-') && !v.includes('alpha') && !v.includes('beta'));
        if (stable.length > 0) {
          return stable.sort((a, b) => this.compareVersions(b, a))[0];
        }
        return candidates.sort((a, b) => this.compareVersions(b, a))[0];
      
      case 'minimum-compatible':
        if (requested && candidates.includes(requested)) return requested;
        return candidates.sort((a, b) => this.compareVersions(a, b))[0];
      
      case 'best-effort':
        if (requested && candidates.includes(requested)) return requested;
        return candidates.sort((a, b) => this.compareVersions(b, a))[0];
      
      default:
        return candidates[0];
    }
  }

  /**
   * Compare two version strings.
   */
  private compareVersions(a: string, b: string): number {
    const parseVersion = (v: string): number[] => {
      return v.replace(/^v/, '').split(/[.-]/).map(p => {
        const num = parseInt(p, 10);
        return isNaN(num) ? 0 : num;
      });
    };

    const aParts = parseVersion(a);
    const bParts = parseVersion(b);
    const maxLen = Math.max(aParts.length, bParts.length);

    for (let i = 0; i < maxLen; i++) {
      const aVal = aParts[i] || 0;
      const bVal = bParts[i] || 0;
      if (aVal > bVal) return 1;
      if (aVal < bVal) return -1;
    }
    return 0;
  }

  /**
   * Check feature support for a version.
   */
  private async checkFeatureSupport(
    protocol: AgentFramework,
    version: string,
    features: ProtocolFeature[]
  ): Promise<ProtocolFeature[]> {
    // In real implementation, would check capability matrix
    // For now, return empty (all features supported)
    return [];
  }

  /**
   * Record negotiation for history tracking.
   */
  private recordNegotiation(request: NegotiationRequest, result: NegotiationResult): void {
    this.negotiationHistory.push({
      timestamp: new Date().toISOString(),
      request,
      result,
    });

    // Keep history bounded
    if (this.negotiationHistory.length > 1000) {
      this.negotiationHistory = this.negotiationHistory.slice(-500);
    }
  }

  /**
   * Get negotiation history.
   */
  getHistory(protocol?: AgentFramework): NegotiationHistoryEntry[] {
    if (protocol) {
      return this.negotiationHistory.filter(e => e.request.protocol === protocol);
    }
    return [...this.negotiationHistory];
  }

  /**
   * Set fallback version for a protocol.
   */
  setFallbackVersion(protocol: AgentFramework, version: string): void {
    this.fallbackVersions.set(protocol, version);
  }
}

/**
 * Negotiation history entry.
 */
export interface NegotiationHistoryEntry {
  timestamp: string;
  request: NegotiationRequest;
  result: NegotiationResult;
}

// ============================================================================
// Extensibility Points
// ============================================================================

/**
 * Extension point for adapter behavior modification.
 */
export interface ExtensionPoint {
  /** Extension point ID */
  extensionId: string;
  /** Extension point name */
  name: string;
  /** Protocols this extension applies to */
  protocols: AgentFramework[] | 'all';
  /** Extension type */
  type: ExtensionType;
  /** Extension handler */
  handler: ExtensionHandler;
  /** Priority */
  priority: HookPriority;
  /** Is extension enabled */
  enabled: boolean;
  /** Extension metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Extension types.
 */
export type ExtensionType =
  | 'message-transformer'    // Transform messages during conversion
  | 'capability-augmenter'   // Augment protocol capabilities
  | 'error-handler'          // Custom error handling
  | 'metric-collector'       // Collect custom metrics
  | 'security-filter'        // Security filtering
  | 'rate-limiter'           // Rate limiting
  | 'cache-layer'            // Caching behavior
  | 'logging-enhancer';      // Enhanced logging

/**
 * Extension handler function.
 */
export type ExtensionHandler = (
  input: ExtensionInput
) => Promise<ExtensionOutput> | ExtensionOutput;

/**
 * Input to an extension handler.
 */
export interface ExtensionInput {
  protocol: AgentFramework;
  operation: string;
  data: unknown;
  context: Record<string, unknown>;
}

/**
 * Output from an extension handler.
 */
export interface ExtensionOutput {
  data: unknown;
  modified: boolean;
  metadata?: Record<string, unknown>;
  continueProcessing: boolean;
}

/**
 * Manages extensibility points for adapters.
 */
export class ExtensibilityManager extends EventEmitter {
  private extensions: Map<string, ExtensionPoint> = new Map();
  private extensionsByType: Map<ExtensionType, Set<string>> = new Map();
  private extensionIdCounter = 0;

  /**
   * Register an extension.
   */
  registerExtension(
    type: ExtensionType,
    handler: ExtensionHandler,
    options: Partial<Omit<ExtensionPoint, 'extensionId' | 'type' | 'handler'>> = {}
  ): string {
    const extensionId = `ext-${type}-${++this.extensionIdCounter}`;
    
    const extension: ExtensionPoint = {
      extensionId,
      name: options.name ?? extensionId,
      protocols: options.protocols ?? 'all',
      type,
      handler,
      priority: options.priority ?? 'normal',
      enabled: options.enabled ?? true,
      metadata: options.metadata,
    };

    this.extensions.set(extensionId, extension);
    
    if (!this.extensionsByType.has(type)) {
      this.extensionsByType.set(type, new Set());
    }
    this.extensionsByType.get(type)!.add(extensionId);

    this.emit('extension:registered', extension);
    return extensionId;
  }

  /**
   * Unregister an extension.
   */
  unregisterExtension(extensionId: string): boolean {
    const extension = this.extensions.get(extensionId);
    if (!extension) return false;

    this.extensions.delete(extensionId);
    this.extensionsByType.get(extension.type)?.delete(extensionId);
    
    this.emit('extension:unregistered', extension);
    return true;
  }

  /**
   * Execute extensions of a specific type.
   */
  async executeExtensions(
    type: ExtensionType,
    input: ExtensionInput
  ): Promise<ExtensionOutput> {
    const extensionIds = this.extensionsByType.get(type);
    if (!extensionIds || extensionIds.size === 0) {
      return { data: input.data, modified: false, continueProcessing: true };
    }

    // Get applicable extensions sorted by priority
    const applicable = Array.from(extensionIds)
      .map(id => this.extensions.get(id)!)
      .filter(ext => this.isExtensionApplicable(ext, input.protocol))
      .sort((a, b) => PRIORITY_WEIGHTS[a.priority] - PRIORITY_WEIGHTS[b.priority]);

    let currentData = input.data;
    let wasModified = false;
    const combinedMetadata: Record<string, unknown> = {};

    for (const extension of applicable) {
      try {
        const output = await extension.handler({
          ...input,
          data: currentData,
        });

        if (output.modified) {
          currentData = output.data;
          wasModified = true;
        }

        if (output.metadata) {
          Object.assign(combinedMetadata, output.metadata);
        }

        if (!output.continueProcessing) {
          break;
        }
      } catch (error) {
        this.emit('extension:error', extension, error);
      }
    }

    return {
      data: currentData,
      modified: wasModified,
      metadata: combinedMetadata,
      continueProcessing: true,
    };
  }

  /**
   * Check if extension applies to protocol.
   */
  private isExtensionApplicable(extension: ExtensionPoint, protocol: AgentFramework): boolean {
    if (!extension.enabled) return false;
    if (extension.protocols === 'all') return true;
    return extension.protocols.includes(protocol);
  }

  /**
   * Get all extensions of a type.
   */
  getExtensions(type?: ExtensionType): ExtensionPoint[] {
    if (type) {
      const ids = this.extensionsByType.get(type);
      if (!ids) return [];
      return Array.from(ids).map(id => this.extensions.get(id)!);
    }
    return Array.from(this.extensions.values());
  }

  /**
   * Enable or disable an extension.
   */
  setExtensionEnabled(extensionId: string, enabled: boolean): boolean {
    const extension = this.extensions.get(extensionId);
    if (!extension) return false;
    extension.enabled = enabled;
    return true;
  }
}

// ============================================================================
// Pattern Detection Sensors
// ============================================================================

/**
 * Sensor for detecting evolutionary patterns in adapter behavior.
 */
export interface PatternSensor {
  /** Sensor ID */
  sensorId: string;
  /** Sensor name */
  name: string;
  /** Pattern ID this sensor detects */
  patternId: string;
  /** Detection function */
  detect: PatternDetectionFn;
  /** Is sensor active */
  active: boolean;
  /** Protocols to monitor (undefined = all) */
  protocols?: AgentFramework[];
  /** Detection threshold (0-1) */
  threshold: number;
  /** Cooldown between detections (ms) */
  cooldownMs: number;
  /** Last detection timestamp */
  lastDetection?: string;
}

/**
 * Pattern detection function.
 */
export type PatternDetectionFn = (
  context: SensorContext
) => Promise<SensorReading> | SensorReading;

/**
 * Context for sensor detection.
 */
export interface SensorContext {
  protocol: AgentFramework;
  eventType: string;
  data: unknown;
  metrics: SensorMetrics;
  history: SensorHistoryEntry[];
}

/**
 * Metrics available to sensors.
 */
export interface SensorMetrics {
  errorRate: number;
  latencyMs: number;
  throughput: number;
  healthScore: number;
  versionMismatches: number;
  conversionFailures: number;
}

/**
 * Sensor history entry.
 */
export interface SensorHistoryEntry {
  timestamp: string;
  eventType: string;
  protocol: AgentFramework;
  success: boolean;
  latencyMs?: number;
}

/**
 * Sensor reading result.
 */
export interface SensorReading {
  detected: boolean;
  patternId: string;
  confidence: number;
  evidence: string[];
  recommendedAction?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Manages pattern detection sensors.
 */
export class PatternSensorManager extends EventEmitter {
  private sensors: Map<string, PatternSensor> = new Map();
  private history: SensorHistoryEntry[] = [];
  private metrics: Map<AgentFramework, SensorMetrics> = new Map();
  private sensorIdCounter = 0;

  /**
   * Register a pattern sensor.
   */
  registerSensor(
    patternId: string,
    detect: PatternDetectionFn,
    options: Partial<Omit<PatternSensor, 'sensorId' | 'patternId' | 'detect'>> = {}
  ): string {
    const sensorId = `sensor-${patternId}-${++this.sensorIdCounter}`;
    
    const sensor: PatternSensor = {
      sensorId,
      name: options.name ?? sensorId,
      patternId,
      detect,
      active: options.active ?? true,
      protocols: options.protocols,
      threshold: options.threshold ?? 0.7,
      cooldownMs: options.cooldownMs ?? 60000, // 1 minute default
    };

    this.sensors.set(sensorId, sensor);
    this.emit('sensor:registered', sensor);
    return sensorId;
  }

  /**
   * Run all applicable sensors for an event.
   */
  async runSensors(
    protocol: AgentFramework,
    eventType: string,
    data: unknown
  ): Promise<SensorReading[]> {
    const readings: SensorReading[] = [];
    const metrics = this.getOrCreateMetrics(protocol);
    const context: SensorContext = {
      protocol,
      eventType,
      data,
      metrics,
      history: this.getRecentHistory(protocol, 100),
    };

    const allSensors = Array.from(this.sensors.values());
    for (const sensor of allSensors) {
      if (!this.isSensorApplicable(sensor, protocol)) continue;
      if (this.isInCooldown(sensor)) continue;

      try {
        const reading = await sensor.detect(context);
        
        if (reading.detected && reading.confidence >= sensor.threshold) {
          readings.push(reading);
          sensor.lastDetection = new Date().toISOString();
          this.emit('pattern:detected', sensor, reading);
        }
      } catch (error) {
        this.emit('sensor:error', sensor, error);
      }
    }

    return readings;
  }

  /**
   * Record an event for history.
   */
  recordEvent(
    protocol: AgentFramework,
    eventType: string,
    success: boolean,
    latencyMs?: number
  ): void {
    this.history.push({
      timestamp: new Date().toISOString(),
      eventType,
      protocol,
      success,
      latencyMs,
    });

    // Keep history bounded
    if (this.history.length > 10000) {
      this.history = this.history.slice(-5000);
    }

    // Update metrics
    this.updateMetrics(protocol, success, latencyMs);
  }

  /**
   * Get or create metrics for a protocol.
   */
  private getOrCreateMetrics(protocol: AgentFramework): SensorMetrics {
    if (!this.metrics.has(protocol)) {
      this.metrics.set(protocol, {
        errorRate: 0,
        latencyMs: 0,
        throughput: 0,
        healthScore: 100,
        versionMismatches: 0,
        conversionFailures: 0,
      });
    }
    return this.metrics.get(protocol)!;
  }

  /**
   * Update metrics for a protocol.
   */
  private updateMetrics(protocol: AgentFramework, success: boolean, latencyMs?: number): void {
    const metrics = this.getOrCreateMetrics(protocol);
    
    // Simple exponential moving average
    const alpha = 0.1;
    
    if (!success) {
      metrics.errorRate = metrics.errorRate * (1 - alpha) + 1 * alpha;
      metrics.conversionFailures++;
    } else {
      metrics.errorRate = metrics.errorRate * (1 - alpha);
    }

    if (latencyMs !== undefined) {
      metrics.latencyMs = metrics.latencyMs * (1 - alpha) + latencyMs * alpha;
    }

    metrics.healthScore = Math.max(0, 100 - (metrics.errorRate * 100));
  }

  /**
   * Get recent history for a protocol.
   */
  private getRecentHistory(protocol: AgentFramework, limit: number): SensorHistoryEntry[] {
    return this.history
      .filter(e => e.protocol === protocol)
      .slice(-limit);
  }

  /**
   * Check if sensor is applicable to protocol.
   */
  private isSensorApplicable(sensor: PatternSensor, protocol: AgentFramework): boolean {
    if (!sensor.active) return false;
    if (!sensor.protocols || sensor.protocols.length === 0) return true;
    return sensor.protocols.includes(protocol);
  }

  /**
   * Check if sensor is in cooldown.
   */
  private isInCooldown(sensor: PatternSensor): boolean {
    if (!sensor.lastDetection) return false;
    const elapsed = Date.now() - new Date(sensor.lastDetection).getTime();
    return elapsed < sensor.cooldownMs;
  }

  /**
   * Get all registered sensors.
   */
  getSensors(): PatternSensor[] {
    return Array.from(this.sensors.values());
  }

  /**
   * Get metrics for all protocols.
   */
  getAllMetrics(): Map<AgentFramework, SensorMetrics> {
    return new Map(this.metrics);
  }
}

// ============================================================================
// Global Instances
// ============================================================================

/**
 * Global adaptation hook executor instance.
 */
export const hookExecutor = new AdaptationHookExecutor();

/**
 * Global version negotiator instance.
 */
export const versionNegotiator = new VersionNegotiator();

/**
 * Global extensibility manager instance.
 */
export const extensibilityManager = new ExtensibilityManager();

/**
 * Global pattern sensor manager instance.
 */
export const patternSensorManager = new PatternSensorManager();

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a pre-conversion hook.
 */
export function createPreConversionHook(
  fn: (context: HookContext) => Promise<HookResult>,
  options?: Partial<RegisteredHook>
): string {
  return hookExecutor.registerHook('pre-conversion', fn, options);
}

/**
 * Create a post-conversion hook.
 */
export function createPostConversionHook(
  fn: (context: HookContext) => Promise<HookResult>,
  options?: Partial<RegisteredHook>
): string {
  return hookExecutor.registerHook('post-conversion', fn, options);
}

/**
 * Create an error handling hook.
 */
export function createErrorHook(
  fn: (context: HookContext) => Promise<HookResult>,
  options?: Partial<RegisteredHook>
): string {
  return hookExecutor.registerHook('on-error', fn, options);
}

/**
 * Create a version mismatch hook.
 */
export function createVersionMismatchHook(
  fn: (context: HookContext) => Promise<HookResult>,
  options?: Partial<RegisteredHook>
): string {
  return hookExecutor.registerHook('on-version-mismatch', fn, options);
}

/**
 * Create a pattern detection hook.
 */
export function createPatternDetectedHook(
  fn: (context: HookContext) => Promise<HookResult>,
  options?: Partial<RegisteredHook>
): string {
  return hookExecutor.registerHook('on-pattern-detected', fn, options);
}

// ============================================================================
// Exports
// ============================================================================

export default {
  hookExecutor,
  versionNegotiator,
  extensibilityManager,
  patternSensorManager,
  createPreConversionHook,
  createPostConversionHook,
  createErrorHook,
  createVersionMismatchHook,
  createPatternDetectedHook,
};
