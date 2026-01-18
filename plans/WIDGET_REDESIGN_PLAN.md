# Widget Redesign Plan

## Status
NoteWidget redesigned (1/17 complete). Remaining widgets need redesign to follow tokens.ts + integrate with ChrysalisWorkspace.

## Redesign Requirements

Per `docs/architecture/UI_UX_STRATEGY_2026.md` and `src/components/shared/tokens.ts`:

**NO bright colors. NO hardcoded hex values. Use design tokens only.**

- Background: `tokens.color.surface.*`
- Text: `tokens.color.text.*`
- Borders: `tokens.color.border.*`
- Trust indicators: `tokens.color.trust.*`
- Spacing: `tokens.spacing.*`
- Radius: `tokens.radius.*`
- Typography: `tokens.typography.*`

## Widgets Needing Redesign (16)

- [ ]LinkWidget - remove bright blue #2196f3
- [ ] ArtifactWidget - remove colored backgrounds
- [ ] ConfigWidget - neutral design
- [ ] ConnectionWidget - neutral with trust indicator
- [ ] CitationWidget - remove purple #9c27b0
- [ ] SynthesisWidget - remove yellow #fff8e1
- [ ] HypothesisWidget - neutral status indicators
- [ ] WikiPageWidget - remove green #00796b
- [ ] WikiSectionWidget - neutral hierarchy
- [ ] WikiLinkWidget - neutral link display
- [ ] TeamGroupWidget - remove purple #f3e5f5
- [ ] TerminalSessionWidget - keep dark terminal but use tokens
- [ ] BrowserTabWidget - neutral tab display
- [ ] CodeEditorWidget - keep syntax but use tokens
- [ ] SourceWidget - neutral reference card
- [ ] AgentCardWidget - use tokens.color.trust.*

## Integration Tasks

1. [ ] Replace standalone sc/canvas-app with integration into ChrysalisWorkspace
2. [ ] Connect BaseCanvas to existing AgentCanvas or replace it
3. [ ] Hook widgets into ChatPane token distribution system
4. [ ] Test in actual 3-pane layout
5. [ ] Verify YJS sync works with new widgets
6. [ ] Test document drop-to-learn with new widgets

## Cost
$43.91 spent. Need systematic rework following proper investigation methodology per AGENT.md.
