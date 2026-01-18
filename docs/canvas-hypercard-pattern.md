# Canvas HyperCard Visual Language

## The Role of HyperCards

### What HyperCards Are

In the Chrysalis canvas system, **HyperCards are the visual representation layer for entities**. When any object becomes a widget within a canvas context, its top-level UI becomes a HyperCard representation.

**Core Function:**  
HyperCards serve as the **interface between abstract data entities and human perception**. They transform:
- Files → Visual cards showing type and preview
- URLs → Linkable cards with favicon and title
- Text → Editable note cards
- Code → Syntax-highlighted code cards
- Agents → Status cards with indicators
- Configuration → Editable setting cards

### Why HyperCards Matter

**1. Cognitive Load Reduction**  
Without HyperCards, users face raw data structures. HyperCards provide:
- Instant visual type identification via icons
- Scannable previews without opening full content  
- Consistent interaction patterns across entity types

**2. Spatial Memory Alignment**  
Humans remember spatial relationships. HyperCards enable:
- Physical positioning of related concepts
- Visual clustering of similar content
- Spatial navigation through knowledge

**3. Context Preservation**  
Each HyperCard maintains its identity across:
- Canvas saves/loads
- Drag-and-drop operations
- Cross-canvas references
- Collaborative edits

### HyperCard Lifecycle

```
External Entity (file/URL/text)
    ↓ drag-and-drop onto canvas
Widget Type Determination (based on canvas policy + content analysis)
    ↓ validation
HyperCard Instantiation (icon + preview + controls)
    ↓ render
Visual Card on Canvas (user can see, drag, edit)
    ↓ persist
Data + Position saved to DataSource
```

### HyperCard Components

Every HyperCard contains:

1. **Header Bar**
   - Icon (type indicator 📝🔗💻🌐⚙️)
   - Title/Label
   - Status indicators (color dots, badges)

2. **Content Preview**
   - Truncated view of actual content
   - Type-appropriate formatting
   - Expand/collapse controls

3. **Action Controls**
   - Edit button
   - Delete/Close
   - Type-specific actions (Test Connection, Run Command, etc.)

4. **Metadata Footer**
   - Tags, categories
   - Timestamps
   - Source attribution

## Pattern Overview

When entities (files, URLs, text, data) are dropped onto a canvas, they are converted into widgets. Each widget's top-level UI representation follows the **HyperCard pattern**: a card-style container with an icon indicating the content type.

## Core Principle

**Any object that becomes a widget gets a HyperCard representation**  
- Card container with border, shadow, padding
- Type-specific icon showing what it contains
- Compact preview of content
- Consistent styling within canvas themes

## Widget Types and Icons

### Scrapbook Canvas
- **NoteWidget** 📝 - Yellow sticky note card, expandable text content
- **LinkWidget** 🔗 - Blue bordered card with clickable URL
- **ArtifactWidget** - Type-specific cards:
  - Code: 💻 (dark background, syntax highlighting)
  - Text: 📄 (light background, readable text)
  - Image: 🖼️ (image preview)
  - Data: 📊 (structured data view)

### Research Canvas
- **SourceWidget** 📄 - White card with URL and excerpt
- **CitationWidget** 📚 - Purple card with authors, year, DOI
- **SynthesisWidget** 💡 - Yellow card with confidence indicator
- **HypothesisWidget** 🔬 - Status-colored border (proposed/testing/validated/refuted)

###Settings Canvas
- **ConfigWidget** ⚙️ - System settings key-value pairs
- **ConnectionWidget** 🔌 - Service connection status with colored indicator

### Wiki Canvas
- **WikiPageWidget** 📄 - Green bordered full page card
- **WikiSectionWidget** 📋 - Section with heading hierarchy (H1/H2/H3)
- **WikiLinkWidget** 🔗 - Internal/external link cards

### Agent Canvas
- **AgentCardWidget** 🤖 - Agent status with colored state indicator
- **TeamGroupWidget** 👥 - Purple dashed card with member list

### Terminal-Browser Canvas
- **TerminalSessionWidget** 💻 - Dark terminal-style card with command input
- **BrowserTabWidget** 🌐 - Browser tab card with URL and status
- **CodeEditorWidget** 📝 - Code editor with language badge

## Drag-and-Drop Conversion Rules

When items are dragged onto a canvas:

1. **URL dropped** → Creates **LinkWidget** (🔗 card with URL)
2. **File dropped** → Creates **ArtifactWidget** with type-specific icon:
   - `.ts, .tsx, .js, .jsx, .py` → Code artifact 💻
   - `.json, .csv, .xml` → Data artifact 📊  
   - `.png, .jpg, .gif, .svg` → Image artifact 🖼️
   - Other text files → Text artifact 📄
3. **Plain text dropped** → Creates **NoteWidget** (📝 sticky note card)

## Widget Validation

Canvases enforce widget type policies:
- Each canvas has `allowedWidgetTypes` list
- Drop attempts are validated against the list
- Invalid widgets are rejected with visual feedback
- Policy violations emit events for logging

## Visual Consistency

All widgets follow HyperCard principles:
- **Card metaphor**: bordered containers with padding
- **Icon indication**: every widget shows what it contains
- **Preview content**: show enough to identify without opening
- **Action buttons**: edit, expand, save consistently placed
- **Status indication**: colors/badges show state (active/error/loaded)

## Implementation Pattern

```typescript
// Every widget follows this structure:
<div style={{
  padding: 'Xpx',
  background: 'color',
  border: '2px solid color',
  borderRadius: '8px',
  minWidth: 'Xpx',
  boxShadow: '0 2px Xpx rgba(...)'
}}>
  <div>{icon} {label}</div>
  <div>{content preview}</div>
  <div>{action buttons}</div>
</div>
```

## Design Rationale

HyperCard pattern chosen because:
1. **Familar metaphor** - users understand cards/note cards intuitively
2. **Visual scanning** - icons let users quickly identify content types
3. **Consistent interaction** - all widgets behave similarly
4. **Scalable** - pattern works from 1 widget to 1000+ widgets
5. **Accessible** - clear visual hierarchy, screen reader friendly

## References

- Based on Apple HyperCard (1987) interaction paradigm
- Modern implementations: Notion, Obsidian, Roam Research
- Widgets as first-class entities in canvas-based UIs
