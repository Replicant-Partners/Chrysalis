/**
 * BaseCanvas Demo
 * 
 * Minimal demo to verify BaseCanvas component functionality.
 * This serves as both documentation and smoke test.
 */

import React from 'react';

import { BaseCanvasWithProvider } from './BaseCanvas';
import { createWidgetRegistry } from './WidgetRegistry';

import type { WidgetProps, WidgetNodeData } from './types';

/**
 * Simple text widget for testing
 */
interface TextWidgetData extends WidgetNodeData {
  text: string;
}

const TextWidget: React.FC<WidgetProps<TextWidgetData>> = ({ data }) => {
  return (
    <div
      style={{
        padding: '12px',
        background: 'white',
        border: '1px solid #ddd',
        borderRadius: '4px',
        minWidth: '200px',
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>{data.label}</div>
      <div>{data.text}</div>
    </div>
  );
};

/**
 * Demo component showing BaseCanvas with a simple widget
 */
export const BaseCanvasDemo: React.FC = () => {
  // Create registry
  const registry = createWidgetRegistry('scrapbook', ['text_note']);

  // Register text widget
  registry.register({
    type: 'text_note',
    displayName: 'Text Note',
    renderer: TextWidget,
    capabilities: [],
    defaultData: {
      text: 'Hello, Canvas!',
    },
  });

  // Define policy
  const policy = {
    maxNodes: 100,
    maxEdges: 200,
    rateLimit: {
      actions: 10,
      windowMs: 1000,
    },
    allowedWidgetTypes: ['text_note'],
  };

  // Create initial nodes
  const initialNodes = [
    {
      id: '1',
      type: 'text_note',
      position: { x: 100, y: 100 },
      data: {
        type: 'text_note',
        label: 'Welcome',
        text: 'This is a test canvas with a simple text widget.',
      },
    },
    {
      id: '2',
      type: 'text_note',
      position: { x: 400, y: 200 },
      data: {
        type: 'text_note',
        label: 'Second Node',
        text: 'You can add edges by dragging from node handles.',
      },
    },
  ];

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <BaseCanvasWithProvider
        canvasKind="scrapbook"
        canvasId="demo-canvas-1"
        registry={registry}
        policy={policy}
        initialNodes={initialNodes}
        onEvent={(event) => {
          console.log('Canvas event:', event);
        }}
        onReady={(instance) => {
          console.log('Canvas ready:', instance);
        }}
      />
    </div>
  );
};

export default BaseCanvasDemo;
