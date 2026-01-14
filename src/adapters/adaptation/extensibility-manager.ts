/**
 * Extensibility Manager
 *
 * Manages extensibility points for adapters.
 *
 * @module adapters/adaptation/extensibility-manager
 */

import { EventEmitter } from 'events';
import { AgentFramework } from '../protocol-types';
import { HookPriority, PRIORITY_WEIGHTS } from './types';

/**
 * Extension types.
 */
export type ExtensionType =
  | 'message-transformer' // Transform messages during conversion
  | 'capability-augmenter' // Augment protocol capabilities
  | 'error-handler' // Custom error handling
  | 'metric-collector' // Collect custom metrics
  | 'security-filter' // Security filtering
  | 'rate-limiter' // Rate limiting
  | 'cache-layer' // Caching behavior
  | 'logging-enhancer'; // Enhanced logging

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
  async executeExtensions(type: ExtensionType, input: ExtensionInput): Promise<ExtensionOutput> {
    const extensionIds = this.extensionsByType.get(type);
    if (!extensionIds || extensionIds.size === 0) {
      return { data: input.data, modified: false, continueProcessing: true };
    }

    // Get applicable extensions sorted by priority
    const applicable = Array.from(extensionIds)
      .map((id) => this.extensions.get(id)!)
      .filter((ext) => this.isExtensionApplicable(ext, input.protocol))
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
      return Array.from(ids).map((id) => this.extensions.get(id)!);
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
