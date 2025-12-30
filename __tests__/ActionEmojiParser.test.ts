import { parseActionCommands, interpretActionInput } from '../src/cli/ActionEmojiParser';
import { chooseActionVariant, renderActionSequence } from '../src/cli/ActionEmojiUX';

describe('ActionEmojiParser', () => {
  test('parses emoji and text aliases', () => {
    expect(parseActionCommands('🧠 🔍')).toEqual(['reflect', 'search']);
    expect(parseActionCommands('reflect :search:')).toEqual(['reflect', 'search']);
    expect(parseActionCommands('mixed🧠text')).toContain('reflect');
  });

  test('interpretActionInput respects variant', () => {
    const interpreted = interpretActionInput('🧠', 'text-only');
    expect(interpreted.variant).toBe('text-only');
    expect(interpreted.label).toBe('reflect');
  });
});

describe('ActionEmojiUX', () => {
  test('renders labels per variant', () => {
    expect(renderActionSequence(['reflect'], 'emoji-first')).toMatch(/🧠/);
    expect(renderActionSequence(['reflect'], 'text-first')).toMatch(/reflect/);
    expect(renderActionSequence(['reflect'], 'text-only')).toBe('reflect');
  });

  test('variant selection falls back to both', () => {
    expect(chooseActionVariant('unknown')).toBe('both');
  });
});
