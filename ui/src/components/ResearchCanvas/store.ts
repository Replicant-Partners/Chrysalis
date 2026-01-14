/**
 * Research Canvas - Zustand Store
 * 
 * Local UI state management for Research Canvas
 */

import { create } from 'zustand';
import type { ResearchCanvasState } from './types';

export const useResearchStore = create<ResearchCanvasState>((set) => ({
  // Initial state
  selectedDocumentId: null,
  expandedFolderIds: [],
  isEditing: false,
  searchQuery: '',
  filterTags: [],
  viewMode: 'split',
  
  // Actions
  createDocument: (doc) => {
    console.log('Create document:', doc);
  },
  
  updateDocument: (id, updates) => {
    console.log('Update document:', id, updates);
  },
  
  deleteDocument: (id) => {
    console.log('Delete document:', id);
  },
  
  moveDocument: (id, newParentId) => {
    console.log('Move document:', id, 'to', newParentId);
  },
  
  setSelectedDocument: (id) => {
    set({ selectedDocumentId: id });
  },
  
  toggleFolder: (id) => {
    set((state) => ({
      expandedFolderIds: state.expandedFolderIds.includes(id)
        ? state.expandedFolderIds.filter(fId => fId !== id)
        : [...state.expandedFolderIds, id],
    }));
  },
  
  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },
  
  setViewMode: (mode) => {
    set({ viewMode: mode });
  },
}));