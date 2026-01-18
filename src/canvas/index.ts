/**
 * Canvas System - Main Export
 * 
 * Comprehensive canvas workspace system for Chrysalis Terminal.
 * Provides 6 specialized canvas types with shared infrastructure.
 */

// Core types and infrastructure
export * from './types';
export * from './WidgetRegistry';
export * from './BaseCanvas';

// Data persistence
export * from './DataSource';

// Interaction management
export { InteractionManager } from './interactions/InteractionManager';
export { KeyboardShortcutsManager, createDefaultShortcuts } from './interactions/KeyboardShortcuts';

// Event system
export { EventBus } from './events/EventBus';
export { CanvasHistory } from './events/CanvasHistory';

// Policy enforcement
export { PolicyEngine } from './policy/PolicyEngine';

// Canvas implementations
export { SettingsCanvas } from './canvases/SettingsCanvas';
export { ScrapbookCanvas } from './canvases/ScrapbookCanvas';
export { ResearchCanvas } from './canvases/ResearchCanvas';
export { WikiCanvas } from './canvases/WikiCanvas';
export { TerminalBrowserCanvas } from './canvases/TerminalBrowserCanvas';
export { AgentCanvas } from './canvases/AgentCanvas';
