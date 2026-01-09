/**
 * AgentImportMenu React Component
 * 
 * Import menu for adding agents to the canvas.
 * Features:
 * - File upload (JSON/YAML)
 * - URL import
 * - Paste JSON/YAML text
 * - Sample agent templates
 */

import React, { useState, useCallback, useRef } from 'react';

// =============================================================================
// Types
// =============================================================================

export interface AgentImportMenuProps {
  onClose: () => void;
  onImportFile: (file: File) => Promise<void>;
  onImportURL: (url: string) => Promise<void>;
  onImportText: (text: string) => Promise<void>;
}

type ImportTab = 'file' | 'url' | 'text' | 'samples';

// =============================================================================
// Sample Agents
// =============================================================================

const SAMPLE_AGENTS = [
  {
    name: 'Research Assistant',
    description: 'Helps with research, summarization, and analysis',
    spec: {
      apiVersion: 'usa/v2',
      kind: 'Agent',
      metadata: { name: 'Research Assistant', version: '1.0.0' },
      identity: {
        role: 'Research Assistant',
        goal: 'Help users with research, summarization, and analysis tasks',
        backstory: 'An AI assistant specialized in finding information, summarizing documents, and providing analytical insights.',
      },
      capabilities: {
        tools: [{ name: 'web_search', protocol: 'mcp' }],
        skills: [{ name: 'summarization' }, { name: 'analysis' }],
      },
      protocols: { mcp: { enabled: true } },
    },
  },
  {
    name: 'Code Helper',
    description: 'Assists with coding, debugging, and code review',
    spec: {
      apiVersion: 'usa/v2',
      kind: 'Agent',
      metadata: { name: 'Code Helper', version: '1.0.0' },
      identity: {
        role: 'Software Engineer',
        goal: 'Help users write, debug, and review code',
        backstory: 'An experienced software engineer who helps with coding tasks across multiple languages and frameworks.',
      },
      capabilities: {
        tools: [{ name: 'code_analysis', protocol: 'native' }],
        skills: [{ name: 'debugging' }, { name: 'code_review' }, { name: 'refactoring' }],
      },
      protocols: { mcp: { enabled: false } },
    },
  },
  {
    name: 'Creative Writer',
    description: 'Helps with creative writing and content creation',
    spec: {
      apiVersion: 'usa/v2',
      kind: 'Agent',
      metadata: { name: 'Creative Writer', version: '1.0.0' },
      identity: {
        role: 'Creative Writer',
        goal: 'Assist with creative writing, storytelling, and content creation',
        backstory: 'A creative writing assistant with a flair for storytelling, poetry, and engaging content.',
      },
      capabilities: {
        tools: [],
        skills: [{ name: 'storytelling' }, { name: 'poetry' }, { name: 'copywriting' }],
      },
      protocols: { mcp: { enabled: false } },
    },
  },
];

// =============================================================================
// Styles
// =============================================================================

