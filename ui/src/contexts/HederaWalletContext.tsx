/**
 * HederaWalletContext
 *
 * Provides Hedera wallet connection state and actions via Hashpack.
 * Used for authentication and sign-on to Chrysalis platform.
 *
 * @module ui/contexts/HederaWalletContext
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode
} from 'react';

// ============================================================================
// Types
// ============================================================================

export type HederaNetwork = 'mainnet' | 'testnet';
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface HederaAccountInfo {
  accountId: string;
  balance: number | null;
  network: HederaNetwork;
}

export interface HederaWalletContextValue {
  // Connection state
  status: ConnectionStatus;
  isConnected: boolean;
  account: HederaAccountInfo | null;
  error: string | null;

  // Actions
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  refreshBalance: () => Promise<void>;

  // Hashpack provider availability
  isHashpackAvailable: boolean;
}

// ============================================================================
// Context
// ============================================================================

const HederaWalletContext = createContext<HederaWalletContextValue | undefined>(undefined);

// ============================================================================
// Provider Props
// ============================================================================

interface HederaWalletProviderProps {
  children: ReactNode;
  defaultNetwork?: HederaNetwork;
}

// ============================================================================
// Hashpack Integration
// ============================================================================

interface HashpackResponse {
  accountIds: string[];
  network: string;
}

// Check if Hashpack is available
const checkHashpackAvailability = (): boolean => {
  return typeof window !== 'undefined' && 'hashpack' in window;
};

// Get Hashpack provider
const getHashpackProvider = (): any => {
  if (typeof window !== 'undefined' && 'hashpack' in window) {
    return (window as any).hashpack;
  }
  return null;
};

// ============================================================================
// Provider Component
// ============================================================================

export function HederaWalletProvider({
  children,
  defaultNetwork: _defaultNetwork = 'testnet'
}: HederaWalletProviderProps) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [account, setAccount] = useState<HederaAccountInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isHashpackAvailable, setIsHashpackAvailable] = useState(false);

  // Check for Hashpack on mount
  useEffect(() => {
    const available = checkHashpackAvailability();
    setIsHashpackAvailable(available);

    if (!available) {
      console.warn('Hashpack wallet extension not detected');
    }
  }, []);

  // Connect to Hashpack wallet
  const connectWallet = useCallback(async () => {
    if (!isHashpackAvailable) {
      setError('Hashpack wallet not installed. Please install the Hashpack extension.');
      setStatus('error');
      return;
    }

    try {
      setStatus('connecting');
      setError(null);

      const hashpack = getHashpackProvider();

      // Initialize Hashpack
      const appMetadata = {
        name: 'Chrysalis',
        description: 'Uniform Semantic Agent Morphing System',
        icon: window.location.origin + '/favicon.ico'
      };

      await hashpack.init(appMetadata);

      // Request connection
      const response: HashpackResponse = await hashpack.connect();

      if (!response || !response.accountIds || response.accountIds.length === 0) {
        throw new Error('No accounts returned from Hashpack');
      }

      const accountId = response.accountIds[0];
      const network = response.network.toLowerCase() as HederaNetwork;

      // Set account info
      setAccount({
        accountId,
        balance: null, // Will be fetched separately
        network
      });

      setStatus('connected');

      // Fetch balance
      // Note: For production, you'd use Hedera mirror node API or SDK
      // For now, we'll leave balance as null until implemented

    } catch (err: any) {
      console.error('Failed to connect to Hashpack:', err);
      setError(err.message || 'Failed to connect to wallet');
      setStatus('error');
      setAccount(null);
    }
  }, [isHashpackAvailable]);

  // Disconnect wallet
  const disconnectWallet = useCallback(() => {
    const hashpack = getHashpackProvider();
    if (hashpack && hashpack.disconnect) {
      hashpack.disconnect();
    }

    setStatus('disconnected');
    setAccount(null);
    setError(null);
  }, []);

  // Refresh balance
  const refreshBalance = useCallback(async () => {
    if (!account) return;

    try {
      // In production, fetch balance from Hedera mirror node
      // For now, this is a placeholder
      console.log('Refreshing balance for', account.accountId);

      // Example: Use Hedera SDK to query balance
      // const client = Client.forTestnet(); // or forMainnet()
      // const balance = await new AccountBalanceQuery()
      //   .setAccountId(account.accountId)
      //   .execute(client);

      // setAccount(prev => prev ? { ...prev, balance: balance.hbars.toTinybars().toNumber() / 1e8 } : null);
    } catch (err) {
      console.error('Failed to refresh balance:', err);
    }
  }, [account]);

  const value: HederaWalletContextValue = {
    status,
    isConnected: status === 'connected',
    account,
    error,
    connectWallet,
    disconnectWallet,
    refreshBalance,
    isHashpackAvailable
  };

  return (
    <HederaWalletContext.Provider value={value}>
      {children}
    </HederaWalletContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useHederaWallet(): HederaWalletContextValue {
  const context = useContext(HederaWalletContext);
  if (!context) {
    throw new Error('useHederaWallet must be used within HederaWalletProvider');
  }
  return context;
}