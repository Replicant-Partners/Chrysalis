/**
 * Media Canvas - Type Definitions
 * 
 * Data models for media editing workspace
 */

import type { MediaType, ExportFormat, ExportQuality, ImageFilter, EditAction } from './enums';

// ============================================================================
// Media Item
// ============================================================================

export interface MediaItem {
  id: string;
  type: MediaType;
  filename: string;
  url: string; // Blob URL or data URL
  thumbnail?: string;
  size: number; // Bytes
  duration?: number; // For audio/video in seconds
  dimensions?: { width: number; height: number }; // For image/video
  mimeType: string;
  createdAt: number;
  modifiedAt: number;
}

// ============================================================================
// Image Editing
// ============================================================================

export interface ImageEdits {
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  rotation: number; // Degrees: 0, 90, 180, 270
  flipH: boolean;
  flipV: boolean;
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  saturation: number; // -100 to 100
  filter: ImageFilter;
}

// ============================================================================
// Audio Editing
// ============================================================================

export interface AudioEdits {
  trim?: {
    start: number; // Seconds
    end: number; // Seconds
  };
  fadeIn?: number; // Duration in seconds
  fadeOut?: number; // Duration in seconds
  volume: number; // 0 to 200 (percentage)
}

// ============================================================================
// Video Editing
// ============================================================================

export interface VideoEdits {
  trim?: {
    start: number; // Seconds
    end: number; // Seconds
  };
}

// ============================================================================
// Export Settings
// ============================================================================

export interface ExportSettings {
  format: ExportFormat;
  quality: ExportQuality;
  filename: string;
}

// ============================================================================
// Edit History
// ============================================================================

export interface EditHistoryEntry {
  id: string;
  action: EditAction;
  timestamp: number;
  details: Record<string, unknown>;
}

// ============================================================================
// Store State
// ============================================================================

export interface MediaCanvasState {
  // Media library
  items: MediaItem[];
  
  // UI State
  selectedItemId: string | null;
  filterType: MediaType | 'all';
  
  // Active editing
  imageEdits: ImageEdits;
  audioEdits: AudioEdits;
  videoEdits: VideoEdits;
  editHistory: EditHistoryEntry[];
  hasUnsavedChanges: boolean;
  
  // Export
  exportSettings: ExportSettings;
  isExporting: boolean;
  exportProgress: number;
  
  // Actions - Media Library
  addItem: (item: Omit<MediaItem, 'id' | 'createdAt' | 'modifiedAt'>) => void;
  deleteItem: (id: string) => void;
  selectItem: (id: string | null) => void;
  setFilterType: (type: MediaType | 'all') => void;
  
  // Actions - Image Editing
  setImageEdit: (edits: Partial<ImageEdits>) => void;
  resetImageEdits: () => void;
  applyImageEdit: (action: EditAction) => void;
  
  // Actions - Audio Editing
  setAudioEdit: (edits: Partial<AudioEdits>) => void;
  resetAudioEdits: () => void;
  
  // Actions - Video Editing
  setVideoEdit: (edits: Partial<VideoEdits>) => void;
  resetVideoEdits: () => void;
  
  // Actions - Export
  setExportSettings: (settings: Partial<ExportSettings>) => void;
  exportMedia: () => Promise<void>;
  
  // Actions - History
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
}