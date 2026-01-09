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
import {
  ChatPaneProps,
  ChatMessage,
  MemoryIndicator,
  ChatPanePosition,
} from './types';

// =============================================================================
// Styles
// =============================================================================

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    backgroundColor: '#1e1e2e',
    borderRight: '1px solid #313244',
    overflow: 'hidden',
  },
  containerRight: {
    borderRight: 'none',
    borderLeft: '1px solid #313244',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: '#181825',
    borderBottom: '1px solid #313244',
  },
  headerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    backgroundColor: '#89b4fa',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 600,
    color: '#1e1e2e',
  },
  agentInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  agentName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#cdd6f4',
  },
  agentType: {
    fontSize: '11px',
    color: '#6c7086',
    textTransform: 'uppercase' as const,
  },
  clearButton: {
    padding: '4px 8px',
    fontSize: '11px',
    backgroundColor: 'transparent',
    border: '1px solid #45475a',
    borderRadius: '4px',
    color: '#6c7086',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
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
  message: {
    padding: '10px 14px',
    borderRadius: '12px',
    fontSize: '14px',
    lineHeight: '1.5',
    wordBreak: 'break-word' as const,
  },
  messageUser: {
    backgroundColor: '#89b4fa',
    color: '#1e1e2e',
    borderBottomRightRadius: '4px',
  },
  messageAgent: {
    backgroundColor: '#313244',
    color: '#cdd6f4',
    borderBottomLeftRadius: '4px',
  },
  messageSystem: {
    backgroundColor: '#45475a',
    color: '#a6adc8',
    fontSize: '12px',
    fontStyle: 'italic' as const,
  },
  messageSender: {
    fontSize: '11px',
    color: '#6c7086',
    marginBottom: '4px',
    paddingLeft: '4px',
  },
  messageTime: {
    fontSize: '10px',
    color: '#585b70',
    marginTop: '4px',
    paddingLeft: '4px',
  },
  memoryIndicators: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '4px',
    marginTop: '6px',
    paddingLeft: '4px',
  },
  memoryBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    padding: '2px 6px',
    borderRadius: '10px',
    fontSize: '10px',
    backgroundColor: '#45475a',
    color: '#a6adc8',
  },
  memoryBadgeEpisodic: {
    backgroundColor: '#313244',
    color: '#f9e2af',
  },
  memoryBadgeSemantic: {
    backgroundColor: '#313244',
    color: '#a6e3a1',
  },
  memoryBadgeSkill: {
    backgroundColor: '#313244',
    color: '#89dceb',
  },
  typingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    color: '#6c7086',
    fontSize: '13px',
  },
  typingDots: {
    display: 'flex',
    gap: '4px',
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    backgroundColor: '#6c7086',
    animation: 'typingBounce 1.4s infinite ease-in-out',
  },
  inputContainer: {
    padding: '12px 16px',
    backgroundColor: '#181825',
    borderTop: '1px solid #313244',
  },
  inputWrapper: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '10px',
    backgroundColor: '#313244',
    borderRadius: '12px',
    padding: '8px 12px',
  },
  textarea: {
    flex: 1,
    backgroundColor: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#cdd6f4',
    fontSize: '14px',
    lineHeight: '1.5',
    resize: 'none' as const,
    maxHeight: '120px',
    minHeight: '24px',
    fontFamily: 'inherit',
  },
  sendButton: {
    padding: '6px 12px',
    backgroundColor: '#89b4fa',
    border: 'none',
    borderRadius: '8px',
    color: '#1e1e2e',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap' as const,
  },
  sendButtonDisabled: {
    backgroundColor: '#45475a',
    color: '#6c7086',
    cursor: 'not-allowed',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#6c7086',
    textAlign: 'center' as const,
    padding: '20px',
  },
  emptyStateIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  emptyStateTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#cdd6f4',
    marginBottom: '8px',
  },
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
const MemoryBadge: React.FC<{ indicator: MemoryIndicator }> = ({ indicator }) => {
  const getIcon = () => {
    switch (indicator.type) {
      case 'episodic': return '🧠';
      case 'semantic': return '📚';
      case 'skill': return '⚡';
    }
  };
  
  const getBadgeStyle = () => {
    switch (indicator.type) {
      case 'episodic': return { ...styles.memoryBadge, ...styles.memoryBadgeEpisodic };
      case 'semantic': return { ...styles.memoryBadge, ...styles.memoryBadgeSemantic };
      case 'skill': return { ...styles.memoryBadge, ...styles.memoryBadgeSkill };
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
const TypingIndicator: React.FC<{ agentName: string }> = ({ agentName }) => (
  <div style={styles.typingIndicator}>
    <div style={styles.typingDots}>
      <span style={{ ...styles.typingDot, animationDelay: '0s' }} />
      <span style={{ ...styles.typingDot, animationDelay: '0.2s' }} />
      <span style={{ ...styles.typingDot, animationDelay: '0.4s' }} />
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
}> = ({ message, showMemoryIndicators }) => {
  const isUser = message.senderType === 'user';
  const isSystem = message.senderType === 'system';
  
  const wrapperStyle = useMemo(() => ({
    ...styles.messageWrapper,
    ...(isUser ? styles.messageWrapperUser : {}),
    ...(isSystem ? styles.messageWrapperSystem : styles.messageWrapperAgent),
  }), [isUser, isSystem]);
  
  const messageStyle = useMemo(() => ({
    ...styles.message,
    ...(isUser ? styles.messageUser : {}),
    ...(isSystem ? styles.messageSystem : styles.messageAgent),
  }), [isUser, isSystem]);
  
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  return (
    <div style={wrapperStyle}>
      {!isUser && !isSystem && (
        <span style={styles.messageSender}>{message.senderName}</span>
      )}
      <div style={messageStyle}>
        {message.content}
      </div>
      <span style={styles.messageTime}>{formatTime(message.timestamp)}</span>
      {showMemoryIndicators && message.memoryIndicators && message.memoryIndicators.length > 0 && (
        <div style={styles.memoryIndicators}>
          {message.memoryIndicators.map((indicator, idx) => (
            <MemoryBadge key={`${indicator.memoryId}-${idx}`} indicator={indicator} />
          ))}
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
  onSendMessage,
  onClearChat,
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
  
  const containerStyle = useMemo(() => ({
    ...styles.container,
    ...(paneId === 'right' ? styles.containerRight : {}),
  }), [paneId]);
  
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
      <div style={styles.header}>
        <div style={styles.headerInfo}>
          <div style={styles.avatar}>
            {agent.avatarUrl ? (
              <img src={agent.avatarUrl} alt={agent.agentName} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
            ) : (
              getAvatarInitial()
            )}
          </div>
          <div style={styles.agentInfo}>
            <span style={styles.agentName}>{agent.agentName}</span>
            <span style={styles.agentType}>{agent.agentType} Agent</span>
          </div>
        </div>
        {onClearChat && (
          <button 
            style={styles.clearButton}
            onClick={handleClear}
            title="Clear chat history"
          >
            Clear
          </button>
        )}
      </div>
      
      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        style={styles.messagesContainer}
        onScroll={handleScroll}
      >
        {displayMessages.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyStateIcon}>💬</div>
            <div style={styles.emptyStateTitle}>Start a conversation</div>
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
              />
            ))}
            {isAgentTyping && <TypingIndicator agentName={agent.agentName} />}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
      
      {/* Input */}
      <div style={styles.inputContainer}>
        <div style={styles.inputWrapper}>
          <textarea
            ref={textareaRef}
            style={styles.textarea}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${agent.agentName}...`}
            rows={1}
            disabled={isLoading}
          />
          <button
            style={{
              ...styles.sendButton,
              ...(canSend ? {} : styles.sendButtonDisabled),
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