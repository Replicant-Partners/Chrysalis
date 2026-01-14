/**
 * Scrapbook Canvas - Zustand Store
 * 
 * Local UI state management for Scrapbook Canvas
 */

import { create } from 'zustand';
import type { ScrapbookCanvasState } from './types';

export const useScrapbookStore = create<ScrapbookCanvasState>((set) => ({
  // Initial state
  viewMode: 'grid',
  selectedItemId: null,
  lightboxItemId: null,
  filterTags: [],
  searchQuery: '',
  sortBy: 'date',
  
  // Actions
  addItem: (item) => {
    // This will be handled by YJS sync, store just tracks UI state
    console.log('Add item:', item);
  },
  
  updateItem: (id, updates) => {
    console.log('Update item:', id, updates);
  },
  
  deleteItem: (id) => {
    console.log('Delete item:', id);
  },
  
  setSelectedItem: (id) => {
    set({ selectedItemId: id });
  },
  
  setLightboxItem: (id) => {
    set({ lightboxItemId: id });
  },
  
  setFilterTags: (tags) => {
    set({ filterTags: tags });
  },
  
  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },
  
  addTag: (itemId, tag) => {
    console.log('Add tag:', itemId, tag);
  },
  
  removeTag: (itemId, tag) => {
    console.log('Remove tag:', itemId, tag);
  },
}));