/**
 * Canvas Module
 * 
 * Exports all canvas-related components, types, and utilities.
 */

// Types
export * from './types';

// Widget Registry
export * from './WidgetRegistry';

// Data Sources
export * from './DataSource';

// Base Canvas
export { BaseCanvas, BaseCanvasWithProvider } from './BaseCanvas';
export type { BaseCanvasProps } from './BaseCanvas';

// Canvas Implementations
export { AgentCanvas } from './canvases/AgentCanvas';
export { ResearchCanvas } from './canvases/ResearchCanvas';
export { ScrapbookCanvas } from './canvases/ScrapbookCanvas';
export { SettingsCanvas } from './canvases/SettingsCanvas';
export { TerminalBrowserCanvas } from './canvases/TerminalBrowserCanvas';
export { WikiCanvas } from './canvases/WikiCanvas';
