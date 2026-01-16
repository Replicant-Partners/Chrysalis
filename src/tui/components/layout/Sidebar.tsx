// @ts-nocheck - Ink v6 types require moduleResolution: bundler/node16
/**
 * Sidebar Component
 *
 * Displays agent list, memory status, and sync status.
 *
 * @module tui/components/layout/Sidebar
 */

import React from 'react';
import { Box, Text } from 'ink';
import { useAgentStore } from '../../stores/agentStore';
import { AGENT_STATUS_DISPLAY } from '../../types/agents';

/**
 * Sidebar component
 */
export const Sidebar: React.FC = () => {
  const agents = useAgentStore((state) => state.getAgentList());

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
    >
      {/* Agents Section */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="white">AGENTS</Text>
        {agents.map((agent) => {
          const statusDisplay = AGENT_STATUS_DISPLAY[agent.status];
          return (
            <Box key={agent.id}>
              <Text color={statusDisplay.color}>
                {statusDisplay.icon} {agent.emoji} {agent.name}
              </Text>
            </Box>
          );
        })}
      </Box>

      {/* Memory Section */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="white">MEMORY</Text>
        <Text color="gray">├─ Episodic: <Text color="cyan">--</Text></Text>
        <Text color="gray">├─ Semantic: <Text color="cyan">--</Text></Text>
        <Text color="gray">└─ Skills: <Text color="cyan">--</Text></Text>
      </Box>

      {/* Sync Section */}
      <Box flexDirection="column">
        <Text bold color="white">SYNC</Text>
        <Text color="gray">└─ <Text color="green">✓</Text> Ready</Text>
      </Box>
    </Box>
  );
};

export default Sidebar;
