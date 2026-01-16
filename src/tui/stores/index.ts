/**
 * TUI Stores Index
 *
 * Re-exports all Zustand stores for the TUI.
 *
 * @module tui/stores
 */

export { useMessageStore } from './messageStore';
export type { MessageStore } from './messageStore';

export { useAgentStore } from './agentStore';
export type { AgentStore } from './agentStore';

export { useConfigStore } from './configStore';
export type { ConfigStore } from './configStore';

// TODO: Add these stores
// export { useMemoryStore } from './memoryStore';
// export { useSyncStore } from './syncStore';
