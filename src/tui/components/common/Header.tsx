// @ts-nocheck - Ink v6 types require moduleResolution: bundler/node16
/**
 * Header Component
 *
 * Displays application title and sync status.
 *
 * @module tui/components/common/Header
 */

import React from 'react';
import { Box, Text } from 'ink';

/**
 * Header component
 */
export const Header: React.FC = () => {
  return (
    <Box
      borderStyle="single"
      borderColor="cyan"
      paddingX={1}
      justifyContent="space-between"
    >
      <Text bold color="cyan">
        🦋 CHRYSALIS v3.1.1
      </Text>
      <Text color="green">
        [Byzantine: ✅ Synced]
      </Text>
    </Box>
  );
};

export default Header;
