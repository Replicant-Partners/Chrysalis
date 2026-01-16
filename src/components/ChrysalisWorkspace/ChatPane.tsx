/**
 * ChatPane Component
 * 
 * A chat interface pane bound to a specific agent for the Chrysalis workspace.
 * Features:
 * - Message display with user/agent/system differentiation
 * - Memory indicators showing recalled/created memories
 * - Typing indicators
 * - Auto-scroll with scroll-lock on user scroll-up
 * 
 * @module components/ChrysalisWorkspace/ChatPane
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { tokens, ThemeMode, useTheme, PermissionCard } from '../shared';
import {
  ChatPaneProps,
  ChatMessage,
  MemoryIndicator,
  ChatPanePosition,
  PermissionRequest,
} from './types';

// =============================================================================
// Styles
// =============================================================================

const styles = {
  container: (mode: ThemeMode, isPrimary: boolean) => ({
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    backgroundColor: isPrimary
      ? tokens.color.surface.primaryPane[mode]
      : tokens.color.surface.secondaryPane[mode],
    borderRight: `1px solid ${tokens.color.border.subtle[mode]}`,
    overflow: 'hidden',
  }),
  containerRight: (mode: ThemeMode) => ({
    borderRight: 'none',
    borderLeft: `1px solid ${tokens.color.border.subtle[mode]}`,
  }),
  header: (mode: ThemeMode) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: tokens.color.surface.base[mode],
    borderBottom: `1px solid ${tokens.color.border.subtle[mode]}`,
  }),
  headerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  avatar: (mode: ThemeMode) => ({
    width: 32,
    height: 32,
    borderRadius: '50%',
    backgroundColor: tokens.color.border.subtle[mode],
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 600,
    color: tokens.color.text.primary[mode],
  }),
  agentInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  agentName: (mode: ThemeMode) => ({
    fontSize: '14px',
    fontWeight: 600,
    color: tokens.color.text.primary[mode],
  }),
  agentType: (mode: ThemeMode) => ({
    fontSize: '11px',
    color: tokens.color.text.secondary[mode],
    textTransform: 'uppercase' as const,
  }),
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: (mode: ThemeMode) => ({
    width: 28,
    height: 28,
    borderRadius: 8,
    border: `1px solid ${tokens.color.border.subtle[mode]}`,
    background: 'transparent',
    color: tokens.color.text.secondary[mode],
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: `all ${tokens.motion.snap} ${tokens.motion.easeSnap}`,
  }),
  iconButtonActive: (mode: ThemeMode) => ({
    color: tokens.color.text.primary[mode],
    borderColor: tokens.color.text.secondary[mode],
  }),
  clearButton: (mode: ThemeMode) => ({
    padding: '4px 8px',
    fontSize: '11px',
    backgroundColor: 'transparent',
    border: `1px solid ${tokens.color.border.subtle[mode]}`,
    borderRadius: '6px',
    color: tokens.color.text.secondary[mode],
    cursor: 'pointer',
    transition: `all ${tokens.motion.snap} ${tokens.motion.easeSnap}`,
  }),
  messagesContainer: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  messageWrapper: {
    display: 'flex',
    flexDirection: 'column' as const,
    maxWidth: '85%',
  },
  messageWrapperUser: {
    alignSelf: 'flex-end',
  },
  messageWrapperAgent: {
    alignSelf: 'flex-start',
  },
  messageWrapperSystem: {
    alignSelf: 'center',
    maxWidth: '90%',
  },
  message: (mode: ThemeMode) => ({
    padding: '10px 14px',
    borderRadius: '12px',
    fontSize: '14px',
    lineHeight: '1.5',
    wordBreak: 'break-word' as const,
    color: tokens.color.text.primary[mode],
    backgroundColor: tokens.color.surface.base[mode],
  }),
  messageUser: (mode: ThemeMode) => ({
    backgroundColor: tokens.color.text.primary[mode],
    color: tokens.color.surface.base[mode],
    borderBottomRightRadius: '4px',
  }),
  messageAgent: (mode: ThemeMode) => ({
    backgroundColor: tokens.color.surface.secondaryPane[mode],
    color: tokens.color.text.primary[mode],
    borderBottomLeftRadius: '4px',
  }),
  messageSystem: (mode: ThemeMode) => ({
    backgroundColor: tokens.color.surface.base[mode],
    color: tokens.color.text.secondary[mode],
    fontSize: '12px',
    fontStyle: 'italic' as const,
  }),
  messageSender: (mode: ThemeMode) => ({
    fontSize: '11px',
    color: tokens.color.text.secondary[mode],
    marginBottom: '4px',
    paddingLeft: '4px',
  }),
  messageTime: (mode: ThemeMode) => ({
    fontSize: '10px',
    color: tokens.color.text.secondary[mode],
    marginTop: '4px',
    paddingLeft: '4px',
  }),
  memoryIndicators: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '4px',
    marginTop: '6px',
    paddingLeft: '4px',
  },
  memoryBadge: (mode: ThemeMode) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    padding: '2px 6px',
    borderRadius: '10px',
    fontSize: '10px',
    backgroundColor: tokens.color.surface.base[mode],
    color: tokens.color.text.secondary[mode],
    border: `1px solid ${tokens.color.border.subtle[mode]}`,
  }),
  typingIndicator: (mode: ThemeMode) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    color: tokens.color.text.secondary[mode],
    fontSize: '13px',
  }),
  typingDots: {
    display: 'flex',
    gap: '4px',
  },
  typingDot: (mode: ThemeMode) => ({
    width: 6,
    height: 6,
    borderRadius: '50%',
    backgroundColor: tokens.color.text.secondary[mode],
    animation: 'typingBounce 1.4s infinite ease-in-out',
  }),
  inputContainer: (mode: ThemeMode) => ({
    padding: '12px 16px',
    backgroundColor: tokens.color.surface.base[mode],
    borderTop: `1px solid ${tokens.color.border.subtle[mode]}`,
  }),
  inputWrapper: (mode: ThemeMode) => ({
    display: 'flex',
    alignItems: 'flex-end',
    gap: '10px',
    backgroundColor: tokens.color.surface.secondaryPane[mode],
    borderRadius: '12px',
    padding: '8px 12px',
  }),
  textarea: (mode: ThemeMode) => ({
    flex: 1,
    backgroundColor: 'transparent',
    border: 'none',
    outline: 'none',
    color: tokens.color.text.primary[mode],
    fontSize: '14px',
    lineHeight: '1.5',
    resize: 'none' as const,
    maxHeight: '120px',
    minHeight: '24px',
    fontFamily: 'inherit',
  }),
  sendButton: (mode: ThemeMode) => ({
    padding: '6px 12px',
    backgroundColor: tokens.color.text.primary[mode],
    border: 'none',
    borderRadius: '8px',
    color: tokens.color.surface.base[mode],
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: `all ${tokens.motion.snap} ${tokens.motion.easeSnap}`,
    whiteSpace: 'nowrap' as const,
  }),
  sendButtonDisabled: (mode: ThemeMode) => ({
    backgroundColor: tokens.color.border.subtle[mode],
    color: tokens.color.text.secondary[mode],
    cursor: 'not-allowed',
  }),
  emptyState: (mode: ThemeMode) => ({
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: tokens.color.text.secondary[mode],
    textAlign: 'center' as const,
    padding: '20px',
  }),
  emptyStateIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  emptyStateTitle: (mode: ThemeMode) => ({
    fontSize: '16px',
    fontWeight: 600,
    color: tokens.color.text.primary[mode],
    marginBottom: '8px',
  }),
  emptyStateSubtitle: {
    fontSize: '13px',
    lineHeight: '1.5',
  },
};

// =============================================================================
// Helper Components
// =============================================================================

/**
 * Memory badge component
 */
