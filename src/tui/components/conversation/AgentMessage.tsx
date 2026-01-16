// @ts-nocheck - Ink v6 types require moduleResolution: bundler/node16
/**
 * Agent Message Component
 *
 * Renders a single agent message with speaker label and content.
 *
 * @module tui/components/conversation/AgentMessage
 */

import React from 'react';
import { Box, Text } from 'ink';
import { useAgentStore } from '../../stores/agentStore';
import { AGENT_COLORS } from '../../types/config';
import type { AgentMessage, ToolExecution } from '../../types/messages';

interface AgentMessageViewProps {
  message: AgentMessage;
  isStreaming?: boolean;
}

/**
 * Agent message component
 */
export const AgentMessageView: React.FC<AgentMessageViewProps> = (props) => {
  const { message, isStreaming = false } = props;
  const agent = useAgentStore((state) => state.getAgent(message.agentId));

  // Get color scheme for agent
  const colorScheme = AGENT_COLORS[message.agentRole] || AGENT_COLORS.default;

  // Determine if this is a handoff
  const isHandoff = !!message.handoffFrom;

  return (
    <Box flexDirection="column" marginY={1} marginLeft={isHandoff ? 4 : 0}>
      {/* Handoff indicator */}
      {isHandoff && (
        <Text color="gray">└──▶ </Text>
      )}

      {/* Speaker label */}
      <Box>
        <Text bold color={colorScheme.primary}>
          {colorScheme.emoji} {message.agentName}
        </Text>
        {agent?.model && (
          <Text color="gray"> ({agent.model})</Text>
        )}
      </Box>

      {/* Separator line */}
      <Text color={colorScheme.primary}>
        {'─'.repeat(40)}
      </Text>

      {/* Message content */}
      <Box paddingLeft={0}>
        <Text wrap="wrap">
          {message.content}
          {isStreaming && <Text color="gray">▌</Text>}
        </Text>
      </Box>

      {/* Tool executions */}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {message.toolCalls.map((tool: ToolExecution) => (
            <Box key={tool.id} marginLeft={2}>
              <Text color={tool.status === 'success' ? 'green' : tool.status === 'error' ? 'red' : 'yellow'}>
                {tool.status === 'running' ? '⏳' : tool.status === 'success' ? '✅' : tool.status === 'error' ? '❌' : '📋'}
                {' '}{tool.name}
                {tool.duration && <Text color="gray"> ({tool.duration}ms)</Text>}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Metrics (if complete) */}
      {message.metrics && !isStreaming && (
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            [{message.metrics.outputTokens} tokens, ${message.metrics.cost.toFixed(4)}, {message.metrics.duration}ms]
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default AgentMessageView;
