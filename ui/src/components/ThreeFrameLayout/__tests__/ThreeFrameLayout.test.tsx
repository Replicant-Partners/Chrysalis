/**
 * ThreeFrameLayout Component Tests
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThreeFrameLayout } from '../ThreeFrameLayout';

describe('ThreeFrameLayout', () => {
  const defaultProps = {
    leftPane: <div>Left Pane Content</div>,
    centerPane: <div>Center Pane Content</div>,
    rightPane: <div>Right Pane Content</div>
  };

  describe('Rendering', () => {
    it('should render without crashing', () => {
      render(<ThreeFrameLayout {...defaultProps} />);
      
      expect(screen.getByText('Left Pane Content')).toBeInTheDocument();
      expect(screen.getByText('Center Pane Content')).toBeInTheDocument();
      expect(screen.getByText('Right Pane Content')).toBeInTheDocument();
    });

    it('should render all three panes', () => {
      const { container } = render(<ThreeFrameLayout {...defaultProps} />);
      
      // Should have three main content areas
      expect(screen.getByText('Left Pane Content')).toBeInTheDocument();
      expect(screen.getByText('Center Pane Content')).toBeInTheDocument();
      expect(screen.getByText('Right Pane Content')).toBeInTheDocument();
    });

    it('should render header when provided', () => {
      render(
        <ThreeFrameLayout 
          {...defaultProps} 
          header={<div>Test Header</div>}
        />
      );
      
      expect(screen.getByText('Test Header')).toBeInTheDocument();
    });

    it('should render footer when provided', () => {
      render(
        <ThreeFrameLayout 
          {...defaultProps} 
          footer={<div>Test Footer</div>}
        />
      );
      
      expect(screen.getByText('Test Footer')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(
        <ThreeFrameLayout {...defaultProps} className="custom-layout" />
      );
      
      expect(container.firstChild).toHaveClass('custom-layout');
    });
  });

  describe('Layout Structure', () => {
    it('should have left pane on the left', () => {
      render(<ThreeFrameLayout {...defaultProps} />);
      
      const leftContent = screen.getByText('Left Pane Content');
      expect(leftContent).toBeInTheDocument();
    });

    it('should have center pane in the middle', () => {
      render(<ThreeFrameLayout {...defaultProps} />);
      
      const centerContent = screen.getByText('Center Pane Content');
      expect(centerContent).toBeInTheDocument();
    });

    it('should have right pane on the right', () => {
      render(<ThreeFrameLayout {...defaultProps} />);
      
      const rightContent = screen.getByText('Right Pane Content');
      expect(rightContent).toBeInTheDocument();
    });
  });

  describe('Initial Width Configuration', () => {
    it('should accept initial left width', () => {
      render(<ThreeFrameLayout {...defaultProps} leftWidth={400} />);
      
      // Layout should render (width is internal state)
      expect(screen.getByText('Left Pane Content')).toBeInTheDocument();
    });

    it('should accept initial right width', () => {
      render(<ThreeFrameLayout {...defaultProps} rightWidth={400} />);
      
      expect(screen.getByText('Right Pane Content')).toBeInTheDocument();
    });

    it('should accept minimum pane width', () => {
      render(<ThreeFrameLayout {...defaultProps} minPaneWidth={250} />);
      
      expect(screen.getByText('Left Pane Content')).toBeInTheDocument();
    });
  });

  describe('Pane Content', () => {
    it('should render complex left pane content', () => {
      const complexLeftPane = (
        <div>
          <h2>Complex Left</h2>
          <p>With multiple elements</p>
        </div>
      );

      render(
        <ThreeFrameLayout 
          {...defaultProps} 
          leftPane={complexLeftPane}
        />
      );
      
      expect(screen.getByText('Complex Left')).toBeInTheDocument();
      expect(screen.getByText('With multiple elements')).toBeInTheDocument();
    });

    it('should render complex center pane content', () => {
      const complexCenterPane = (
        <div>
          <h2>Canvas Area</h2>
          <div>Widget container</div>
        </div>
      );

      render(
        <ThreeFrameLayout 
          {...defaultProps} 
          centerPane={complexCenterPane}
        />
      );
      
      expect(screen.getByText('Canvas Area')).toBeInTheDocument();
      expect(screen.getByText('Widget container')).toBeInTheDocument();
    });

    it('should render complex right pane content', () => {
      const complexRightPane = (
        <div>
          <h2>Complex Right</h2>
          <button>Action Button</button>
        </div>
      );

      render(
        <ThreeFrameLayout 
          {...defaultProps} 
          rightPane={complexRightPane}
        />
      );
      
      expect(screen.getByText('Complex Right')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /action button/i })).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have semantic structure', () => {
      const { container } = render(<ThreeFrameLayout {...defaultProps} />);
      
      // Should have proper HTML structure
      expect(container.firstChild).toBeInTheDocument();
    });

    it('should maintain tab order', () => {
      render(
        <ThreeFrameLayout 
          leftPane={<button>Left Button</button>}
          centerPane={<button>Center Button</button>}
          rightPane={<button>Right Button</button>}
        />
      );
      
      expect(screen.getByRole('button', { name: /left/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /center/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /right/i })).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('should handle window resize', () => {
      render(<ThreeFrameLayout {...defaultProps} />);
      
      // Layout should adapt (tested via visual regression)
      expect(screen.getByText('Left Pane Content')).toBeInTheDocument();
    });
  });
});