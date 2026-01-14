/**
 * SearchPanel Component
 * 
 * Full-text search across all documents
 */

import React from 'react';
import { Search, X, FileText } from 'lucide-react';
import { Input } from '../design-system';
import type { ResearchDocument } from './types';
import styles from './SearchPanel.module.css';

interface SearchPanelProps {
  query: string;
  documents: ResearchDocument[];
  onQueryChange: (query: string) => void;
  onSelectDocument: (id: string) => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  query,
  documents,
  onQueryChange,
  onSelectDocument,
}) => {
  // Search across title and content
  const results = React.useMemo(() => {
    if (!query.trim()) return [];
    
    const lowerQuery = query.toLowerCase();
    return documents.filter(doc => 
      doc.title.toLowerCase().includes(lowerQuery) ||
      doc.content.toLowerCase().includes(lowerQuery)
    ).map(doc => {
      // Find context around match
      const contentLower = doc.content.toLowerCase();
      const matchIndex = contentLower.indexOf(lowerQuery);
      const start = Math.max(0, matchIndex - 50);
      const end = Math.min(doc.content.length, matchIndex + query.length + 50);
      const context = doc.content.substring(start, end);
      
      return {
        ...doc,
        context: (start > 0 ? '...' : '') + context + (end < doc.content.length ? '...' : ''),
      };
    });
  }, [query, documents]);
  
  return (
    <div className={styles.panel}>
      {/* Search Input */}
      <div className={styles.searchBox}>
        <Search size={20} className={styles.searchIcon} />
        <Input
          type="text"
          placeholder="Search documents..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className={styles.input}
        />
        {query && (
          <button
            className={styles.clearButton}
            onClick={() => onQueryChange('')}
            title="Clear search"
          >
            <X size={16} />
          </button>
        )}
      </div>
      
      {/* Results */}
      {query && (
        <div className={styles.results}>
          {results.length === 0 ? (
            <div className={styles.noResults}>
              <p>No documents found</p>
            </div>
          ) : (
            <>
              <div className={styles.resultCount}>
                {results.length} result{results.length !== 1 ? 's' : ''}
              </div>
              {results.map((result) => (
                <div
                  key={result.id}
                  className={styles.resultItem}
                  onClick={() => onSelectDocument(result.id)}
                >
                  <div className={styles.resultHeader}>
                    <FileText size={16} className={styles.resultIcon} />
                    <span className={styles.resultTitle}>{result.title}</span>
                  </div>
                  <p className={styles.resultContext}>{result.context}</p>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};