/**
 * ScrapbookGrid Component
 * 
 * Masonry grid layout for scrapbook items
 */

import React, { useMemo } from 'react';
import { ScrapbookItem } from './ScrapbookItem';
import type { ScrapbookItem as ScrapbookItemType } from './types';
import styles from './ScrapbookGrid.module.css';

interface ScrapbookGridProps {
  items: ScrapbookItemType[];
  onItemSelect: (id: string) => void;
  onItemDelete: (id: string) => void;
  onTagRemove: (itemId: string, tag: string) => void;
  onOpenLightbox: (id: string) => void;
  searchQuery: string;
  filterTags: string[];
  sortBy: 'date' | 'title' | 'type';
}

export const ScrapbookGrid: React.FC<ScrapbookGridProps> = ({
  items,
  onItemSelect,
  onItemDelete,
  onTagRemove,
  onOpenLightbox,
  searchQuery,
  filterTags,
  sortBy,
}) => {
  // Filter and sort items
  const filteredItems = useMemo(() => {
    let filtered = items;
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(query) ||
        item.content?.toLowerCase().includes(query) ||
        item.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    // Filter by tags
    if (filterTags.length > 0) {
      filtered = filtered.filter(item =>
        filterTags.every(tag => item.tags.includes(tag))
      );
    }
    
    // Sort items
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return b.createdAt - a.createdAt;
        case 'title':
          return a.title.localeCompare(b.title);
        case 'type':
          return a.type.localeCompare(b.type);
        default:
          return 0;
      }
    });
    
    return sorted;
  }, [items, searchQuery, filterTags, sortBy]);
  
  if (filteredItems.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>
          {searchQuery || filterTags.length > 0
            ? 'No items match your filters'
            : 'No items yet. Upload some files to get started!'}
        </p>
      </div>
    );
  }
  
  return (
    <div className={styles.grid}>
      {filteredItems.map((item) => (
        <ScrapbookItem
          key={item.id}
          item={item}
          onSelect={onItemSelect}
          onDelete={onItemDelete}
          onTagRemove={onTagRemove}
          onOpenLightbox={onOpenLightbox}
        />
      ))}
    </div>
  );
};