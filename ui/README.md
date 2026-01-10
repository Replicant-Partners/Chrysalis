# Chrysalis Terminal UI

**AI Agent Interaction Workbench**

A React-based three-frame interface for human-AI collaboration with real-time canvas synchronization.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](package.json)
[![React](https://img.shields.io/badge/React-18.2-blue.svg)](package.json)
[![Vite](https://img.shields.io/badge/Vite-5.0-purple.svg)](package.json)

---

## 🎯 What is Chrysalis Terminal UI?

A **human-in-the-loop AI workbench** where you orchestrate teams of agents and human collaborators through an elegant three-frame interface:

- **Left Chat** - Agent collaboration workspace
- **Center Canvas** - Shared JSONCanvas for visual work
- **Right Chat** - Human communication workspace

```
┌─────────────────────────────────────────────────────────┐
│  🦋 Chrysalis  │  Team A  │  🟢 Live  │  ⚙️ Config    │
├──────────────┬────────────────────┬────────────────────┤
│              │                    │                    │
│  Left Chat   │   Center Canvas    │    Right Chat      │
│  (Agents)    │   (Shared Work)    │    (Human)         │
│              │                    │                    │
│  🤖 Agent 1  │   [Widgets]        │    👤 You          │
│  🤖 Agent 2  │   [Nodes]          │    👥 Collaborator │
│              │   [Connections]    │                    │
├──────────────┴────────────────────┴────────────────────┤
│  Metrics  │  Status  │  Canvas Tabs                    │
└─────────────────────────────────────────────────────────┘
```

**Key Features:**
- ✅ Real-time collaboration via YJS CRDTs
- ✅ JSONCanvas protocol for infinite canvas types
- ✅ Design system with 340+ tokens
- ✅ Wallet system for API key management
- ✅ Mercury frame aesthetic with liquid metal shimmer

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 18.0.0
- **npm** ≥ 9.0

### Installation

```bash
# Navigate to UI directory
cd ui

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit **http://localhost:3000**

### Build for Production

```bash
# Type-check and build
npm run build

# Preview production build
npm run preview
```

---

## 📁 Project Structure

```
ui/
├── src/
│   ├── components/           # React components
│   │   ├── ChatPane/         # Chat interface
│   │   ├── JSONCanvas/       # Canvas rendering
│   │   ├── ThreeFrameLayout/ # Layout system
│   │   ├── Wallet/           # API key wallet
│   │   └── design-system/    # Reusable UI components
│   │
│   ├── contexts/             # React contexts
│   │   └── WalletContext.tsx # Global wallet state
│   │
│   ├── hooks/                # Custom React hooks
│   │   └── useTerminal.ts    # YJS terminal connection
│   │
│   ├── styles/               # Design system
│   │   ├── tokens.css        # 340+ design tokens
│   │   ├── components.css    # Component tokens
│   │   ├── animations.css    # Animation library
│   │   └── utilities.css     # Utility classes
│   │
│   ├── App.tsx               # Main application
│   └── main.tsx              # Entry point
│
├── docs/                     # Documentation
│   ├── README.md             # Docs navigation hub
│   ├── architecture/         # Architecture specs
│   ├── guides/               # Developer guides
│   ├── api/                  # API documentation
│   └── status/               # Implementation status
│
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript config
├── vite.config.ts            # Vite config
└── index.html                # HTML template
```

---

## 🎨 Design System

Built on a comprehensive token-based design system:

### Foundation Tokens (`tokens.css`)
- **Colors:** Brand palette, neutrals, semantic colors
- **Typography:** Inter + JetBrains Mono, modular scale
- **Spacing:** 8px base unit system
- **Shadows:** Elevation system
- **Motion:** Duration + easing presets

### Component Library (`components/design-system/`)
- **Button** - 4 variants, 3 sizes, loading states
- **Input** - Labels, errors, icons, validation
- **Card** - 3 variants, hoverable states
- **Badge** - 6 variants, pulsing dot support

### Mercury Frame Aesthetic
Signature liquid metal shimmer effect (8s animation cycle)

**Learn More:** [Design System README](./src/styles/README.md)

---

## 🔧 Development

### Available Scripts

```bash
npm run dev      # Start dev server (port 3000)
npm run build    # Type-check + build
npm run preview  # Preview production build
npm run lint     # ESLint check
```

### Development Workflow

1. **Design Component** - Follow design system patterns
2. **Build with Tokens** - Use CSS variables from design system
3. **Add TypeScript** - Strong typing for props and state
4. **Test Accessibility** - Keyboard nav, screen readers, focus
5. **Document** - Add usage examples and props docs

**See:** [Development Guide](./docs/guides/DEVELOPMENT.md)

---

## 🏗️ Architecture

### State Management

**Zustand (Local State)**
- User preferences
- UI state (active tabs, etc.)
- Wallet unlock status

**YJS (Distributed State)**
- Chat messages
- Canvas nodes and edges
- Viewport position
- Typing indicators

**See:** [State Management](./docs/architecture/STATE_MANAGEMENT.md)

### Real-Time Sync

YJS CRDTs enable real-time collaboration:
- One YJS document per Terminal session
- WebSocket provider for network sync
- Awareness layer for cursors/presence

**See:** [Backend Integration](./docs/api/BACKEND_INTEGRATION.md)

### Canvas System

JSONCanvas protocol with custom extensions:
- **Types:** Agent, Media, Data, Document, General
- **Widgets:** Markdown, Code, Chart, Table
- **Visibility:** Toggle between visible/invisible
- **Sync:** Each canvas = one YJS room

**See:** [Canvas Architecture](./docs/architecture/CANVAS_SYSTEM.md)

---

## 🔑 API Key Wallet

Secure API key management for LLM providers:

```typescript
import { useWallet } from '@/contexts/WalletContext';

function MyComponent() {
  const wallet = useWallet();
  
  // Check if provider has key
  if (wallet.hasKeyForProvider('openai')) {
    const key = wallet.getKeyForProvider('openai');
    // Use key for API calls
  }
}
```

**Supported Providers:**
- OpenAI
- Anthropic
- Google
- Ollama
- Azure
- HuggingFace
- Cohere
- Mistral
- Groq

**See:** [WalletContext.tsx](./src/contexts/WalletContext.tsx)

---

## 📚 Documentation

**Navigation Hub:** [docs/README.md](./docs/README.md)

### Quick Links

| Topic | Document |
|-------|----------|
| Architecture | [Terminal Architecture](./docs/CHRYSALIS_TERMINAL_ARCHITECTURE.md) |
| Components | [Component Architecture](./docs/architecture/COMPONENT_ARCHITECTURE.md) |
| State | [State Management](./docs/architecture/STATE_MANAGEMENT.md) |
| Design System | [Design System README](./src/styles/README.md) |
| Development | [Development Guide](./docs/guides/DEVELOPMENT.md) |
| Components | [Component Guide](./docs/guides/COMPONENT_GUIDE.md) |
| Status | [Implementation Status](./docs/status/IMPLEMENTATION_STATUS.md) |

---

## 🧩 Component Examples

### Using Design System Components

```tsx
import { Button, Badge, Card } from '@/components/design-system';

<Card variant="elevated" padding="lg">
  <h2>Agent Status</h2>
  <Badge variant="live" withDot>Active</Badge>
  <Button variant="primary" size="md">
    Connect
  </Button>
</Card>
```

### Using Wallet Context

```tsx
import { useWallet } from '@/contexts/WalletContext';

function SetupPanel() {
  const wallet = useWallet();
  
  return (
    <Button onClick={wallet.openModal}>
      {wallet.isUnlocked ? 'Manage Keys' : 'Unlock Wallet'}
    </Button>
  );
}
```

### Using Terminal Hook

```tsx
import { useTerminal } from '@/hooks/useTerminal';

function ChatInterface() {
  const terminal = useTerminal({
    terminalId: 'my-session',
    autoConnect: true
  });
  
  return (
    <div>
      <Badge variant={terminal.connected ? 'live' : 'error'}>
        {terminal.connected ? 'Connected' : 'Offline'}
      </Badge>
      {/* Chat UI */}
    </div>
  );
}
```

---

## 🔍 Tech Stack

### Core

- **React 18.2** - UI library
- **TypeScript 5.3** - Type safety
- **Vite 5.0** - Build tool

### State & Sync

- **Zustand 4.5** - Local state management
- **YJS 13.6** - CRDT for real-time sync
- **y-websocket 3.0** - WebSocket provider

### Styling

- **Vanilla CSS** - CSS Modules for scoping
- **Design Tokens** - CSS variables (340+ tokens)

### Development

- **ESLint** - Code linting
- **TypeScript** - Type checking

**Full dependency list:** [package.json](./package.json)

---

## 📦 Installation Details

### Package Info

```json
{
  "name": "@chrysalis/terminal-ui",
  "version": "1.0.0",
  "type": "module"
}
```

### Peer Dependencies

- `chrysalis: workspace:*` - Core Chrysalis package

### Dev Server

- **Port:** 3000
- **Auto-open:** Yes
- **Source maps:** Yes (production build)

---

## 🤝 Contributing

We welcome contributions! To get started:

1. **Read:** [Development Guide](./docs/guides/DEVELOPMENT.md)
2. **Review:** [Component Guide](./docs/guides/COMPONENT_GUIDE.md)
3. **Check:** [Implementation Status](./docs/status/IMPLEMENTATION_STATUS.md)
4. **Follow:** Design system patterns in [styles/README.md](./src/styles/README.md)

### Code Standards

- Use TypeScript for all new code
- Follow existing component patterns
- Use design tokens (no hardcoded values)
- Include accessibility features
- Add Mermaid diagrams for complex flows
- Cite external sources for design patterns

---

## 📊 Implementation Status

### Completed ✅

- ✅ Design system (tokens, components, animations)
- ✅ Three-frame layout
- ✅ YJS integration (real-time sync)
- ✅ Wallet system (API key management)
- ✅ Base UI components (Button, Input, Card, Badge)

### In Progress 🚧

- 🚧 Canvas widgets (Markdown, Code, Chart)
- 🚧 Chat enhancements (voice, attachments)
- 🚧 Agent configuration UI
- 🚧 Voyeur mode (observability)

**See:** [Implementation Status](./docs/status/IMPLEMENTATION_STATUS.md)

---

## 🔗 Related Links

### Chrysalis Core
- [Main README](../README.md)
- [Architecture](../ARCHITECTURE.md)
- [Docs Hub](../docs/README.md)

### Projects
- [Memory System](../memory_system/README.md)
- [KnowledgeBuilder](../projects/KnowledgeBuilder/README.md)
- [SkillBuilder](../projects/SkillBuilder/README.md)

---

## 📝 License

MIT License - See [LICENSE](../LICENSE) for details

---

## 📞 Support

- **Documentation:** [docs/README.md](./docs/README.md)
- **Issues:** [GitHub Issues](https://github.com/Replicant-Partners/Chrysalis/issues)
- **Discussions:** [GitHub Discussions](https://github.com/Replicant-Partners/Chrysalis/discussions)

---

**Last Updated:** January 10, 2026  
**Version:** 1.0.0  
**Maintainer:** Chrysalis UI Team