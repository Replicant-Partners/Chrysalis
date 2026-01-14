/**
 * Scrapbook Canvas - Type Definitions
 * 
 * Data models for the media collection canvas
 */

export type ScrapbookItemType = 'image' | 'video' | 'audio' | 'link' | 'note';

export type ScrapbookItemStatus = 'uploading' | 'ready' | 'error';

export interface ScrapbookItem {
  id: string;
  type: ScrapbookItemType;
  title: string;
  content?: string; // For notes, link URLs
  url?: string; // For uploaded media
  thumbnail?: string; // Thumbnail URL
  tags: string[];
  createdAt: number;
  createdBy: string;
  status: ScrapbookItemStatus;
  metadata: {
    size?: number; // File size in bytes
    duration?: number; // For audio/video
    dimensions?: { width: number; height: number }; // For images/video
    mimeType?: string;
  };
}

export interface ScrapbookCanvas {
  id: string;
  title: string;
  items: ScrapbookItem[];
  tags: string[]; // All unique tags across items
  metadata: {
    createdAt: number;
    itemCount: number;
    lastUpdated: number;
  };
}

export interface ScrapbookCanvasState {
  // UI State
  viewMode: 'grid' | 'list';
  selectedItemId: string | null;
  lightboxItemId: string | null;
  filterTags: string[];
  searchQuery: string;
  sortBy: 'date' | 'title' | 'type';
  
  // Actions
  addItem: (item: Omit<ScrapbookItem, 'id' | 'createdAt'>) => void;
  updateItem: (id: string, updates: Partial<ScrapbookItem>) => void;
  deleteItem: (id: string) => void;
  setSelectedItem: (id: string | null) => void;
  setLightboxItem: (id: string | null) => void;
  setFilterTags: (tags: string[]) => void;
  setSearchQuery: (query: string) => void;
  addTag: (itemId: string, tag: string) => void;
  removeTag: (itemId: string, tag: string) => void;
}