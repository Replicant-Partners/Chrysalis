# Chrysalis Terminal UI

React-based user interface for ChrysalisTerminal - A three-frame agent/human collaboration interface.

## Features

- 🦋 **Three-Frame Layout**: Agent, Canvas, and Human panes with real-time YJS synchronization
- 🔐 **Secure Wallet**: AES-256-GCM encrypted API key management
- 👁️ **Observability**: VoyeurPane for real-time event streaming and debugging
- 🎨 **Design System**: Reusable components with CSS Modules
- ⚡ **Performance**: React 18 with Vite for fast development and builds
- ✅ **Type Safety**: Full TypeScript support with strict mode

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3000
```

## Development

### Available Scripts

```bash
# Development
npm run dev              # Start dev server with HMR
npm run build            # Build for production
npm run preview          # Preview production build

# Testing
npm test                 # Run tests
npm run test:watch       # Run tests in watch mode
npm run test:ui          # Run tests with UI
npm run test:coverage    # Generate coverage report

# Quality
npm run typecheck        # TypeScript type checking
npm run lint             # ESLint checking
```

### Project Structure

```
ui/
├── src/
│   ├── components/       # React components
│   │   ├── design-system/  # Reusable UI components
│   │   ├── ChatPane/       # Agent/Human chat interface
│   │   ├── JSONCanvas/     # Center canvas for visualization
│   │   ├── VoyeurPane/     # Observability event viewer
│   │   └── Wallet/         # Encrypted wallet UI
│   ├── contexts/         # React contexts
│   │   ├── WalletContext.tsx    # Wallet state management
│   │   └── VoyeurContext.tsx    # Observability state
│   ├── hooks/            # Custom React hooks
│   ├── utils/            # Utility functions
│   │   ├── WalletCrypto.ts      # Encryption utilities
│   │   └── VoyeurBusClient.ts   # SSE client
│   ├── test/             # Test utilities and setup
│   ├── App.tsx           # Root component
│   └── main.tsx          # Entry point
├── public/               # Static assets
├── vitest.config.ts      # Test configuration
└── tsconfig.json         # TypeScript configuration
```

## Architecture

### Component Hierarchy

```
App (WalletProvider + VoyeurProvider)
  ├─ Header (status, Voyeur toggle)
  ├─ ThreeFrameLayout
  │   ├─ ChatPane (Agent) - Left
  │   ├─ JSONCanvas (Center)
  │   ├─ ChatPane (Human) - Right
  │   └─ Footer
  └─ VoyeurPane Modal (conditional)
```

### State Management

- **Zustand**: Global terminal state
- **React Context**: Wallet and Observability
- **YJS**: Real-time CRDT synchronization

## Features

### 🔐 Wallet Management

Secure API key storage with production-grade encryption:

- AES-256-GCM authenticated encryption
- PBKDF2 key derivation (600,000 iterations)
- Password strength validation
- Auto-lock timeout
- Multiple provider support

**Usage:**

```typescript
import { useWallet } from './contexts/WalletContext';

function MyComponent() {
  const { addKey, getKeyForProvider, isUnlocked } = useWallet();
  
  if (!isUnlocked) {
    return <WalletModal />;
  }
  
  const apiKey = getKeyForProvider('openai');
  // Use API key...
}
```

### 👁️ Observability

Real-time event streaming for debugging and monitoring:

- Server-Sent Events (SSE) connection
- Event filtering and search
- Expandable JSON details
- Connection state management
- Auto-scroll and pause/resume

**Usage:**

```typescript
import { useVoyeurEvents } from './contexts/VoyeurContext';

function ObservabilityPanel() {
  const { events, connect, disconnect, isConnected } = useVoyeurEvents();
  
  return (
    <div>
      <button onClick={connect}>Connect</button>
      {events.map(event => (
        <EventCard key={event.timestamp} event={event} />
      ))}
    </div>
  );
}
```

### 🎨 Design System

Reusable components with consistent styling:

```typescript
import { Button, Badge, Input, Card } from './components/design-system';

<Button variant="primary" size="md">
  Click Me
</Button>

<Badge variant="success" withDot>
  Connected
</Badge>

<Input 
  label="Email" 
  error="Invalid email"
  iconBefore={<EmailIcon />}
/>
```

## Configuration

### Environment Variables

```bash
# Backend YJS server (optional)
VITE_SERVER_URL=ws://localhost:1234

# VoyeurBus SSE server (optional)
VITE_VOYEUR_URL=http://localhost:8787
VITE_VOYEUR_PATH=/voyeur-stream
```

### TypeScript Configuration

The project uses strict TypeScript settings:

- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Watch mode for development
npm run test:watch

# Interactive UI
npm run test:ui

# Coverage report
npm run test:coverage
```

### Writing Tests

```typescript
import { renderWithProviders } from '../test/test-utils';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    renderWithProviders(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

See [Testing Guide](./src/test/README.md) for detailed documentation.

## Building for Production

```bash
# Create production build
npm run build

# Preview production build locally
npm run preview
```

Build output is in `dist/` directory.

## Performance

- ⚡ Vite for instant HMR
- 🎯 Code splitting and lazy loading
- 📦 Tree shaking and minification
- 🗜️ Gzip compression
- 🚀 Production optimizations

## Browser Support

- Chrome/Edge: Last 2 versions
- Firefox: Last 2 versions
- Safari: Last 2 versions

Requires:
- Web Crypto API (for wallet encryption)
- EventSource API (for observability)
- WebSocket (for YJS sync)

## Accessibility

- ♿ ARIA labels and roles
- ⌨️ Keyboard navigation
- 🎨 Color contrast compliance
- 📱 Responsive design
- 🔊 Screen reader support

## Contributing

1. Follow the component structure
2. Use TypeScript with strict mode
3. Write tests for new features
4. Use CSS Modules for styling
5. Follow accessibility guidelines

## License

MIT

## Documentation

- [Frontend Development Status](../docs/frontend-development-status.md)
- [Wallet Encryption Implementation](../docs/frontend-wallet-encryption-implementation.md)
- [VoyeurPane Documentation](../docs/voyeur-updated-documentation.md)
- [Testing Guide](./src/test/README.md)

## Support

For issues and questions, please refer to the main [Chrysalis README](../README.md).