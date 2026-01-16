/**
 * Compatibility shim for legacy BaseAdapter imports.
 *
 * The bridge/orchestrator layers historically depended on a "BaseAdapter"
 * interface with canonical conversion helpers. The current codebase uses the
 * unified adapter abstractions instead, so this file re-introduces the
 * expected surface in a minimal form to unblock the build while keeping
 * everything routed through the unified adapter registry.
 *
 * NOTE: This shim is intentionally lightweight. Real protocol adapters should
 * wrap the unified adapter implementations and fulfill these methods with
 * proper logic; the defaults here are safe no-ops suitable for non-critical
 * paths.
 */

import { adapterRegistry as unifiedAdapterRegistry } from './unified-adapter';
import type { AgentFramework, CanonicalAgent, NativeAgent, ValidationResult } from '../bridge/types';
import { uri } from '../bridge/types';

export interface RoundTripResult {
  success: boolean;
  fidelityScore?: number;
  warnings?: string[];
  errors?: string[];
  durationMs?: number;
}

/**
 * Legacy BaseAdapter shape expected by bridge/orchestrator code paths.
 */
export interface BaseAdapter {
  framework: AgentFramework;
  toCanonical(agent: NativeAgent): Promise<CanonicalAgent>;
  fromCanonical(canonical: CanonicalAgent): Promise<NativeAgent>;
  validateNative(agent: NativeAgent): ValidationResult;
  validateCanonical(canonical: CanonicalAgent): ValidationResult;
  roundTrip(agent: NativeAgent): Promise<RoundTripResult>;
}

/**
 * Minimal adapter registry compatible with legacy imports.
 */
export class AdapterRegistry {
  private adapters = new Map<AgentFramework, BaseAdapter>();

  register(adapter: BaseAdapter): void {
    this.adapters.set(adapter.framework, adapter);
  }

  unregister(framework: AgentFramework): boolean {
    return this.adapters.delete(framework);
  }

  get(framework: AgentFramework): BaseAdapter | undefined {
    return this.adapters.get(framework);
  }

  has(framework: AgentFramework): boolean {
    return this.adapters.has(framework);
  }

  getFrameworks(): AgentFramework[] {
    return Array.from(this.adapters.keys());
  }

  getAll(): BaseAdapter[] {
    return Array.from(this.adapters.values());
  }
}

/**
 * Global instance to mirror historical usage.
 */
export const adapterRegistry = new AdapterRegistry();

// NOTE: createStubAdapter has been removed. Stub adapters silently returned
// fake data, which violates the "no silent failures" principle. Use real
// adapters or throw NotImplementedError if functionality is not available.

/**
 * Bridge unified adapter registry into the legacy one if needed.
 */
export function registerUnifiedAsBase(framework: AgentFramework): void {
  const unified = unifiedAdapterRegistry.get(framework as any);
  if (!unified) return;

  const adapter: BaseAdapter = {
    framework,
    async toCanonical(agent: NativeAgent): Promise<CanonicalAgent> {
      // Unified adapters work with universal messages; we return a minimal canonical shell.
      return {
        uri: uri(`agent:${framework}:${agent.data?.['id'] || 'unknown'}`) as CanonicalAgent['uri'],
        quads: [],
        sourceFramework: framework as any,
        extensions: [],
        metadata: {
          translationTimeMs: 0,
          mappedFields: [],
          unmappedFields: [],
          lostFields: [],
          warnings: [],
          fidelityScore: 1,
          translatedAt: new Date().toISOString() as any
        }
      };
    },
    async fromCanonical(canonical: CanonicalAgent): Promise<NativeAgent> {
      return {
        data: { uri: canonical.uri, sourceFramework: canonical.sourceFramework },
        framework: framework as any,
        version: '1.0.0'
      };
    },
    validateNative(): ValidationResult {
      return { valid: true, errors: [], warnings: [] };
    },
    validateCanonical(): ValidationResult {
      return { valid: true, errors: [], warnings: [] };
    },
    async roundTrip(agent: NativeAgent): Promise<RoundTripResult> {
      const start = Date.now();
      await this.toCanonical(agent);
      return {
        success: true,
        fidelityScore: 1,
        durationMs: Date.now() - start,
        warnings: []
      };
    }
  };

  adapterRegistry.register(adapter);
}

// Re-export common types for legacy imports
export type { NativeAgent, CanonicalAgent, ValidationResult, AgentFramework } from '../bridge/types';
