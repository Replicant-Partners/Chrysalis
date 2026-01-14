/**
 * ResearchCanvas Component
 * 
 * Structured documentation canvas with hierarchical structure and markdown editing
 */

import React, { useState, useCallback } from 'react';
import { FilePlus, FolderPlus, Search, Edit3, Eye, Columns } from 'lucide-react';
import { Button } from '../design-system';
import { DocumentTree } from './DocumentTree';
import { DocumentEditor } from './DocumentEditor';
import { DocumentViewer } from './DocumentViewer';
import { SearchPanel } from './SearchPanel';
import { useResearchStore } from './store';
import type { ResearchDocument } from './types';
import styles from './ResearchCanvas.module.css';

// Mock data for demonstration
const MOCK_DOCUMENTS: ResearchDocument[] = [
  {
    id: '1',
    type: 'folder',
    title: 'Project Documentation',
    content: '',
    parentId: null,
    order: 0,
    tags: [],
    createdAt: Date.now() - 86400000 * 7,
    createdBy: 'user-1',
    updatedAt: Date.now() - 86400000,
    metadata: {},
  },
  {
    id: '2',
    type: 'document',
    title: 'Getting Started',
    content: `# Getting Started

Welcome to the Research Canvas! This is a powerful tool for organizing your documentation.

## Features

- **Hierarchical structure** - Organize documents in folders
- **Markdown support** - Full markdown editing with syntax highlighting
- **Wiki-links** - Link between documents using [[Page Name]] syntax
- **Full-text search** - Search across all documents
- **Tags** - Organize with flexible tagging

## Quick Tips

1. Create folders to organize your work
2. Use markdown for formatting
3. Link related documents with [[wiki-links]]
4. Use the search to find anything quickly

Happy writing!`,
    parentId: '1',
    order: 0,
    tags: ['guide', 'tutorial'],
    createdAt: Date.now() - 86400000 * 7,
    createdBy: 'user-1',
    updatedAt: Date.now() - 86400000 * 2,
    metadata: {
      wordCount: 80,
      isStarred: true,
      wikiLinks: [],
    },
  },
  {
    id: '3',
    type: 'document',
    title: 'Architecture Notes',
    content: `# Architecture Overview

## System Design

The system follows a three-tier architecture:

\`\`\`typescript
interface SystemArchitecture {
  frontend: 'React + TypeScript';
  backend: 'Node.js + Express';
  database: 'PostgreSQL';
}
\`\`\`

## Key Components

- **UI Layer** - React components
- **API Layer** - REST endpoints
- **Data Layer** - Database models

> **Note:** See [[Getting Started]] for more details.`,
    parentId: '1',
    order: 1,
    tags: ['architecture', 'technical'],
    createdAt: Date.now() - 86400000 * 5,
    createdBy: 'user-1',
    updatedAt: Date.now() - 86400000,
    metadata: {
      wordCount: 45,
      wikiLinks: ['Getting Started'],
    },
  },
];

