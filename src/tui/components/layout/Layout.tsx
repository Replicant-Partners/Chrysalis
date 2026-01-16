// @ts-nocheck - Ink v6 types require moduleResolution: bundler/node16
/**
 * Layout Component
 *
 * Main layout wrapper for the TUI.
 *
 * @module tui/components/layout/Layout
 */

import React from 'react';
import { Box } from 'ink';

interface LayoutProps {
  children: React.ReactNode;
}

/**
 * Main layout component
 */
export const Layout: React.FC<LayoutProps> = (props) => {
  const { children } = props;
  return (
    <Box flexDirection="column" flexGrow={1}>
      {children}
    </Box>
  );
};

export default Layout;
