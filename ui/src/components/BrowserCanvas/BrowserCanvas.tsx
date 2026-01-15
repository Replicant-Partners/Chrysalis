/**
 * Browser Canvas - Embed browser instances
 */

import React, { useState, useCallback } from 'react';
import { Plus, X, Globe, ArrowLeft, ArrowRight, RotateCw, Home } from 'lucide-react';
import { Button, Input } from '../design-system';
import styles from './BrowserCanvas.module.css';

interface BrowserInstance {
  id: string;
  title: string;
  url: string;
  canGoBack: boolean;
  canGoForward: boolean;
}

export const BrowserCanvas: React.FC = () => {
  const [browsers, setBrowsers] = useState<BrowserInstance[]>([]);
  const [activeBrowserId, setActiveBrowserId] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');

  const createBrowser = useCallback(() => {
    const id = `browser-${Date.now()}`;
    const newBrowser: BrowserInstance = {
      id,
      title: 'New Tab',
      url: 'about:blank',
      canGoBack: false,
      canGoForward: false,
    };
    setBrowsers((prev) => [...prev, newBrowser]);
    setActiveBrowserId(id);
    setUrlInput('');
  }, []);

  const closeBrowser = useCallback((id: string) => {
    setBrowsers((prev) => {
      const updated = prev.filter((b) => b.id !== id);
      if (activeBrowserId === id && updated.length > 0) {
        setActiveBrowserId(updated[0].id);
      }
      return updated;
    });
  }, [activeBrowserId]);

  const navigateTo = useCallback((url: string) => {
    if (!activeBrowserId) return;

    let fullUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      fullUrl = 'https://' + url;
    }

    setBrowsers((prev) =>
      prev.map((b) =>
        b.id === activeBrowserId
          ? { ...b, url: fullUrl, title: new URL(fullUrl).hostname }
          : b
      )
    );
  }, [activeBrowserId]);

  const handleUrlSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim()) {
      navigateTo(urlInput.trim());
    }
  }, [urlInput, navigateTo]);

  const activeBrowser = browsers.find((b) => b.id === activeBrowserId);

  return (
    <div className={styles.canvas}>
      <div className={styles.header}>
        <div className={styles.tabs}>
          {browsers.map((b) => (
            <div
              key={b.id}
              className={`${styles.tab} ${
                b.id === activeBrowserId ? styles.active : ''
              }`}
              onClick={() => setActiveBrowserId(b.id)}
            >
              <Globe size={14} />
              <span>{b.title}</span>
              <button
                className={styles.closeTab}
                onClick={(e) => {
                  e.stopPropagation();
                  closeBrowser(b.id);
                }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={createBrowser}
          iconBefore={<Plus size={16} />}
        >
          New Tab
        </Button>
      </div>

      {activeBrowser && (
        <div className={styles.controls}>
          <div className={styles.navButtons}>
            <button
              className={styles.navButton}
              disabled={!activeBrowser.canGoBack}
              title="Back"
            >
              <ArrowLeft size={16} />
            </button>
            <button
              className={styles.navButton}
              disabled={!activeBrowser.canGoForward}
              title="Forward"
            >
              <ArrowRight size={16} />
            </button>
            <button
              className={styles.navButton}
              title="Refresh"
              onClick={() => {
                const iframe = document.getElementById(
                  `iframe-${activeBrowser.id}`
                ) as HTMLIFrameElement;
                if (iframe) {
                  iframe.src = iframe.src;
                }
              }}
            >
              <RotateCw size={16} />
            </button>
            <button
              className={styles.navButton}
              title="Home"
              onClick={() => navigateTo('about:blank')}
            >
              <Home size={16} />
            </button>
          </div>

          <form className={styles.urlBar} onSubmit={handleUrlSubmit}>
            <Input
              type="text"
              placeholder="Enter URL..."
              value={urlInput || activeBrowser.url}
              onChange={(e) => setUrlInput(e.target.value)}
              onFocus={() => setUrlInput(activeBrowser.url)}
            />
          </form>
        </div>
      )}

      <div className={styles.browserContainer}>
        {browsers.length === 0 ? (
          <div className={styles.empty}>
            <Globe size={48} />
            <p>No browsers open</p>
            <Button onClick={createBrowser}>Create Browser</Button>
          </div>
        ) : (
          browsers.map((b) => (
            <iframe
              key={b.id}
              id={`iframe-${b.id}`}
              src={b.url}
              className={styles.browserFrame}
              style={{
                display: b.id === activeBrowserId ? 'block' : 'none',
              }}
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
              title={b.title}
            />
          ))
        )}
      </div>
    </div>
  );
};