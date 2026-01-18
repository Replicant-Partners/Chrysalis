import React from 'react';

import { BaseCanvasWithProvider, BaseCanvasProps } from '../BaseCanvas';
import { createWidgetRegistry } from '../WidgetRegistry';
import { CitationWidget, CitationWidgetData } from '../widgets/CitationWidget';
import { HypothesisWidget, HypothesisWidgetData } from '../widgets/HypothesisWidget';
import { SourceWidget, SourceWidgetData } from '../widgets/SourceWidget';
import { SynthesisWidget, SynthesisWidgetData } from '../widgets/SynthesisWidget';

import type { CanvasPolicy, WidgetDefinition } from '../types';

const RESEARCH_POLICY: CanvasPolicy = {
  maxNodes: 300,
  maxEdges: 600,
  rateLimit: { actions: 40, windowMs: 1000 },
  allowedWidgetTypes: ['source', 'citation', 'synthesis', 'hypothesis'],
};

const sourceWidgetDef: WidgetDefinition<SourceWidgetData> = {
  type: 'source',
  displayName: 'Source',
  renderer: SourceWidget,
  capabilities: ['read'],
  defaultData: {
    url: '',
    citation: '',
    excerpt: ''
  },
  category: 'reference',
  icon: '📄'
};

const citationWidgetDef: WidgetDefinition<CitationWidgetData> = {
  type: 'citation',
  displayName: 'Citation',
  renderer: CitationWidget,
  capabilities: ['read'],
  defaultData: {
    authors: [],
    title: 'Untitled',
    year: new Date().getFullYear(),
    doi: undefined,
    notes: undefined
  },
  category: 'reference',
  icon: '📚'
};

const synthesisWidgetDef: WidgetDefinition<SynthesisWidgetData> = {
  type: 'synthesis',
  displayName: 'Synthesis',
  renderer: SynthesisWidget,
  capabilities: ['read', 'edit'],
  defaultData: {
    summary: '',
    sources: [],
    confidence: undefined
  },
  category: 'analysis',
  icon: '💡'
};

const hypothesisWidgetDef: WidgetDefinition<HypothesisWidgetData> = {
  type: 'hypothesis',
  displayName: 'Hypothesis',
  renderer: HypothesisWidget,
  capabilities: ['read', 'edit'],
  defaultData: {
    statement: '',
    evidence: [],
    status: 'proposed'
  },
  category: 'analysis',
  icon: '🔬'
};

export interface ResearchCanvasProps extends Omit<BaseCanvasProps, 'canvasKind' | 'registry' | 'policy'> { }

export const ResearchCanvas: React.FC<ResearchCanvasProps> = (props) => {
  const registry = React.useMemo(() => {
    const reg = createWidgetRegistry('research', RESEARCH_POLICY.allowedWidgetTypes);
    reg.register(sourceWidgetDef);
    reg.register(citationWidgetDef);
    reg.register(synthesisWidgetDef);
    reg.register(hypothesisWidgetDef);
    return reg;
  }, []);

  return (
    <BaseCanvasWithProvider
      {...props}
      canvasKind="research"
      registry={registry}
      policy={RESEARCH_POLICY}
    />
  );
};

export default ResearchCanvas;
