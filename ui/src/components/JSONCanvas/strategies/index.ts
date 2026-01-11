/**
 * Widget Rendering Strategies - Export Module
 * 
 * Exports the widget strategy system and pre-configured registry.
 * 
 * @module ui/components/JSONCanvas/strategies
 */

export {
  type WidgetRenderStrategy,
  WidgetStrategyRegistry,
  defaultWidgetRegistry
} from './WidgetRenderStrategy';

export {
  MarkdownStrategy,
  CodeStrategy,
  ChartStrategy,
  TableStrategy,
  ImageStrategy,
  InteractiveWidgetsStrategy,
  AgentWidgetsStrategy,
  SystemWidgetsStrategy
} from './BuiltInStrategies';

// Initialize default registry with all built-in strategies
import { defaultWidgetRegistry } from './WidgetRenderStrategy';
import {
  MarkdownStrategy,
  CodeStrategy,
  ChartStrategy,
  TableStrategy,
  ImageStrategy,
  InteractiveWidgetsStrategy,
  AgentWidgetsStrategy,
  SystemWidgetsStrategy
} from './BuiltInStrategies';

// Register all built-in strategies
defaultWidgetRegistry.register(new MarkdownStrategy());
defaultWidgetRegistry.register(new CodeStrategy());
defaultWidgetRegistry.register(new ChartStrategy());
defaultWidgetRegistry.register(new TableStrategy());
defaultWidgetRegistry.register(new ImageStrategy());
defaultWidgetRegistry.register(new InteractiveWidgetsStrategy());
defaultWidgetRegistry.register(new AgentWidgetsStrategy());
defaultWidgetRegistry.register(new SystemWidgetsStrategy());