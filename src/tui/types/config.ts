/**
 * TUI Configuration Types
 *
 * @module tui/types/config
 */

/**
 * Options passed to startTUI()
 */
export interface TUIOptions {
  /** Start with specific agent focused */
  agent?: string;

  /** Resume existing session by ID */
  session?: string;

  /** Hide sidebar on start */
  noSidebar?: boolean;

  /** Custom ACP server URL */
  acpUrl?: string;

  /** Enable debug mode */
  debug?: boolean;
}

/**
 * Runtime configuration state
 */
export interface TUIConfig {
  /** Is sidebar visible */
  sidebarVisible: boolean;

  /** Currently focused agent */
  focusedAgent: string | null;

  /** Show token counts */
  showTokens: boolean;

  /** Show cost estimates */
  showCost: boolean;

  /** Auto-save sessions */
  autoSave: boolean;

  /** Session storage path */
  sessionPath: string;

  /** ACP server URL */
  acpUrl: string;

  /** Debug mode */
  debug: boolean;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: TUIConfig = {
  sidebarVisible: true,
  focusedAgent: null,
  showTokens: true,
  showCost: true,
  autoSave: true,
  sessionPath: '~/.chrysalis/sessions',
  acpUrl: 'stdio://',
  debug: false,
};

/**
 * Agent color scheme
 */
export interface AgentColorScheme {
  /** Primary color for speaker label */
  primary: string;

  /** Secondary color for borders/accents */
  secondary: string;

  /** Emoji for agent role */
  emoji: string;
}

/**
 * Predefined agent colors
 */
export const AGENT_COLORS: Record<string, AgentColorScheme> = {
  architect: {
    primary: 'yellow',
    secondary: 'yellowBright',
    emoji: '🏗️',
  },
  coder: {
    primary: 'green',
    secondary: 'greenBright',
    emoji: '💻',
  },
  reviewer: {
    primary: 'magenta',
    secondary: 'magentaBright',
    emoji: '🔍',
  },
  researcher: {
    primary: 'cyan',
    secondary: 'cyanBright',
    emoji: '📚',
  },
  tester: {
    primary: 'blue',
    secondary: 'blueBright',
    emoji: '🧪',
  },
  default: {
    primary: 'white',
    secondary: 'gray',
    emoji: '🤖',
  },
};
