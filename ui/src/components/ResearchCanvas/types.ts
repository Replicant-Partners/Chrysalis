/**
 * Research Canvas - Type Definitions
 * 
 * Data models for the structured documentation canvas
 */

export type DocumentType = 'document' | 'folder' | 'note';

export interface ResearchDocument {
  id: string;
  type: DocumentType;
  title: string;
  content: string; // Markdown content
  parentId: string | null; // For hierarchy
  order: number; // Display order in tree
  tags: string[];
  createdAt: number;
  createdBy: string;
  updatedAt: number;
  metadata: {
    wordCount?: number;
    lastEditedBy?: string;
    isStarred?: boolean;
    wikiLinks?: string[]; // Extracted [[wiki-links]]
  };
}

export interface ResearchCanvas {
  id: string;
  title: string;
  documents: ResearchDocument[];
  tags: string[];
  metadata: {
    createdAt: number;
    documentCount: number;
    lastUpdated: number;
  };
}

export interface ResearchCanvasState {
  // UI State
  selectedDocumentId: string | null;
  expandedFolderIds: string[];
  isEditing: boolean;
  searchQuery: string;
  filterTags: string[];
  viewMode: 'edit' | 'preview' | 'split';
  
  // Actions
  createDocument: (doc: Omit<ResearchDocument, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateDocument: (id: string, updates: Partial<ResearchDocument>) => void;
  deleteDocument: (id: string) => void;
  moveDocument: (id: string, newParentId: string | null) => void;
  setSelectedDocument: (id: string | null) => void;
  toggleFolder: (id: string) => void;
  setSearchQuery: (query: string) => void;
  setViewMode: (mode: 'edit' | 'preview' | 'split') => void;
}