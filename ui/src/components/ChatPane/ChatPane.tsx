/**
 * ChatPane Component
 * 
 * Renders a chat pane for either agent (left) or human (right) conversations.
 * Features:
 * - Message list with auto-scroll
 * - Message input with send button
 * - Typing indicator
 * - Participant avatar/name display
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import type { ChatMessage } from '@terminal/protocols/common-types';
import { useWallet } from '../../contexts/WalletContext';
import styles from './ChatPane.module.css';

// ============================================================================
// Types
// ============================================================================

export interface ChatPaneProps {
  /** Which side this pane is on */
  side: 'left' | 'right';
  /** Messages to display */
  messages: ChatMessage[];
  /** Whether someone is typing */
  isTyping?: boolean;
  /** Called when user sends a message */
  onSendMessage: (content: string) => void;
  /** Called when user starts/stops typing */
  onTypingChange?: (isTyping: boolean) => void;
  /** Pane title */
  title?: string;
  /** Placeholder text for input */
  placeholder?: string;
  /** Whether input is disabled */
  disabled?: boolean;
  /** CSS class name */
  className?: string;
}

// ============================================================================
// Message Component
// ============================================================================

interface MessageItemProps {
  message: ChatMessage;
  side: 'left' | 'right';
}

function MessageItem({ message, side }: MessageItemProps) {
  const isAgent = message.senderType === 'agent' || side === 'left';
  
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div 
      className={clsx(
        styles.message,
        isAgent ? styles.agentMessage : styles.humanMessage
      )}
    >
      <div className={styles.messageHeader}>
        <span className={styles.senderName}>
          {isAgent ? '🤖 Agent' : '👤 You'}
        </span>
        <span className={styles.timestamp}>
          {formatTime(message.timestamp)}
        </span>
      </div>
      <div className={styles.messageContent}>
        {message.content}
      </div>
      {message.attachments && message.attachments.length > 0 && (
        <div className={styles.attachments}>
          {message.attachments.map((att: any, idx: number) => (
            <div key={idx} className={styles.attachment}>
              📎 {att.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Typing Indicator
// ============================================================================

function TypingIndicator({ side }: { side: 'left' | 'right' }) {
  return (
    <div className={styles.typingIndicator} data-testid="typing-indicator">
      <span className={styles.typingDot} />
      <span className={styles.typingDot} />
      <span className={styles.typingDot} />
      <span className={styles.typingText}>
        {side === 'left' ? 'Agent is typing...' : 'User is typing...'}
      </span>
    </div>
  );
}

// ============================================================================
// Chat Pane Component
// ============================================================================

export function ChatPane({
  side,
  messages,
  isTyping = false,
  onSendMessage,
  onTypingChange,
  title,
  placeholder,
  disabled = false,
  className
}: ChatPaneProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle input change with typing indicator
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputValue(value);

    if (onTypingChange) {
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set typing to true
      if (value.length > 0) {
        onTypingChange(true);
        // Set typing to false after 1 second of no input
        typingTimeoutRef.current = setTimeout(() => {
          onTypingChange(false);
        }, 1000);
      } else {
        onTypingChange(false);
      }
    }
  }, [onTypingChange]);

  // Handle send
  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (trimmed && !disabled) {
      onSendMessage(trimmed);
      setInputValue('');
      onTypingChange?.(false);
      inputRef.current?.focus();
    }
  }, [inputValue, disabled, onSendMessage, onTypingChange]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const wallet = useWallet();
  
  const defaultTitle = side === 'left' ? '🤖 Agent' : '👤 Human';
  const defaultPlaceholder = side === 'left'
    ? 'Agent messages appear here...'
    : 'Type your message...';

  return (
    <div className={clsx(styles.chatPane, styles[side], className)}>
      {/* Header */}
      <div className={styles.header}>
        <h3 className={styles.title}>{title || defaultTitle}</h3>
        <div className={styles.headerActions}>
          <button
            className={styles.walletButton}
            onClick={() => wallet.openModal()}
            title="API Key Wallet"
          >
            {wallet.isUnlocked ? '🔓' : '🔒'}
          </button>
          <div className={styles.connectionStatus}>
            <span className={styles.statusDot} />
            Connected
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className={styles.messageList}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              {side === 'left' ? '🤖' : '💬'}
            </div>
            <p>No messages yet</p>
            <p className={styles.emptyHint}>
              {side === 'left' 
                ? 'Agent messages will appear here'
                : 'Start a conversation!'}
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageItem key={msg.id} message={msg} side={side} />
          ))
        )}
        {isTyping && <TypingIndicator side={side} />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input - only show for human pane */}
      {side === 'right' && (
        <div className={styles.inputArea}>
          <textarea
            ref={inputRef}
            className={styles.input}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || defaultPlaceholder}
            disabled={disabled}
            rows={1}
          />
          <button
            className={styles.sendButton}
            onClick={handleSend}
            disabled={disabled || !inputValue.trim()}
            aria-label="Send message"
          >
            <SendIcon />
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Icons
// ============================================================================

function SendIcon() {
  return (
    <svg 
      width="20" 
      height="20" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

export default ChatPane;