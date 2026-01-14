/**
 * ScrapbookCanvas Component
 * 
 * Media collection canvas with masonry grid, tagging, and lightbox viewer
 */

import React, { useState, useCallback } from 'react';
import { Upload, Grid, List } from 'lucide-react';
import { Button } from '../design-system';
import { FileUpload } from './FileUpload';
import { ScrapbookGrid } from './ScrapbookGrid';
import { TagFilter } from './TagFilter';
import { Lightbox } from './Lightbox';
import { useScrapbookStore } from './store';
import type { ScrapbookItem, ScrapbookItemType } from './types';
import styles from './ScrapbookCanvas.module.css';

// Mock data for demonstration
const MOCK_ITEMS: ScrapbookItem[] = [
  {
    id: '1',
    type: 'image',
    title: 'Mountain Landscape',
    url: 'https://picsum.photos/400/300',
    thumbnail: 'https://picsum.photos/400/300',
    tags: ['nature', 'landscape'],
    createdAt: Date.now() - 86400000,
    createdBy: 'user-1',
    status: 'ready',
    metadata: {
      size: 1024000,
      dimensions: { width: 400, height: 300 },
      mimeType: 'image/jpeg',
    },
  },
  {
    id: '2',
    type: 'note',
    title: 'Project Ideas',
    content: 'Some interesting ideas for the next project iteration...',
    tags: ['planning', 'ideas'],
    createdAt: Date.now() - 172800000,
    createdBy: 'user-1',
    status: 'ready',
    metadata: {},
  },
  {
    id: '3',
    type: 'image',
    title: 'Architecture Design',
    url: 'https://picsum.photos/400/600',
    thumbnail: 'https://picsum.photos/400/600',
    tags: ['architecture', 'design'],
    createdAt: Date.now() - 259200000,
    createdBy: 'user-1',
    status: 'ready',
    metadata: {
      size: 2048000,
      dimensions: { width: 400, height: 600 },
      mimeType: 'image/jpeg',
    },
  },
];

export const ScrapbookCanvas: React.FC = () => {
  const [items, setItems] = useState<ScrapbookItem[]>(MOCK_ITEMS);
  const [showUpload, setShowUpload] = useState(false);
  
  const {
    selectedItemId,
    lightboxItemId,
    searchQuery,
    filterTags,
    sortBy,
    setSelectedItem,
    setLightboxItem,
    setSearchQuery,
    setFilterTags,
  } = useScrapbookStore();
  
  // Get all unique tags
  const allTags = Array.from(new Set(items.flatMap(item => item.tags))).sort();
  
  // Handle file uploads
  const handleFilesSelected = useCallback((files: File[]) => {
    console.log('Files selected:', files);
    // TODO: Implement file upload logic
    // For now, just close the upload dialog
    setShowUpload(false);
  }, []);
  
  // Handle item deletion
  const handleItemDelete = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);
  
  // Handle tag removal
  const handleTagRemove = useCallback((itemId: string, tag: string) => {
    setItems(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, tags: item.tags.filter(t => t !== tag) }
        : item
    ));
  }, []);
  
  // Handle tag filter toggle
  const handleTagToggle = useCallback((tag: string) => {
    setFilterTags(
      filterTags.includes(tag)
        ? filterTags.filter(t => t !== tag)
        : [...filterTags, tag]
    );
  }, [filterTags, setFilterTags]);
  
  // Handle lightbox navigation
  const handleLightboxNavigate = useCallback((direction: 'prev' | 'next') => {
    if (!lightboxItemId) return;
    
    const mediaItems = items.filter(item => item.type === 'image' || item.type === 'video');
    const currentIndex = mediaItems.findIndex(item => item.id === lightboxItemId);
    
    if (direction === 'prev' && currentIndex > 0) {
      setLightboxItem(mediaItems[currentIndex - 1].id);
    } else if (direction === 'next' && currentIndex < mediaItems.length - 1) {
      setLightboxItem(mediaItems[currentIndex + 1].id);
    }
  }, [lightboxItemId, items, setLightboxItem]);
  
  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setFilterTags([]);
  }, [setSearchQuery, setFilterTags]);
  
  const lightboxItem = lightboxItemId ? items.find(i => i.id === lightboxItemId) : null;
  
  return (
    <div className={styles.canvas}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h2 className={styles.title}>
            📚 Scrapbook
          </h2>
          <p className={styles.subtitle}>
            Quick media collection with tagging and search
          </p>
        </div>
        
        <div className={styles.headerActions}>
          <Button
            variant="primary"
            size="md"
            iconBefore={<Upload size={20} />}
            onClick={() => setShowUpload(!showUpload)}
          >
            Upload Files
          </Button>
        </div>
      </div>
      
      {/* Filter Controls */}
      <TagFilter
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filterTags={filterTags}
        allTags={allTags}
        onTagToggle={handleTagToggle}
        onClearFilters={handleClearFilters}
        sortBy={sortBy}
        onSortChange={(sort) => useScrapbookStore.setState({ sortBy: sort })}
      />
      
      {/* Content */}
      <div className={styles.content}>
        {showUpload ? (
          <FileUpload onFilesSelected={handleFilesSelected} />
        ) : items.length === 0 ? (
          <div className={styles.emptyState}>
            <Upload size={64} className={styles.emptyIcon} />
            <h3 className={styles.emptyTitle}>No items yet</h3>
            <p className={styles.emptyText}>
              Upload images, videos, audio files, or create notes to get started
            </p>
            <Button
              variant="primary"
              size="lg"
              iconBefore={<Upload size={20} />}
              onClick={() => setShowUpload(true)}
            >
              Upload Your First Item
            </Button>
          </div>
        ) : (
          <ScrapbookGrid
            items={items}
            onItemSelect={setSelectedItem}
            onItemDelete={handleItemDelete}
            onTagRemove={handleTagRemove}
            onOpenLightbox={setLightboxItem}
            searchQuery={searchQuery}
            filterTags={filterTags}
            sortBy={sortBy}
          />
        )}
      </div>
      
      {/* Lightbox */}
      {lightboxItem && (
        <Lightbox
          item={lightboxItem}
          items={items.filter(i => i.type === 'image' || i.type === 'video')}
          onClose={() => setLightboxItem(null)}
          onNavigate={handleLightboxNavigate}
        />
      )}
    </div>
  );
};