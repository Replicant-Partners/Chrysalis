/**
 * AgentNodeWidget React Component
 * 
 * Visual representation of an agent on the canvas.
 * Features:
 * - Agent identity display (name, role, avatar)
 * - State indicator (dormant/waking/awake/sleeping/error)
 * - Wake/sleep controls
 * - Expandable details view
 * - Chat action button
 * - Remove action
 */

import React, { useState, useCallback, useMemo } from 'react';
import { CanvasAgent, AgentState, AgentSourceFormat } from '../../terminal/protocols/agent-canvas';
import { AgentLayout } from '../../terminal/protocols/agent-canvas-manager';

// =============================================================================
// Types
// =============================================================================

export interface AgentNodeWidgetProps {
  agent: CanvasAgent;
  layout: AgentLayout;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onWake: () => void;
  onSleep: () => void;
  onRemove: () => void;
  onChat: () => void;
  readOnly?: boolean;
}

// =============================================================================
// State Colors and Icons
// =============================================================================

const STATE_CONFIG: Record<AgentState, { color: string; icon: string; label: string }> = {
  dormant: { color: '#666', icon: '💤', label: 'Dormant' },
  waking: { color: '#f0a500', icon: '⏳', label: 'Waking...' },
  awake: { color: '#4caf50', icon: '✨', label: 'Awake' },
  sleeping: { color: '#9c27b0', icon: '🌙', label: 'Sleeping...' },
  error: { color: '#f44336', icon: '⚠️', label: 'Error' },
};

const FORMAT_BADGES: Record<AgentSourceFormat, { label: string; color: string }> = {
  usa: { label: 'uSA', color: '#e94560' },
  eliza: { label: 'Eliza', color: '#6366f1' },
  crewai: { label: 'CrewAI', color: '#22c55e' },
  replicant: { label: 'Replicant', color: '#f59e0b' },
  unknown: { label: '?', color: '#666' },
};

// =============================================================================
// Styles
// =============================================================================

const styles = {
  container: {
    position: 'absolute' as const,
    backgroundColor: '#1e1e2f',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    overflow: 'hidden',
    transition: 'box-shadow 0.2s, transform 0.1s',
    cursor: 'move',
    userSelect: 'none' as const,
  },
  containerSelected: {
    boxShadow: '0 0 0 2px #e94560, 0 4px 16px rgba(233, 69, 96, 0.3)',
  },
  containerAwake: {
    boxShadow: '0 0 0 2px #4caf50, 0 4px 16px rgba(76, 175, 80, 0.3)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px',
    gap: '10px',
    backgroundColor: '#16213e',
    borderBottom: '1px solid #0f3460',
  },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#0f3460',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    flexShrink: 0,
  },
  avatarAwake: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    border: '2px solid #4caf50',
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#e0e0e0',
    marginBottom: '2px',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  role: {
    fontSize: '11px',
    color: '#888',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  stateIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 500,
  },
  body: {
    padding: '12px',
  },
  formatBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: 600,
    marginBottom: '8px',
  },
  goal: {
    fontSize: '12px',
    color: '#999',
    lineHeight: 1.4,
    marginBottom: '12px',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
    overflow: 'hidden',
  },
  stats: {
    display: 'flex',
    gap: '16px',
    marginBottom: '12px',
    fontSize: '11px',
    color: '#666',
  },
  stat: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    marginTop: '8px',
  },
  actionButton: {
    flex: 1,
    padding: '8px 12px',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  wakeButton: {
    backgroundColor: '#0f3460',
    color: '#4caf50',
  },
  wakeButtonHover: {
    backgroundColor: '#1a4a7a',
  },
  sleepButton: {
    backgroundColor: '#0f3460',
    color: '#f0a500',
  },
  sleepButtonHover: {
    backgroundColor: '#1a4a7a',
  },
  chatButton: {
    backgroundColor: '#e94560',
    color: '#fff',
  },
  chatButtonHover: {
    backgroundColor: '#c73e55',
  },
  chatButtonDisabled: {
    backgroundColor: '#333',
    color: '#666',
    cursor: 'not-allowed',
  },
  removeButton: {
    position: 'absolute' as const,
    top: '8px',
    right: '8px',
    width: '24px',
    height: '24px',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: 'transparent',
    color: '#666',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    opacity: 0,
    transition: 'opacity 0.2s, color 0.2s',
  },
  removeButtonVisible: {
    opacity: 1,
  },
  removeButtonHover: {
    color: '#f44336',
  },
  expandToggle: {
    padding: '8px',
    textAlign: 'center' as const,
    fontSize: '11px',
    color: '#666',
    cursor: 'pointer',
    borderTop: '1px solid #0f3460',
    transition: 'background-color 0.2s',
  },
  expandToggleHover: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  details: {
    padding: '12px',
    borderTop: '1px solid #0f3460',
    fontSize: '11px',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '6px',
    color: '#888',
  },
  detailLabel: {
    color: '#666',
  },
  detailValue: {
    color: '#999',
    textAlign: 'right' as const,
    maxWidth: '60%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  error: {
    padding: '8px 12px',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    borderTop: '1px solid rgba(244, 67, 54, 0.3)',
    fontSize: '11px',
    color: '#f44336',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px',
    gap: '8px',
  },
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid #0f3460',
    borderTop: '2px solid #e94560',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  skillTags: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '4px',
    marginTop: '8px',
  },
  skillTag: {
    padding: '2px 6px',
    backgroundColor: '#0f3460',
    borderRadius: '3px',
    fontSize: '10px',
    color: '#888',
  },
};

