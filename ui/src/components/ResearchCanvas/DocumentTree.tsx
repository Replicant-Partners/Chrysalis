/**
 * DocumentTree Component
 * 
 * Hierarchical tree view of documents and folders
 */

import React from 'react';
import { Folder, FileText, ChevronRight, ChevronDown, Star } from 'lucide-react';
import type { ResearchDocument } from './types';
import styles from './DocumentTree.module.css';

interface DocumentTreeProps {
  documents: ResearchDocument[];
  selectedId: string | null;
  expandedIds: string[];
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}

interface TreeNodeProps {
  document: ResearchDocument;
  children: ResearchDocument[];
  allDocuments: ResearchDocument[];
  level: number;
  selectedId: string | null;
  expandedIds: string[];
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  document,
  children,
  allDocuments,
  level,
  selectedId,
  expandedIds,
  onSelect,
  onToggle,
}) => {
  const isFolder = document.type === 'folder';
  const isExpanded = expandedIds.includes(document.id);
  const isSelected = selectedId === document.id;
  const hasChildren = children.length > 0;
  
  return (
    <div className={styles.treeNode}>
      <div
        className={`${styles.nodeContent} ${isSelected ? styles.selected : ''}`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onSelect(document.id)}
      >
        {isFolder && hasChildren && (
          <button
            className={styles.chevron}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(document.id);
            }}
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        )}
        
        {!hasChildren && <span className={styles.spacer} />}
        
        <span className={styles.icon}>
          {isFolder ? (
            <Folder size={16} />
          ) : (
            <FileText size={16} />
          )}
        </span>
        
        <span className={styles.title}>{document.title}</span>
        
        {document.metadata.isStarred && (
          <Star size={14} className={styles.star} />
        )}
      </div>
      
      {isFolder && isExpanded && hasChildren && (
        <div className={styles.children}>
          {children.map((child) => {
            const childChildren = allDocuments.filter(d => d.parentId === child.id);
            return (
              <TreeNode
                key={child.id}
                document={child}
                children={childChildren}
                allDocuments={allDocuments}
                level={level + 1}
                selectedId={selectedId}
                expandedIds={expandedIds}
                onSelect={onSelect}
                onToggle={onToggle}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export const DocumentTree: React.FC<DocumentTreeProps> = ({
  documents,
  selectedId,
  expandedIds,
  onSelect,
  onToggle,
}) => {
  // Build tree structure
  const rootDocuments = documents.filter(d => d.parentId === null);
  
  if (documents.length === 0) {
    return (
      <div className={styles.empty}>
        <FileText size={48} className={styles.emptyIcon} />
        <p className={styles.emptyText}>No documents yet</p>
      </div>
    );
  }
  
  return (
    <div className={styles.tree}>
      {rootDocuments.map((doc) => {
        const children = documents.filter(d => d.parentId === doc.id);
        return (
          <TreeNode
            key={doc.id}
            document={doc}
            children={children}
            allDocuments={documents}
            level={0}
            selectedId={selectedId}
            expandedIds={expandedIds}
            onSelect={onSelect}
            onToggle={onToggle}
          />
        );
      })}
    </div>
  );
};