// @ts-nocheck - Ink v6 types require moduleResolution: bundler/node16
/**
 * Conversation Pane Component
 *
 * Displays the conversation stream with agent messages.
 *
 * @module tui/components/conversation/ConversationPane
 */

import React from 'react';
import { Box, Text, Static } from 'ink';
import { useMessageStore } from '../../stores/messageStore';
import { AgentMessageView } from './AgentMessage';
import { isAgentMessage, isUserMessage, isSystemMessage, type Message } from '../../types/messages';

interface ConversationPaneProps {
  height?: number;
}

/**
 * Conversation pane component
 */
export const ConversationPane: React.FC<ConversationPaneProps> = (props) => {
  const { height: _height } = props; // height reserved for future scroll implementation
  const messages = useMessageStore((state) => state.messages);
  const streamingId = useMessageStore((state) => state.streamingMessageId);

  // Separate static (completed) and dynamic (streaming) messages
  const staticMessages = messages.filter((msg) =>
    !('streaming' in msg) || !msg.streaming
  );

  const streamingMessage = streamingId
    ? messages.find((msg) => msg.id === streamingId)
    : null;

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      paddingX={1}
      overflow="hidden"
    >
      {/* Static messages (won't re-render) */}
      <Static items={staticMessages}>
        {(message: Message) => {
          if (isAgentMessage(message)) {
            return (
              <AgentMessageView
                key={message.id}
                message={message}
              />
            );
          }

          if (isUserMessage(message)) {
            return (
              <Box key={message.id} marginY={1}>
                <Text color="blue">
                  {'>'} {message.content}
                </Text>
              </Box>
            );
          }

          if (isSystemMessage(message)) {
            const color = message.type === 'error' ? 'red'
              : message.type === 'warning' ? 'yellow'
              : message.type === 'success' ? 'green'
              : 'gray';

            return (
              <Box key={message.id}>
                <Text color={color}>
                  [System] {message.content}
                </Text>
              </Box>
            );
          }

          return null;
        }}
      </Static>

      {/* Streaming message (dynamic) */}
      {streamingMessage && isAgentMessage(streamingMessage) && (
        <AgentMessageView
          message={streamingMessage}
          isStreaming
        />
      )}

      {/* Empty state */}
      {messages.length === 0 && (
        <Box flexGrow={1} justifyContent="center" alignItems="center">
          <Text color="gray">
            No messages yet. Type a message or /help for commands.
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default ConversationPane;
