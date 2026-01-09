/**
 * WalletModal Component
 * 
 * Modal dialog for managing API keys:
 * - Add new API keys
 * - View existing keys (masked)
 * - Remove keys
 * - Set default keys per provider
 * - Lock/unlock wallet
 */

import React, { useState, useCallback } from 'react';
import { useWallet, ApiKeyProvider, ApiKeyInfo } from '../../contexts/WalletContext';
import styles from './WalletModal.module.css';

// ============================================================================
// Types
// ============================================================================

type ModalView = 'main' | 'add-key' | 'unlock' | 'setup';

interface AddKeyFormState {
  provider: ApiKeyProvider;
  apiKey: string;
  name: string;
  isDefault: boolean;
}

// ============================================================================
// Provider Icons
// ============================================================================

const providerIcons: Record<ApiKeyProvider, string> = {
  openai: '🤖',
  anthropic: '🧠',
  google: '🔮',
  ollama: '🦙',
  azure: '☁️',
  huggingface: '🤗',
  cohere: '💬',
  mistral: '🌬️',
  groq: '⚡',
  custom: '🔧'
};

const providerNames: Record<ApiKeyProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google AI',
  ollama: 'Ollama',
  azure: 'Azure OpenAI',
  huggingface: 'Hugging Face',
  cohere: 'Cohere',
  mistral: 'Mistral AI',
  groq: 'Groq',
  custom: 'Custom'
};

// ============================================================================
// Sub-components
// ============================================================================

interface KeyItemProps {
  keyInfo: ApiKeyInfo;
  onRemove: (id: string) => void;
  onSetDefault: (id: string) => void;
}

function KeyItem({ keyInfo, onRemove, onSetDefault }: KeyItemProps) {
  return (
    <div className={styles.keyItem}>
      <div className={styles.keyIcon}>
        {providerIcons[keyInfo.provider]}
      </div>
      <div className={styles.keyInfo}>
        <div className={styles.keyProvider}>
          {providerNames[keyInfo.provider]}
          {keyInfo.name && <span className={styles.keyName}> - {keyInfo.name}</span>}
        </div>
        <div className={styles.keyValue}>
          {keyInfo.keyPrefix}
          {keyInfo.isDefault && <span className={styles.defaultBadge}>Default</span>}
        </div>
      </div>
      <div className={styles.keyActions}>
        {!keyInfo.isDefault && (
          <button
            className={styles.setDefaultButton}
            onClick={() => onSetDefault(keyInfo.id)}
            title="Set as default"
          >
            ★
          </button>
        )}
        <button
          className={styles.removeButton}
          onClick={() => onRemove(keyInfo.id)}
          title="Remove key"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

interface UnlockViewProps {
  onUnlock: (password: string) => Promise<boolean>;
  onCancel: () => void;
}

function UnlockView({ onUnlock, onCancel }: UnlockViewProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    const success = await onUnlock(password);
    setLoading(false);
    
    if (!success) {
      setError('Incorrect password');
      setPassword('');
    }
  };

  return (
    <div className={styles.unlockView}>
      <div className={styles.lockIcon}>🔒</div>
      <h3>Wallet Locked</h3>
      <p>Enter your password to unlock the wallet</p>
      
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className={styles.passwordInput}
          autoFocus
        />
        {error && <div className={styles.error}>{error}</div>}
        <div className={styles.buttonGroup}>
          <button 
            type="button" 
            onClick={onCancel} 
            className={styles.cancelButton}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className={styles.unlockButton}
            disabled={loading || !password}
          >
            {loading ? 'Unlocking...' : 'Unlock'}
          </button>
        </div>
      </form>
    </div>
  );
}

interface SetupViewProps {
  onSetup: (password: string) => Promise<void>;
  onSkip: () => void;
}

function SetupView({ onSetup, onSkip }: SetupViewProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    
    setLoading(true);
    await onSetup(password);
    setLoading(false);
  };

  return (
    <div className={styles.setupView}>
      <div className={styles.setupIcon}>🔐</div>
      <h3>Setup Wallet</h3>
      <p>Create a password to protect your API keys</p>
      
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min 8 characters)"
          className={styles.passwordInput}
          autoFocus
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm password"
          className={styles.passwordInput}
        />
        {error && <div className={styles.error}>{error}</div>}
        <div className={styles.buttonGroup}>
          <button 
            type="button" 
            onClick={onSkip} 
            className={styles.skipButton}
          >
            Skip (No Password)
          </button>
          <button 
            type="submit" 
            className={styles.setupButton}
            disabled={loading || !password || !confirmPassword}
          >
            {loading ? 'Setting up...' : 'Create Wallet'}
          </button>
        </div>
      </form>
    </div>
  );
}

interface AddKeyViewProps {
  onAdd: (provider: ApiKeyProvider, key: string, options?: { name?: string; isDefault?: boolean }) => Promise<void>;
  onBack: () => void;
}