const styles = {
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: '#1e1e2f',
    borderRadius: '8px',
    width: '500px',
    maxWidth: '90vw',
    maxHeight: '80vh',
    overflow: 'hidden',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    backgroundColor: '#16213e',
    borderBottom: '1px solid #0f3460',
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#e0e0e0',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#888',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '4px',
    lineHeight: 1,
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #0f3460',
  },
  tab: {
    flex: 1,
    padding: '12px',
    background: 'none',
    border: 'none',
    color: '#888',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    transition: 'color 0.2s, background-color 0.2s',
  },
  tabActive: {
    color: '#e94560',
    backgroundColor: 'rgba(233, 69, 96, 0.1)',
    borderBottom: '2px solid #e94560',
    marginBottom: '-1px',
  },
  content: {
    padding: '20px',
    maxHeight: '400px',
    overflow: 'auto',
  },
  dropZone: {
    border: '2px dashed #0f3460',
    borderRadius: '8px',
    padding: '40px',
    textAlign: 'center' as const,
    cursor: 'pointer',
    transition: 'border-color 0.2s, background-color 0.2s',
  },
  dropZoneActive: {
    borderColor: '#e94560',
    backgroundColor: 'rgba(233, 69, 96, 0.1)',
  },
  dropIcon: {
    fontSize: '48px',
    marginBottom: '12px',
    opacity: 0.5,
  },
  dropText: {
    color: '#888',
    fontSize: '14px',
    marginBottom: '8px',
  },
  dropSubtext: {
    color: '#666',
    fontSize: '12px',
  },
  fileInput: {
    display: 'none',
  },
  inputGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    color: '#888',
    fontSize: '12px',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    backgroundColor: '#0f1729',
    border: '1px solid #0f3460',
    borderRadius: '4px',
    color: '#e0e0e0',
    fontSize: '14px',
    outline: 'none',
  },
  inputFocus: {
    borderColor: '#e94560',
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    backgroundColor: '#0f1729',
    border: '1px solid #0f3460',
    borderRadius: '4px',
    color: '#e0e0e0',
    fontSize: '13px',
    fontFamily: 'monospace',
    minHeight: '200px',
    resize: 'vertical' as const,
    outline: 'none',
  },
  button: {
    padding: '10px 20px',
    backgroundColor: '#e94560',
    border: 'none',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    width: '100%',
  },
  buttonDisabled: {
    backgroundColor: '#333',
    color: '#666',
    cursor: 'not-allowed',
  },
  sampleList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  sampleCard: {
    padding: '16px',
    backgroundColor: '#0f1729',
    border: '1px solid #0f3460',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'border-color 0.2s, background-color 0.2s',
  },
  sampleCardHover: {
    borderColor: '#e94560',
    backgroundColor: 'rgba(233, 69, 96, 0.05)',
  },
  sampleName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#e0e0e0',
    marginBottom: '4px',
  },
  sampleDesc: {
    fontSize: '12px',
    color: '#888',
  },
  error: {
    padding: '12px',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    border: '1px solid rgba(244, 67, 54, 0.3)',
    borderRadius: '4px',
    color: '#f44336',
    fontSize: '13px',
    marginBottom: '16px',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '20px',
  },
  spinner: {
    width: '20px',
    height: '20px',
    border: '2px solid #0f3460',
    borderTop: '2px solid #e94560',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    color: '#888',
    fontSize: '14px',
  },
  formatHint: {
    marginTop: '12px',
    padding: '12px',
    backgroundColor: 'rgba(233, 69, 96, 0.1)',
    borderRadius: '4px',
    fontSize: '12px',
    color: '#999',
  },
  formatList: {
    marginTop: '8px',
    paddingLeft: '20px',
  },
};

// =============================================================================
// AgentImportMenu Component
// =============================================================================

