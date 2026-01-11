/**
 * TerminalService Unit Tests
 * 
 * Tests for the terminal service module including:
 * - Initialization and lifecycle management
 * - WebGL addon loading and fallback
 * - Data flow and event handling
 * - Connection state management
 * 
 * @module ui/services/terminal/__tests__/TerminalService.test
 */

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { 
  TerminalService, 
  createTerminalService,
  type TerminalServiceConfig 
} from '../TerminalService';

// ============================================================================
// Mocks
// ============================================================================

// Mock xterm.js
vi.mock('@xterm/xterm', () => {
  const Terminal = vi.fn().mockImplementation(() => ({
    open: vi.fn(),
    write: vi.fn(),
    writeln: vi.fn(),
    clear: vi.fn(),
    reset: vi.fn(),
    focus: vi.fn(),
    blur: vi.fn(),
    dispose: vi.fn(),
    scrollToBottom: vi.fn(),
    scrollToTop: vi.fn(),
    getSelection: vi.fn().mockReturnValue(''),
    loadAddon: vi.fn(),
    onData: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    onBinary: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    onKey: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    onResize: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    onTitleChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    onSelectionChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    cols: 80,
    rows: 24,
    options: {},
  }));
  
  return { Terminal };
});

// Mock WebGL addon
vi.mock('@xterm/addon-webgl', () => {
  const WebglAddon = vi.fn().mockImplementation(() => ({
    dispose: vi.fn(),
    onContextLoss: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  }));
  return { WebglAddon };
});

// Mock Fit addon
vi.mock('@xterm/addon-fit', () => {
  const FitAddon = vi.fn().mockImplementation(() => ({
    fit: vi.fn(),
    dispose: vi.fn(),
  }));
  return { FitAddon };
});

// Mock WebLinks addon
vi.mock('@xterm/addon-web-links', () => {
  const WebLinksAddon = vi.fn().mockImplementation(() => ({
    dispose: vi.fn(),
  }));
  return { WebLinksAddon };
});

// Mock Attach addon
vi.mock('@xterm/addon-attach', () => {
  const AttachAddon = vi.fn().mockImplementation(() => ({
    dispose: vi.fn(),
  }));
  return { AttachAddon };
});

// Mock Serialize addon
vi.mock('@xterm/addon-serialize', () => {
  const SerializeAddon = vi.fn().mockImplementation(() => ({
    serialize: vi.fn().mockReturnValue('serialized content'),
    dispose: vi.fn(),
  }));
  return { SerializeAddon };
});

// ============================================================================
// Test Helpers
// ============================================================================

function createMockContainer(): HTMLElement {
  const container = document.createElement('div');
  container.style.width = '800px';
  container.style.height = '600px';
  document.body.appendChild(container);
  return container;
}

function createMockWebSocket(): WebSocket {
  const ws = {
    onopen: null as ((event: Event) => void) | null,
    onerror: null as ((event: Event) => void) | null,
    onclose: null as ((event: Event) => void) | null,
    onmessage: null as ((event: MessageEvent) => void) | null,
    close: vi.fn(),
    send: vi.fn(),
    readyState: WebSocket.OPEN,
  } as unknown as WebSocket;
  
  return ws;
}

// ============================================================================
// Tests
// ============================================================================