function AddKeyView({ onAdd, onBack }: AddKeyViewProps) {
  const [form, setForm] = useState<AddKeyFormState>({
    provider: 'openai',
    apiKey: '',
    name: '',
    isDefault: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.apiKey.trim()) {
      setError('API key is required');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      await onAdd(form.provider, form.apiKey.trim(), {
        name: form.name.trim() || undefined,
        isDefault: form.isDefault
      });
      onBack();
    } catch (err) {
      setError('Failed to add key');
    } finally {
      setLoading(false);
    }
  };

  const providers: ApiKeyProvider[] = [
    'openai', 'anthropic', 'google', 'azure', 
    'ollama', 'huggingface', 'cohere', 'mistral', 'groq', 'custom'
  ];

  return (
    <div className={styles.addKeyView}>
      <h3>Add API Key</h3>
      
      <form onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label>Provider</label>
          <select
            value={form.provider}
            onChange={(e) => setForm({ ...form, provider: e.target.value as ApiKeyProvider })}
            className={styles.select}
          >
            {providers.map(p => (
              <option key={p} value={p}>
                {providerIcons[p]} {providerNames[p]}
              </option>
            ))}
          </select>
        </div>
        
        <div className={styles.formGroup}>
          <label>API Key</label>
          <input
            type="password"
            value={form.apiKey}
            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            placeholder="sk-..."
            className={styles.input}
            autoFocus
          />
        </div>
        
        <div className={styles.formGroup}>
          <label>Name (optional)</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g., Production Key"
            className={styles.input}
          />
        </div>
        
        <div className={styles.formGroup}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
            />
            Set as default for this provider
          </label>
        </div>
        
        {error && <div className={styles.error}>{error}</div>}
        
        <div className={styles.buttonGroup}>
          <button 
            type="button" 
            onClick={onBack} 
            className={styles.cancelButton}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className={styles.addButton}
            disabled={loading || !form.apiKey.trim()}
          >
            {loading ? 'Adding...' : 'Add Key'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================================
// Main Modal Component
// ============================================================================

export function WalletModal() {
  const wallet = useWallet();
  const [view, setView] = useState<ModalView>('main');

  // Determine initial view based on wallet state
  React.useEffect(() => {
    if (!wallet.isModalOpen) {
      setView('main');
      return;
    }
    
    if (!wallet.isInitialized) {
      setView('setup');
    } else if (!wallet.isUnlocked) {
      setView('unlock');
    } else {
      setView('main');
    }
  }, [wallet.isModalOpen, wallet.isInitialized, wallet.isUnlocked]);

  const handleUnlock = useCallback(async (password: string): Promise<boolean> => {
    return wallet.unlockWallet(password);
  }, [wallet]);

  const handleSetup = useCallback(async (password: string) => {
    await wallet.initializeWallet(password);
    setView('main');
  }, [wallet]);

  const handleSkipSetup = useCallback(() => {
    // Initialize without password
    wallet.initializeWallet('');
    setView('main');
  }, [wallet]);

  const handleAddKey = useCallback(async (
    provider: ApiKeyProvider, 
    key: string, 
    options?: { name?: string; isDefault?: boolean }
  ) => {
    await wallet.addKey(provider, key, options);
  }, [wallet]);

  const handleRemoveKey = useCallback((keyId: string) => {
    wallet.removeKey(keyId);
  }, [wallet]);

  const handleSetDefault = useCallback((keyId: string) => {
    wallet.setDefaultKey(keyId);
  }, [wallet]);

  if (!wallet.isModalOpen) return null;

  return (
    <div className={styles.overlay} onClick={wallet.closeModal}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>🔑 API Key Wallet</h2>
          <button 
            className={styles.closeButton} 
            onClick={wallet.closeModal}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        
        <div className={styles.content}>
          {view === 'setup' && (
            <SetupView onSetup={handleSetup} onSkip={handleSkipSetup} />
          )}
          
          {view === 'unlock' && (
            <UnlockView 
              onUnlock={handleUnlock} 
              onCancel={wallet.closeModal} 
            />
          )}
          
          {view === 'add-key' && (
            <AddKeyView 
              onAdd={handleAddKey} 
              onBack={() => setView('main')} 
            />
          )}
          
          {view === 'main' && wallet.isUnlocked && (
            <div className={styles.mainView}>
              {/* Key List */}
              <div className={styles.keyList}>
                {wallet.keys.length === 0 ? (
                  <div className={styles.emptyState}>
                    <span className={styles.emptyIcon}>🔑</span>
                    <p>No API keys configured</p>
                    <p className={styles.emptyHint}>
                      Add your first API key to start using AI providers
                    </p>
                  </div>
                ) : (
                  wallet.keys.map((key) => (
                    <KeyItem
                      key={key.id}
                      keyInfo={key}
                      onRemove={handleRemoveKey}
                      onSetDefault={handleSetDefault}
                    />
                  ))
                )}
              </div>
              
              {/* Actions */}
              <div className={styles.actions}>
                <button
                  className={styles.addKeyButton}
                  onClick={() => setView('add-key')}
                >
                  + Add API Key
                </button>
                
                {wallet.keys.length > 0 && (
                  <button
                    className={styles.lockButton}
                    onClick={wallet.lockWallet}
                  >
                    🔒 Lock Wallet
                  </button>
                )}
              </div>
              
              {/* Provider Status */}
              <div className={styles.providerStatus}>
                <h4>Provider Status</h4>
                <div className={styles.providerGrid}>
                  {wallet.providerStatus.map(status => (
                    <div 
                      key={status.provider}
                      className={`${styles.providerItem} ${status.hasKey ? styles.configured : ''}`}
                    >
                      <span className={styles.providerIcon}>
                        {providerIcons[status.provider]}
                      </span>
                      <span className={styles.providerName}>
                        {providerNames[status.provider]}
                      </span>
                      <span className={styles.providerStatusBadge}>
                        {status.hasKey ? '✓' : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default WalletModal;