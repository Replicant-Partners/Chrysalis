import React, { useCallback } from 'react';

import type { CanvasKind, CanvasNode } from '../canvas/types';
import type { WidgetRegistry } from '../canvas/WidgetRegistry';
import type { NoteWidgetData } from '../canvas/widgets/NoteWidget';
import type { LinkWidgetData } from '../canvas/widgets/LinkWidget';
import type { ArtifactWidgetData } from '../canvas/widgets/ArtifactWidget';

interface DragDropHandlerProps {
  canvasKind: CanvasKind;
  registry: WidgetRegistry;
  onNodeCreated: (node: CanvasNode) => void;
  children: React.ReactNode;
}

export const DragDropHandler: React.FC<DragDropHandlerProps> = ({
  canvasKind,
  registry,
  onNodeCreated,
  children
}) => {
  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();

    const url = event.dataTransfer.getData('text/uri-list') || event.dataTransfer.getData('text/plain');
    const files = event.dataTransfer.files;

    // Get drop position relative to canvas
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Handle URL drop
    if (url && url.startsWith('http')) {
      // Create LinkWidget for URLs
      if (registry.has('link')) {
        const node: CanvasNode<LinkWidgetData> = {
          id: `link-${Date.now()}`,
          type: 'link',
          position: { x, y },
          data: {
            type: 'link',
            label: 'Dropped Link',
            url,
            title: url,
            description: 'Dragged from browser'
          }
        };
        onNodeCreated(node);
      }
    }

    // Handle file drop  
    else if (files.length > 0) {
      const file = files[0];
      const reader = new FileReader();

      reader.onload = (e) => {
        const content = e.target?.result as string;

        // Determine artifact type from file
        let artifactType: 'code' | 'text' | 'image' | 'data' = 'text';
        let language: string | undefined;

        if (file.name.endsWith('.ts') || file.name.endsWith('.tsx')) {
          artifactType = 'code';
          language = 'typescript';
        } else if (file.name.endsWith('.js') || file.name.endsWith('.jsx')) {
          artifactType = 'code';
          language = 'javascript';
        } else if (file.name.endsWith('.py')) {
          artifactType = 'code';
          language = 'python';
        } else if (file.name.match(/\.(json|csv|xml)$/)) {
          artifactType = 'data';
        } else if (file.name.match(/\.(png|jpg|jpeg|gif|svg)$/)) {
          artifactType = 'image';
        }

        // Create ArtifactWidget
        if (registry.has('artifact')) {
          const node: CanvasNode<ArtifactWidgetData> = {
            id: `artifact-${Date.now()}`,
            type: 'artifact',
            position: { x, y },
            data: {
              type: 'artifact',
              label: file.name,
              artifactType,
              content: artifactType === 'image' ? content : content.substring(0, 5000),
              language,
              source: file.name
            }
          };
          onNodeCreated(node);
        }
      };

      if (file.name.match(/\.(png|jpg|jpeg|gif|svg)$/)) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    }

    // Handle plain text drop
    else {
      const text = event.dataTransfer.getData('text/plain');
      if (text && registry.has('note')) {
        const node: CanvasNode<NoteWidgetData> = {
          id: `note-${Date.now()}`,
          type: 'note',
          position: { x, y },
          data: {
            type: 'note',
            label: 'Dropped Text',
            content: text,
            tags: []
          }
        };
        onNodeCreated(node);
      }
    }
  }, [canvasKind, registry, onNodeCreated]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      style={{ width: '100%', height: '100%' }}
    >
      {children}
    </div>
  );
};

export default DragDropHandler;