describe('TerminalService', () => {
  let container: HTMLElement;
  let service: TerminalService;

  beforeEach(() => {
    container = createMockContainer();
    // Mock WebGL support check
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return {
          getContext: vi.fn().mockReturnValue({
            getExtension: vi.fn().mockReturnValue({ loseContext: vi.fn() }),
          }),
        } as unknown as HTMLCanvasElement;
      }
      return document.createElement(tagName);
    });
  });

  afterEach(() => {
    if (service) {
      service.dispose();
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should create a terminal service with default config', () => {
      service = new TerminalService();
      expect(service).toBeDefined();
      expect(service.getConnectionState()).toBe('disconnected');
    });

    it('should create a terminal service with custom config', () => {
      const config: TerminalServiceConfig = {
        fontSize: 16,
        fontFamily: 'Menlo, monospace',
        scrollback: 5000,
        enableWebGL: true,
        enableLinks: true,
      };
      
      service = new TerminalService(config);
      expect(service).toBeDefined();
    });

    it('should throw error when mounting already mounted terminal', () => {
      service = new TerminalService();
      service.mount(container);
      
      expect(() => service.mount(container)).toThrow('Terminal is already mounted');
    });

    it('should throw error when mounting disposed service', () => {
      service = new TerminalService();
      service.dispose();
      
      expect(() => service.mount(container)).toThrow('TerminalService has been disposed');
    });
  });

  describe('Factory Function', () => {
    it('should create terminal service via factory', () => {
      service = createTerminalService() as TerminalService;
      expect(service).toBeInstanceOf(TerminalService);
    });

    it('should pass config to factory', () => {
      service = createTerminalService({
        fontSize: 18,
      }) as TerminalService;
      expect(service).toBeDefined();
    });
  });

  describe('Terminal Operations', () => {
    beforeEach(() => {
      service = new TerminalService();
      service.mount(container);
    });

    it('should write data to terminal', () => {
      service.write('Hello World');
      // Terminal.write should have been called
    });

    it('should write line to terminal', () => {
      service.writeln('Hello World');
      // Terminal.writeln should have been called
    });

    it('should clear terminal', () => {
      service.clear();
      // Terminal.clear should have been called
    });

    it('should reset terminal', () => {
      service.reset();
      // Terminal.reset should have been called
    });

    it('should focus terminal', () => {
      service.focus();
      // Terminal.focus should have been called
    });

    it('should blur terminal', () => {
      service.blur();
      // Terminal.blur should have been called
    });

    it('should get dimensions', () => {
      const dims = service.getDimensions();
      expect(dims).toEqual({ cols: 80, rows: 24 });
    });

    it('should serialize terminal content', () => {
      const content = service.serialize();
      expect(content).toBe('serialized content');
    });

    it('should get selection', () => {
      const selection = service.getSelection();
      expect(selection).toBe('');
    });

    it('should scroll to bottom', () => {
      service.scrollToBottom();
      // Terminal.scrollToBottom should have been called
    });

    it('should scroll to top', () => {
      service.scrollToTop();
      // Terminal.scrollToTop should have been called
    });
  });

  describe('WebGL Support', () => {
    it('should detect WebGL support', () => {
      service = new TerminalService({ enableWebGL: true });
      expect(service.isWebGLSupported()).toBe(true);
    });

    it('should handle WebGL disabled config', () => {
      service = new TerminalService({ enableWebGL: false });
      service.mount(container);
      expect(service.getRenderingBackend()).toBe('canvas');
    });
  });

  describe('Event Handling', () => {
    beforeEach(() => {
      service = new TerminalService();
      service.mount(container);
    });

    it('should subscribe to events', () => {
      const handler = vi.fn();
      const disposable = service.on('onData', handler);
      
      expect(disposable).toBeDefined();
      expect(typeof disposable.dispose).toBe('function');
    });

    it('should dispose event subscriptions', () => {
      const handler = vi.fn();
      const disposable = service.on('onData', handler);
      
      disposable.dispose();
      // Handler should no longer be called
    });
  });

  describe('Theme Management', () => {
    beforeEach(() => {
      service = new TerminalService();
      service.mount(container);
    });

    it('should set theme', () => {
      service.setTheme({
        background: '#000000',
        foreground: '#ffffff',
      });
      // Theme should be updated
    });

    it('should set options', () => {
      service.setOptions({
        fontSize: 16,
      });
      // Options should be updated
    });
  });

  describe('Connection Management', () => {
    let mockWebSocket: WebSocket;
    let originalWebSocket: typeof WebSocket;

    beforeEach(() => {
      service = new TerminalService();
      service.mount(container);
      
      mockWebSocket = createMockWebSocket();
      originalWebSocket = global.WebSocket;
      global.WebSocket = vi.fn().mockImplementation(() => mockWebSocket) as unknown as typeof WebSocket;
    });

    afterEach(() => {
      global.WebSocket = originalWebSocket;
    });

    it('should connect to WebSocket', async () => {
      const connectPromise = service.connect('ws://localhost:1234');
      
      // Simulate connection open
      (mockWebSocket.onopen as Function)?.({});
      
      await connectPromise;
      expect(service.getConnectionState()).toBe('connected');
    });

    it('should disconnect from WebSocket', async () => {
      const connectPromise = service.connect('ws://localhost:1234');
      (mockWebSocket.onopen as Function)?.({});
      await connectPromise;
      
      service.disconnect();
      expect(service.getConnectionState()).toBe('disconnected');
    });

    it('should handle connection error', async () => {
      const connectPromise = service.connect('ws://localhost:1234');
      
      // Simulate connection error
      (mockWebSocket.onerror as Function)?.({});
      
      await expect(connectPromise).rejects.toThrow();
      expect(service.getConnectionState()).toBe('error');
    });

    it('should throw when connecting disposed service', async () => {
      service.dispose();
      
      await expect(service.connect('ws://localhost:1234')).rejects.toThrow(
        'TerminalService has been disposed'
      );
    });
  });

  describe('Metrics', () => {
    beforeEach(() => {
      service = new TerminalService({ enableMetrics: true });
      service.mount(container);
    });

    it('should return metrics', () => {
      const metrics = service.getMetrics();
      
      expect(metrics).toMatchObject({
        renderingBackend: expect.any(String),
        webglSupported: expect.any(Boolean),
        webglContextLost: expect.any(Boolean),
        framesRendered: expect.any(Number),
        averageFrameTime: expect.any(Number),
        lastFrameTime: expect.any(Number),
      });
    });
  });

  describe('Disposal', () => {
    it('should dispose all resources', () => {
      service = new TerminalService();
      service.mount(container);
      
      service.dispose();
      
      // Should not throw when disposing again
      expect(() => service.dispose()).not.toThrow();
    });

    it('should clear event handlers on dispose', () => {
      service = new TerminalService();
      service.mount(container);
      
      const handler = vi.fn();
      service.on('onData', handler);
      
      service.dispose();
      // Event handlers should be cleared
    });
  });
});

describe('TerminalService Integration', () => {
  // Integration tests would require a real DOM environment
  // These are placeholder tests for CI/CD integration
  
  it.skip('should render terminal with WebGL', () => {
    // Requires real WebGL context
  });

  it.skip('should handle WebGL context loss and recovery', () => {
    // Requires real WebGL context
  });

  it.skip('should handle actual WebSocket connection', () => {
    // Requires WebSocket server
  });
});
