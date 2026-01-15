/**
 * Collection Panel Component
 * 
 * Hierarchical collection tree with folders and tags
 */

import React, { useMemo } from 'react';
import { ChevronRight, ChevronDown, Plus, Folder, Tag } from 'lucide-react';
import { Button } from '../design-system';
import { useCurationStore } from './store';
import type { Collection, Artifact } from './types';
import styles from './CollectionPanel.module.css';

interface CollectionPanelProps {
  collections: Collection[];
  artifacts: Artifact[];
}

export const CollectionPanel: React.FC<CollectionPanelProps> = ({
  collections,
  artifacts,
}) => {
  const {
    selectedCollectionId,
    expandedCollectionIds,
    setSelectedCollection,
    toggleCollection,
  } = useCurationStore();
  
  // Separate folders and tags
  const folders = useMemo(() => 
    collections.filter(c => c.type === 'folder').sort((a, b) => a.order - b.order),
    [collections]
  );
  
  const tags = useMemo(() => 
    collections.filter(c => c.type === 'tag').sort((a, b) => a.order - b.order),
    [collections]
  );
  
  // Build folder hierarchy
  const rootFolders = useMemo(() => 
    folders.filter(f => !f.parentId),
    [folders]
  );
  
  const getChildFolders = (parentId: string) => {
    return folders.filter(f => f.parentId === parentId);
  };
  
  // Count artifacts in each collection
  const getArtifactCount = (collectionId: string) => {
    return artifacts.filter(a => a.collectionIds.includes(collectionId)).length;
  };
  
  const renderFolder = (folder: Collection, level: number = 0) => {
    const isExpanded = expandedCollectionIds.includes(folder.id);
    const isSelected = selectedCollectionId === folder.id;
    const childFolders = getChildFolders(folder.id);
    const hasChildren = childFolders.length > 0;
    const count = getArtifactCount(folder.id);
    
    return (
      <div key={folder.id} className={styles.folderItem}>
        <div 
          className={`${styles.folderHeader} ${isSelected ? styles.selected : ''}`}
          style={{ paddingLeft: `${level * 16 + 12}px` }}
          onClick={() => setSelectedCollection(isSelected ? null : folder.id)}
        >
          {hasChildren && (
            <button
              className={styles.expandButton}
              onClick={(e) => {
                e.stopPropagation();
                toggleCollection(folder.id);
              }}
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          )}
          
          <span className={styles.folderIcon} style={{ color: folder.color }}>
            {folder.icon || '📁'}
          </span>
          
          <span className={styles.folderName}>{folder.name}</span>
          
          {count > 0 && (
            <span className={styles.count}>{count}</span>
          )}
        </div>
        
        {hasChildren && isExpanded && (
          <div className={styles.folderChildren}>
            {childFolders.map(child => renderFolder(child, level + 1))}
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <h3 className={styles.title}>Collections</h3>
        <Button
          variant="ghost"
          size="sm"
          iconBefore={<Plus size={16} />}
        >
          New
        </Button>
      </div>
      
      {/* All Artifacts */}
      <div 
        className={`${styles.allItems} ${selectedCollectionId === null ? styles.selected : ''}`}
        onClick={() => setSelectedCollection(null)}
      >
        <Folder size={18} className={styles.allItemsIcon} />
        <span className={styles.allItemsLabel}>All Artifacts</span>
        <span className={styles.count}>{artifacts.length}</span>
      </div>
      
      {/* Folders */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Folders</div>
        <div className={styles.folderList}>
          {rootFolders.map(folder => renderFolder(folder))}
        </div>
      </div>
      
      {/* Tags */}
      {tags.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Tags</div>
          <div className={styles.tagList}>
            {tags.map(tag => {
              const isSelected = selectedCollectionId === tag.id;
              const count = getArtifactCount(tag.id);
              
              return (
                <div
                  key={tag.id}
                  className={`${styles.tagItem} ${isSelected ? styles.selected : ''}`}
                  onClick={() => setSelectedCollection(isSelected ? null : tag.id)}
                >
                  <Tag size={14} className={styles.tagIcon} style={{ color: tag.color }} />
                  <span className={styles.tagName}>{tag.name}</span>
                  {count > 0 && (
                    <span className={styles.count}>{count}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};