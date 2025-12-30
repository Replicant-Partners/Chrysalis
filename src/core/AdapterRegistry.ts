/**
 * Adapter Registry - Manages framework adapters
 * 
 * Provides a centralized registry for all framework adapters,
 * allowing dynamic adapter registration and lookup.
 * Supports both v1 and v2 adapters.
 */

import type { FrameworkAdapter } from './FrameworkAdapter';
import { isFrameworkAdapter } from './FrameworkAdapter';
import type { FrameworkAdapterV2 } from './FrameworkAdapterV2';
import { isFrameworkAdapterV2 } from './FrameworkAdapterV2';

type AnyAdapter = FrameworkAdapter | FrameworkAdapterV2;

/**
 * Registry for framework adapters
 */
export class AdapterRegistry {
  private adapters: Map<string, AnyAdapter> = new Map();
  private aliases: Map<string, string> = new Map();
  
  /**
   * Register a framework adapter (v1 or v2)
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
   */
  get(nameOrAlias: string): AnyAdapter {
    const normalizedName = nameOrAlias.toLowerCase();
    
    // Check direct match
    const direct = this.adapters.get(normalizedName);
    if (direct) return direct;
    
    // Check aliases
    const aliasTarget = this.aliases.get(normalizedName);
    if (aliasTarget) {
      const adapter = this.adapters.get(aliasTarget);
      if (adapter) return adapter;
    }
    
    throw new Error(
      `Adapter '${nameOrAlias}' not found. Available adapters: ${this.listNames().join(', ')}`
    );
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
   */
  getInfo(nameOrAlias: string): {
    name: string;
    version: string;
    supports_shadow: boolean;
    aliases: string[];
  } {
    const adapter = this.get(nameOrAlias);
    const aliases = Array.from(this.aliases.entries())
      .filter(([_, target]) => target === adapter.name)
      .map(([alias]) => alias);
    
    return {
      name: adapter.name,
      version: adapter.version,
      supports_shadow: adapter.supports_shadow,
      aliases
    };
  }
}

/**
 * Global adapter registry instance
 */
export const adapterRegistry = new AdapterRegistry();

/**
 * Convenience function to register an adapter
 */
export function registerAdapter(adapter: FrameworkAdapter, aliases?: string[]): void {
  adapterRegistry.register(adapter, aliases);
}

/**
 * Convenience function to get an adapter
 */
export function getAdapter(nameOrAlias: string): AnyAdapter {
  return adapterRegistry.get(nameOrAlias);
}

/**
 * Get a v2 adapter
 */
export function getAdapterV2(nameOrAlias: string): FrameworkAdapterV2 {
  const adapter = adapterRegistry.get(nameOrAlias);
  if (!isFrameworkAdapterV2(adapter)) {
    throw new Error(`Adapter '${nameOrAlias}' is not a v2 adapter`);
  }
  return adapter;
}
