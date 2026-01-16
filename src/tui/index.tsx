#!/usr/bin/env node
// @ts-nocheck - Ink v6 types require moduleResolution: bundler/node16
/**
 * Chrysalis TUI - Multi-Agent Chat Interface
 *
 * Ink-based terminal user interface for multi-agent conversations.
 * This is the entry point for `chrysalis chat` command.
 *
 * @module tui
 * @see docs/specs/INK_CHAT_IMPLEMENTATION_PLAN.md
 * @see docs/specs/TUI_CHAT_INTERFACE_RECOMMENDATION.md
 */

import React from 'react';
import { render } from 'ink';
import { ChrysalisApp } from './App';
import type { TUIOptions } from './types/config';

/**
 * Start the Chrysalis TUI
 *
 * @param options - TUI configuration options
 * @returns Promise that resolves when TUI exits
 */
export async function startTUI(options: TUIOptions = {}): Promise<void> {
  const { waitUntilExit } = render(
    <ChrysalisApp options={options} />
  );

  await waitUntilExit();
}

/**
 * Export for programmatic usage
 */
export { ChrysalisApp } from './App';
export type { TUIOptions } from './types/config';

// If running directly (not imported)
if (require.main === module) {
  startTUI().catch((err) => {
    console.error('TUI Error:', err);
    process.exit(1);
  });
}
