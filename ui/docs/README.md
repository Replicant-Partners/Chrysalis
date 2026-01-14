# Chrysalis Terminal UI - Documentation Hub

**Version:** 1.0.0  
**Last Updated:** January 10, 2026  
**Framework:** React 18 + TypeScript + Vite

Welcome to the Chrysalis Terminal UI documentation. This is the central navigation hub for all frontend-related documentation.

---

## 🎯 Quick Navigation

### For New Developers
1. **[Getting Started](../README.md)** - Setup and run the UI
2. **[Component Architecture](./architecture/COMPONENT_ARCHITECTURE.md)** - Understanding the component structure
3. **[Design System](../src/styles/README.md)** - Tokens, components, styling

### For Contributors
1. **[Development Guide](./guides/DEVELOPMENT.md)** - Development workflow
2. **[Component Guide](./guides/COMPONENT_GUIDE.md)** - Creating new components
3. **[Implementation Status](./status/IMPLEMENTATION_STATUS.md)** - Current progress

### For Architects
1. **[Terminal Architecture](./CHRYSALIS_TERMINAL_ARCHITECTURE.md)** - System design specification
2. **[State Management](./architecture/STATE_MANAGEMENT.md)** - Zustand + YJS patterns
3. **[Backend Integration](./api/BACKEND_INTEGRATION.md)** - API contracts

---

## 📚 Documentation Structure

```
ui/docs/
├── README.md (this file)                 # Navigation hub
│
├── architecture/                         # Architecture documentation
│   ├── README.md                         # Architecture overview
│   ├── COMPONENT_ARCHITECTURE.md         # Component design patterns
│   ├── STATE_MANAGEMENT.md               # State & data flow
│   └── CANVAS_SYSTEM.md                  # Canvas architecture
│
├── guides/                               # Developer guides
│   ├── GETTING_STARTED.md                # Quick start guide
│   ├── DEVELOPMENT.md                    # Development workflow
│   └── COMPONENT_GUIDE.md                # Component development
│
├── api/                                  # API & integration
│   ├── BACKEND_INTEGRATION.md            # Backend API contracts
│   └── DATA_MODELS.md                    # TypeScript interfaces
│
├── status/                               # Implementation tracking
│   └── IMPLEMENTATION_STATUS.md          # Current status (not history)
│
└── archive/                              # Historical materials
    ├── README.md                         # Archive index
    └── 2026-01/                          # Dated archives
        └── clarification-sessions/       # Q&A sessions
```

---

## 🔍 Active Documentation

### Core Specifications

| Document | Purpose | Audience |
|----------|---------|----------|
| [Terminal Architecture](./CHRYSALIS_TERMINAL_ARCHITECTURE.md) | System design, canvas types, access control | Architects, Senior Devs |
| [Component Architecture](./architecture/COMPONENT_ARCHITECTURE.md) | Component patterns, organization | All Developers |
| [State Management](./architecture/STATE_MANAGEMENT.md) | Zustand stores, YJS integration | All Developers |
| [Design System](../src/styles/README.md) | Tokens, animations, utilities | UI Developers |

### Developer Guides

| Document | Purpose | Audience |
|----------|---------|----------|
| [Getting Started](../README.md) | Setup, install, run | New Developers |
| [Development Guide](./guides/DEVELOPMENT.md) | Workflow, testing, linting | All Developers |
| [Component Guide](./guides/COMPONENT_GUIDE.md) | Create new components | UI Developers |

### API & Data

| Document | Purpose | Audience |
|----------|---------|----------|
| [Backend Integration](./api/BACKEND_INTEGRATION.md) | API contracts, WebSocket | Backend Integration |
| [Data Models](./api/DATA_MODELS.md) | TypeScript interfaces | All Developers |

### Status & Progress

| Document | Purpose | Audience |
|----------|---------|----------|
| [Implementation Status](./status/IMPLEMENTATION_STATUS.md) | Current feature status | All Developers, PMs |

---

## 📦 Archive

Historical documentation is preserved in `archive/` but is **not current guidance**:

- [Archive Index](./archive/README.md)
- [Clarification Sessions (Jan 2026)](./archive/2026-01/clarification-sessions/)
- Historical progress logs (moved from root ui/)

**Note:** Git history preserves the evolution of the codebase. Active docs focus on present state and future direction.

---

## 🎨 Design System

The Chrysalis UI uses a comprehensive design system built on design tokens:

- **[Design System README](../src/styles/README.md)** - Complete guide
- **Foundation:** 340+ design tokens (colors, typography, spacing, shadows)
- **Components:** Button, Input, Card, Badge + custom components
- **Animations:** Mercury shimmer, fades, slides, reduced-motion support
- **Utilities:** Layout helpers, accessibility classes, glass morphism

---

## 🔧 Tech Stack

```json
{
  "framework": "Vite + React 18 + TypeScript",
  "state": "Zustand (user settings) + YJS (collaborative)",
  "sync": "y-websocket (one room per canvas)",
  "canvas": "React Flow + YJS sync",
  "styling": "Vanilla CSS + Design Tokens",
  "icons": "Font Awesome + User-selected emoji (Noto/Fluent/Open)",
  "backend": "Node.js 18+",
  "versioning": "Checkpoint system for rollback"
}
```

**Key Dependencies:**
- React 18.2.0
- YJS 13.6.29 + y-websocket
- Zustand 4.5.0
- TypeScript 5.3.3
- Vite 5.0.12

See [package.json](../package.json) for complete list.

---

## 📖 Documentation Principles

All Chrysalis UI documentation follows three non-negotiable biases:

### 1. Diagram Everything Structural

Flows, relationships, lifecycles, state machines, object models → **Mermaid diagrams**

### 2. Cite Design Choices

Architectural patterns, protocols, data modeling → **Source notes with external links**

### 3. Forward-Looking Only

Consolidate lessons into present-tense guidance. Remove history, status diaries, old logs from active docs.

---

## 🚀 Quick Start

```bash
# Clone repository
git clone https://github.com/Replicant-Partners/Chrysalis.git
cd Chrysalis/ui

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

Visit **http://localhost:3000** to see the UI.

---

## 🔗 Related Documentation

### Chrysalis Core
- [Main README](../../README.md) - Project overview
- [Architecture](../../ARCHITECTURE.md) - System architecture
- [Main Docs Hub](../../docs/README.md) - Backend documentation

### Projects
- [Memory System](../../memory_system/README.md)
- [KnowledgeBuilder](../../projects/KnowledgeBuilder/README.md)
- [SkillBuilder](../../projects/SkillBuilder/README.md)

---

## 📝 Maintenance

**Update Cadence:**
- Architecture docs: Updated with major design changes
- Component docs: Updated when components change
- Status doc: Updated with each development session
- Archive: Updated when materials become historical

**Last Review:** January 10, 2026  
**Maintainer:** Chrysalis UI Team

---

## 🤝 Contributing

See [Component Guide](./guides/COMPONENT_GUIDE.md) for how to:
- Create new components
- Follow design system patterns
- Write TypeScript interfaces
- Add Mermaid diagrams
- Document with source citations

---

**Navigation:** [Project Root](../../) | [UI README](../README.md) | [Design System](../src/styles/README.md) | [Architecture](./CHRYSALIS_TERMINAL_ARCHITECTURE.md)