/**
 * CanvasNavigator Component
 * 
 * Left frame navigation:
 * - 5 canvas tabs (Settings + 4 flexible)
 * - Canvas type selector for flexible canvases
 * - Agent roster
 */

import { useState } from 'react';
import styles from './CanvasNavigator.module.css';

// ============================================================================
// Types
// ============================================================================

export type CanvasType =
  | 'settings'
  | 'board'
  | 'scrapbook'
  | 'storyboard'
  | 'remixer'
  | 'video'
  | 'meme'
  | 'custom_template';

export interface CanvasTab {
  id: string;
  index: number;
  type: CanvasType;
  title: string;
  isFixed: boolean;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'idle' | 'offline';
}

export interface CanvasNavigatorProps {
  canvases: CanvasTab[];
  activeCanvasId: string;
  agents: Agent[];
  onCanvasSelect: (canvasId: string) => void;
  onCanvasTypeChange: (canvasId: string, newType: CanvasType) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CANVAS_TYPE_OPTIONS: { value: CanvasType; label: string; icon: string }[] = [
  { value: 'board', label: 'Board', icon: '📋' },
  { value: 'scrapbook', label: 'Scrapbook', icon: '📔' },
  { value: 'storyboard', label: 'Storyboard', icon: '🎬' },
  { value: 'remixer', label: 'Remixer', icon: '🎨' },
  { value: 'video', label: 'Video', icon: '🎥' },
  { value: 'meme', label: 'Meme', icon: '😄' },
  { value: 'custom_template', label: 'Custom', icon: '⚡' },
];

// ============================================================================
// CanvasNavigator Component
// ============================================================================

export function CanvasNavigator({
  canvases,
  activeCanvasId,
  agents,
  onCanvasSelect,
  onCanvasTypeChange
}: CanvasNavigatorProps) {
  const [expandedSections, setExpandedSections] = useState({
    canvases: true,
    agents: true
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getCanvasIcon = (type: CanvasType): string => {
    if (type === 'settings') return '⚙️';
    return CANVAS_TYPE_OPTIONS.find(opt => opt.value === type)?.icon || '📄';
  };

  const getAgentStatusColor = (status: Agent['status']): string => {
    switch (status) {
      case 'active': return 'var(--color-success)';
      case 'idle': return 'var(--color-warning)';
      case 'offline': return 'var(--color-text-muted)';
    }
  };

  return (
    <div className={styles.navigator}>
      {/* Canvases Section */}
      <div className={styles.section}>
        <button 
          className={styles.sectionHeader}
          onClick={() => toggleSection('canvases')}
        >
          <span className={styles.sectionTitle}>Canvases</span>
          <span className={styles.sectionToggle}>
            {expandedSections.canvases ? '▼' : '▶'}
          </span>
        </button>

        {expandedSections.canvases && (
          <div className={styles.sectionContent}>
            {canvases.map((canvas) => (
              <div 
                key={canvas.id}
                className={`${styles.canvasItem} ${canvas.id === activeCanvasId ? styles.active : ''}`}
              >
                <button
                  className={styles.canvasButton}
                  onClick={() => onCanvasSelect(canvas.id)}
                >
                  <span className={styles.canvasIcon}>{getCanvasIcon(canvas.type)}</span>
                  <span className={styles.canvasTitle}>{canvas.title}</span>
                </button>

                {!canvas.isFixed && (
                  <select
                    className={styles.typeSelector}
                    value={canvas.type}
                    onChange={(e) => onCanvasTypeChange(canvas.id, e.target.value as CanvasType)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {CANVAS_TYPE_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.icon} {option.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Agents Section */}
      <div className={styles.section}>
        <button 
          className={styles.sectionHeader}
          onClick={() => toggleSection('agents')}
        >
          <span className={styles.sectionTitle}>Active Agents</span>
          <span className={styles.sectionToggle}>
            {expandedSections.agents ? '▼' : '▶'}
          </span>
        </button>

        {expandedSections.agents && (
          <div className={styles.sectionContent}>
            {agents.length === 0 ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>🤖</span>
                <p className={styles.emptyText}>No agents active</p>
              </div>
            ) : (
              agents.map((agent) => (
                <div key={agent.id} className={styles.agentItem}>
                  <div 
                    className={styles.agentStatus}
                    style={{ backgroundColor: getAgentStatusColor(agent.status) }}
                  />
                  <div className={styles.agentInfo}>
                    <div className={styles.agentName}>{agent.name}</div>
                    <div className={styles.agentRole}>{agent.role}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}