// =============================================================================
// AgentNodeWidget Component
// =============================================================================

export const AgentNodeWidget: React.FC<AgentNodeWidgetProps> = ({
  agent,
  layout,
  isSelected,
  onMouseDown,
  onWake,
  onSleep,
  onRemove,
  onChat,
  readOnly = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [buttonHover, setButtonHover] = useState<string | null>(null);

  const stateConfig = STATE_CONFIG[agent.state];
  const formatBadge = FORMAT_BADGES[agent.sourceFormat];
  const isAwake = agent.state === 'awake';
  const isLoading = agent.state === 'waking' || agent.state === 'sleeping';

  // Extract data from spec
  const identity = agent.spec.identity || {};
  const capabilities = agent.spec.capabilities || {};
  const skills = (capabilities.skills as Array<{ name: string }>) || [];
  const tools = (capabilities.tools as Array<{ name: string }>) || [];

  // Get initials for avatar
  const initials = useMemo(() => {
    const name = agent.name || 'Agent';
    const parts = name.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }, [agent.name]);

  // Format date
  const formatTime = useCallback((timestamp?: number) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  // Handle wake/sleep toggle
  const handleStateToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (readOnly || isLoading) return;
    
    if (isAwake) {
      onSleep();
    } else {
      onWake();
    }
  }, [isAwake, isLoading, readOnly, onWake, onSleep]);

  // Handle chat
  const handleChat = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAwake) return;
    onChat();
  }, [isAwake, onChat]);

  // Handle remove
  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (readOnly) return;
    onRemove();
  }, [readOnly, onRemove]);

  // Handle expand toggle
  const handleExpandToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(prev => !prev);
  }, []);

  // Container styles
  const containerStyle = {
    ...styles.container,
    left: layout.position.x,
    top: layout.position.y,
    width: layout.position.width,
    zIndex: layout.position.zIndex,
    ...(isSelected ? styles.containerSelected : {}),
    ...(isAwake && !isSelected ? styles.containerAwake : {}),
  };

  return (
    <div
      style={containerStyle}
      onMouseDown={onMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div style={styles.header}>
        {/* Avatar */}
        <div style={{
          ...styles.avatar,
          ...(isAwake ? styles.avatarAwake : {}),
        }}>
          {isLoading ? (
            <div style={styles.spinner} />
          ) : (
            initials
          )}
        </div>

        {/* Info */}
        <div style={styles.info}>
          <div style={styles.name} title={agent.name}>
            {agent.name}
          </div>
          <div style={styles.role} title={identity.role as string}>
            {(identity.role as string) || 'AI Agent'}
          </div>
        </div>

        {/* State Indicator */}
        <div
          style={{
            ...styles.stateIndicator,
            backgroundColor: `${stateConfig.color}20`,
            color: stateConfig.color,
          }}
        >
          <span>{stateConfig.icon}</span>
          <span>{stateConfig.label}</span>
        </div>

        {/* Remove Button */}
        {!readOnly && (
          <button
            style={{
              ...styles.removeButton,
              ...(isHovered ? styles.removeButtonVisible : {}),
              ...(buttonHover === 'remove' ? styles.removeButtonHover : {}),
            }}
            onMouseEnter={() => setButtonHover('remove')}
            onMouseLeave={() => setButtonHover(null)}
            onClick={handleRemove}
            title="Remove agent"
          >
            ×
          </button>
        )}
      </div>

      {/* Body */}
      <div style={styles.body}>
        {/* Format Badge */}
        <div
          style={{
            ...styles.formatBadge,
            backgroundColor: `${formatBadge.color}20`,
            color: formatBadge.color,
          }}
        >
          {formatBadge.label}
        </div>

        {/* Goal */}
        <div style={styles.goal}>
          {(identity.goal as string) || 'No goal specified'}
        </div>

        {/* Stats */}
        <div style={styles.stats}>
          <div style={styles.stat}>
            🔧 {tools.length} tools
          </div>
          <div style={styles.stat}>
            ⚡ {skills.length} skills
          </div>
        </div>

        {/* Actions */}
        <div style={styles.actions}>
          {/* Wake/Sleep Button */}
          {!readOnly && (
            <button
              style={{
                ...styles.actionButton,
                ...(isAwake ? styles.sleepButton : styles.wakeButton),
                ...(buttonHover === 'state' ? (isAwake ? styles.sleepButtonHover : styles.wakeButtonHover) : {}),
                opacity: isLoading ? 0.5 : 1,
                cursor: isLoading ? 'wait' : 'pointer',
              }}
              onMouseEnter={() => setButtonHover('state')}
              onMouseLeave={() => setButtonHover(null)}
              onClick={handleStateToggle}
              disabled={isLoading}
            >
              {isLoading ? (
                <>Processing...</>
              ) : isAwake ? (
                <>🌙 Sleep</>
              ) : (
                <>✨ Wake</>
              )}
            </button>
          )}

          {/* Chat Button */}
          <button
            style={{
              ...styles.actionButton,
              ...(isAwake ? styles.chatButton : styles.chatButtonDisabled),
              ...(buttonHover === 'chat' && isAwake ? styles.chatButtonHover : {}),
            }}
            onMouseEnter={() => setButtonHover('chat')}
            onMouseLeave={() => setButtonHover(null)}
            onClick={handleChat}
            disabled={!isAwake}
            title={isAwake ? 'Start chat' : 'Wake agent to chat'}
          >
            💬 Chat
          </button>
        </div>

        {/* Skill Tags (first 3) */}
        {skills.length > 0 && (
          <div style={styles.skillTags}>
            {skills.slice(0, 3).map((skill, i) => (
              <span key={i} style={styles.skillTag}>
                {skill.name}
              </span>
            ))}
            {skills.length > 3 && (
              <span style={styles.skillTag}>
                +{skills.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Error Message */}
      {agent.state === 'error' && agent.lastError && (
        <div style={styles.error}>
          ⚠️ {agent.lastError}
        </div>
      )}

      {/* Expand Toggle */}
      <div
        style={{
          ...styles.expandToggle,
          ...(buttonHover === 'expand' ? styles.expandToggleHover : {}),
        }}
        onMouseEnter={() => setButtonHover('expand')}
        onMouseLeave={() => setButtonHover(null)}
        onClick={handleExpandToggle}
      >
        {isExpanded ? '▲ Hide Details' : '▼ Show Details'}
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div style={styles.details}>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>ID</span>
            <span style={styles.detailValue}>{agent.id.substring(0, 8)}...</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Source</span>
            <span style={styles.detailValue}>{agent.sourceFormat}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Created</span>
            <span style={styles.detailValue}>{formatTime(agent.createdAt)}</span>
          </div>
          {agent.lastWakeTime && (
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Last Wake</span>
              <span style={styles.detailValue}>{formatTime(agent.lastWakeTime)}</span>
            </div>
          )}
          {agent.lastSleepTime && (
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Last Sleep</span>
              <span style={styles.detailValue}>{formatTime(agent.lastSleepTime)}</span>
            </div>
          )}
          {identity.backstory && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ ...styles.detailLabel, marginBottom: '4px' }}>Backstory</div>
              <div style={{ ...styles.detailValue, textAlign: 'left' as const, maxWidth: '100%', whiteSpace: 'normal' as const }}>
                {(identity.backstory as string).substring(0, 200)}
                {(identity.backstory as string).length > 200 && '...'}
              </div>
            </div>
          )}
        </div>
      )}

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

export default AgentNodeWidget;