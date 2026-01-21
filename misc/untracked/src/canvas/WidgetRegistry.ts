/**
 * Widget Registry
 * 
 * Central registry for managing widget types and their lifecycle.
 * Validates widget definitions, handles instantiation, and enforces capability requirements.
 * 
 * @see docs/CANVAS_FOUNDATION_IMPLEMENTATION.md
 * @see plans/CHRYSALIS_TERMINAL_IMPLEMENTATION_ROADMAP.md
 */

import type {
  WidgetDefinition,
  WidgetNodeData,
  CanvasKind,
  ValidationResult,
} from './types';

/**
 * Error thrown when widget registration or validation fails
 */
export class WidgetRegistryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'WidgetRegistryError';
  }
}

/**
 * Type-erased widget definition for storage
 */
type StoredWidgetDefinition = WidgetDefinition<WidgetNodeData>;

/**
 * Widget Registry
 * 
 * Manages widget type registration and validation for canvas instances.
 * Each canvas kind has its own registry with specific widget type constraints.
 */
export class WidgetRegistry {
  private readonly widgets: Map<string, StoredWidgetDefinition>;
  private readonly canvasKind: CanvasKind;
  private readonly allowedTypes: Set<string>;

  /**
   * Create a new widget registry
   * 
   * @param canvasKind - The canvas kind this registry serves
   * @param allowedTypes - Optional list of allowed widget types (if empty, all are allowed)
   */
  constructor(canvasKind: CanvasKind, allowedTypes?: string[]) {
    this.widgets = new Map();
    this.canvasKind = canvasKind;
    this.allowedTypes = new Set(allowedTypes || []);
  }

  /**
   * Register a widget type
   * 
   * @param definition - Widget definition to register
   * @throws {WidgetRegistryError} If validation fails
   */
  public register<TData extends WidgetNodeData>(definition: WidgetDefinition<TData>): void {
    // Validate definition
    const validation = this.validateDefinition(definition as StoredWidgetDefinition);
    if (!validation.valid) {
      throw new WidgetRegistryError(
        `Invalid widget definition for '${definition.type}'`,
        'INVALID_DEFINITION',
        { errors: validation.errors }
      );
    }

    // Check if type is allowed for this canvas kind
    if (this.allowedTypes.size > 0 && !this.allowedTypes.has(definition.type)) {
      throw new WidgetRegistryError(
        `Widget type '${definition.type}' not allowed for canvas kind '${this.canvasKind}'`,
        'TYPE_NOT_ALLOWED',
        { allowedTypes: Array.from(this.allowedTypes) }
      );
    }

    // Check for duplicates
    if (this.widgets.has(definition.type)) {
      throw new WidgetRegistryError(
        `Widget type '${definition.type}' is already registered`,
        'DUPLICATE_TYPE'
      );
    }

    // Type-erase for storage
    this.widgets.set(definition.type, definition as StoredWidgetDefinition);
  }

  /**
   * Unregister a widget type
   * 
   * @param type - Widget type identifier
   * @returns true if unregistered, false if not found
   */
  public unregister(type: string): boolean {
    return this.widgets.delete(type);
  }

  /**
   * Get a widget definition by type
   * 
   * @param type - Widget type identifier
   * @returns Widget definition or undefined if not found
   */
  public get(type: string): WidgetDefinition | undefined {
    return this.widgets.get(type);
  }

  /**
   * Check if a widget type is registered
   * 
   * @param type - Widget type identifier
   */
  public has(type: string): boolean {
    return this.widgets.has(type);
  }

  /**
   * Get all registered widget types
   */
  public getTypes(): string[] {
    return Array.from(this.widgets.keys());
  }

  /**
   * Get all registered widget definitions
   */
  public getAll(): WidgetDefinition[] {
    return Array.from(this.widgets.values());
  }

  /**
   * Get widgets by category
   * 
   * @param category - Widget category
   */
  public getByCategory(category: string): WidgetDefinition[] {
    return Array.from(this.widgets.values()).filter(
      (def) => def.category === category
    );
  }

