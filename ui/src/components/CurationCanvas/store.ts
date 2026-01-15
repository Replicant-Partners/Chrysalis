/**
 * Curation Canvas - Zustand Store
 * 
 * Local UI state management for the Curation Canvas
 */

import { create } from 'zustand';
import type { CurationCanvasState } from './types';

export const useCurationStore = create<CurationCanvasState>((set) => ({
  // Initial view state
  viewMode: 'grid',
  selectedArtifactIds: [],
  selectedCollectionId: null,
  expandedCollectionIds: [],
  
  // Initial filter state
  searchQuery: '',
  filterTypes: [],
  filterTags: [],
  dateRangeStart: null,
  dateRangeEnd: null,
  sortBy: 'created',
  
  // Initial graph state
  selectedRelationshipId: null,
  showRelationshipEditor: false,
  
  // View actions
  setViewMode: (mode) => {
    set({ viewMode: mode });
  },
  
  setSelectedArtifacts: (ids) => {
    set({ selectedArtifactIds: ids });
  },
  
  setSelectedCollection: (id) => {
    set({ selectedCollectionId: id });
  },
  
  toggleCollection: (id) => {
    set((state) => ({
      expandedCollectionIds: state.expandedCollectionIds.includes(id)
        ? state.expandedCollectionIds.filter((cid) => cid !== id)
        : [...state.expandedCollectionIds, id],
    }));
  },
  
  // Filter actions
  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },
  
  setFilterTypes: (types) => {
    set({ filterTypes: types });
  },
  
  setFilterTags: (tags) => {
    set({ filterTags: tags });
  },
  
  setDateRange: (start, end) => {
    set({ dateRangeStart: start, dateRangeEnd: end });
  },
  
  setSortBy: (sort) => {
    set({ sortBy: sort });
  },
  
  clearFilters: () => {
    set({
      searchQuery: '',
      filterTypes: [],
      filterTags: [],
      dateRangeStart: null,
      dateRangeEnd: null,
    });
  },
  
  // Graph actions
  setSelectedRelationship: (id) => {
    set({ selectedRelationshipId: id });
  },
  
  setShowRelationshipEditor: (show) => {
    set({ showRelationshipEditor: show });
  },
}));