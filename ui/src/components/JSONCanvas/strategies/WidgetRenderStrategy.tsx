/**
 * Widget Render Strategy Interface
 * 
 * Implements Strategy pattern (Gang of Four) for rendering different widget types.
 * Each widget type has its own strategy implementation, allowing new widgets
 * to be added without modifying the core WidgetRenderer.
 * 
 * This matches the backend Strategy pattern used in:
 * - memory_system/semantic/strategy.py (SemanticStrategy)
 * - src/memory/VectorIndexFactory.ts (Index strategies)
 * 
 * @see Design Patterns: Elements of Reusable Object-Oriented Software
 *      Gamma, Helm, Johnson, Vlissides (1994), Chapter: Strategy Pattern
 * @see docs/frontend-development-verified-report.md - Section 3.4
 * 
 * @module ui/components/JSONCanvas/strategies
 */

import type { ReactElement } from 'react';

/**
 * Strategy interface for rendering widget types.
 * 
 * Each widget type implements this interface to provide its own rendering logic.
 * The strategy receives widget props and returns a React element.
 * 
 * Example:
 * ```typescript
 * class MarkdownStrategy implements WidgetRenderStrategy {
 *   supports(widgetType: string): boolean {
 *     return widgetType === 'markdown';
 *   }
 *   
 *   render(props: Record<string, unknown>): ReactElement {
 *     return <MarkdownWidget props={props} />;
 *   }
 * }
 * ```
 */
export interface WidgetRenderStrategy {
  /**
   * Check if this strategy supports the given widget type.
   * 
   * @param widgetType - The widget type string (e.g., 'markdown', 'code')
   * @returns true if this strategy can render the widget type
   */
  supports(widgetType: string): boolean;
  
  /**
   * Render the widget with the given props.
   * 
   * @param props - Widget props from the WidgetNode
   * @returns React element representing the rendered widget
   */
  render(props: Record<string, unknown>): ReactElement;
  
  /**
   * Validate widget props against the widget definition schema (optional).
   * 
   * @param props - Widget props to validate
   * @returns true if props are valid, false otherwise
   */
  validate?(props: Record<string, unknown>): boolean;
}

/**
 * Registry for widget render strategies.
 * 
 * Manages registration and lookup of widget rendering strategies.
 * Follows the Registry pattern to enable dynamic widget type addition.
 * 
 * Usage:
 * ```typescript
 * const registry = new WidgetStrategyRegistry();
 * registry.register(new MarkdownStrategy());
 * registry.register(new CodeStrategy());
 * 
 * const strategy = registry.getStrategy('markdown');
 * const element = strategy.render(props);
 * ```
 */
export class WidgetStrategyRegistry {
  private strategies = new Map<string, WidgetRenderStrategy>();
  
  /**
   * Register a widget rendering strategy.
   * 
   * @param strategy - The strategy to register
   * @throws Error if strategy with same type already registered
   */
  register(strategy: WidgetRenderStrategy): void {
    // Find all widget types this strategy supports
    const supportedTypes: string[] = [];
    
    // Common widget types to check
    const knownTypes = [
      'markdown', 'code', 'chart', 'table', 'image', 
      'button', 'input', 'memory-viewer', 'skill-executor',
      'conversation', 'api-key-wallet', 'settings'
    ];
    
    for (const type of knownTypes) {
      if (strategy.supports(type)) {
        if (this.strategies.has(type)) {
          throw new Error(`Strategy for widget type '${type}' already registered`);
        }
        supportedTypes.push(type);
      }
    }
    
    // Register for all supported types
    for (const type of supportedTypes) {
      this.strategies.set(type, strategy);
    }
  }
  
  /**
   * Get the rendering strategy for a widget type.
   * 
   * @param widgetType - The widget type to get strategy for
   * @returns The registered strategy, or null if not found
   */
  getStrategy(widgetType: string): WidgetRenderStrategy | null {
    return this.strategies.get(widgetType) || null;
  }
  
  /**
   * Check if a widget type has a registered strategy.
   * 
   * @param widgetType - The widget type to check
   * @returns true if strategy exists, false otherwise
   */
  hasStrategy(widgetType: string): boolean {
    return this.strategies.has(widgetType);
  }
  
  /**
   * Render a widget using the appropriate strategy.
   * 
   * @param widgetType - The type of widget to render
   * @param props - Widget props
   * @returns Rendered React element
   * @throws Error if no strategy found for widget type
   */
  render(widgetType: string, props: Record<string, unknown>): ReactElement {
    const strategy = this.getStrategy(widgetType);
    
    if (!strategy) {
      throw new Error(`No rendering strategy found for widget type: ${widgetType}`);
    }
    
    // Optionally validate props if strategy supports it
    if (strategy.validate && !strategy.validate(props)) {
      console.warn(`Invalid props for widget type '${widgetType}':`, props);
    }
    
    return strategy.render(props);
  }
  
  /**
   * Get all registered widget types.
   * 
   * @returns Array of registered widget type strings
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.strategies.keys());
  }
  
  /**
   * Clear all registered strategies.
   * Useful for testing or hot-reloading scenarios.
   */
  clear(): void {
    this.strategies.clear();
  }
}

/**
 * Default global widget strategy registry.
 * Pre-populated with all built-in widget strategies.
 */
export const defaultWidgetRegistry = new WidgetStrategyRegistry();