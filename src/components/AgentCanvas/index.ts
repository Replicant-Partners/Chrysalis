/**
 * AgentCanvas Components
 * 
 * Export all Agent Canvas related components for the Chrysalis UI.
 */

export { AgentCanvas } from './AgentCanvas';
export type { AgentCanvasProps } from './AgentCanvas';

export { AgentNodeWidget } from './AgentNodeWidget';
export type { AgentNodeWidgetProps } from './AgentNodeWidget';

export { AgentImportMenu } from './AgentImportMenu';
export type { AgentImportMenuProps } from './AgentImportMenu';

// Re-export protocol types for convenience
// Note: agent-canvas is the primary source for AgentPosition
export * from '../../terminal/protocols/agent-canvas';
export {
  // Explicitly re-export from agent-canvas-manager, excluding AgentPosition to avoid conflict
  AgentCanvasManager,
  type AgentCanvasManagerConfig,
  type AgentLayout,
  type CanvasViewport,
  type SelectionState,
  type CanvasManagerEventType,
  type CanvasManagerEvent,
  type CanvasManagerEventListener,
  getDefaultAgentCanvasManager,
  createAgentCanvasManager,
  resetDefaultAgentCanvasManager,
} from '../../terminal/protocols/agent-canvas-manager';
export * from '../../terminal/protocols/agent-lifecycle-manager';
export * from '../../terminal/protocols/agent-import-pipeline';
export * from '../../terminal/protocols/data-resource-connector';