/**
 * Wiki Canvas - Zustand Store
 * 
 * Local UI state management for Wiki Canvas
 */

import { create } from 'zustand';
import type { WikiCanvasState } from './types';
import * as MediaWikiAPI from './mediawiki-api';

export const useWikiStore = create<WikiCanvasState>((set, get) => ({
  // Initial state
  currentPageTitle: 'Main_Page',
  searchQuery: '',
  viewMode: 'read',
  selectedNamespace: 'Main',
  isLoading: false,
  wikiConnected: false,
  wikiUrl: 'http://localhost:8080', // Default local MediaWiki
  
  // Actions
  loadPage: async (title) => {
    set({ currentPageTitle: title, isLoading: true });
    
    try {
      const page = await MediaWikiAPI.getPage(get().wikiUrl, title);
      
      if (page) {
        set({ 
          currentPageTitle: page.title,
          isLoading: false,
          wikiConnected: true 
        });
      } else {
        set({ 
          isLoading: false,
          wikiConnected: false 
        });
      }
    } catch (error) {
      console.error('Error loading page:', error);
      set({ 
        isLoading: false,
        wikiConnected: false 
      });
    }
  },
  
  savePage: async (title, content, summary) => {
    set({ isLoading: true });
    
    try {
      const success = await MediaWikiAPI.savePage(
        get().wikiUrl,
        title,
        content,
        summary
      );
      
      if (success) {
        // Reload the page to show saved content
        get().loadPage(title);
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Error saving page:', error);
      set({ isLoading: false });
    }
  },
  
  searchPages: async (query) => {
    set({ searchQuery: query, isLoading: true });
    
    try {
      const results = await MediaWikiAPI.searchPages(get().wikiUrl, query);
      console.log('Search results:', results);
      set({ isLoading: false });
      // TODO: Store search results in state if needed
    } catch (error) {
      console.error('Error searching pages:', error);
      set({ isLoading: false });
    }
  },
  
  setViewMode: (mode) => {
    set({ viewMode: mode });
  },
  
  syncToZep: async () => {
    console.log('Syncing to Zep knowledge graph...');
    // TODO: Implement Zep sync when Zep integration is ready
    // This would involve:
    // 1. Fetching current page content
    // 2. Parsing and extracting entities
    // 3. Sending to Zep API
    // 4. Showing success/error feedback
  },
}));