/**
 * Test Utilities
 * 
 * Reusable test helpers and custom render functions
 */

import { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { VoyeurProvider } from '../contexts/VoyeurContext';
import { WalletProvider } from '../contexts/WalletContext';

/**
 * Custom render function with common providers
 */
interface AllTheProvidersProps {
  children: ReactNode;
}

function AllTheProviders({ children }: AllTheProvidersProps) {
  return (
    <WalletProvider>
      <VoyeurProvider autoConnect={false}>
        {children}
      </VoyeurProvider>
    </WalletProvider>
  );
}

/**
 * Render with all context providers
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllTheProviders, ...options });
}

/**
 * Render with VoyeurProvider only
 */
export function renderWithVoyeur(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, {
    wrapper: ({ children }) => (
      <VoyeurProvider autoConnect={false}>{children}</VoyeurProvider>
    ),
    ...options,
  });
}

/**
 * Render with WalletProvider only
 */
export function renderWithWallet(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, {
    wrapper: ({ children }) => <WalletProvider>{children}</WalletProvider>,
    ...options,
  });
}

/**
 * Wait for a condition with timeout
 */
export async function waitForCondition(
  condition: () => boolean,
  timeout = 5000,
  interval = 50
): Promise<void> {
  const startTime = Date.now();
  
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
}

/**
 * Create a mock EventSource for SSE testing
 */
export class MockEventSource {
  public url: string;
  public onopen: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  public readyState: number = 0;
  private listeners: Map<string, Set<EventListener>> = new Map();

  constructor(url: string) {
    this.url = url;
    this.readyState = 0; // CONNECTING
  }

  addEventListener(type: string, listener: EventListener): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  close(): void {
    this.readyState = 2; // CLOSED
  }

  // Test helper methods
  simulateOpen(): void {
    this.readyState = 1; // OPEN
    const event = new Event('open');
    this.onopen?.(event);
    this.listeners.get('open')?.forEach(listener => listener(event));
  }

  simulateMessage(data: any): void {
    const event = new MessageEvent('message', {
      data: typeof data === 'string' ? data : JSON.stringify(data),
    });
    this.onmessage?.(event);
    this.listeners.get('message')?.forEach(listener => listener(event as any));
  }

  simulateError(): void {
    const event = new Event('error');
    this.onerror?.(event);
    this.listeners.get('error')?.forEach(listener => listener(event));
  }
}

/**
 * Create mock Web Crypto API
 */
export function createMockCrypto() {
  return {
    subtle: {
      encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
      decrypt: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
      deriveKey: vi.fn().mockResolvedValue({} as CryptoKey),
      importKey: vi.fn().mockResolvedValue({} as CryptoKey),
    },
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
  };
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';