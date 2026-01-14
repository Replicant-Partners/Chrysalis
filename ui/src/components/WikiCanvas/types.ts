/**
 * Wiki Canvas - Type Definitions
 * 
 * Data models for MediaWiki-based collaborative knowledge base
 */

export interface WikiPage {
  id: string;
  title: string;
  content: string; // MediaWiki markup
  namespace: string; // Main, User, Talk, etc.
  categories: string[];
  revisionId: number;
  lastModified: number;
  lastEditor: string; // User or agent ID
  metadata: {
    wordCount: number;
    backlinks: string[]; // Pages linking to this one
    outlinks: string[]; // Pages this one links to
    isRedirect: boolean;
    redirectTarget?: string;
  };
}

export interface WikiCanvas {
  id: string;
  wikiUrl: string; // MediaWiki instance URL
  pages: Map<string, WikiPage>;
  zepConfig?: ZepIntegration;
  metadata: {
    createdAt: number;
    pageCount: number;
    lastUpdated: number;
    isBackground: boolean; // Can run invisibly
  };
}

export interface ZepIntegration {
  enabled: boolean;
  apiKey?: string;
  collectionName: string;
  syncMode: 'manual' | 'auto';
  lastSync?: number;
}

export interface WikiCanvasState {
  // UI State
  currentPageTitle: string | null;
  searchQuery: string;
  viewMode: 'read' | 'edit' | 'history' | 'search';
  selectedNamespace: string;
  isLoading: boolean;
  
  // MediaWiki connection
  wikiConnected: boolean;
  wikiUrl: string;
  
  // Actions
  loadPage: (title: string) => void;
  savePage: (title: string, content: string, summary: string) => void;
  searchPages: (query: string) => void;
  setViewMode: (mode: 'read' | 'edit' | 'history' | 'search') => void;
  syncToZep: () => void;
}