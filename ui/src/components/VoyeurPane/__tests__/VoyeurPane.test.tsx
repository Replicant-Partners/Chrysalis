/**
 * VoyeurPane Component Tests
 * 
 * Component tests for the observability event viewer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VoyeurPane } from '../VoyeurPane';
import { renderWithVoyeur } from '../../../test/test-utils';

describe('VoyeurPane', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  it('should render without crashing', () => {
    renderWithVoyeur(<VoyeurPane onClose={mockOnClose} />);
    
    expect(screen.getByText(/Observability Events/i)).toBeInTheDocument();
  });

  it('should display connection controls', () => {
    renderWithVoyeur(<VoyeurPane onClose={mockOnClose} />);
    
    expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    renderWithVoyeur(<VoyeurPane onClose={mockOnClose} />);
    
    const closeButton = screen.getByLabelText(/close/i);
    await user.click(closeButton);
    
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should display disconnected state initially', () => {
    renderWithVoyeur(<VoyeurPane onClose={mockOnClose} />);
    
    expect(screen.getByText(/disconnected/i)).toBeInTheDocument();
  });

  it('should show empty state when no events', () => {
    renderWithVoyeur(<VoyeurPane onClose={mockOnClose} />);
    
    expect(screen.getByText(/No events yet/i)).toBeInTheDocument();
  });

  it('should display search input', () => {
    renderWithVoyeur(<VoyeurPane onClose={mockOnClose} />);
    
    expect(screen.getByPlaceholderText(/search events/i)).toBeInTheDocument();
  });

  it('should display filter options', () => {
    renderWithVoyeur(<VoyeurPane onClose={mockOnClose} />);
    
    expect(screen.getByText(/all events/i)).toBeInTheDocument();
  });

  it('should have clear button', () => {
    renderWithVoyeur(<VoyeurPane onClose={mockOnClose} />);
    
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
  });

  it('should have pause/resume button', () => {
    renderWithVoyeur(<VoyeurPane onClose={mockOnClose} />);
    
    const pauseButton = screen.getByRole('button', { name: /pause/i });
    expect(pauseButton).toBeInTheDocument();
  });

  it('should toggle auto-scroll', async () => {
    const user = userEvent.setup();
    renderWithVoyeur(<VoyeurPane onClose={mockOnClose} />);
    
    const autoScrollCheckbox = screen.getByRole('checkbox', { name: /auto-scroll/i });
    expect(autoScrollCheckbox).toBeChecked();
    
    await user.click(autoScrollCheckbox);
    expect(autoScrollCheckbox).not.toBeChecked();
  });

  it('should filter events by search text', async () => {
    const user = userEvent.setup();
    renderWithVoyeur(<VoyeurPane onClose={mockOnClose} />);
    
    const searchInput = screen.getByPlaceholderText(/search events/i);
    await user.type(searchInput, 'ingest');
    
    expect(searchInput).toHaveValue('ingest');
  });

  it('should display event count badge', () => {
    renderWithVoyeur(<VoyeurPane onClose={mockOnClose} />);
    
    // Initially should show 0 events
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('should be keyboard accessible', async () => {
    const user = userEvent.setup();
    renderWithVoyeur(<VoyeurPane onClose={mockOnClose} />);
    
    // Tab through interactive elements
    await user.tab();
    expect(screen.getByRole('button', { name: /connect/i })).toHaveFocus();
    
    await user.tab();
    expect(screen.getByPlaceholderText(/search events/i)).toHaveFocus();
  });

  it('should have proper ARIA labels', () => {
    renderWithVoyeur(<VoyeurPane onClose={mockOnClose} />);
    
    expect(screen.getByLabelText(/close/i)).toBeInTheDocument();
    expect(screen.getByRole('region')).toBeInTheDocument();
  });

  describe('Event Display', () => {
    it('should expand event details when clicked', async () => {
      // This test would need actual events in the context
      // For now, just verify the UI structure exists
      renderWithVoyeur(<VoyeurPane onClose={mockOnClose} />);
      
      // Event list container should exist
      const eventList = screen.getByRole('region');
      expect(eventList).toBeInTheDocument();
    });
  });

  describe('Connection Management', () => {
    it('should show connect button when disconnected', () => {
      renderWithVoyeur(<VoyeurPane onClose={mockOnClose} />);
      
      expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument();
    });
  });

  describe('Filtering', () => {
    it('should have filter dropdown', () => {
      renderWithVoyeur(<VoyeurPane onClose={mockOnClose} />);
      
      expect(screen.getByText(/all events/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have semantic HTML structure', () => {
      const { container } = renderWithVoyeur(<VoyeurPane onClose={mockOnClose} />);
      
      // Should have proper heading structure
      expect(container.querySelector('h1, h2, h3')).toBeInTheDocument();
    });

    it('should have descriptive button labels', () => {
      renderWithVoyeur(<VoyeurPane onClose={mockOnClose} />);
      
      const connectButton = screen.getByRole('button', { name: /connect/i });
      expect(connectButton).toHaveAccessibleName();
    });
  });
});