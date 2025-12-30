import { chooseActionVariant, renderActionSequence, type ActionUXVariant } from './ActionEmojiUX';

/**
 * Action Emoji parser (draft)
 * 
 * Decodes emoji or text aliases into normalized action verbs.
 */

export const ACTION_EMOJI_MAP: Record<string, string> = {
  '🧠': 'reflect',
  '🔍': 'search',
  '📥': 'ingest',
  '🧹': 'dedupe',
  '🚦': 'slow',
  '🛰️': 'sync',
  '🧾': 'log',
  '🛡️': 'guard',
  '🎯': 'focus',
  '⏸️': 'pause',
  '▶️': 'resume'
};

export const ACTION_TO_EMOJI: Record<string, string> = Object.entries(ACTION_EMOJI_MAP).reduce((acc, [emoji, action]) => {
  acc[action] = emoji;
  return acc;
}, {} as Record<string, string>);

export const ACTION_ALIAS_MAP: Record<string, string> = {
  reflect: 'reflect',
  search: 'search',
  ingest: 'ingest',
  dedupe: 'dedupe',
  slow: 'slow',
  sync: 'sync',
  log: 'log',
  guard: 'guard',
  focus: 'focus',
  pause: 'pause',
  resume: 'resume',
  ':reflect:': 'reflect',
  ':search:': 'search'
};

/**
 * Parse a command string into normalized action tokens.
 * Returns an array of verbs in the order encountered.
 */
export function parseActionCommands(input: string): string[] {
  if (!input) return [];
  const results: string[] = [];
  const words = input.trim().split(/\s+/);

  for (const word of words) {
    if (!word) continue;

    if (ACTION_EMOJI_MAP[word]) {
      results.push(ACTION_EMOJI_MAP[word]);
      continue;
    }

    if (ACTION_ALIAS_MAP[word.toLowerCase()]) {
      results.push(ACTION_ALIAS_MAP[word.toLowerCase()]);
      continue;
    }

    for (const char of Array.from(word)) {
      if (ACTION_EMOJI_MAP[char]) {
        results.push(ACTION_EMOJI_MAP[char]);
      }
    }
  }

  return results;
}

/**
 * Parse and render with UX variant selection (emoji/text/both).
 */
export function interpretActionInput(input: string, variant?: ActionUXVariant): { actions: string[]; label: string; variant: ActionUXVariant } {
  const actions = parseActionCommands(input);
  const resolvedVariant = variant || chooseActionVariant();
  const label = renderActionSequence(actions, resolvedVariant);
  return { actions, label, variant: resolvedVariant };
}
