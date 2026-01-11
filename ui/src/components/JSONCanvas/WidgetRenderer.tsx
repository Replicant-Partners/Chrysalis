/**
 * Widget Renderer Component
 * 
 * Renders widget nodes using the Strategy pattern.
 * New widget types can be added by registering new strategies
 * without modifying this component (Open/Closed Principle).
 * 
 * @see ui/src/components/JSONCanvas/strategies/WidgetRenderStrategy.tsx
 */

import type { WidgetNode } from '@terminal/protocols/types';
import { defaultWidgetRegistry, type WidgetStrategyRegistry } from './strategies';
import styles from './WidgetRenderer.module.css';

// ============================================================================
// Types
// ============================================================================

export interface WidgetRendererProps {
  widget: WidgetNode;
  isSelected?: boolean;
  /** Optional custom widget registry. Defaults to global registry. */
  registry?: WidgetStrategyRegistry;
}

// ============================================================================
// Main Widget Renderer - Strategy Pattern Implementation
// ============================================================================

/**
 * WidgetRenderer component using Strategy pattern.
 * 
 * Delegates rendering to registered strategies based on widget type.
 * New widget types can be added by registering new strategies without
 * modifying this component (Open/Closed Principle).
 * 
 * Benefits over switch statement approach:
 * - Extensible: Add new widgets without modifying core renderer
 * - Testable: Each strategy can be tested independently
 * - Maintainable: Widget logic encapsulated in strategies
 * - Consistent: Matches backend Strategy pattern usage
 */
export function WidgetRenderer({ 
  widget, 
  registry = defaultWidgetRegistry 
}: WidgetRendererProps) {
  const { widgetType, props } = widget;

  const renderWidget = () => {
    try {
      // Use strategy registry to render widget
      return registry.render(widgetType, props);
    } catch (error) {
      // Fallback for unknown widget types
      console.error(`Error rendering widget type '${widgetType}':`, error);
      return (
        <div className={styles.unknownWidget}>
          <span>⚠️ Unknown widget type: {widgetType}</span>
          <span className={styles.errorDetails}>
            {error instanceof Error ? error.message : 'Rendering failed'}
          </span>
        </div>
      );
    }
  };

  return (
    <div className={styles.widgetContainer}>
      <div className={styles.widgetHeader}>
        <span className={styles.widgetType}>{widgetType}</span>
      </div>
      <div className={styles.widgetBody}>
        {renderWidget()}
      </div>
    </div>
  );
}

export default WidgetRenderer;