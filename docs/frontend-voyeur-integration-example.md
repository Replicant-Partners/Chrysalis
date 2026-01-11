# VoyeurPane Integration Example

## Basic Setup

Add VoyeurProvider to wrap your app:

```tsx
import { VoyeurProvider } from './contexts/VoyeurContext';
import { VoyeurPane } from './components/VoyeurPane';

// Wrap your app with VoyeurProvider
function App() {
  return (
    <VoyeurProvider 
      options={{ 
        serverUrl: 'http://localhost:8787',
        streamPath: '/voyeur-stream',
        maxBufferSize: 500
      }}
      autoConnect={false} // Connect manually via UI
    >
      <YourAppContent />
    </VoyeurProvider>
  );
}
```

## As a Sidebar Panel

```tsx
import { useState } from 'react';
import { VoyeurPane } from './components/VoyeurPane';

function AppWithVoyeur() {
  const [showVoyeur, setShowVoyeur] = useState(false);
  
  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Main content */}
      <div style={{ flex: 1 }}>
        <YourMainContent />
        
        {/* Toggle button */}
        <button onClick={() => setShowVoyeur(!showVoyeur)}>
          {showVoyeur ? 'Hide' : 'Show'} Voyeur
        </button>
      </div>
      
      {/* Voyeur sidebar */}
      {showVoyeur && (
        <div style={{ width: '400px', borderLeft: '1px solid #2d2d44' }}>
          <VoyeurPane />
        </div>
      )}
    </div>
  );
}
```

## As a Modal/Overlay

```tsx
import { useState } from 'react';
import { VoyeurPane } from './components/VoyeurPane';

function AppWithVoyeurModal() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <>
      <YourMainContent />
      
      {/* Open button */}
      <button onClick={() => setIsOpen(true)}>
        Open Voyeur
      </button>
      
      {/* Modal overlay */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            width: '90%',
            height: '80%',
            maxWidth: '1200px',
            background: '#1a1a2e',
            borderRadius: '12px',
            overflow: 'hidden'
          }}>
            <VoyeurPane />
            <button onClick={() => setIsOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
```

## Backend Server Setup

Make sure the VoyeurWebServer is running:

```typescript
// In your backend code
import { VoyeurBus } from './observability/VoyeurEvents';
import { startVoyeurWebServer } from './observability/VoyeurWebServer';

const voyeurBus = new VoyeurBus();

// Start SSE server
startVoyeurWebServer(voyeurBus, {
  port: 8787,
  path: '/voyeur-stream',
  redact: false // Set true to hide event details
});

// Emit events
voyeurBus.emit({
  kind: 'ingest.start',
  timestamp: new Date().toISOString(),
  sourceInstance: 'agent-1',
  details: { ... }
});
```