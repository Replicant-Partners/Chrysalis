/**
 * Canvas Implementations
 * 
 * All canvas implementations for the Chrysalis canvas system.
 * 
 * @module canvas/canvases
 */

// Terminal canvas - interactive shell sessions
export { TerminalCanvas } from './TerminalCanvas';
export type { TerminalCanvasProps, TerminalWidgetType } from './TerminalCanvas';

// Board canvas - general organization
export { BoardCanvas } from './BoardCanvas';
export type { BoardCanvasProps, BoardWidgetType } from './BoardCanvas';

// Browser canvas - sandboxed web browsing
export { BrowserCanvas } from './BrowserCanvas';
export type { BrowserCanvasProps, BrowserWidgetType } from './BrowserCanvas';

// Settings canvas - configuration management
export { SettingsCanvas } from './SettingsCanvas';
export type { SettingsCanvasProps, SettingsWidgetType } from './SettingsCanvas';

// Research canvas - knowledge gathering (TODO)
// export { ResearchCanvas } from './ResearchCanvas';

// Wiki canvas - documentation (TODO)
// export { WikiCanvas } from './WikiCanvas';

// Scrapbook canvas - quick notes (TODO)
// export { ScrapbookCanvas } from './ScrapbookCanvas';

// Scenarios canvas - testing scenarios (TODO)
// export { ScenariosCanvas } from './ScenariosCanvas';

// Curation canvas - content curation (TODO)
// export { CurationCanvas } from './CurationCanvas';

// Media canvas - audio/video (TODO)
// export { MediaCanvas } from './MediaCanvas';