/**
 * Widget Registry
 *
 * Central registry for widget definitions. Provides:
 * - Registration of widget types
 * - Query by canvas type, category, capabilities
 * - Validation of widget definitions
 * - Enable/disable widgets at runtime
 *
 * This is the extension point for third-party widgets.
 */

import {
  WidgetTypeId,
  WidgetDefinition,
  WidgetRegistryEntry,
  WidgetRegistryQuery,
  WidgetCapabilities,
  DEFAULT_CAPABILITIES,
} from './types';
import type { CanvasKind } from '../core/types';

// =============================================================================
// Validation Errors
// =============================================================================

export class WidgetRegistrationError extends Error {
  constructor(
    public readonly typeId: WidgetTypeId,
    public readonly reason: string
  ) {
    super(`Failed to register widget '${typeId}': ${reason}`);
    this.name = 'WidgetRegistrationError';
  }
}

// =============================================================================
// Widget Registry
// =============================================================================

export class WidgetRegistry {
  private widgets: Map<WidgetTypeId, WidgetRegistryEntry> = new Map();
  private listeners: Set<(event: RegistryEvent) => void> = new Set();

  // ===========================================================================
  // Registration
  // ===========================================================================

  /**
   * Register a widget definition.
   * Throws if widget with same typeId already exists.
   */
  register<TData>(definition: WidgetDefinition<TData>): void {
    this.validateDefinition(definition);

    if (this.widgets.has(definition.typeId)) {
      throw new WidgetRegistrationError(
        definition.typeId,
        'Widget with this typeId is already registered'
      );
    }

    // Fill in default capabilities
    const fullDefinition: WidgetDefinition<TData> = {
      ...definition,
      capabilities: { ...DEFAULT_CAPABILITIES, ...definition.capabilities },
    };

    this.widgets.set(definition.typeId, {
      definition: fullDefinition as WidgetDefinition<unknown>,
      registeredAt: Date.now(),
      enabled: true,
    });

    this.emit({ type: 'registered', typeId: definition.typeId });
  }

  /**
   * Register multiple widgets at once.
   */
  registerAll(definitions: WidgetDefinition<unknown>[]): void {
    definitions.forEach(def => this.register(def));
  }

  /**
   * Unregister a widget by typeId.
   */
  unregister(typeId: WidgetTypeId): boolean {
    const existed = this.widgets.delete(typeId);
    if (existed) {
      this.emit({ type: 'unregistered', typeId });
    }
    return existed;
  }

  // ===========================================================================
  // Queries
  // ===========================================================================

  /**
   * Get a widget definition by typeId.
   */
  get<TData = unknown>(typeId: WidgetTypeId): WidgetDefinition<TData> | undefined {
    const entry = this.widgets.get(typeId);
    if (!entry || !entry.enabled) return undefined;
    return entry.definition as WidgetDefinition<TData>;
  }

  /**
   * Check if a widget type exists and is enabled.
   */
  has(typeId: WidgetTypeId): boolean {
    const entry = this.widgets.get(typeId);
    return entry !== undefined && entry.enabled;
  }

  /**
   * Check if a widget type is allowed on a specific canvas.
   */
  isAllowedOnCanvas(typeId: WidgetTypeId, canvasKind: CanvasKind): boolean {
    const definition = this.get(typeId);
    if (!definition) return false;

    if (definition.allowedCanvases === '*') return true;
    return definition.allowedCanvases.includes(canvasKind);
  }

  /**
   * Get all widgets allowed on a specific canvas.
   */
  getForCanvas(canvasKind: CanvasKind): WidgetDefinition<unknown>[] {
    return this.query({ canvasKind, enabled: true });
  }

  /**
   * Query widgets by multiple criteria.
   */
  query(criteria: WidgetRegistryQuery): WidgetDefinition<unknown>[] {
    const results: WidgetDefinition<unknown>[] = [];

    this.widgets.forEach((entry) => {
      // Check enabled
      if (criteria.enabled !== undefined && entry.enabled !== criteria.enabled) {
        return;
      }

      const def = entry.definition;

      // Check category
      if (criteria.category && def.category !== criteria.category) {
        return;
      }

      // Check canvas kind
      if (criteria.canvasKind) {
        if (def.allowedCanvases !== '*' && !def.allowedCanvases.includes(criteria.canvasKind)) {
          return;
        }
      }

      // Check capability
      if (criteria.capability && !def.capabilities[criteria.capability]) {
        return;
      }

      results.push(def);
    });

    return results;
  }

