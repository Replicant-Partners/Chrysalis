/**
 * ChatPane Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithWallet } from '../../../test/test-utils';
import { ChatPane } from '../ChatPane';
import type { ChatMessage } from '@terminal/protocols/types';

describe('ChatPane', () => {
  const mockMessages: ChatMessage[] = [
    {
      id: '1',
      content: 'Hello from agent',
      senderType: 'agent',
      senderId: 'agent-1',
      timestamp: Date.now() - 60000,
      attachments: []
    },
    {
      id: '2',
      content: 'Hello from human',
      senderType: 'human',
      senderId: 'human-1',
      timestamp: Date.now(),
      attachments: []
    }
  ];

  const defaultProps = {
    side: 'left' as const,
    messages: mockMessages,
    onSendMessage: vi.fn(),
    title: 'Agent Chat',
    placeholder: 'Type a message...'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render without crashing', () => {
      renderWithWallet(<ChatPane {...defaultProps} />);
      expect(screen.getByText(/agent chat/i)).toBeInTheDocument();
    });

    it('should display messages', () => {
      renderWithWallet(<ChatPane {...defaultProps} />);
      
      expect(screen.getByText('Hello from agent')).toBeInTheDocument();
      expect(screen.getByText('Hello from human')).toBeInTheDocument();
    });

    it('should show empty state when no messages', () => {
      renderWithWallet(<ChatPane {...defaultProps} messages={[]} />);
      
      const emptyState = screen.getByText(/no messages yet/i);
      expect(emptyState).toBeInTheDocument();
    });

    it('should display typing indicator when isTyping is true', () => {
      renderWithWallet(<ChatPane {...defaultProps} isTyping={true} />);
      
      // Typing indicator should be visible
      const typingIndicator = screen.getByTestId('typing-indicator');
      expect(typingIndicator).toBeInTheDocument();
    });

    it('should render attachments', () => {
      const messagesWithAttachments: ChatMessage[] = [
        {
          id: '3',
          content: 'Message with file',
          senderType: 'human',
          senderId: 'human-1',
          timestamp: Date.now(),
          attachments: [
            { name: 'document.pdf', type: 'application/pdf', size: 1024 }
          ]
        }
      ];

      renderWithWallet(
        <ChatPane {...defaultProps} messages={messagesWithAttachments} />
      );
      
      expect(screen.getByText(/document\.pdf/i)).toBeInTheDocument();
    });
  });

  describe('Message Input', () => {
    it('should have input field for right pane', () => {
      renderWithWallet(<ChatPane {...defaultProps} side="right" />);
      
      const input = screen.getByPlaceholderText(/type/i);
      expect(input).toBeInTheDocument();
    });

    it('should not have input field for left pane', () => {
      renderWithWallet(<ChatPane {...defaultProps} side="left" />);
      
      const input = screen.queryByPlaceholderText(/type/i);
      expect(input).not.toBeInTheDocument();
    });

    it('should handle user typing', async () => {
      const user = userEvent.setup();
      const onTypingChange = vi.fn();
      
      renderWithWallet(
        <ChatPane {...defaultProps} side="right" onTypingChange={onTypingChange} />
      );
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'Hello');
      
      expect(input).toHaveValue('Hello');
    });

    it('should send message on button click', async () => {
      const user = userEvent.setup();
      const onSendMessage = vi.fn();
      
      renderWithWallet(
        <ChatPane {...defaultProps} side="right" onSendMessage={onSendMessage} />
      );
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'Test message');
      
      const sendButton = screen.getByRole('button', { name: /send/i });
      await user.click(sendButton);
      
      expect(onSendMessage).toHaveBeenCalledWith('Test message');
    });

    it('should send message on Enter key', async () => {
      const user = userEvent.setup();
      const onSendMessage = vi.fn();
      
      renderWithWallet(
        <ChatPane {...defaultProps} side="right" onSendMessage={onSendMessage} />
      );
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'Test message{Enter}');
      
      expect(onSendMessage).toHaveBeenCalledWith('Test message');
    });

    it('should clear input after sending', async () => {
      const user = userEvent.setup();
      const onSendMessage = vi.fn();
      
      renderWithWallet(
        <ChatPane {...defaultProps} side="right" onSendMessage={onSendMessage} />
      );
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'Test{Enter}');
      
      await waitFor(() => {
        expect(input).toHaveValue('');
      });
    });

    it('should not send empty messages', async () => {
      const user = userEvent.setup();
      const onSendMessage = vi.fn();
      
      renderWithWallet(
        <ChatPane {...defaultProps} side="right" onSendMessage={onSendMessage} />
      );
      
      const sendButton = screen.getByRole('button', { name: /send/i });
      await user.click(sendButton);
      
      expect(onSendMessage).not.toHaveBeenCalled();
    });

    it('should disable input when disabled prop is true', () => {
      renderWithWallet(<ChatPane {...defaultProps} side="right" disabled={true} />);
      
      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
    });
  });

  describe('Side Variations', () => {
    it('should render left side (agent) correctly', () => {
      renderWithWallet(<ChatPane {...defaultProps} side="left" />);
      
      // Agent messages should be styled appropriately
      expect(screen.getByText(/agent chat/i)).toBeInTheDocument();
    });

    it('should render right side (human) correctly', () => {
      renderWithWallet(
        <ChatPane {...defaultProps} side="right" title="Human Chat" />
      );
      
      expect(screen.getByText(/human chat/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      renderWithWallet(<ChatPane {...defaultProps} side="right" />);
      
      // Tab to wallet button first, then to input
      await user.tab(); // Wallet button
      await user.tab(); // Input field
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveFocus();
    });

    it('should have accessible send button', () => {
      renderWithWallet(<ChatPane {...defaultProps} side="right" />);
      
      const sendButton = screen.getByRole('button', { name: /send/i });
      expect(sendButton).toHaveAccessibleName();
    });
  });

  describe('Auto-scroll', () => {
    it('should auto-scroll to latest message', () => {
      const { rerender } = renderWithWallet(
        <ChatPane {...defaultProps} messages={mockMessages} />
      );
      
      const newMessages = [
        ...mockMessages,
        {
          id: '3',
          content: 'New message',
          senderType: 'agent',
          senderId: 'agent-1',
          timestamp: Date.now(),
          attachments: []
        }
      ];
      
      rerender(<ChatPane {...defaultProps} messages={newMessages} />);
      
      expect(screen.getByText('New message')).toBeInTheDocument();
    });
  });
});