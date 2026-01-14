/**
 * WikiCanvas Component
 * 
 * Collaborative knowledge base using MediaWiki
 * Can run in background as project knowledge base
 * Supports agent collaborative editing and optional Zep integration
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Book, Search, Edit, Clock, Database, RefreshCw } from 'lucide-react';
import { Button, Input } from '../design-system';
import { useWikiStore } from './store';
import styles from './WikiCanvas.module.css';

interface WikiCanvasProps {
  wikiUrl?: string;
  isBackground?: boolean; // Can run invisibly
}

export const WikiCanvas: React.FC<WikiCanvasProps> = ({
  wikiUrl = 'http://localhost:8080',
  isBackground = false,
}) => {
  const {
    currentPageTitle,
    viewMode,
    isLoading,
    wikiConnected,
    loadPage,
    setViewMode,
    syncToZep,
  } = useWikiStore();
  
  const [iframeUrl, setIframeUrl] = useState<string>('');
  const [zepEnabled, setZepEnabled] = useState(false);
  
  // Construct MediaWiki URL
  useEffect(() => {
    if (currentPageTitle) {
      const encodedTitle = encodeURIComponent(currentPageTitle);
      const action = viewMode === 'edit' ? 'action=edit' : '';
      setIframeUrl(`${wikiUrl}/index.php?title=${encodedTitle}${action ? '&' + action : ''}`);
    } else {
      setIframeUrl(`${wikiUrl}/index.php`);
    }
  }, [currentPageTitle, viewMode, wikiUrl]);
  
  const handlePageLoad = useCallback((title: string) => {
    loadPage(title);
  }, [loadPage]);
  
  const handleZepSync = useCallback(() => {
    syncToZep();
  }, [syncToZep]);
  
  if (isBackground) {
    // Background mode - minimal UI, agents can still access via API
    return (
      <div className={styles.backgroundMode}>
        <div className={styles.backgroundIndicator}>
          <Database size={32} />
          <p>Wiki running in background</p>
          <p className={styles.backgroundUrl}>{wikiUrl}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className={styles.canvas}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h2 className={styles.title}>
            📚 Wiki
          </h2>
          <p className={styles.subtitle}>
            Collaborative knowledge base • {wikiConnected ? 'Connected' : 'Disconnected'}
          </p>
        </div>
        
        <div className={styles.headerActions}>
          <Button
            variant="ghost"
            size="sm"
            iconBefore={<Search size={18} />}
            onClick={() => setViewMode('search')}
          >
            Search
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            iconBefore={<Clock size={18} />}
            onClick={() => setViewMode('history')}
          >
            History
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            iconBefore={<Edit size={18} />}
            onClick={() => setViewMode('edit')}
          >
            Edit
          </Button>
          
          {zepEnabled && (
            <Button
              variant="ghost"
              size="sm"
              iconBefore={<RefreshCw size={18} />}
              onClick={handleZepSync}
            >
              Sync to Zep
            </Button>
          )}
        </div>
      </div>
      
      {/* Wiki Controls */}
      <div className={styles.controls}>
        <div className={styles.pageTitle}>
          <Book size={20} />
          <Input
            type="text"
            placeholder="Page title..."
            value={currentPageTitle || ''}
            onChange={(e) => handlePageLoad(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handlePageLoad(currentPageTitle || 'Main_Page');
              }
            }}
          />
        </div>
        
        <div className={styles.modeSwitch}>
          <button
            className={`${styles.modeButton} ${viewMode === 'read' ? styles.active : ''}`}
            onClick={() => setViewMode('read')}
          >
            Read
          </button>
          <button
            className={`${styles.modeButton} ${viewMode === 'edit' ? styles.active : ''}`}
            onClick={() => setViewMode('edit')}
          >
            Edit
          </button>
          <button
            className={`${styles.modeButton} ${viewMode === 'history' ? styles.active : ''}`}
            onClick={() => setViewMode('history')}
          >
            History
          </button>
        </div>
      </div>
      
      {/* MediaWiki iframe */}
      <div className={styles.wikiContainer}>
        {isLoading && (
          <div className={styles.loading}>
            <RefreshCw size={32} className={styles.spinner} />
            <p>Loading wiki page...</p>
          </div>
        )}
        
        <iframe
          src={iframeUrl}
          className={styles.wikiFrame}
          title="MediaWiki"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          onLoad={() => useWikiStore.setState({ isLoading: false, wikiConnected: true })}
          onError={() => useWikiStore.setState({ isLoading: false, wikiConnected: false })}
        />
      </div>
      
      {/* Status Bar */}
      <div className={styles.statusBar}>
        <div className={styles.statusLeft}>
          <span className={`${styles.statusDot} ${wikiConnected ? styles.connected : ''}`} />
          <span className={styles.statusText}>
            {wikiConnected ? `Connected to ${wikiUrl}` : 'Disconnected'}
          </span>
        </div>
        
        <div className={styles.statusRight}>
          {zepEnabled && (
            <span className={styles.zepIndicator}>
              <Database size={14} />
              Zep Enabled
            </span>
          )}
          <button
            className={styles.zepToggle}
            onClick={() => setZepEnabled(!zepEnabled)}
          >
            {zepEnabled ? 'Disable' : 'Enable'} Zep Integration
          </button>
        </div>
      </div>
    </div>
  );
};