  /**
   * Get all registered widget typeIds.
   */
  getTypeIds(): WidgetTypeId[] {
    return Array.from(this.widgets.keys());
  }

  /**
   * Get count of registered widgets.
   */
  count(): number {
    return this.widgets.size;
  }

  // ===========================================================================
  // Enable/Disable
  // ===========================================================================

  /**
   * Enable a widget type.
   */
  enable(typeId: WidgetTypeId): boolean {
    const entry = this.widgets.get(typeId);
    if (!entry) return false;

    entry.enabled = true;
    this.emit({ type: 'enabled', typeId });
    return true;
  }

  /**
   * Disable a widget type (it remains registered but won't be returned by queries).
   */
  disable(typeId: WidgetTypeId): boolean {
    const entry = this.widgets.get(typeId);
    if (!entry) return false;

    entry.enabled = false;
    this.emit({ type: 'disabled', typeId });
    return true;
  }

  /**
   * Check if a widget is enabled.
   */
  isEnabled(typeId: WidgetTypeId): boolean {
    return this.widgets.get(typeId)?.enabled ?? false;
  }

  // ===========================================================================
  // Validation
  // ===========================================================================

  private validateDefinition(definition: WidgetDefinition<unknown>): void {
    if (!definition.typeId || typeof definition.typeId !== 'string') {
      throw new WidgetRegistrationError(
        definition.typeId ?? 'unknown',
        'typeId must be a non-empty string'
      );
    }

    if (!definition.name || typeof definition.name !== 'string') {
      throw new WidgetRegistrationError(
        definition.typeId,
        'name must be a non-empty string'
      );
    }

    if (!definition.component) {
      throw new WidgetRegistrationError(
        definition.typeId,
        'component is required'
      );
    }

    if (!definition.defaultData || typeof definition.defaultData !== 'function') {
      throw new WidgetRegistrationError(
        definition.typeId,
        'defaultData must be a function'
      );
    }

    if (!definition.defaultSize ||
        typeof definition.defaultSize.width !== 'number' ||
        typeof definition.defaultSize.height !== 'number') {
      throw new WidgetRegistrationError(
        definition.typeId,
        'defaultSize must have width and height numbers'
      );
    }

    if (definition.allowedCanvases !== '*' &&
        (!Array.isArray(definition.allowedCanvases) || definition.allowedCanvases.length === 0)) {
      throw new WidgetRegistrationError(
        definition.typeId,
        'allowedCanvases must be "*" or a non-empty array of canvas kinds'
      );
    }
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  /**
   * Subscribe to registry events.
   */
  subscribe(listener: (event: RegistryEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: RegistryEvent): void {
    this.listeners.forEach(listener => listener(event));
  }

  // ===========================================================================
  // Utility
  // ===========================================================================

  /**
   * Clear all registered widgets.
   */
  clear(): void {
    this.widgets.clear();
    this.emit({ type: 'cleared' });
  }

  /**
   * Export registry state for debugging.
   */
  toJSON(): Record<string, { enabled: boolean; registeredAt: number }> {
    const result: Record<string, { enabled: boolean; registeredAt: number }> = {};
    this.widgets.forEach((entry, typeId) => {
      result[typeId] = {
        enabled: entry.enabled,
        registeredAt: entry.registeredAt,
      };
    });
    return result;
  }
}

// =============================================================================
// Registry Events
// =============================================================================

export type RegistryEvent =
  | { type: 'registered'; typeId: WidgetTypeId }
  | { type: 'unregistered'; typeId: WidgetTypeId }
  | { type: 'enabled'; typeId: WidgetTypeId }
  | { type: 'disabled'; typeId: WidgetTypeId }
  | { type: 'cleared' };

// =============================================================================
// Singleton Instance
// =============================================================================

let globalRegistry: WidgetRegistry | null = null;

/**
 * Get the global widget registry.
 * Use this for the main application registry.
 */
export function getWidgetRegistry(): WidgetRegistry {
  if (!globalRegistry) {
    globalRegistry = new WidgetRegistry();
  }
  return globalRegistry;
}

/**
 * Create a new isolated registry (useful for testing).
 */
export function createWidgetRegistry(): WidgetRegistry {
  return new WidgetRegistry();
}

/**
 * Reset the global registry (for testing).
 */
export function resetWidgetRegistry(): void {
  globalRegistry?.clear();
  globalRegistry = null;
}
