/**
 * Theme Context
 * 
 * Provides theme mode (light/dark) management across the Chrysalis UI.
 * Supports theme toggle and persists preference to localStorage.
 * 
 * @module components/shared/ThemeContext
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { ThemeMode } from './tokens';

// =============================================================================
// Types
// =============================================================================

interface ThemeContextValue {
  mode: ThemeMode;
  toggleMode: () => void;
  setMode: (mode: ThemeMode) => void;
}

// =============================================================================
// Context
// =============================================================================

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// =============================================================================
// Provider
// =============================================================================

interface ThemeProviderProps {
  children: ReactNode;
  defaultMode?: ThemeMode;
  persistKey?: string;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultMode = 'dark',
  persistKey = 'chrysalis-theme-mode',
}) => {
  // Initialize from localStorage or default
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(persistKey);
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
    }
    return defaultMode;
  });

  // Persist to localStorage whenever mode changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(persistKey, mode);
    }
  }, [mode, persistKey]);

  // Toggle between light and dark
  const toggleMode = useCallback(() => {
    setModeState(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  // Set specific mode
  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
  }, []);

  const value: ThemeContextValue = {
    mode,
    toggleMode,
    setMode,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// =============================================================================
// Hook
// =============================================================================

/**
 * Use theme context
 * 
 * @throws {Error} if used outside ThemeProvider
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

export default ThemeContext;