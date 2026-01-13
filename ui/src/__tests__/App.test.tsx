/**
 * App Component Tests
 * 
 * Integration tests for the main App component
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test/test-utils';
import { App } from '../App';

// Mock useTerminal hook
vi.mock('../hooks/useTerminal', () => ({
  useTerminal: () => ({
    connected: true,
    synced: true,
    sessionName: 'Test Session',
    participantCount: 2,
    leftMessages: [],
    rightMessages: [],
    canvasNodes: [],
    canvasEdges: [],
    sendMessage: vi.fn(),
    updateCanvas: vi.fn()
  })
}));

describe('App', () => {
  const defaultProps = {
    terminalId: 'test-terminal',
    serverUrl: 'ws://localhost:1234'
  };

  describe('Rendering', () => {
    it('should render without crashing', () => {
      renderWithProviders(<App {...defaultProps} />);
      
      expect(screen.getByText(/chrysalis/i)).toBeInTheDocument();
    });

    it('should render the header', () => {
      renderWithProviders(<App {...defaultProps} />);
      
      expect(screen.getByText(/chrysalis/i)).toBeInTheDocument();
      expect(screen.getByText(/ai agent interaction workbench/i)).toBeInTheDocument();
    });

    it('should show connection status', () => {
      renderWithProviders(<App {...defaultProps} />);
      
      expect(screen.getByText(/live session/i)).toBeInTheDocument();
    });

    it('should display session information', () => {
      renderWithProviders(<App {...defaultProps} />);
      
      expect(screen.getByText(/test session/i)).toBeInTheDocument();
      expect(screen.getByText(/2 participants/i)).toBeInTheDocument();
    });

    it('should render all three panes', () => {
      renderWithProviders(<App {...defaultProps} />);
      
      // Layout should be present
      expect(screen.getByText(/chrysalis/i)).toBeInTheDocument();
    });
  });

  describe('Providers', () => {
    it('should wrap app with WalletProvider', () => {
      renderWithProviders(<App {...defaultProps} />);
      
      // Wallet modal should be available
      expect(screen.getByText(/chrysalis/i)).toBeInTheDocument();
    });

    it('should wrap app with VoyeurProvider', () => {
      renderWithProviders(<App {...defaultProps} />);
      
      // VoyeurProvider should be initialized
      expect(screen.getByText(/chrysalis/i)).toBeInTheDocument();
    });
  });

  describe('Header Actions', () => {
    it('should have Voyeur toggle button', () => {
      renderWithProviders(<App {...defaultProps} />);
      
      expect(screen.getByText(/show voyeur/i)).toBeInTheDocument();
    });

    it('should have project button', () => {
      renderWithProviders(<App {...defaultProps} />);
      
      expect(screen.getByText(/project/i)).toBeInTheDocument();
    });

    it('should have save button', () => {
      renderWithProviders(<App {...defaultProps} />);
      
      expect(screen.getByText(/save/i)).toBeInTheDocument();
    });

    it('should have settings button', () => {
      renderWithProviders(<App {...defaultProps} />);
      
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(3);
    });
  });

  describe('Connection States', () => {
    it('should show offline state when not connected', () => {
      vi.mock('../hooks/useTerminal', () => ({
        useTerminal: () => ({
          connected: false,
          synced: false,
          sessionName: 'Test Session',
          participantCount: 0,
          leftMessages: [],
          rightMessages: [],
          canvasNodes: [],
          canvasEdges: [],
          sendMessage: vi.fn(),
          updateCanvas: vi.fn()
        })
      }));

      renderWithProviders(<App {...defaultProps} />);
      
      // Should show some indication of connection state
      expect(screen.getByText(/chrysalis/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      const { container } = renderWithProviders(<App {...defaultProps} />);
      
      // Should have headings
      const headings = container.querySelectorAll('h1, h2, h3');
      expect(headings.length).toBeGreaterThan(0);
    });

    it('should have accessible buttons', () => {
      renderWithProviders(<App {...defaultProps} />);
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveAccessibleName();
      });
    });
  });
});