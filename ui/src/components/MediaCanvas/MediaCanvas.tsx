/**
 * Media Canvas Component
 * 
 * Main media editing workspace with library, editors, and export
 */

import React from 'react';
import { useMediaStore } from './store';
import { MediaLibrary } from './MediaLibrary';
import { ImageEditor } from './ImageEditor';
import { AudioEditor } from './AudioEditor';
import { VideoPlayer } from './VideoPlayer';
import { ExportPanel } from './ExportPanel';
import styles from './MediaCanvas.module.css';

export interface MediaCanvasProps {
  canvasId: string;
}

export const MediaCanvas: React.FC<MediaCanvasProps> = () => {
  const { items, selectedItemId } = useMediaStore();
  
  const selectedItem = items.find((i) => i.id === selectedItemId);
  
  // Determine which editor to show
  const renderEditor = () => {
    if (!selectedItem) {
      return (
        <div className={styles.emptyEditor}>
          <p>Select a file from the library to start editing</p>
          <p className={styles.hint}>
            Supported formats: JPG, PNG, GIF, MP3, WAV, MP4, WebM
          </p>
        </div>
      );
    }
    
    switch (selectedItem.type) {
      case 'image':
        return <ImageEditor />;
      case 'audio':
        return <AudioEditor />;
      case 'video':
        return <VideoPlayer />;
      default:
        return (
          <div className={styles.emptyEditor}>
            <p>Unsupported file type</p>
          </div>
        );
    }
  };
  
  return (
    <div className={styles.canvas}>
      <div className={styles.library}>
        <MediaLibrary />
      </div>
      
      <div className={styles.editor}>
        {renderEditor()}
      </div>
      
      <div className={styles.export}>
        <ExportPanel />
      </div>
    </div>
  );
};