/**
 * Widget Registry
 * 
 * Per-canvas widget registry that enforces type safety and capability requirements.
 * Guards widget creation, updates, and imports against policy violations.
 * 
 * @module canvas/WidgetRegistry
 */

import type {
  WidgetType,
  WidgetDefinition,
  WidgetNodeData,
  CanvasKind,
  CanvasLogger
} from './types';

// =============================================================================
// Registry Types
// =============================================================================

export interface WidgetCreationRequest<TWidget extends WidgetType = WidgetType> {
  widgetType: TWidget;
  title?: string;
  payload?: unknown;
  meta?: Record<string, unknown>;
}

export interface WidgetValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface RegistryStats {
  registeredWidgets: number;
  allowedWidgets: number;
  deniedWidgets: number;
}

// =============================================================================
// Widget Registry
// =============================================================================

export class WidgetRegistry<TWidget extends WidgetType = WidgetType> {
  private readonly canvasKind: CanvasKind;
  private readonly widgets: Map<TWidget, WidgetDefinition<TWidget>> = new Map();
  private readonly allowlist: Set<TWidget>;
  private readonly denylist: Set<TWidget>;
  private readonly logger: CanvasLogger;
  private readonly capabilities: Set<string>;
  
  constructor(
    canvasKind: CanvasKind,
    allowlist: TWidget[],
    logger: CanvasLogger,
    options?: {
      denylist?: TWidget[];
      capabilities?: string[];
    }
  ) {
    this.canvasKind = canvasKind;
    this.allowlist = new Set(allowlist);
    this.denylist = new Set(options?.denylist || []);
    this.logger = logger;
    this.capabilities = new Set(options?.capabilities || []);
  }
  
  // ===========================================================================
  // Registration
  // ===========================================================================
  
  /**
   * Register a widget definition
   */
  register(definition: WidgetDefinition<TWidget>): void {
    if (this.widgets.has(definition.type)) {
      this.logger.warn('Widget already registered, overwriting', {
        canvasKind: this.canvasKind,
        widgetType: definition.type
      });
    }
    
    this.widgets.set(definition.type, definition);
    this.logger.debug('Widget registered', {
      canvasKind: this.canvasKind,
      widgetType: definition.type,
      displayName: definition.displayName
    });
  }
  
  /**
   * Register multiple widget definitions
   */
  registerMany(definitions: WidgetDefinition<TWidget>[]): void {
    for (const def of definitions) {
      this.register(def);
    }
  }
  
  /**
   * Unregister a widget
   */
  unregister(widgetType: TWidget): boolean {
    const existed = this.widgets.delete(widgetType);
    if (existed) {
      this.logger.debug('Widget unregistered', {
        canvasKind: this.canvasKind,
        widgetType
      });
    }
    return existed;
  }
  
  // ===========================================================================
  // Validation & Guards
  // ===========================================================================
  
  /**
   * Check if a widget type is allowed on this canvas
   */
  isAllowed(widgetType: TWidget): boolean {
    // Check denylist first
    if (this.denylist.has(widgetType)) {
      return false;
    }
    
    // Check allowlist
    if (!this.allowlist.has(widgetType)) {
      return false;
    }
    
    // Check if widget is registered
    const definition = this.widgets.get(widgetType);
    if (!definition) {
      return false;
    }
    
    // Check capability requirements
    if (definition.capabilities) {
      for (const required of definition.capabilities) {
        if (!this.capabilities.has(required)) {
          this.logger.warn('Widget blocked: missing capability', {
            canvasKind: this.canvasKind,
            widgetType,
            requiredCapability: required
          });
          return false;
        }
      }
    }
    
    return true;
  }
  
  /**
   * Validate widget data against schema
   */
  validate(widgetType: TWidget, data: WidgetNodeData<TWidget>): WidgetValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check if widget exists
    const definition = this.widgets.get(widgetType);
    if (!definition) {
      errors.push(`Widget type '${widgetType}' is not registered`);
      return { valid: false, errors, warnings };
    }
    
    // Check allowlist
    if (!this.isAllowed(widgetType)) {
      errors.push(`Widget type '${widgetType}' is not allowed on ${this.canvasKind} canvas`);
      return { valid: false, errors, warnings };
    }
    
    // Validate against schema if present
    if (definition.schema && data.payload) {
      // Simple schema validation (in production, use ajv or similar)
      const schemaValidation = this.validateAgainstSchema(data.payload, definition.schema);
      errors.push(...schemaValidation.errors);
      warnings.push(...schemaValidation.warnings);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Guard widget creation request
   */
  guardCreate(request: WidgetCreationRequest<TWidget>): WidgetValidationResult {
    const data: WidgetNodeData<TWidget> = {
      widgetType: request.widgetType,
      title: request.title,
      payload: request.payload,
      meta: request.meta
    };
    
    return this.validate(request.widgetType, data);
  }
  
  /**
   * Guard widget update
   */
  guardUpdate(
    widgetType: TWidget,
    currentData: WidgetNodeData<TWidget>,
    updates: Partial<WidgetNodeData<TWidget>>
  ): WidgetValidationResult {
    const mergedData = { ...currentData, ...updates };
    return this.validate(widgetType, mergedData);
  }
  
  // ===========================================================================
  // Lookups
  // ===========================================================================
  
  /**
   * Get widget definition
   */
  getDefinition(widgetType: TWidget): WidgetDefinition<TWidget> | undefined {
    return this.widgets.get(widgetType);
  }
  
  /**
   * Get all registered widget types
   */
  getRegisteredTypes(): TWidget[] {
    return Array.from(this.widgets.keys());
  }
  
  /**
   * Get allowed widget types for this canvas
   */
  getAllowedTypes(): TWidget[] {
    return Array.from(this.allowlist);
  }
  
  /**
   * Get all widget definitions
   */
  getAllDefinitions(): WidgetDefinition<TWidget>[] {
    return Array.from(this.widgets.values());
  }
  
  /**
   * Get statistics
   */
  getStats(): RegistryStats {
    return {
      registeredWidgets: this.widgets.size,
      allowedWidgets: this.allowlist.size,
      deniedWidgets: this.denylist.size
    };
  }
  
  // ===========================================================================
  // Private Helpers
  // ===========================================================================
  
  /**
   * Simple schema validation
   * In production, use ajv or similar JSON Schema validator
   */
  private validateAgainstSchema(
    payload: unknown,
    schema: Record<string, unknown>
  ): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Basic type checking only
    // TODO: Implement proper JSON Schema validation with ajv
    
    if (schema.required && Array.isArray(schema.required) && typeof payload === 'object' && payload !== null) {
      for (const field of schema.required) {
        if (!(field in payload)) {
          errors.push(`Required field '${field}' is missing`);
        }
      }
    }
    
    return { errors, warnings };
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a widget registry for a specific canvas
 */
export function createWidgetRegistry<TWidget extends WidgetType>(
  canvasKind: CanvasKind,
  allowlist: TWidget[],
  logger: CanvasLogger,
  options?: {
    denylist?: TWidget[];
    capabilities?: string[];
  }
): WidgetRegistry<TWidget> {
  return new WidgetRegistry(canvasKind, allowlist, logger, options);
}

export default WidgetRegistry;