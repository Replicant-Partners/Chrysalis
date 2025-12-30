import { ACTION_TO_EMOJI } from './ActionEmojiParser';

export type ActionUXVariant = 'emoji-first' | 'text-first' | 'text-only' | 'both';

export function chooseActionVariant(envVariant?: string): ActionUXVariant {
  const variant = (envVariant || process.env.ACTION_EMOJI_VARIANT || '').toLowerCase();
  if (variant === 'emoji-first' || variant === 'text-first' || variant === 'text-only' || variant === 'both') {
    return variant;
  }
  return 'both';
}

export function renderActionLabel(action: string, variant: ActionUXVariant): string {
  const emoji = ACTION_TO_EMOJI[action];
  switch (variant) {
    case 'emoji-first':
      return emoji ? `${emoji} ${action}` : action;
    case 'text-first':
      return emoji ? `${action} ${emoji}` : action;
    case 'text-only':
      return action;
    case 'both':
      return emoji ? `${emoji} ${action}` : action;
    default:
      return emoji ? `${emoji} ${action}` : action;
  }
}

export function renderActionSequence(actions: string[], variant: ActionUXVariant): string {
  return actions.map(a => renderActionLabel(a, variant)).join(' → ');
}
