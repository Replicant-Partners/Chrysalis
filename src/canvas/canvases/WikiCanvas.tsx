import React from 'react';
import { BaseCanvasWithProvider, BaseCanvasProps } from '../BaseCanvas';
import { createWidgetRegistry } from '../WidgetRegistry';
import { WikiLinkWidget, WikiLinkWidgetData } from '../widgets/WikiLinkWidget';
import { WikiPageWidget, WikiPageWidgetData } from '../widgets/WikiPageWidget';
import { WikiSectionWidget, WikiSectionWidgetData } from '../widgets/WikiSectionWidget';

import type { CanvasPolicy, WidgetDefinition } from '../types';

const WIKI_POLICY: CanvasPolicy = {
  maxNodes: 1000,
  maxEdges: 2000,
  rateLimit: { actions: 30, windowMs: 1000 },
  allowedWidgetTypes: ['wiki_page', 'wiki_section', 'wiki_link'],
};

const wikiPageWidgetDef: WidgetDefinition<WikiPageWidgetData> = {
  type: 'wiki_page',
  displayName: 'Wiki Page',
  renderer: WikiPageWidget,
  capabilities: ['read', 'edit'],
  defaultData: {
    title: 'New Page',
    content: '',
    categories: [],
    lastModified: Date.now()
  },
  category: 'content',
  icon: '📄'
};

const wikiSectionWidgetDef: WidgetDefinition<WikiSectionWidgetData> = {
  type: 'wiki_section',
  displayName: 'Wiki Section',
  renderer: WikiSectionWidget,
  capabilities: ['read', 'edit'],
  defaultData: {
    heading: 'New Section',
    content: '',
    level: 2
  },
  category: 'content',
  icon: '📋'
};

const wikiLinkWidgetDef: WidgetDefinition<WikiLinkWidgetData> = {
  type: 'wiki_link',
  displayName: 'Wiki Link',
  renderer: WikiLinkWidget,
  capabilities: ['read'],
  defaultData: {
    targetPage: 'Page Name',
    linkType: 'internal',
    description: undefined
  },
  category: 'navigation',
  icon: '🔗'
};

export const WikiCanvas: React.FC<Omit<BaseCanvasProps, 'canvasKind' | 'registry' | 'policy'>> = (props) => {
  const registry = React.useMemo(() => {
    const reg = createWidgetRegistry('wiki', WIKI_POLICY.allowedWidgetTypes);
    reg.register(wikiPageWidgetDef);
    reg.register(wikiSectionWidgetDef);
    reg.register(wikiLinkWidgetDef);
    return reg;
  }, []);

  return <BaseCanvasWithProvider {...props} canvasKind="wiki" registry={registry} policy={WIKI_POLICY} />;
};

export default WikiCanvas;
