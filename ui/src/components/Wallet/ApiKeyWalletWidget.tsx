/**
 * ApiKeyWalletWidget Component
 * 
 * A canvas widget that displays API key wallet status and provides
 * quick access to wallet management. This widget can be placed on
 * the canvas for agents to reference available API providers.
 */

import React from 'react';
import { useWallet, ApiKeyProvider } from '../../contexts/WalletContext';
import styles from './ApiKeyWalletWidget.module.css';

// ============================================================================
// Types
// ============================================================================

export interface ApiKeyWalletWidgetProps {
  /** Widget properties from canvas node */
  props?: {
    /** Show only specific providers */
    filterProviders?: ApiKeyProvider[];
    /** Compact display mode */
    compact?: boolean;
    /** Show add key button */
    showAddButton?: boolean;
  };
}

// ============================================================================
// Provider Display Config
// ============================================================================

const providerConfig: Record<ApiKeyProvider, { icon: string; name: string; color: string }> = {
  openai: { icon: '🤖', name: 'OpenAI', color: '#10a37f' },
  anthropic: { icon: '🧠', name: 'Anthropic', color: '#cc785c' },
  google: { icon: '🔮', name: 'Google AI', color: '#4285f4' },
  ollama: { icon: '🦙', name: 'Ollama', color: '#888' },
  azure: { icon: '☁️', name: 'Azure', color: '#0078d4' },
  huggingface: { icon: '🤗', name: 'Hugging Face', color: '#ffcc00' },
  cohere: { icon: '💬', name: 'Cohere', color: '#39594d' },
  mistral: { icon: '🌬️', name: 'Mistral', color: '#ff7000' },
  groq: { icon: '⚡', name: 'Groq', color: '#f55036' },
  custom: { icon: '🔧', name: 'Custom', color: '#6366f1' }
};

// ============================================================================
// Component
// ============================================================================

export function ApiKeyWalletWidget({ props }: ApiKeyWalletWidgetProps) {
  const wallet = useWallet();
  const { filterProviders, compact = false, showAddButton = true } = props || {};

  // Filter providers if specified
  const displayProviders = filterProviders 
    ? wallet.providerStatus.filter(s => filterProviders.includes(s.provider))
    : wallet.providerStatus;

  // Count configured providers
  const configuredCount = displayProviders.filter(s => s.hasKey).length;
  const totalCount = displayProviders.length;

  return (
    <div className={`${styles.widget} ${compact ? styles.compact : ''}`}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.icon}>🔑</span>
          <span>API Keys</span>
        </div>
        <div className={styles.status}>
          {wallet.isUnlocked ? (
            <span className={styles.unlocked}>
              🔓 {configuredCount}/{totalCount}
            </span>
          ) : (
            <span className={styles.locked}>🔒 Locked</span>
          )}
        </div>
      </div>

      {/* Content */}
      {wallet.isUnlocked ? (
        <>
          {/* Provider Grid */}
          <div className={styles.providerGrid}>
            {displayProviders.map(status => {
              const config = providerConfig[status.provider];
              const keyInfo = wallet.keys.find(
                k => k.provider === status.provider && k.isDefault
              );
              
              return (
                <div 
                  key={status.provider}
                  className={`${styles.provider} ${status.hasKey ? styles.configured : ''}`}
                  style={{ '--provider-color': config.color } as React.CSSProperties}
                  title={status.hasKey 
                    ? `${config.name}: ${keyInfo?.keyPrefix || 'Configured'}`
                    : `${config.name}: Not configured`
                  }
                >
                  <span className={styles.providerIcon}>{config.icon}</span>
                  {!compact && (
                    <span className={styles.providerName}>{config.name}</span>
                  )}
                  <span className={styles.providerStatus}>
                    {status.hasKey ? '✓' : '—'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Quick Actions */}
          {showAddButton && (
            <div className={styles.actions}>
              <button 
                className={styles.manageButton}
                onClick={() => wallet.openModal()}
              >
                ⚙️ Manage Keys
              </button>
            </div>
          )}
        </>
      ) : (
        /* Locked State */
        <div className={styles.lockedContent}>
          <p>Wallet is locked</p>
          <button 
            className={styles.unlockButton}
            onClick={() => wallet.openModal()}
          >
            🔓 Unlock
          </button>
        </div>
      )}
    </div>
  );
}

export default ApiKeyWalletWidget;