/**
 * Wiki Canvas - Zustand Store
 * 
 * Local UI state management for Wiki Canvas
 */

import { create } from 'zustand';
import type { WikiCanvasState } from './types';

export const useWikiStore = create<WikiCanvasState>((set) => ({
  // Initial state
  currentPageTitle: 'Main_Page',
  searchQuery: '',
  viewMode: 'read',
  selectedNamespace: 'Main',
  isLoading: false,
  wikiConnected: false,
  wikiUrl: 'http://localhost:8080', // Default local MediaWiki
  
  // Actions
  loadPage: (title) => {
    set({ currentPageTitle: title, isLoading: true });
    // TODO: Implement MediaWiki API call
    setTimeout(() => set({ isLoading: false }), 500);
  },
  
  savePage: (title, content, summary) => {
    console.log('Save page:', title, content.substring(0, 50), summary);
    set({ isLoading: true });
    // TODO: Implement MediaWiki API save
    setTimeout(() => set({ isLoading: false }), 500);
  },
  
  searchPages: (query) => {
    set({ searchQuery: query });
    // TODO: Implement MediaWiki search
  },
  
  setViewMode: (mode) => {
    set({ viewMode: mode });
  },
  
  syncToZep: () => {
    console.log('Syncing to Zep knowledge graph...');
    // TODO: Implement Zep sync
  },
}));