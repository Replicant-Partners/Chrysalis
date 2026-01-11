/**
 * Adapter Registry - Manages framework adapters
 *
 * Provides a centralized registry for all framework adapters,
 * allowing dynamic adapter registration and lookup.
 * Supports both v1 and v2 adapters.
 *
 * Now includes Result-returning methods for type-safe error handling.
 */

import type { FrameworkAdapter } from './FrameworkAdapter';
import { isFrameworkAdapter } from './FrameworkAdapter';
import type { FrameworkAdapterV2 } from './FrameworkAdapterV2';
import { isFrameworkAdapterV2 } from './FrameworkAdapterV2';
import {
  Result,
  success,
  failure,
  isSuccess,
  notFoundFailure,
  validationFailure,
} from '../../shared/api-core/src/result';

type AnyAdapter = FrameworkAdapter | FrameworkAdapterV2;

/**
 * Adapter metadata returned by getInfo
 */
export interface AdapterInfo {
  name: string;
  version: string;
  supports_shadow: boolean;
  aliases: string[];
}

/**
 * Registry for framework adapters
 *
 * Provides both exception-throwing methods (for backwards compatibility)
 * and Result-returning methods (recommended for new code).
 */
export class AdapterRegistry {
  private adapters: Map<string, AnyAdapter> = new Map();
  private aliases: Map<string, string> = new Map();
  
  // =========================================================================
  // Result-returning methods (recommended for new code)
  // =========================================================================
  
  /**
   * Register a framework adapter (v1 or v2), returning Result.
   *
   * @param adapter - The adapter to register
   * @param aliases - Optional aliases for the adapter
   * @returns Success with adapter name, or Failure with validation error
   *
   * @example
   * ```typescript
   * const result = registry.registerSafe(myAdapter, ['alias1']);
   * if (isSuccess(result)) {
   *   console.log(`Registered: ${result.value}`);
   * }
   * ```
   */
  registerSafe(adapter: AnyAdapter, aliases?: string[]): Result<string> {
    if (!isFrameworkAdapter(adapter) && !isFrameworkAdapterV2(adapter)) {
      return validationFailure(
        'Invalid adapter: must implement FrameworkAdapter or FrameworkAdapterV2 interface',
        'adapter'
      );
    }
    
    this.adapters.set(adapter.name, adapter);
    
    // Register aliases
    if (aliases) {
      for (const alias of aliases) {
        this.aliases.set(alias.toLowerCase(), adapter.name);
      }
    }
    
    console.log(`✓ Registered adapter: ${adapter.name} v${adapter.version}`);
    return success(adapter.name);
  }
  
  /**
   * Get an adapter by name or alias, returning Result.
   *
   * @param nameOrAlias - The adapter name or alias to look up
   * @returns Success with the adapter, or Failure with not-found error
   *
   * @example
   * ```typescript
   * const result = registry.getSafe('mcp');
   * fold(result,
   *   (adapter) => console.log(`Found: ${adapter.name}`),
   *   (error) => console.error(error.message)
   * );
   * ```
   */
  getSafe(nameOrAlias: string): Result<AnyAdapter> {
    const normalizedName = nameOrAlias.toLowerCase();
    
    // Check direct match
    const direct = this.adapters.get(normalizedName);
    if (direct) return success(direct);
    
    // Check aliases
    const aliasTarget = this.aliases.get(normalizedName);
    if (aliasTarget) {
      const adapter = this.adapters.get(aliasTarget);
      if (adapter) return success(adapter);
    }
    
    const availableAdapters = this.listNames().join(', ') || '(none)';
    return notFoundFailure(
      'Adapter',
      `${nameOrAlias} (available: ${availableAdapters})`
    );
  }
  
  /**
   * Get a v2 adapter by name or alias, returning Result.
   *
   * @param nameOrAlias - The adapter name or alias to look up
   * @returns Success with the v2 adapter, or Failure with error
   */
  getV2Safe(nameOrAlias: string): Result<FrameworkAdapterV2> {
    const adapterResult = this.getSafe(nameOrAlias);
    if (!isSuccess(adapterResult)) {
      return adapterResult;
    }
    
    const adapter = adapterResult.value;
    if (!isFrameworkAdapterV2(adapter)) {
      return validationFailure(
        `Adapter '${nameOrAlias}' is not a v2 adapter`,
        'adapter'
      );
    }
    
    return success(adapter);
  }
  
