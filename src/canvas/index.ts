/**
 * Canvas System
 * 
 * Exports for the Chrysalis canvas system.
 * 
 * @module canvas
 */

// Core types
export * from './types';

// Widget registry
export { WidgetRegistry, createWidgetRegistry } from './WidgetRegistry';
export type {
  WidgetCreationRequest,
  WidgetValidationResult,
  RegistryStats
} from './WidgetRegistry';

// Base canvas
export { BaseCanvas } from './BaseCanvas';
export type { BaseCanvasProps } from './BaseCanvas';

// Canvas implementations
export { TerminalCanvas } from './canvases/TerminalCanvas';
export type { TerminalCanvasProps, TerminalWidgetType } from './canvases/TerminalCanvas';

export { BoardCanvas } from './canvases/BoardCanvas';
export type { BoardCanvasProps, BoardWidgetType } from './canvases/BoardCanvas';

export { BrowserCanvas } from './canvases/BrowserCanvas';
export type { BrowserCanvasProps, BrowserWidgetType } from './canvases/BrowserCanvas';

export { SettingsCanvas } from './canvases/SettingsCanvas';
export type { SettingsCanvasProps, SettingsWidgetType } from './canvases/SettingsCanvas';

// Widgets
export { TerminalSessionWidget } from './widgets/TerminalSessionWidget';
export type { TerminalSessionPayload } from './widgets/TerminalSessionWidget';