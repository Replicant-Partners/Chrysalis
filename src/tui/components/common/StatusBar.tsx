// @ts-nocheck - Ink v6 types require moduleResolution: bundler/node16
/**
 * Status Bar Component
 *
 * Displays token count, cost, and help hint.
 *
 * @module tui/components/common/StatusBar
 */

import React from 'react';
import { Box, Text } from 'ink';
import { useMessageStore } from '../../stores/messageStore';
import { useConfigStore } from '../../stores/configStore';

/**
 * Status bar component
 */
export const StatusBar: React.FC = () => {
  const totalTokens = useMessageStore((state) => state.totalTokens);
  const totalCost = useMessageStore((state) => state.totalCost);
  const showTokens = useConfigStore((state) => state.showTokens);
  const showCost = useConfigStore((state) => state.showCost);

  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      justifyContent="space-between"
    >
      <Box>
        {showTokens && (
          <Text color="gray">
            Tokens: <Text color="cyan">{totalTokens.toLocaleString()}</Text>
          </Text>
        )}
        {showTokens && showCost && <Text color="gray"> │ </Text>}
        {showCost && (
          <Text color="gray">
            Cost: <Text color="green">${totalCost.toFixed(4)}</Text>
          </Text>
        )}
      </Box>
      <Text color="gray">/help for commands</Text>
    </Box>
  );
};

export default StatusBar;
