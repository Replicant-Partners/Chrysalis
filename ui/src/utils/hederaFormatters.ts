/**
 * Hedera Formatting Utilities
 * 
 * Helper functions for formatting Hedera-related data
 */

import type { HederaNetwork } from '../contexts/HederaWalletContext';

/**
 * Format Hedera account ID (0.0.xxxxx)
 */
export const formatAccountId = (accountId: string): string => {
  return accountId;
};

/**
 * Shorten account ID for display (0.0...xxxxx)
 */
export const shortenAccountId = (accountId: string): string => {
  if (!accountId) return '';
  const parts = accountId.split('.');
  if (parts.length !== 3) return accountId;
  return `${parts[0]}.${parts[1]}...${parts[2].slice(-4)}`;
};

/**
 * Format HBAR balance with decimals
 */
export const formatHbarBalance = (balance: number | null): string => {
  if (balance === null) return '-- ℏ';
  return `${balance.toFixed(2)} ℏ`;
};

/**
 * Format network name
 */
export const formatNetworkName = (network: HederaNetwork): string => {
  return network === 'mainnet' ? 'Mainnet' : 'Testnet';
};