export const ResearchCanvas: React.FC = () => {
  const [documents, setDocuments] = useState<ResearchDocument[]>(MOCK_DOCUMENTS);
  const [searchOpen, setSearchOpen] = useState(false);
  
  const {
    selectedDocumentId,
    expandedFolderIds,
    searchQuery,
    viewMode,
    setSelectedDocument,
    toggleFolder,
    setSearchQuery,
    setViewMode,
  } = useResearchStore();
  
  const selectedDocument = documents.find(d => d.id === selectedDocumentId);
  
  // Handle document content update
  const handleContentChange = useCallback((content: string) => {
    if (!selectedDocumentId) return;
    
    setDocuments(prev => prev.map(doc =>
      doc.id === selectedDocumentId
        ? { ...doc, content, updatedAt: Date.now() }
        : doc
    ));
  }, [selectedDocumentId]);
  
  // Handle wiki-link clicks
  const handleWikiLinkClick = useCallback((linkText: string) => {
    const targetDoc = documents.find(d => d.title === linkText);
    if (targetDoc) {
      setSelectedDocument(targetDoc.id);
    }
  }, [documents, setSelectedDocument]);
  
  return (
    <div className={styles.canvas}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h2 className={styles.title}>
            📚 Research
          </h2>
          <p className={styles.subtitle}>
            Structured documentation and knowledge organization
          </p>
        </div>
        
        <div className={styles.headerActions}>
          <Button
            variant="ghost"
            size="sm"
            iconBefore={<Search size={18} />}
            onClick={() => setSearchOpen(!searchOpen)}
          >
            Search
          </Button>
          <Button
            variant="ghost"
            size="sm"
            iconBefore={<FolderPlus size={18} />}
          >
            New Folder
          </Button>
          <Button
            variant="primary"
            size="sm"
            iconBefore={<FilePlus size={18} />}
          >
            New Document
          </Button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className={styles.content}>
        {/* Sidebar */}
        <div className={styles.sidebar}>
          {searchOpen ? (
            <SearchPanel
              query={searchQuery}
              documents={documents}
              onQueryChange={setSearchQuery}
              onSelectDocument={(id) => {
                setSelectedDocument(id);
                setSearchOpen(false);
              }}
            />
          ) : (
            <DocumentTree
              documents={documents}
              selectedId={selectedDocumentId}
              expandedIds={expandedFolderIds}
              onSelect={setSelectedDocument}
              onToggle={toggleFolder}
            />
          )}
        </div>
        
        {/* Editor/Viewer */}
        <div className={styles.main}>
          {!selectedDocument ? (
            <div className={styles.emptyState}>
              <FilePlus size={64} className={styles.emptyIcon} />
              <h3 className={styles.emptyTitle}>No document selected</h3>
              <p className={styles.emptyText}>
                Select a document from the tree or create a new one
              </p>
            </div>
          ) : selectedDocument.type === 'folder' ? (
            <div className={styles.emptyState}>
              <FolderPlus size={64} className={styles.emptyIcon} />
              <h3 className={styles.emptyTitle}>{selectedDocument.title}</h3>
              <p className={styles.emptyText}>
                This is a folder. Select a document to view or edit it.
              </p>
            </div>
          ) : (
            <>
              {/* Document Header */}
              <div className={styles.documentHeader}>
                <h3 className={styles.documentTitle}>{selectedDocument.title}</h3>
                
                <div className={styles.viewModeButtons}>
                  <button
                    className={`${styles.viewModeButton} ${viewMode === 'edit' ? styles.active : ''}`}
                    onClick={() => setViewMode('edit')}
                    title="Edit mode"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    className={`${styles.viewModeButton} ${viewMode === 'split' ? styles.active : ''}`}
                    onClick={() => setViewMode('split')}
                    title="Split mode"
                  >
                    <Columns size={16} />
                  </button>
                  <button
                    className={`${styles.viewModeButton} ${viewMode === 'preview' ? styles.active : ''}`}
                    onClick={() => setViewMode('preview')}
                    title="Preview mode"
                  >
                    <Eye size={16} />
                  </button>
                </div>
              </div>
              
              {/* Document Content */}
              <div className={styles.documentContent}>
                {viewMode === 'edit' && (
                  <DocumentEditor
                    content={selectedDocument.content}
                    onChange={handleContentChange}
                  />
                )}
                
                {viewMode === 'preview' && (
                  <DocumentViewer
                    content={selectedDocument.content}
                    onWikiLinkClick={handleWikiLinkClick}
                  />
                )}
                
                {viewMode === 'split' && (
                  <div className={styles.splitView}>
                    <DocumentEditor
                      content={selectedDocument.content}
                      onChange={handleContentChange}
                    />
                    <div className={styles.splitDivider} />
                    <DocumentViewer
                      content={selectedDocument.content}
                      onWikiLinkClick={handleWikiLinkClick}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};