  /**
   * Get adapter metadata, returning Result.
   *
   * @param nameOrAlias - The adapter name or alias to look up
   * @returns Success with adapter info, or Failure with not-found error
   */
  getInfoSafe(nameOrAlias: string): Result<AdapterInfo> {
    const adapterResult = this.getSafe(nameOrAlias);
    if (!isSuccess(adapterResult)) {
      return adapterResult;
    }
    
    const adapter = adapterResult.value;
    const adapterAliases = Array.from(this.aliases.entries())
      .filter(([_, target]) => target === adapter.name)
      .map(([alias]) => alias);
    
    return success({
      name: adapter.name,
      version: adapter.version,
      supports_shadow: adapter.supports_shadow,
      aliases: adapterAliases
    });
  }
  
  // =========================================================================
  // Legacy exception-throwing methods (for backwards compatibility)
  // =========================================================================
  
  /**
   * Register a framework adapter (v1 or v2)
   * @deprecated Use registerSafe() for Result-based error handling
   */
  register(adapter: AnyAdapter, aliases?: string[]): void {
    if (!isFrameworkAdapter(adapter) && !isFrameworkAdapterV2(adapter)) {
      throw new Error('Invalid adapter: must implement FrameworkAdapter or FrameworkAdapterV2 interface');
    }
    
    this.adapters.set(adapter.name, adapter);
    
    // Register aliases
    if (aliases) {
      for (const alias of aliases) {
        this.aliases.set(alias.toLowerCase(), adapter.name);
      }
    }
    
    console.log(`✓ Registered adapter: ${adapter.name} v${adapter.version}`);
  }
  
  /**
   * Get an adapter by name or alias
   * @deprecated Use getSafe() for Result-based error handling
   */
  get(nameOrAlias: string): AnyAdapter {
    const result = this.getSafe(nameOrAlias);
    if (isSuccess(result)) {
      return result.value;
    }
    throw new Error(result.error.message);
  }
  
  /**
   * Check if adapter is registered
   */
  has(nameOrAlias: string): boolean {
    const normalizedName = nameOrAlias.toLowerCase();
    return (
      this.adapters.has(normalizedName) ||
      this.aliases.has(normalizedName)
    );
  }
  
  /**
   * Get all registered adapters
   */
  list(): AnyAdapter[] {
    return Array.from(this.adapters.values());
  }
  
  /**
   * Get all adapter names
   */
  listNames(): string[] {
    return Array.from(this.adapters.keys());
  }
  
  /**
   * Unregister an adapter
   */
  unregister(name: string): boolean {
    return this.adapters.delete(name.toLowerCase());
  }
  
  /**
   * Clear all adapters
   */
  clear(): void {
    this.adapters.clear();
    this.aliases.clear();
  }
  
  /**
   * Get adapter metadata
   * @deprecated Use getInfoSafe() for Result-based error handling
   */
  getInfo(nameOrAlias: string): AdapterInfo {
    const result = this.getInfoSafe(nameOrAlias);
    if (isSuccess(result)) {
      return result.value;
    }
    throw new Error(result.error.message);
  }
}

/**
 * Global adapter registry instance
 */
export const adapterRegistry = new AdapterRegistry();

/**
 * Convenience function to register an adapter
 * @deprecated Use adapterRegistry.registerSafe() for Result-based error handling
 */
export function registerAdapter(adapter: FrameworkAdapter, aliases?: string[]): void {
  adapterRegistry.register(adapter, aliases);
}

/**
 * Convenience function to get an adapter
 * @deprecated Use adapterRegistry.getSafe() for Result-based error handling
 */
export function getAdapter(nameOrAlias: string): AnyAdapter {
  return adapterRegistry.get(nameOrAlias);
}

/**
 * Get a v2 adapter
 * @deprecated Use adapterRegistry.getV2Safe() for Result-based error handling
 */
export function getAdapterV2(nameOrAlias: string): FrameworkAdapterV2 {
  const adapter = adapterRegistry.get(nameOrAlias);
  if (!isFrameworkAdapterV2(adapter)) {
    throw new Error(`Adapter '${nameOrAlias}' is not a v2 adapter`);
  }
  return adapter;
}

// =========================================================================
// Result-returning convenience functions
// =========================================================================

/**
 * Get an adapter by name or alias, returning Result.
 */
export function getAdapterSafe(nameOrAlias: string): Result<AnyAdapter> {
  return adapterRegistry.getSafe(nameOrAlias);
}

/**
 * Get a v2 adapter by name or alias, returning Result.
 */
export function getAdapterV2Safe(nameOrAlias: string): Result<FrameworkAdapterV2> {
  return adapterRegistry.getV2Safe(nameOrAlias);
}

/**
 * Register an adapter, returning Result.
 */
export function registerAdapterSafe(
  adapter: FrameworkAdapter | FrameworkAdapterV2,
  aliases?: string[]
): Result<string> {
  return adapterRegistry.registerSafe(adapter, aliases);
}
