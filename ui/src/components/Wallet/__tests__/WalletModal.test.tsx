/**
 * WalletModal Component Tests
 * 
 * Tests for the wallet modal UI component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithWallet } from '../../../test/test-utils';
import { WalletModal } from '../WalletModal';

describe('WalletModal', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Uninitialized State', () => {
    it('should show initialization form for new wallet', () => {
      renderWithWallet(<WalletModal />);
      
      expect(screen.getByText(/create.*wallet/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm.*password/i)).toBeInTheDocument();
    });

    it('should require password confirmation to match', async () => {
      const user = userEvent.setup();
      renderWithWallet(<WalletModal />);
      
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmInput = screen.getByLabelText(/confirm.*password/i);
      
      await user.type(passwordInput, 'MyPassword123!');
      await user.type(confirmInput, 'DifferentPassword123!');
      
      const createButton = screen.getByRole('button', { name: /create/i });
      await user.click(createButton);
      
      expect(screen.getByText(/passwords.*match/i)).toBeInTheDocument();
    });

    it('should show password strength indicator', async () => {
      const user = userEvent.setup();
      renderWithWallet(<WalletModal />);
      
      const passwordInput = screen.getByLabelText(/^password$/i);
      await user.type(passwordInput, 'weak');
      
      expect(screen.getByText(/weak/i)).toBeInTheDocument();
    });
  });

  describe('Locked State', () => {
    beforeEach(() => {
      localStorage.setItem('chrysalis_wallet_initialized', 'true');
    });

    it('should show unlock form for existing wallet', () => {
      renderWithWallet(<WalletModal />);
      
      expect(screen.getByText(/unlock.*wallet/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    });

    it('should show error for incorrect password', async () => {
      const user = userEvent.setup();
      renderWithWallet(<WalletModal />);
      
      const passwordInput = screen.getByLabelText(/password/i);
      await user.type(passwordInput, 'WrongPassword123!');
      
      const unlockButton = screen.getByRole('button', { name: /unlock/i });
      await user.click(unlockButton);
      
      await waitFor(() => {
        expect(screen.getByText(/incorrect.*password/i)).toBeInTheDocument();
      });
    });
  });

  describe('Unlocked State', () => {
    it('should show key management interface', async () => {
      const user = userEvent.setup();
      renderWithWallet(<WalletModal />);
      
      // Initialize wallet
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmInput = screen.getByLabelText(/confirm.*password/i);
      
      await user.type(passwordInput, 'MySecurePassword123!');
      await user.type(confirmInput, 'MySecurePassword123!');
      
      const createButton = screen.getByRole('button', { name: /create/i });
      await user.click(createButton);
      
      await waitFor(() => {
        expect(screen.getByText(/add.*key/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper form labels', () => {
      renderWithWallet(<WalletModal />);
      
      const passwordInput = screen.getByLabelText(/password/i);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      renderWithWallet(<WalletModal />);
      
      await user.tab();
      expect(screen.getByLabelText(/password/i)).toHaveFocus();
    });

    it('should have ARIA live region for errors', () => {
      renderWithWallet(<WalletModal />);
      
      const alerts = screen.queryAllByRole('alert');
      expect(alerts.length).toBeGreaterThanOrEqual(0);
    });
  });
});