const MemoryBadge: React.FC<{ indicator: MemoryIndicator; mode: ThemeMode }> = ({ indicator, mode }) => {
  const getIcon = () => {
    switch (indicator.type) {
      case 'episodic': return '🧠';
      case 'semantic': return '📚';
      case 'skill': return '⚡';
    }
  };
  
  const getBadgeStyle = () => {
    switch (indicator.type) {
      case 'episodic': return { ...styles.memoryBadge(mode) };
      case 'semantic': return { ...styles.memoryBadge(mode) };
      case 'skill': return { ...styles.memoryBadge(mode) };
    }
  };
  
  const label = indicator.usedInResponse ? 'recalled' : 'learned';
  
  return (
    <span style={getBadgeStyle()} title={indicator.content}>
      {getIcon()} {indicator.type} {label}
    </span>
  );
};

/**
 * Typing indicator animation
 */
const TypingIndicator: React.FC<{ agentName: string; mode: ThemeMode }> = ({ agentName, mode }) => (
  <div style={styles.typingIndicator(mode)}>
    <div style={styles.typingDots}>
      <span style={{ ...styles.typingDot(mode), animationDelay: '0s' }} />
      <span style={{ ...styles.typingDot(mode), animationDelay: '0.2s' }} />
      <span style={{ ...styles.typingDot(mode), animationDelay: '0.4s' }} />
    </div>
    <span>{agentName} is thinking...</span>
  </div>
);

