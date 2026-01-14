/**
 * TagFilter Component
 * 
 * Filter controls for tags and search
 */

import React from 'react';
import { Search, Tag, X, Filter } from 'lucide-react';
import { Input, Badge, Button } from '../design-system';
import styles from './TagFilter.module.css';

interface TagFilterProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterTags: string[];
  allTags: string[];
  onTagToggle: (tag: string) => void;
  onClearFilters: () => void;
  sortBy: 'date' | 'title' | 'type';
  onSortChange: (sort: 'date' | 'title' | 'type') => void;
}

export const TagFilter: React.FC<TagFilterProps> = ({
  searchQuery,
  onSearchChange,
  filterTags,
  allTags,
  onTagToggle,
  onClearFilters,
  sortBy,
  onSortChange,
}) => {
  const hasFilters = searchQuery || filterTags.length > 0;
  
  return (
    <div className={styles.container}>
      {/* Search Bar */}
      <div className={styles.searchRow}>
        <div className={styles.searchInput}>
          <Search size={20} className={styles.searchIcon} />
          <Input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={styles.input}
          />
          {searchQuery && (
            <button
              className={styles.clearButton}
              onClick={() => onSearchChange('')}
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>
        
        {/* Sort Options */}
        <div className={styles.sortControls}>
          <Filter size={16} />
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as 'date' | 'title' | 'type')}
            className={styles.sortSelect}
          >
            <option value="date">Recent First</option>
            <option value="title">Title A-Z</option>
            <option value="type">Type</option>
          </select>
        </div>
        
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
          >
            Clear Filters
          </Button>
        )}
      </div>
      
      {/* Tag Filters */}
      {allTags.length > 0 && (
        <div className={styles.tagRow}>
          <Tag size={16} className={styles.tagIcon} />
          <div className={styles.tagList}>
            {allTags.map((tag) => {
              const isActive = filterTags.includes(tag);
              return (
                <Badge
                  key={tag}
                  variant={isActive ? 'default' : 'default'}
                  className={`${styles.tagBadge} ${isActive ? styles.activeTag : ''}`}
                  onClick={() => onTagToggle(tag)}
                >
                  {tag}
                </Badge>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};