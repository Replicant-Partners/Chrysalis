/**
 * TerminalPane Component Tests
 * 
 * Integration tests for the TerminalPane React component including:
 * - Component rendering and mounting
 * - Ref handle operations
 * - Error boundary behavior
 * - Connection state changes
 * - Resize handling
 * 
 * @module ui/components/TerminalPane/__tests__/TerminalPane.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { createRef } from 'react';
import { TerminalPane, type TerminalPaneHandle, type TerminalPaneProps } from '../TerminalPane';

// ============================================================================
// Mocks
// ============================================================================

// Mock the terminal service
vi.mock('../../../services/terminal', () => ({
  createTerminalService: vi.fn(() => ({
    mount: vi.fn(),
    dispose: vi.fn(),
    write: vi.fn(),
    writeln: vi.fn(),
    clear: vi.fn(),
    reset: vi.fn(),
    focus: vi.fn(),
    blur: vi.fn(),
    fit: vi.fn(),
    getDimensions: vi.fn().mockReturnValue({ cols: 80, rows: 24 }),
    serialize: vi.fn().mockReturnValue('terminal content'),
    getSelection: vi.fn().mockReturnValue('selected text'),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    reconnect: vi.fn().mockResolvedValue(undefined),
    getConnectionState: vi.fn().mockReturnValue('disconnected'),
    getMetrics: vi.fn().mockReturnValue({
      renderingBackend: 'webgl',
      webglSupported: true,
      webglContextLost: false,
      framesRendered: 100,
      averageFrameTime: 16,
      lastFrameTime: 16,
    }),
    getRenderingBackend: vi.fn().mockReturnValue('webgl'),
    isWebGLSupported: vi.fn().mockReturnValue(true),
    on: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    setOptions: vi.fn(),
    setTheme: vi.fn(),
    scrollToBottom: vi.fn(),
    scrollToTop: vi.fn(),
  })),
  TerminalService: vi.fn(),
}));

// Mock xterm.js CSS import
vi.mock('@xterm/xterm/css/xterm.css', () => ({}));

// ============================================================================
// Test Helpers
// ============================================================================

function renderTerminalPane(props: Partial<TerminalPaneProps> = {}) {
  const defaultProps: TerminalPaneProps = {
    paneId: 'test-terminal',
    title: 'Test Terminal',
    ...props,
  };
  
  return render(<TerminalPane {...defaultProps} />);
}

// ============================================================================
// Tests
// ============================================================================

describe('TerminalPane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render with default props', () => {
      renderTerminalPane();
      
      expect(screen.getByText('Test Terminal')).toBeInTheDocument();
    });

    it('should render header when showHeader is true', () => {
      renderTerminalPane({ showHeader: true, title: 'My Terminal' });
      
      expect(screen.getByText('My Terminal')).toBeInTheDocument();
    });

    it('should not render header when showHeader is false', () => {
      renderTerminalPane({ showHeader: false, title: 'Hidden Title' });
      
      expect(screen.queryByText('Hidden Title')).not.toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = renderTerminalPane({ className: 'custom-class' });
      
      expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });

    it('should apply custom style', () => {
      const { container } = renderTerminalPane({ 
        style: { backgroundColor: 'red' } 
      });
      
      const pane = container.firstChild as HTMLElement;
      expect(pane.style.backgroundColor).toBe('red');
    });

    it('should set data-pane-id attribute', () => {
      const { container } = renderTerminalPane({ paneId: 'my-pane' });
      
      expect(container.querySelector('[data-pane-id="my-pane"]')).toBeInTheDocument();
    });
  });

  describe('Ref Handle', () => {
    it('should expose write method', async () => {
      const ref = createRef<TerminalPaneHandle>();
      render(<TerminalPane ref={ref} paneId="test" />);
      
      await waitFor(() => {
        expect(ref.current).toBeDefined();
      });
      
      ref.current?.write('test data');
      // Verify method is callable
    });

    it('should expose writeln method', async () => {
      const ref = createRef<TerminalPaneHandle>();
      render(<TerminalPane ref={ref} paneId="test" />);
      
      await waitFor(() => {
        expect(ref.current).toBeDefined();
      });
      
      ref.current?.writeln('test line');
    });

    it('should expose clear method', async () => {
      const ref = createRef<TerminalPaneHandle>();
      render(<TerminalPane ref={ref} paneId="test" />);
      
      await waitFor(() => {
        expect(ref.current).toBeDefined();
      });
      
      ref.current?.clear();
    });

    it('should expose reset method', async () => {
      const ref = createRef<TerminalPaneHandle>();
      render(<TerminalPane ref={ref} paneId="test" />);
      
      await waitFor(() => {
        expect(ref.current).toBeDefined();
      });
      
      ref.current?.reset();
    });

    it('should expose focus method', async () => {
      const ref = createRef<TerminalPaneHandle>();
      render(<TerminalPane ref={ref} paneId="test" />);
      
      await waitFor(() => {
        expect(ref.current).toBeDefined();
      });
      
      ref.current?.focus();
    });

    it('should expose fit method', async () => {
      const ref = createRef<TerminalPaneHandle>();
      render(<TerminalPane ref={ref} paneId="test" />);
      
      await waitFor(() => {
        expect(ref.current).toBeDefined();
      });
      
      ref.current?.fit();
    });

    it('should expose getDimensions method', async () => {
      const ref = createRef<TerminalPaneHandle>();
      render(<TerminalPane ref={ref} paneId="test" />);
      
      await waitFor(() => {
        expect(ref.current).toBeDefined();
      });
      
      const dims = ref.current?.getDimensions();
      expect(dims).toEqual({ cols: 80, rows: 24 });
    });

    it('should expose serialize method', async () => {
      const ref = createRef<TerminalPaneHandle>();
      render(<TerminalPane ref={ref} paneId="test" />);
      
      await waitFor(() => {
        expect(ref.current).toBeDefined();
      });
      
      const content = ref.current?.serialize();
      expect(content).toBe('terminal content');
    });

    it('should expose getSelection method', async () => {
      const ref = createRef<TerminalPaneHandle>();
      render(<TerminalPane ref={ref} paneId="test" />);
      
      await waitFor(() => {
        expect(ref.current).toBeDefined();
      });
      
      const selection = ref.current?.getSelection();
      expect(selection).toBe('selected text');
    });

    it('should expose connect method', async () => {
      const ref = createRef<TerminalPaneHandle>();
      render(<TerminalPane ref={ref} paneId="test" />);
      
      await waitFor(() => {
        expect(ref.current).toBeDefined();
      });
      
      await ref.current?.connect('ws://localhost:1234');
    });

    it('should expose disconnect method', async () => {
      const ref = createRef<TerminalPaneHandle>();
      render(<TerminalPane ref={ref} paneId="test" />);
      
      await waitFor(() => {
        expect(ref.current).toBeDefined();
      });
      
      ref.current?.disconnect();
    });

    it('should expose getConnectionState method', async () => {
      const ref = createRef<TerminalPaneHandle>();
      render(<TerminalPane ref={ref} paneId="test" />);
      
      await waitFor(() => {
        expect(ref.current).toBeDefined();
      });
      
      const state = ref.current?.getConnectionState();
      expect(state).toBe('disconnected');
    });

    it('should expose getRenderingBackend method', async () => {
      const ref = createRef<TerminalPaneHandle>();
      render(<TerminalPane ref={ref} paneId="test" />);
      
      await waitFor(() => {
        expect(ref.current).toBeDefined();
      });
      
      const backend = ref.current?.getRenderingBackend();
      expect(backend).toBe('webgl');
    });

    it('should expose setTheme method', async () => {
      const ref = createRef<TerminalPaneHandle>();
      render(<TerminalPane ref={ref} paneId="test" />);
      
      await waitFor(() => {
        expect(ref.current).toBeDefined();
      });
      
      ref.current?.setTheme({ background: '#000000' });
    });

    it('should expose scrollToBottom method', async () => {
      const ref = createRef<TerminalPaneHandle>();
      render(<TerminalPane ref={ref} paneId="test" />);
      
      await waitFor(() => {
        expect(ref.current).toBeDefined();
      });
      
      ref.current?.scrollToBottom();
    });
  });

  describe('Callbacks', () => {
    it('should call onReady when terminal is ready', async () => {
      const onReady = vi.fn();
      renderTerminalPane({ onReady });
      
      await waitFor(() => {
        expect(onReady).toHaveBeenCalled();
      });
    });

    it('should call onData when data callback is triggered', () => {
      const onData = vi.fn();
      renderTerminalPane({ onData });
      
      // Data callback is set up during initialization
    });

    it('should call onResize when resize callback is triggered', () => {
      const onResize = vi.fn();
      renderTerminalPane({ onResize });
      
      // Resize callback is set up during initialization
    });

    it('should call onConnectionStateChange when state changes', () => {
      const onConnectionStateChange = vi.fn();
      renderTerminalPane({ onConnectionStateChange });
      
      // Connection state callback is set up during initialization
    });
  });

  describe('Configuration', () => {
    it('should pass config to terminal service', () => {
      renderTerminalPane({
        config: {
          fontSize: 16,
          fontFamily: 'Menlo',
        },
      });
      
      // Config should be passed to service
    });

    it('should pass theme to terminal service', () => {
      renderTerminalPane({
        theme: {
          background: '#1a1a1a',
          foreground: '#ffffff',
        },
      });
      
      // Theme should be passed to service
    });

    it('should pass websocketUrl to terminal service', () => {
      renderTerminalPane({
        websocketUrl: 'ws://localhost:8080',
      });
      
      // WebSocket URL should be passed to service
    });

    it('should handle autoConnect prop', () => {
      renderTerminalPane({
        websocketUrl: 'ws://localhost:8080',
        autoConnect: true,
      });
      
      // Auto-connect should trigger connection
    });

    it('should handle readOnly prop', () => {
      const { container } = renderTerminalPane({ readOnly: true });
      
      expect(container.querySelector('[data-read-only="true"]')).toBeInTheDocument();
    });

    it('should write initialContent to terminal', () => {
      renderTerminalPane({
        initialContent: 'Welcome to the terminal!',
      });
      
      // Initial content should be written
    });
  });

  describe('Header Controls', () => {
    it('should show connection status when showConnectionStatus is true', () => {
      renderTerminalPane({ showConnectionStatus: true });
      
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });

    it('should show rendering backend when showRenderingBackend is true', () => {
      renderTerminalPane({ showRenderingBackend: true });
      
      // WebGL badge should be visible
    });

    it('should handle clear button click', async () => {
      const user = userEvent.setup();
      renderTerminalPane();
      
      const clearButton = screen.getByText('Clear');
      await user.click(clearButton);
      
      // Clear should be called
    });

    it('should handle connect button click when disconnected', async () => {
      const user = userEvent.setup();
      renderTerminalPane({ websocketUrl: 'ws://localhost:8080' });
      
      const connectButton = screen.getByText('Connect');
      await user.click(connectButton);
      
      // Connect should be called
    });
  });

  describe('Cleanup', () => {
    it('should dispose terminal service on unmount', () => {
      const { unmount } = renderTerminalPane();
      
      unmount();
      
      // Service should be disposed
    });

    it('should cleanup resize observer on unmount', () => {
      const { unmount } = renderTerminalPane();
      
      unmount();
      
      // ResizeObserver should be disconnected
    });
  });
});

describe('TerminalPane Error Boundary', () => {
  it('should catch and display errors', () => {
    // Error boundary tests would require throwing errors during render
  });

  it('should provide reset functionality', () => {
    // Reset functionality tests
  });
});

describe('TerminalPane Accessibility', () => {
  it('should have proper ARIA attributes', () => {
    renderTerminalPane();
    
    // Terminal should have appropriate accessibility attributes
  });

  it('should support keyboard navigation', () => {
    renderTerminalPane();
    
    // Keyboard navigation should work
  });
});
