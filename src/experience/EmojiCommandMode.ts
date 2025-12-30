type EmojiSetName = 'noto' | 'fluent' | 'open' | 'custom';

type CanonicalAction =
  | 'observe'
  | 'orient'
  | 'decide'
  | 'act'
  | 'sync'
  | 'hash'
  | 'sign'
  | 'verify'
  | 'merkle'
  | 'random'
  | 'skill-up'
  | 'knowledge-add'
  | 'gossip'
  | 'stop';

type EmojiMapping = Record<CanonicalAction, string>;

type Command = {
  action: CanonicalAction;
  payload?: Record<string, any>;
};

const noto: EmojiMapping = {
  'observe': '👁️',
  'orient': '🧭',
  'decide': '🧠',
  'act': '⚡',
  'sync': '🔄',
  'hash': '#️⃣',
  'sign': '✍️',
  'verify': '✅',
  'merkle': '🌳',
  'random': '🎲',
  'skill-up': '📈',
  'knowledge-add': '📚',
  'gossip': '📢',
  'stop': '🛑'
};

const fluent: EmojiMapping = {
  'observe': '👀',
  'orient': '🧭',
  'decide': '🧠',
  'act': '⚡',
  'sync': '🔁',
  'hash': '#️⃣',
  'sign': '🖊️',
  'verify': '☑️',
  'merkle': '🌲',
  'random': '🎲',
  'skill-up': '📊',
  'knowledge-add': '📘',
  'gossip': '📣',
  'stop': '⛔'
};

const open: EmojiMapping = {
  'observe': '👁',
  'orient': '🧭',
  'decide': '🧠',
  'act': '⚡',
  'sync': '🔄',
  'hash': '#️⃣',
  'sign': '✒️',
  'verify': '✅',
  'merkle': '🌴',
  'random': '🎲',
  'skill-up': '📈',
  'knowledge-add': '📗',
  'gossip': '📢',
  'stop': '🛑'
};

const registry: Record<EmojiSetName, EmojiMapping> = {
  noto,
  fluent,
  open,
  custom: { ...noto }
};

export class EmojiCommandMode {
  private mapping: EmojiMapping;

  constructor(set: EmojiSetName = 'noto', custom?: EmojiMapping) {
    this.mapping = set === 'custom' && custom ? custom : registry[set];
  }

  setEmojiSet(set: EmojiSetName, custom?: EmojiMapping) {
    this.mapping = set === 'custom' && custom ? custom : registry[set];
  }

  encode(action: CanonicalAction): string {
    return this.mapping[action];
  }

  decode(token: string): Command | null {
    const entry = Object.entries(this.mapping).find(([, emoji]) => emoji === token);
    if (!entry) return null;
    return { action: entry[0] as CanonicalAction };
  }

  decodeSequence(tokens: string[]): Command[] {
    return tokens.map(t => this.decode(t)).filter(Boolean) as Command[];
  }
}