export const AgentImportMenu: React.FC<AgentImportMenuProps> = ({
  onClose,
  onImportFile,
  onImportURL,
  onImportText,
}) => {
  const [activeTab, setActiveTab] = useState<ImportTab>('file');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [hoveredSample, setHoveredSample] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file drop
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    setError(null);

    const files = Array.from(e.dataTransfer.files).filter(
      f => f.name.endsWith('.json') || f.name.endsWith('.yaml') || f.name.endsWith('.yml')
    );

    if (files.length === 0) {
      setError('Please drop a JSON or YAML file');
      return;
    }

    setIsLoading(true);
    try {
      await onImportFile(files[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsLoading(false);
    }
  }, [onImportFile]);

  // Handle file input
  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsLoading(true);
    try {
      await onImportFile(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [onImportFile]);

  // Handle URL import
  const handleURLImport = useCallback(async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      await onImportURL(url.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsLoading(false);
    }
  }, [url, onImportURL]);

  // Handle text import
  const handleTextImport = useCallback(async () => {
    if (!text.trim()) {
      setError('Please enter agent specification');
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      await onImportText(text.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsLoading(false);
    }
  }, [text, onImportText]);

  // Handle sample import
  const handleSampleImport = useCallback(async (index: number) => {
    const sample = SAMPLE_AGENTS[index];
    if (!sample) return;

    setError(null);
    setIsLoading(true);
    try {
      await onImportText(JSON.stringify(sample.spec));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsLoading(false);
    }
  }, [onImportText]);

  // Close on overlay click
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  // Render content based on active tab
  const renderContent = () => {
    if (isLoading) {
      return (
        <div style={styles.loading}>
          <div style={styles.spinner} />
          <span style={styles.loadingText}>Importing agent...</span>
        </div>
      );
    }

    switch (activeTab) {
      case 'file':
        return (
          <>
            <div
              style={{
                ...styles.dropZone,
                ...(isDragActive ? styles.dropZoneActive : {}),
              }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragActive(true); }}
              onDragLeave={() => setIsDragActive(false)}
              onDrop={handleDrop}
            >
              <div style={styles.dropIcon}>📁</div>
              <div style={styles.dropText}>
                Drop agent file here or click to browse
              </div>
              <div style={styles.dropSubtext}>
                Supports .json and .yaml files
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.yaml,.yml"
              style={styles.fileInput}
              onChange={handleFileInput}
            />
            <div style={styles.formatHint}>
              <strong>Supported formats:</strong>
              <ul style={styles.formatList}>
                <li>uSA (Uniform Semantic Agent)</li>
                <li>ElizaOS personas</li>
                <li>CrewAI agents</li>
                <li>Replicant definitions</li>
              </ul>
            </div>
          </>
        );

      case 'url':
        return (
          <>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Agent Specification URL</label>
              <input
                type="url"
                style={styles.input}
                placeholder="https://example.com/agent.json"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleURLImport()}
              />
            </div>
            <button
              style={{
                ...styles.button,
                ...(url.trim() ? {} : styles.buttonDisabled),
              }}
              onClick={handleURLImport}
              disabled={!url.trim()}
            >
              Import from URL
            </button>
          </>
        );

      case 'text':
        return (
          <>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Paste Agent Specification (JSON or YAML)</label>
              <textarea
                style={styles.textarea}
                placeholder='{\n  "apiVersion": "usa/v2",\n  "kind": "Agent",\n  ...\n}'
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
            <button
              style={{
                ...styles.button,
                ...(text.trim() ? {} : styles.buttonDisabled),
              }}
              onClick={handleTextImport}
              disabled={!text.trim()}
            >
              Import from Text
            </button>
          </>
        );

      case 'samples':
        return (
          <div style={styles.sampleList}>
            {SAMPLE_AGENTS.map((sample, index) => (
              <div
                key={index}
                style={{
                  ...styles.sampleCard,
                  ...(hoveredSample === index ? styles.sampleCardHover : {}),
                }}
                onMouseEnter={() => setHoveredSample(index)}
                onMouseLeave={() => setHoveredSample(null)}
                onClick={() => handleSampleImport(index)}
              >
                <div style={styles.sampleName}>{sample.name}</div>
                <div style={styles.sampleDesc}>{sample.description}</div>
              </div>
            ))}
          </div>
        );
    }
  };

  return (
    <div style={styles.overlay} onClick={handleOverlayClick}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.title}>
            🦋 Import Agent
          </div>
          <button style={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          {[
            { key: 'file', label: '📁 File' },
            { key: 'url', label: '🔗 URL' },
            { key: 'text', label: '📝 Paste' },
            { key: 'samples', label: '✨ Samples' },
          ].map(tab => (
            <button
              key={tab.key}
              style={{
                ...styles.tab,
                ...(activeTab === tab.key ? styles.tabActive : {}),
              }}
              onClick={() => setActiveTab(tab.key as ImportTab)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={styles.content}>
          {/* Error */}
          {error && (
            <div style={styles.error}>
              ⚠️ {error}
            </div>
          )}

          {renderContent()}
        </div>
      </div>

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AgentImportMenu;