/**
 * Single message component
 */
const MessageItem: React.FC<{
  message: ChatMessage;
  showMemoryIndicators: boolean;
  mode: ThemeMode;
  onPermissionApprove?: (requestId: string) => void;
  onPermissionDeny?: (requestId: string) => void;
  onPermissionExplain?: (requestId: string) => void;
}> = ({ message, showMemoryIndicators, mode, onPermissionApprove, onPermissionDeny, onPermissionExplain }) => {
  const isUser = message.senderType === 'user';
  const isSystem = message.senderType === 'system';
  const hasPermissionRequest = message.permissionRequest && message.permissionRequest.status === 'pending';
  
  const wrapperStyle = useMemo(() => ({
    ...styles.messageWrapper,
    ...(isUser ? styles.messageWrapperUser : {}),
    ...(isSystem ? styles.messageWrapperSystem : styles.messageWrapperAgent),
  }), [isUser, isSystem]);
  
  const messageStyle = useMemo(() => ({
    ...styles.message(mode),
    ...(isUser ? styles.messageUser(mode) : {}),
    ...(isSystem ? styles.messageSystem(mode) : styles.messageAgent(mode)),
  }), [isUser, isSystem, mode]);
  
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  return (
    <div style={wrapperStyle}>
      {!isUser && !isSystem && (
        <span style={styles.messageSender(mode)}>{message.senderName}</span>
      )}
      <div style={messageStyle}>
        {message.content}
      </div>
      <span style={styles.messageTime(mode)}>{formatTime(message.timestamp)}</span>
      {showMemoryIndicators && message.memoryIndicators && message.memoryIndicators.length > 0 && (
        <div style={styles.memoryIndicators}>
          {message.memoryIndicators.map((indicator, idx) => (
            <MemoryBadge key={`${indicator.memoryId}-${idx}`} indicator={indicator} mode={mode} />
          ))}
        </div>
      )}
      {hasPermissionRequest && (
        <div style={{ marginTop: '8px' }}>
          <PermissionCard
            requestId={message.permissionRequest.requestId}
            agentName={message.permissionRequest.agentName}
            trust={message.permissionRequest.trust}
            summary={message.permissionRequest.summary}
            scopePreview={message.permissionRequest.scopePreview}
            riskLevel={message.permissionRequest.riskLevel}
            mode={mode}
            onApprove={onPermissionApprove}
            onDeny={onPermissionDeny}
            onExplainRisk={onPermissionExplain}
          />
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

/**
 * ChatPane - A chat interface bound to a specific agent
 */
export const ChatPane: React.FC<ChatPaneProps> = ({
  paneId,
  agent,
  messages,
  participants,
  isLoading = false,
  isAgentTyping = false,
  showMemoryIndicators = true,
  maxMessages = 500,
  showInviteButton = true,
  showDndButton = true,
  dndState = 'off',
  onSendMessage,
  onClearChat,
  onInviteClick,
  onToggleDnd,
  onPermissionApprove,
  onPermissionDeny,
  onPermissionExplain,
}) => {
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // State
  const [inputValue, setInputValue] = useState('');
  const [isAtBottom, setIsAtBottom] = useState(true);
  
  // Memoized values
  const displayMessages = useMemo(() => 
    messages.slice(-maxMessages),
    [messages, maxMessages]
  );
  
  const { mode } = useTheme();
  const isPrimary = paneId === 'left';
  const containerStyle = useMemo(() => ({
    ...styles.container(mode, isPrimary),
    ...(paneId === 'right' ? styles.containerRight(mode) : {}),
  }), [mode, isPrimary, paneId]);
  
  const canSend = inputValue.trim().length > 0 && !isLoading;
  
  // Auto-scroll to bottom
  useEffect(() => {
    if (isAtBottom && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [displayMessages, isAgentTyping, isAtBottom]);
  
  // Handle scroll to detect if user scrolled up
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const threshold = 50;
    setIsAtBottom(scrollHeight - scrollTop - clientHeight < threshold);
  }, []);
  
  // Handle input change with auto-resize
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, []);
  
  // Handle key press
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) {
        handleSend();
      }
    }
  }, [canSend]);
  
  // Handle send
  const handleSend = useCallback(() => {
    if (!canSend) return;
    
    const content = inputValue.trim();
    setInputValue('');
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    
    onSendMessage(content);
    
    // Scroll to bottom after sending
    setIsAtBottom(true);
  }, [inputValue, canSend, onSendMessage]);
  
  // Handle clear chat
  const handleClear = useCallback(() => {
    if (onClearChat && window.confirm('Clear all messages in this chat?')) {
      onClearChat();
    }
  }, [onClearChat]);
  
  // Get avatar initial
  const getAvatarInitial = () => {
    return agent.agentName.charAt(0).toUpperCase();
  };
  
  return (
    <div style={containerStyle}>
      {/* Header */}
        <div style={styles.header(mode)}>
          <div style={styles.headerInfo}>
            <div style={styles.avatar(mode)}>
            {agent.avatarUrl ? (
              <img src={agent.avatarUrl} alt={agent.agentName} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
            ) : (
              getAvatarInitial()
            )}
          </div>
          <div style={styles.agentInfo}>
            <span style={styles.agentName(mode)}>{agent.agentName}</span>
            <span style={styles.agentType(mode)}>{agent.agentType} Agent</span>
          </div>
        </div>
        <div style={styles.headerActions}>
          {showInviteButton && (
            <button
              style={styles.iconButton(mode)}
              onClick={onInviteClick}
              title="Invite participants"
              aria-label="Invite participants"
            >
              +
            </button>
          )}
          {showDndButton && (
            <button
              style={{
                ...styles.iconButton(mode),
                ...(dndState === 'on' ? styles.iconButtonActive(mode) : {}),
              }}
              onClick={() => onToggleDnd?.(dndState === 'on' ? 'off' : 'on')}
              title={dndState === 'on' ? 'Disable Do Not Disturb' : 'Enable Do Not Disturb'}
              aria-label="Toggle Do Not Disturb"
            >
              {dndState === 'on' ? 'DND' : '•'}
            </button>
          )}
          {onClearChat && (
            <button
              style={styles.clearButton(mode)}
              onClick={handleClear}
              title="Clear chat history"
            >
              Clear
            </button>
          )}
        </div>
      </div>
      
      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        style={styles.messagesContainer}
        onScroll={handleScroll}
      >
        {displayMessages.length === 0 ? (
          <div style={styles.emptyState(mode)}>
            <div style={styles.emptyStateIcon}>💬</div>
            <div style={styles.emptyStateTitle(mode)}>Start a conversation</div>
            <div style={styles.emptyStateSubtitle}>
              Send a message to {agent.agentName} to begin.
              <br />
              They will remember what you discuss.
            </div>
          </div>
        ) : (
          <>
            {displayMessages.map((message) => (
              <MessageItem 
                key={message.id} 
                message={message} 
                showMemoryIndicators={showMemoryIndicators}
                mode={mode}
                onPermissionApprove={onPermissionApprove}
                onPermissionDeny={onPermissionDeny}
                onPermissionExplain={onPermissionExplain}
              />
            ))}
            {isAgentTyping && <TypingIndicator agentName={agent.agentName} mode={mode} />}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
      
      {/* Input */}
      <div style={styles.inputContainer(mode)}>
        <div style={styles.inputWrapper(mode)}>
          <textarea
            ref={textareaRef}
            style={styles.textarea(mode)}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${agent.agentName}...`}
            rows={1}
            disabled={isLoading}
          />
          <button
            style={{
              ...styles.sendButton(mode),
              ...(canSend ? {} : styles.sendButtonDisabled(mode)),
            }}
            onClick={handleSend}
            disabled={!canSend}
          >
            Send
          </button>
        </div>
      </div>
      
      {/* CSS for typing animation */}
      <style>{`
        @keyframes typingBounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
};

export default ChatPane;