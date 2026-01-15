/**
 * Curation Canvas - Domain-focused Research Library
 * 
 * Multi-artifact collection with relationship management, timeline, and graph views
 */

import React, { useState, useMemo } from 'react';
import { Plus, Grid3x3, Clock, Network, Filter, Search } from 'lucide-react';
import { Button, Input } from '../design-system';
import { useCurationStore } from './store';
import { filterArtifacts, sortArtifacts } from './utils';
import { CollectionPanel } from './CollectionPanel';
import { ArtifactGrid } from './ArtifactGrid';
import { TimelineView } from './TimelineView';
import { GraphView } from './GraphView';
import { FilterBar } from './FilterBar';
import type { Artifact, Relationship, Collection, CurationCanvasProps } from './types';
import styles from './CurationCanvas.module.css';

// Mock data for demonstration
import { MOCK_ARTIFACTS, MOCK_RELATIONSHIPS, MOCK_COLLECTIONS } from './mockData';

export const CurationCanvas: React.FC<CurationCanvasProps> = () => {
  // Use mock data for now
  const [artifacts] = useState<Artifact[]>(MOCK_ARTIFACTS);
  const [relationships] = useState<Relationship[]>(MOCK_RELATIONSHIPS);
  const [collections] = useState<Collection[]>(MOCK_COLLECTIONS);
  
  const {
    viewMode,
    selectedCollectionId,
    searchQuery,
    filterTypes,
    filterTags,
    dateRangeStart,
    dateRangeEnd,
    sortBy,
    setViewMode,
    setSearchQuery,
  } = useCurationStore();
  
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter and sort artifacts
  const filteredArtifacts = useMemo(() => {
    const filtered = filterArtifacts(artifacts, {
      searchQuery,
      types: filterTypes,
      tags: filterTags,
      collectionId: selectedCollectionId,
      dateStart: dateRangeStart,
      dateEnd: dateRangeEnd,
    });
    
    return sortArtifacts(filtered, sortBy);
  }, [artifacts, searchQuery, filterTypes, filterTags, selectedCollectionId, dateRangeStart, dateRangeEnd, sortBy]);
  
  const hasActiveFilters = searchQuery || filterTypes.length > 0 || filterTags.length > 0 || 
                          dateRangeStart || dateRangeEnd || selectedCollectionId;
  
  return (
    <div className={styles.canvas}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h2 className={styles.title}>📦 Curation</h2>
          <p className={styles.subtitle}>
            AI Research Library • {artifacts.length} artifacts • {relationships.length} relationships
          </p>
        </div>
        
        <div className={styles.headerActions}>
          <div className={styles.searchBox}>
            <Search size={18} className={styles.searchIcon} />
            <Input
              type="text"
              placeholder="Search artifacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            iconBefore={<Filter size={18} />}
            onClick={() => setShowFilters(!showFilters)}
          >
            Filter
            {hasActiveFilters && <span className={styles.filterBadge}>{
              (filterTypes.length || 0) + 
              (filterTags.length || 0) + 
              (selectedCollectionId ? 1 : 0)
            }</span>}
          </Button>
          
          <div className={styles.viewModeButtons}>
            <button
              className={`${styles.viewModeButton} ${viewMode === 'grid' ? styles.active : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid View"
            >
              <Grid3x3 size={18} />
            </button>
            <button
              className={`${styles.viewModeButton} ${viewMode === 'timeline' ? styles.active : ''}`}
              onClick={() => setViewMode('timeline')}
              title="Timeline View"
            >
              <Clock size={18} />
            </button>
            <button
              className={`${styles.viewModeButton} ${viewMode === 'graph' ? styles.active : ''}`}
              onClick={() => setViewMode('graph')}
              title="Graph View"
            >
              <Network size={18} />
            </button>
          </div>
          
          <Button
            variant="primary"
            size="sm"
            iconBefore={<Plus size={18} />}
          >
            Add Artifact
          </Button>
        </div>
      </div>
      
      {/* Filter Bar */}
      {showFilters && (
        <FilterBar
          artifacts={artifacts}
          collections={collections}
          onClose={() => setShowFilters(false)}
        />
      )}
      
      {/* Main Content */}
      <div className={styles.content}>
        {/* Collection Panel */}
        <div className={styles.sidebar}>
          <CollectionPanel
            collections={collections}
            artifacts={artifacts}
          />
        </div>
        
        {/* View Area */}
        <div className={styles.main}>
          {viewMode === 'grid' && (
            <ArtifactGrid
              artifacts={filteredArtifacts}
              relationships={relationships}
            />
          )}
          
          {viewMode === 'timeline' && (
            <TimelineView
              artifacts={filteredArtifacts}
            />
          )}
          
          {viewMode === 'graph' && (
            <GraphView
              artifacts={filteredArtifacts}
              relationships={relationships}
            />
          )}
        </div>
      </div>
    </div>
  );
};