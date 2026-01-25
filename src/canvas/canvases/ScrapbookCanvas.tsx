import React from 'react';

import { BaseCanvasWithProvider } from '../BaseCanvas';
import { createWidgetRegistry } from '../WidgetRegistry';
import { ArtifactWidget } from '../widgets/ArtifactWidget';
import { LinkWidget } from '../widgets/LinkWidget';
import { NoteWidget } from '../widgets/NoteWidget';

import type { BaseCanvasProps } from '../BaseCanvas';
import type { CanvasPolicy, WidgetDefinition } from '../types';
import type { ArtifactWidgetData } from '../widgets/ArtifactWidget';
import type { LinkWidgetData } from '../widgets/LinkWidget';
import type { NoteWidgetData } from '../widgets/NoteWidget';

const SCRAPBOOK_POLICY: CanvasPolicy = {
  maxNodes: 500,
  maxEdges: 1000,
  rateLimit: { actions: 50, windowMs: 1000 },
  allowedWidgetTypes: ['artifact', 'note', 'link', 'group'],
};

const noteWidgetDef: WidgetDefinition<NoteWidgetData> = {
  type: 'note',
  displayName: 'Note',
  renderer: NoteWidget,
  capabilities: ['edit', 'read'],
  defaultData: {
    content: 'New note...',
    tags: []
  },
  category: 'content',
  icon: '📝'
};

const linkWidgetDef: WidgetDefinition<LinkWidgetData> = {
  type: 'link',
  displayName: 'Link',
  renderer: LinkWidget,
  capabilities: ['read'],
  defaultData: {
    url: 'https://example.com',
    title: 'New Link',
    description: ''
  },
  category: 'reference',
  icon: '🔗'
};

const artifactWidgetDef: WidgetDefinition<ArtifactWidgetData> = {
  type: 'artifact',
  displayName: 'Artifact',
  renderer: ArtifactWidget,
  capabilities: ['read', 'edit'],
  defaultData: {
    artifactType: 'text',
    content: '',
    language: undefined,
    source: undefined
  },
  category: 'content',
  icon: '📦'
};

export interface ScrapbookCanvasProps extends Omit<BaseCanvasProps, 'canvasKind' | 'registry' | 'policy'> { }

export const ScrapbookCanvas: React.FC<ScrapbookCanvasProps> = (props) => {
  const registry = React.useMemo(() => {
    const reg = createWidgetRegistry('scrapbook', SCRAPBOOK_POLICY.allowedWidgetTypes);
    reg.register(noteWidgetDef);
    reg.register(linkWidgetDef);
    reg.register(artifactWidgetDef);
    return reg;
  }, []);

  return (
    <BaseCanvasWithProvider
      {...props}
      canvasKind="scrapbook"
      registry={registry}
      policy={SCRAPBOOK_POLICY}
    />
  );
};

export default ScrapbookCanvas;
