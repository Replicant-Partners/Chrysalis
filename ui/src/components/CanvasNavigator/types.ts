/**
 * Canvas Navigator - Type Definitions
 */

export type CanvasType =
  | 'settings'
  | 'board'
  | 'scrapbook'
  | 'research'
  | 'wiki'
  | 'terminal'
  | 'browser'
  | 'scenarios'
  | 'curation'
  | 'media'
  | 'storyboard'
  | 'remixer'
  | 'video'
  | 'meme'
  | 'custom_template';

export type ScrollMode = 'vertical' | 'horizontal' | 'both' | 'bounded';

export interface CanvasConfig {
  scrollMode: ScrollMode;
  gridSize: number;
  autoExpand: boolean;
  snapToGrid: boolean;
  allowOverlap: boolean;
}

export interface CanvasTab {
  id: string;
  index: number;
  type: CanvasType;
  title: string;
  isFixed: boolean;      // Cannot close (Settings)
  isVisible: boolean;    // Show in tab bar
  isPinned: boolean;     // Pin to start
  config: CanvasConfig;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'idle' | 'offline';
}

export interface CanvasNavigatorProps {
  canvases: CanvasTab[];
  activeCanvasId: string;
  agents: Agent[];
  onCanvasSelect: (canvasId: string) => void;
  onCanvasTypeChange: (canvasId: string, newType: CanvasType) => void;
}

export interface CanvasTabBarProps {
  canvases: CanvasTab[];
  activeCanvasId: string;
  onCanvasSelect: (canvasId: string) => void;
  onCanvasRename: (canvasId: string, newTitle: string) => void;
  onCanvasHide: (canvasId: string) => void;
  onCanvasClose: (canvasId: string) => void;
  onCanvasAdd: () => void;
  onCanvasReorder: (canvasIds: string[]) => void;
  onCanvasTypeChange: (canvasId: string, newType: CanvasType) => void;
}

export interface TabContextMenuProps {
  canvas: CanvasTab;
  onRename: () => void;
  onHide: () => void;
  onClose: () => void;
  onDuplicate: () => void;
  onChangeType: () => void;
  position: { x: number; y: number };
  onCloseMenu: () => void;
}

export interface HiddenCanvasDrawerProps {
  hiddenCanvases: CanvasTab[];
  onCanvasShow: (canvasId: string) => void;
  onCanvasClose: (canvasId: string) => void;
}