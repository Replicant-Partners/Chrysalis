/**
 * Terminal Service Module
 * 
 * Exports terminal emulation services using xterm.js with WebGL acceleration.
 * 
 * @module ui/services/terminal
 */

export {
  TerminalService,
  createTerminalService,
  type ITerminalService,
  type TerminalServiceConfig,
  type TerminalTheme,
  type TerminalMetrics,
  type TerminalEvents,
  type RenderingBackend,
  type ConnectionState,
} from './TerminalService';
