# Action Emoji Language (Draft)

## Purpose
Lightweight, shareable command vocabulary for interacting with agents in chat/CLI/GUI using emojis + optional text aliases.

## Core Vocabulary (proposal)
- 🧠 `reflect` – run self-check / reasoning trace
- 🔍 `search` – retrieve knowledge or browse
- 📥 `ingest` – capture new memory/input
- 🧹 `dedupe` – run memory merge/deduplication
- 🚦 `slow` – enable slow-mo voyeur mode
- 🛰️ `sync` – initiate experience sync
- 🧾 `log` – show recent events/trace
- 🛡️ `guard` – enforce safety/security checks
- 🎯 `focus` – set current goal/intent
- ⏸️ `pause` / ▶️ `resume` – control execution

Pair each emoji with text alias for accessibility and clarity (e.g., `:reflect`).

## Interaction Patterns
- **Inline commands**: “🧠 then 🔍 customer-feedback”  
- **Macros**: Emoji sequences mapped to workflows (e.g., `🧠🧹🛰️` = reflect → dedupe → sync).  
- **Dual-mode**: Accept emoji or text (`reflect`, `:reflect:`) to avoid ambiguity and support screen readers.

## Viral Potential
- **Low-friction sharing**: Emoji snippets are easy to copy/paste across chat apps.  
- **Cross-lingual**: Reduces language barriers; must provide legend for meaning.  
- **Memorable hooks**: Visual mnemonics aid recall and community memes.  
- **Gamification**: Streaks/badges for sequences encourage experimentation.  
- **Risks**: Cultural ambiguity, accessibility gaps, overloading meanings. Mitigate with clear docs, tooltips, and text fallbacks.

## Guardrails
- Provide legends/tooltips; default to text echo (“🧠 reflect”).  
- Accessibility mode: replace emojis with words; ensure screen-reader labels.  
- Validation: unknown emojis are echoed with suggestions, not executed.

## A/B Variants (accessibility)
- `emoji-first`: emoji + text (default playful mode).  
- `text-first`: text + emoji (clearer for screen readers).  
- `text-only`: no emoji, purely verbal.  
- Set via `ACTION_EMOJI_VARIANT` env; see `src/cli/ActionEmojiUX.ts`.
- Helper: `interpretActionInput(input)` in `src/cli/ActionEmojiParser.ts` parses and renders using the selected variant.

## References & Signals
- Emoji adoption studies (Unicode Consortium usage reports, platform telemetry).  
- Visual language precedents: Slack emoji commands, GitHub reactions, IDE lightbulb hints.  
- Cognitive benefits of pictograms in UI/UX research (icon-based affordances).
