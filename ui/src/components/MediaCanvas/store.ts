/**
 * Media Canvas - Zustand Store
 * 
 * Local UI state management for Media Canvas
 */

import { create } from 'zustand';
import type { MediaCanvasState, MediaItem, ImageEdits, AudioEdits, VideoEdits } from './types';
import { generateId, getExtensionFromMimeType } from './utils';

const DEFAULT_IMAGE_EDITS: ImageEdits = {
  rotation: 0,
  flipH: false,
  flipV: false,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  filter: 'none',
};

const DEFAULT_AUDIO_EDITS: AudioEdits = {
  volume: 100,
};

const DEFAULT_VIDEO_EDITS: VideoEdits = {};

export const useMediaStore = create<MediaCanvasState>((set, get) => ({
  // Initial state
  items: [],
  selectedItemId: null,
  filterType: 'all',
  
  imageEdits: { ...DEFAULT_IMAGE_EDITS },
  audioEdits: { ...DEFAULT_AUDIO_EDITS },
  videoEdits: { ...DEFAULT_VIDEO_EDITS },
  editHistory: [],
  hasUnsavedChanges: false,
  
  exportSettings: {
    format: 'image/png',
    quality: 'high',
    filename: 'export',
  },
  isExporting: false,
  exportProgress: 0,
  
  // Media Library Actions
  addItem: (item) => {
    const newItem: MediaItem = {
      ...item,
      id: generateId(),
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };
    set((state) => ({
      items: [...state.items, newItem],
    }));
  },
  
  deleteItem: (id) => {
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
      selectedItemId: state.selectedItemId === id ? null : state.selectedItemId,
    }));
  },
  
  selectItem: (id) => {
    set({
      selectedItemId: id,
      imageEdits: { ...DEFAULT_IMAGE_EDITS },
      audioEdits: { ...DEFAULT_AUDIO_EDITS },
      videoEdits: { ...DEFAULT_VIDEO_EDITS },
      hasUnsavedChanges: false,
      editHistory: [],
    });
    
    // Update export settings based on selected item
    if (id) {
      const item = get().items.find((i) => i.id === id);
      if (item) {
        set((state) => ({
          exportSettings: {
            ...state.exportSettings,
            format: item.mimeType as any,
            filename: item.filename.replace(/\.[^/.]+$/, ''),
          },
        }));
      }
    }
  },
  
  setFilterType: (type) => {
    set({ filterType: type });
  },
  
  // Image Editing Actions
  setImageEdit: (edits) => {
    set((state) => ({
      imageEdits: { ...state.imageEdits, ...edits },
      hasUnsavedChanges: true,
    }));
  },
  
  resetImageEdits: () => {
    set({
      imageEdits: { ...DEFAULT_IMAGE_EDITS },
      hasUnsavedChanges: false,
    });
  },
  
  applyImageEdit: (action) => {
    const state = get();
    const entry = {
      id: generateId(),
      action,
      timestamp: Date.now(),
      details: { ...state.imageEdits },
    };
    set((state) => ({
      editHistory: [...state.editHistory, entry],
      hasUnsavedChanges: true,
    }));
  },
  
  // Audio Editing Actions
  setAudioEdit: (edits) => {
    set((state) => ({
      audioEdits: { ...state.audioEdits, ...edits },
      hasUnsavedChanges: true,
    }));
  },
  
  resetAudioEdits: () => {
    set({
      audioEdits: { ...DEFAULT_AUDIO_EDITS },
      hasUnsavedChanges: false,
    });
  },
  
  // Video Editing Actions
  setVideoEdit: (edits) => {
    set((state) => ({
      videoEdits: { ...state.videoEdits, ...edits },
      hasUnsavedChanges: true,
    }));
  },
  
  resetVideoEdits: () => {
    set({
      videoEdits: { ...DEFAULT_VIDEO_EDITS },
      hasUnsavedChanges: false,
    });
  },
  
  // Export Actions
  setExportSettings: (settings) => {
    set((state) => ({
      exportSettings: { ...state.exportSettings, ...settings },
    }));
  },
  
  exportMedia: async () => {
    set({ isExporting: true, exportProgress: 0 });
    
    try {
      // Simulate export progress
      for (let i = 0; i <= 100; i += 10) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        set({ exportProgress: i });
      }
      
      // TODO: Implement actual export logic
      // For now, just download the original file
      const selectedItem = get().items.find((i) => i.id === get().selectedItemId);
      if (selectedItem) {
        const link = document.createElement('a');
        link.href = selectedItem.url;
        link.download = `${get().exportSettings.filename}.${getExtensionFromMimeType(get().exportSettings.format)}`;
        link.click();
      }
      
      set({
        isExporting: false,
        exportProgress: 0,
        hasUnsavedChanges: false,
      });
    } catch (error) {
      console.error('Export failed:', error);
      set({ isExporting: false, exportProgress: 0 });
    }
  },
  
  // History Actions
  undo: () => {
    const state = get();
    if (state.editHistory.length > 0) {
      const newHistory = [...state.editHistory];
      newHistory.pop();
      set({ editHistory: newHistory });
    }
  },
  
  redo: () => {
    // TODO: Implement redo functionality
    console.log('Redo not yet implemented');
  },
  
  clearHistory: () => {
    set({ editHistory: [] });
  },
}));