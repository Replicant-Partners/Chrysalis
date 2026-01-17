/**
 * Board Canvas
 * 
 * General-purpose canvas for organizing ideas and tasks.
 * Whitelist: Note, Task, Group, Link
 * 
 * @module canvas/canvases/BoardCanvas
 */

import React from 'react';
import { BaseCanvas, BaseCanvasProps } from '../BaseCanvas';
import { createWidgetRegistry } from '../WidgetRegistry';
import type { CanvasPolicy, CanvasLogger } from '../types';
import { NoteWidget } from '../widgets/NoteWidget';
import { TaskWidget } from '../widgets/TaskWidget';
import { createLogger } from '../../shared/logger';

// =============================================================================
// Board Widget Types
// =============================================================================

export type BoardWidgetType = 'note' | 'task' | 'group' | 'link';

// =============================================================================
// Board Canvas Configuration
// =============================================================================

const BOARD_POLICY: CanvasPolicy = {
  allowlist: ['note', 'task', 'group', 'link'],
  denylist: [],
  maxNodes: 500,
  maxEdges: 1000,
  rateLimit: {
    maxActionsPerMinute: 200,
    maxCreationsPerMinute: 50,
  },
};

/**
 * Create board canvas widget registry
 */
function createBoardRegistry(logger: CanvasLogger) {
  const registry = createWidgetRegistry<BoardWidgetType>(
    'board',
    ['note', 'task', 'group', 'link'],
    logger
  );
  
  // Register note widget
  registry.register({
    type: 'note',
    displayName: 'Note',
    description: 'Sticky note for quick thoughts',
    icon: 'note',
    renderer: NoteWidget,
    defaultSize: { width: 200, height: 150 },
  });
  
  // Register task widget
  registry.register({
    type: 'task',
    displayName: 'Task',
    description: 'Task with status tracking',
    icon: 'check-square',
    renderer: TaskWidget,
    defaultSize: { width: 250, height: 180 },
  });
  
  // TODO: Register group and link widgets
  
  return registry;
}

// =============================================================================
// Board Canvas Component
// =============================================================================

export interface BoardCanvasProps extends Omit<BaseCanvasProps<BoardWidgetType>, 'canvasKind' | 'registry' | 'policy'> {
  policy?: Partial<CanvasPolicy>;
}

export function BoardCanvas(props: BoardCanvasProps) {
  const logger = props.logger || createLogger('canvas-board');
  const registry = React.useMemo(() => createBoardRegistry(logger), [logger]);
  
  const mergedPolicy: CanvasPolicy = {
    ...BOARD_POLICY,
    ...props.policy,
    allowlist: props.policy?.allowlist || BOARD_POLICY.allowlist,
  };
  
  return (
    <BaseCanvas
      canvasKind="board"
      registry={registry}
      policy={mergedPolicy}
      {...props}
    />
  );
}

export default BoardCanvas;