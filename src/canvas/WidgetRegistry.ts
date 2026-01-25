/**
 * Widget Registry
 * 
 * Manages widget type registration and lookup for canvas instances.
 */

import type { WidgetDefinition, WidgetNodeData } from './types';

export interface WidgetRegistry {
  /** Register a widget definition */
  register<T extends WidgetNodeData>(definition: WidgetDefinition<T>): void;
  /** Get a widget definition by type */
  get(type: string): WidgetDefinition | undefined;
  /** Check if a widget type is registered */
  has(type: string): boolean;
  /** Get all registered widget types */
  getTypes(): string[];
  /** Get all widget definitions */
  getAll(): WidgetDefinition[];
  /** Check if a widget type is allowed by policy */
  isAllowed(type: string): boolean;
  /** Get widgets by category */
  getByCategory(category: string): WidgetDefinition[];
}

/**
 * Create a new widget registry
 * @param canvasKind
 * @param allowedTypes
 */
export function createWidgetRegistry(
  canvasKind: string,
  allowedTypes: string[] = []
): WidgetRegistry {
  const widgets = new Map<string, WidgetDefinition>();
  const allowedSet = new Set(allowedTypes);

  return {
    register<T extends WidgetNodeData>(definition: WidgetDefinition<T>): void {
      if (widgets.has(definition.type)) {
        console.warn(`Widget type "${definition.type}" is already registered, overwriting.`);
      }
      widgets.set(definition.type, definition as unknown as WidgetDefinition);
    },

    get(type: string): WidgetDefinition | undefined {
      return widgets.get(type);
    },

    has(type: string): boolean {
      return widgets.has(type);
    },

    getTypes(): string[] {
      return Array.from(widgets.keys());
    },

    getAll(): WidgetDefinition[] {
      return Array.from(widgets.values());
    },

    isAllowed(type: string): boolean {
      // If no allowed types specified, all registered types are allowed
      if (allowedSet.size === 0) {
        return widgets.has(type);
      }
      return allowedSet.has(type) && widgets.has(type);
    },

    getByCategory(category: string): WidgetDefinition[] {
      return Array.from(widgets.values()).filter(w => w.category === category);
    },
  };
}

/**
 * Default widget registry factory
 */
export function createDefaultRegistry(): WidgetRegistry {
  return createWidgetRegistry('default', []);
}
