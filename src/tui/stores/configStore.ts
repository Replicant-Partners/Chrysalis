/**
 * Config Store (Zustand)
 *
 * Manages TUI configuration state.
 *
 * @module tui/stores/configStore
 */

import { create } from 'zustand';
import type { TUIConfig } from '../types/config';
import { DEFAULT_CONFIG } from '../types/config';

/**
 * Config store state
 */
interface ConfigState extends TUIConfig {}

/**
 * Config store actions
 */
interface ConfigActions {
  /** Set sidebar visibility */
  setSidebarVisible: (visible: boolean) => void;

  /** Toggle sidebar */
  toggleSidebar: () => void;

  /** Set focused agent */
  setFocusedAgent: (agentId: string | null) => void;

  /** Set show tokens */
  setShowTokens: (show: boolean) => void;

  /** Set show cost */
  setShowCost: (show: boolean) => void;

  /** Set auto-save */
  setAutoSave: (autoSave: boolean) => void;

  /** Set session path */
  setSessionPath: (path: string) => void;

  /** Set ACP URL */
  setAcpUrl: (url: string) => void;

  /** Set debug mode */
  setDebug: (debug: boolean) => void;

  /** Reset to defaults */
  resetConfig: () => void;

  /** Update multiple config values */
  updateConfig: (updates: Partial<TUIConfig>) => void;
}

/**
 * Combined store type
 */
type ConfigStore = ConfigState & ConfigActions;

/**
 * Create config store
 */
export const useConfigStore = create<ConfigStore>((set) => ({
  // Initial state (from defaults)
  ...DEFAULT_CONFIG,

  // Actions
  setSidebarVisible: (visible) => {
    set({ sidebarVisible: visible });
  },

  toggleSidebar: () => {
    set((state) => ({ sidebarVisible: !state.sidebarVisible }));
  },

  setFocusedAgent: (agentId) => {
    set({ focusedAgent: agentId });
  },

  setShowTokens: (show) => {
    set({ showTokens: show });
  },

  setShowCost: (show) => {
    set({ showCost: show });
  },

  setAutoSave: (autoSave) => {
    set({ autoSave });
  },

  setSessionPath: (path) => {
    set({ sessionPath: path });
  },

  setAcpUrl: (url) => {
    set({ acpUrl: url });
  },

  setDebug: (debug) => {
    set({ debug });
  },

  resetConfig: () => {
    set(DEFAULT_CONFIG);
  },

  updateConfig: (updates) => {
    set(updates);
  },
}));

export type { ConfigStore };
