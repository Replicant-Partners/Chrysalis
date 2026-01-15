/**
 * Filter Bar Component
 * 
 * Collapsible filter controls for artifacts
 */

import React from 'react';
import { X } from 'lucide-react';
import { Button } from '../design-system';
import { useCurationStore } from './store';
import { getArtifactTypeLabel } from './utils';
import type { Artifact, Collection, ArtifactType } from './types';
import styles from './FilterBar.module.css';

interface FilterBarProps {
  artifacts: Artifact[];
  collections: Collection[]; // eslint-disable-line @typescript-eslint/no-unused-vars
  onClose: () => void;
}

const ARTIFACT_TYPES: ArtifactType[] = ['document', 'media', 'code', 'data', 'link', 'note'];

export const FilterBar: React.FC<FilterBarProps> = ({
  artifacts,
  onClose,
}) => {
  const {
    filterTypes,
    filterTags,
    setFilterTypes,
    setFilterTags,
    clearFilters,
  } = useCurationStore();
  
  // Get all unique tags
  const allTags = Array.from(new Set(artifacts.flatMap(a => a.tags))).sort();
  
  const handleTypeToggle = (type: ArtifactType) => {
    if (filterTypes.includes(type)) {
      setFilterTypes(filterTypes.filter(t => t !== type));
    } else {
      setFilterTypes([...filterTypes, type]);
    }
  };
  
  const handleTagToggle = (tag: string) => {
    if (filterTags.includes(tag)) {
      setFilterTags(filterTags.filter(t => t !== tag));
    } else {
      setFilterTags([...filterTags, tag]);
    }
  };
  
  const hasFilters = filterTypes.length > 0 || filterTags.length > 0;
  
  return (
    <div className={styles.filterBar}>
      <div className={styles.filterHeader}>
        <span className={styles.filterTitle}>Filters</span>
        <div className={styles.filterHeaderActions}>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
            >
              Clear All
            </Button>
          )}
          <button
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close filters"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      
      <div className={styles.filterContent}>
        {/* Type Filters */}
        <div className={styles.filterSection}>
          <div className={styles.filterSectionTitle}>Type</div>
          <div className={styles.filterChips}>
            {ARTIFACT_TYPES.map((type) => (
              <button
                key={type}
                className={`${styles.filterChip} ${filterTypes.includes(type) ? styles.active : ''}`}
                onClick={() => handleTypeToggle(type)}
              >
                {getArtifactTypeLabel(type)}
              </button>
            ))}
          </div>
        </div>
        
        {/* Tag Filters */}
        <div className={styles.filterSection}>
          <div className={styles.filterSectionTitle}>Tags</div>
          <div className={styles.filterChips}>
            {allTags.length === 0 ? (
              <span className={styles.emptyText}>No tags available</span>
            ) : (
              allTags.map((tag) => (
                <button
                  key={tag}
                  className={`${styles.filterChip} ${filterTags.includes(tag) ? styles.active : ''}`}
                  onClick={() => handleTagToggle(tag)}
                >
                  #{tag}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};