  /**
   * Validate a widget definition
   * 
   * @param definition - Widget definition to validate
   */
  private validateDefinition(definition: StoredWidgetDefinition): ValidationResult {
    const errors: string[] = [];

    // Required fields
    if (!definition.type || typeof definition.type !== 'string') {
      errors.push('Widget type must be a non-empty string');
    }

    if (!definition.displayName || typeof definition.displayName !== 'string') {
      errors.push('Widget displayName must be a non-empty string');
    }

    if (!definition.renderer || typeof definition.renderer !== 'function') {
      errors.push('Widget renderer must be a React component');
    }

    if (!Array.isArray(definition.capabilities)) {
      errors.push('Widget capabilities must be an array');
    }

    // Validate type format (lowercase, alphanumeric with underscores)
    if (definition.type && !/^[a-z0-9_]+$/.test(definition.type)) {
      errors.push('Widget type must be lowercase alphanumeric with underscores only');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Validate widget node data against registered definition
   * 
   * @param data - Widget node data to validate
   */
  public validateData(data: WidgetNodeData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if widget type is registered
    const definition = this.widgets.get(data.type);
    if (!definition) {
      errors.push(`Widget type '${data.type}' is not registered`);
      return { valid: false, errors };
    }

    // Validate required fields
    if (!data.label || typeof data.label !== 'string') {
      errors.push('Widget label must be a non-empty string');
    }

    // Validate against JSON schema if provided
    if (definition.schema) {
      // TODO: Add JSON schema validation once schema validator is integrated
      warnings.push('JSON schema validation not yet implemented');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Create default data for a widget type
   * 
   * @param type - Widget type
   * @returns Default widget data
   * @throws {WidgetRegistryError} If widget type not found
   */
  public createDefaultData(type: string): WidgetNodeData {
    const definition = this.widgets.get(type);
    if (!definition) {
      throw new WidgetRegistryError(
        `Widget type '${type}' is not registered`,
        'TYPE_NOT_FOUND'
      );
    }

    return {
      type,
      label: definition.displayName,
      ...definition.defaultData,
    };
  }

  /**
   * Get required capabilities for a widget type
   * 
   * @param type - Widget type
   * @returns Array of required capability strings
   */
  public getRequiredCapabilities(type: string): string[] {
    const definition = this.widgets.get(type);
    return definition?.capabilities || [];
  }

  /**
   * Clear all registered widgets
   */
  public clear(): void {
    this.widgets.clear();
  }

  /**
   * Get registry statistics
   */
  public getStats(): {
    canvasKind: CanvasKind;
    registeredCount: number;
    allowedTypes: string[];
    categories: string[];
  } {
    const categories = new Set<string>();
    for (const def of this.widgets.values()) {
      if (def.category) {
        categories.add(def.category);
      }
    }

    return {
      canvasKind: this.canvasKind,
      registeredCount: this.widgets.size,
      allowedTypes: Array.from(this.allowedTypes),
      categories: Array.from(categories),
    };
  }
}

/**
 * Factory function to create a widget registry
 * 
 * @param canvasKind - Canvas kind for the registry
 * @param allowedTypes - Optional list of allowed widget types
 * @returns New WidgetRegistry instance
 */
export function createWidgetRegistry(
  canvasKind: CanvasKind,
  allowedTypes?: string[]
): WidgetRegistry {
  return new WidgetRegistry(canvasKind, allowedTypes);
}

/**
 * Create a default registry configuration for each canvas kind
 */
export function getDefaultAllowedTypes(canvasKind: CanvasKind): string[] {
  switch (canvasKind) {
    case 'settings':
      return ['config', 'connection', 'credential'];
    case 'agent':
      return ['agent_card', 'team_group'];
    case 'scrapbook':
      return ['artifact', 'note', 'link', 'group'];
    case 'research':
      return ['source', 'citation', 'synthesis', 'hypothesis'];
    case 'wiki':
      return ['wiki_page', 'wiki_section', 'wiki_link'];
    case 'terminal-browser':
      return ['terminal_session', 'browser_tab', 'code_editor'];
    default:
      return [];
  }
}
