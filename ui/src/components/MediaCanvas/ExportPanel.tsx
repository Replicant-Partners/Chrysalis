/**
 * Export Panel Component
 * 
 * Format selection and export controls
 */

import React from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useMediaStore } from './store';
import type { ExportFormat, ExportQuality } from './enums';
import styles from './ExportPanel.module.css';

const FORMAT_OPTIONS: Record<string, ExportFormat[]> = {
  image: ['image/jpeg', 'image/png', 'image/webp'],
  audio: ['audio/mp3', 'audio/wav', 'audio/ogg'],
  video: ['video/mp4', 'video/webm'],
};

const FORMAT_LABELS: Record<ExportFormat, string> = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'audio/mp3': 'MP3',
  'audio/wav': 'WAV',
  'audio/ogg': 'OGG',
  'video/mp4': 'MP4',
  'video/webm': 'WebM',
};

const QUALITY_OPTIONS: ExportQuality[] = ['low', 'medium', 'high', 'original'];

export const ExportPanel: React.FC = () => {
  const {
    items,
    selectedItemId,
    exportSettings,
    isExporting,
    exportProgress,
    hasUnsavedChanges,
    setExportSettings,
    exportMedia,
  } = useMediaStore();
  
  const selectedItem = items.find((i) => i.id === selectedItemId);
  
  if (!selectedItem) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>
          <p>Select a file to export</p>
        </div>
      </div>
    );
  }
  
  const availableFormats = FORMAT_OPTIONS[selectedItem.type] || [];
  
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3 className={styles.title}>Export</h3>
      </div>
      
      <div className={styles.content}>
        <div className={styles.field}>
          <label className={styles.label}>Filename</label>
          <input
            type="text"
            value={exportSettings.filename}
            onChange={(e) => setExportSettings({ filename: e.target.value })}
            className={styles.input}
          />
        </div>
        
        <div className={styles.field}>
          <label className={styles.label}>Format</label>
          <select
            value={exportSettings.format}
            onChange={(e) => setExportSettings({ format: e.target.value as ExportFormat })}
            className={styles.select}
          >
            {availableFormats.map((format) => (
              <option key={format} value={format}>
                {FORMAT_LABELS[format]}
              </option>
            ))}
          </select>
        </div>
        
        <div className={styles.field}>
          <label className={styles.label}>Quality</label>
          <select
            value={exportSettings.quality}
            onChange={(e) => setExportSettings({ quality: e.target.value as ExportQuality })}
            className={styles.select}
          >
            {QUALITY_OPTIONS.map((quality) => (
              <option key={quality} value={quality}>
                {quality.charAt(0).toUpperCase() + quality.slice(1)}
              </option>
            ))}
          </select>
        </div>
        
        {hasUnsavedChanges && (
          <div className={styles.warning}>
            <p>You have unsaved edits</p>
          </div>
        )}
        
        <button
          className={styles.exportButton}
          onClick={() => exportMedia()}
          disabled={isExporting}
        >
          {isExporting ? (
            <>
              <Loader2 size={18} className={styles.spinner} />
              Exporting... {exportProgress}%
            </>
          ) : (
            <>
              <Download size={18} />
              Export & Download
            </>
          )}
        </button>
        
        {isExporting && (
          <div className={styles.progress}>
            <div
              className={styles.progressBar}
              style={{ width: `${exportProgress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};