/**
 * SettingsCanvas Component
 * 
 * Full-canvas settings interface for configuring:
 * - API providers and keys
 * - Model selection and parameters
 * - Voice providers
 * - System preferences
 * - Export/Import configuration
 */

import { useState, useCallback } from 'react';
import { useWallet, ApiKeyProvider } from '../../contexts/WalletContext';
import { Button, Card, Input, Badge } from '../design-system';
import styles from './SettingsCanvas.module.css';

// ============================================================================
// Types
// ============================================================================

type SettingsTab = 'providers' | 'models' | 'voice' | 'system' | 'advanced';

interface ModelConfig {
  provider: ApiKeyProvider;
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
}

interface VoiceConfig {
  provider: 'elevenlabs' | 'openai' | 'azure' | 'none';
  voiceId?: string;
  model?: string;
}

interface SystemConfig {
  theme: 'dark' | 'light' | 'auto';
  autoSave: boolean;
  autoLockMinutes: number;
  telemetry: boolean;
}

// ============================================================================
// Provider Info
// ============================================================================

const PROVIDER_INFO: Record<ApiKeyProvider, {
  name: string;
  icon: string;
  description: string;
  models: string[];
  keyFormat: string;
}> = {
  openai: {
    name: 'OpenAI',
    icon: '🤖',
    description: 'GPT-4, GPT-3.5, DALL-E, Whisper',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    keyFormat: 'sk-...'
  },
  anthropic: {
    name: 'Anthropic',
    icon: '🧠',
    description: 'Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
    keyFormat: 'sk-ant-...'
  },
  google: {
    name: 'Google AI',
    icon: '🔮',
    description: 'Gemini Pro, Gemini Ultra',
    models: ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    keyFormat: 'AI...'
  },
  ollama: {
    name: 'Ollama',
    icon: '🦙',
    description: 'Local LLMs (Llama, Mistral, etc.)',
    models: ['llama3.2', 'mistral', 'codellama', 'phi'],
    keyFormat: 'http://localhost:11434'
  },
  azure: {
    name: 'Azure OpenAI',
    icon: '☁️',
    description: 'Azure-hosted OpenAI models',
    models: ['gpt-4', 'gpt-35-turbo'],
    keyFormat: 'Azure key'
  },
  huggingface: {
    name: 'Hugging Face',
    icon: '🤗',
    description: 'Open source models',
    models: ['llama-2', 'mistral-7b', 'falcon'],
    keyFormat: 'hf_...'
  },
  cohere: {
    name: 'Cohere',
    icon: '💬',
    description: 'Command R+, Command R',
    models: ['command-r-plus', 'command-r', 'command'],
    keyFormat: 'co_...'
  },
  mistral: {
    name: 'Mistral AI',
    icon: '🌬️',
    description: 'Mistral Large, Mistral Medium',
    models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'],
    keyFormat: 'mist_...'
  },
  groq: {
    name: 'Groq',
    icon: '⚡',
    description: 'Ultra-fast LPU inference',
    models: ['llama-3.1-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b'],
    keyFormat: 'gsk_...'
  },
  custom: {
    name: 'Custom',
    icon: '🔧',
    description: 'Custom API endpoint',
    models: [],
    keyFormat: 'Custom'
  }
};

// ============================================================================
// Provider Card Component
// ============================================================================

interface ProviderCardProps {
  provider: ApiKeyProvider;
  hasKey: boolean;
  onConfigure: () => void;
  onTest?: () => void;
}

function ProviderCard({ provider, hasKey, onConfigure, onTest }: ProviderCardProps) {
  const info = PROVIDER_INFO[provider];
  
  return (
    <Card variant="elevated" className={styles.providerCard}>
      <div className={styles.providerHeader}>
        <div className={styles.providerIcon}>{info.icon}</div>
        <div className={styles.providerInfo}>
          <h4 className={styles.providerName}>{info.name}</h4>
          <p className={styles.providerDescription}>{info.description}</p>
        </div>
        <Badge variant={hasKey ? 'success' : 'default'} withDot={hasKey}>
          {hasKey ? 'Configured' : 'Not Set'}
        </Badge>
      </div>
      
      <div className={styles.providerActions}>
        <Button 
          variant={hasKey ? 'secondary' : 'primary'} 
          size="sm" 
          onClick={onConfigure}
        >
          {hasKey ? 'Manage Keys' : 'Add API Key'}
        </Button>
        {hasKey && onTest && (
          <Button variant="ghost" size="sm" onClick={onTest}>
            Test Connection
          </Button>
        )}
      </div>
      
      {info.models.length > 0 && (
        <div className={styles.providerModels}>
          <div className={styles.modelsLabel}>Available Models:</div>
          <div className={styles.modelsList}>
            {info.models.slice(0, 3).map(model => (
              <span key={model} className={styles.modelTag}>{model}</span>
            ))}
            {info.models.length > 3 && (
              <span className={styles.modelTag}>+{info.models.length - 3} more</span>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

// ============================================================================
// Model Configuration Component
// ============================================================================

interface ModelConfigPanelProps {
  config: ModelConfig;
  onChange: (config: ModelConfig) => void;
}

function ModelConfigPanel({ config, onChange }: ModelConfigPanelProps) {
  const info = PROVIDER_INFO[config.provider];
  
  return (
    <div className={styles.modelConfig}>
      <h3>Model Configuration</h3>
      
      <div className={styles.configGrid}>
        <div className={styles.configField}>
          <label>Provider</label>
          <select
            value={config.provider}
            onChange={(e) => onChange({ ...config, provider: e.target.value as ApiKeyProvider })}
            className={styles.select}
          >
            {Object.entries(PROVIDER_INFO).map(([key, value]) => (
              <option key={key} value={key}>
                {value.icon} {value.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className={styles.configField}>
          <label>Model</label>
          <select
            value={config.model}
            onChange={(e) => onChange({ ...config, model: e.target.value })}
            className={styles.select}
          >
            {info.models.map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        </div>
        
        <div className={styles.configField}>
          <label>
            Temperature 
            <span className={styles.fieldValue}>{config.temperature.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={config.temperature}
            onChange={(e) => onChange({ ...config, temperature: parseFloat(e.target.value) })}
            className={styles.slider}
          />
          <div className={styles.sliderLabels}>
            <span>Precise</span>
            <span>Creative</span>
          </div>
        </div>
        
        <div className={styles.configField}>
          <label>
            Max Tokens
            <span className={styles.fieldValue}>{config.maxTokens}</span>
          </label>
          <input
            type="range"
            min="256"
            max="4096"
            step="256"
            value={config.maxTokens}
            onChange={(e) => onChange({ ...config, maxTokens: parseInt(e.target.value) })}
            className={styles.slider}
          />
        </div>
        
        <div className={styles.configField}>
          <label>
            Top P
            <span className={styles.fieldValue}>{config.topP.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={config.topP}
            onChange={(e) => onChange({ ...config, topP: parseFloat(e.target.value) })}
            className={styles.slider}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main SettingsCanvas Component
// ============================================================================

export function SettingsCanvas() {
  const wallet = useWallet();
  const [activeTab, setActiveTab] = useState<SettingsTab>('providers');
  
  // Model configuration
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    provider: 'openai',
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 2048,
    topP: 0.9
  });
  
  // Voice configuration
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig>({
    provider: 'none'
  });
  
  // System configuration
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({
    theme: 'dark',
    autoSave: true,
    autoLockMinutes: 30,
    telemetry: false
  });
  
  const handleOpenWallet = useCallback(() => {
    wallet.openModal();
  }, [wallet]);
  
  const handleExportConfig = useCallback(() => {
    const config = {
      model: modelConfig,
      voice: voiceConfig,
      system: systemConfig,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
    
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chrysalis-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [modelConfig, voiceConfig, systemConfig]);
  
  const handleImportConfig = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const config = JSON.parse(text);
        
        if (config.model) setModelConfig(config.model);
        if (config.voice) setVoiceConfig(config.voice);
        if (config.system) setSystemConfig(config.system);
        
        alert('Configuration imported successfully!');
      } catch (error) {
        alert('Failed to import configuration. Invalid file format.');
      }
    };
    input.click();
  }, []);
  
  const tabs: { id: SettingsTab; label: string; icon: string }[] = [
    { id: 'providers', label: 'API Providers', icon: '🔑' },
    { id: 'models', label: 'Model Config', icon: '🤖' },
    { id: 'voice', label: 'Voice', icon: '🎤' },
    { id: 'system', label: 'System', icon: '⚙️' },
    { id: 'advanced', label: 'Advanced', icon: '🔧' }
  ];
  
  return (
    <div className={styles.settingsCanvas}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h2 className={styles.title}>⚙️ Settings</h2>
          <p className={styles.subtitle}>Configure API providers, models, and system preferences</p>
        </div>
        <div className={styles.headerActions}>
          <Button variant="ghost" size="sm" onClick={handleImportConfig}>
            📥 Import
          </Button>
          <Button variant="ghost" size="sm" onClick={handleExportConfig}>
            📤 Export
          </Button>
        </div>
      </div>
      
      {/* Tabs */}
      <div className={styles.tabs}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className={styles.tabIcon}>{tab.icon}</span>
            <span className={styles.tabLabel}>{tab.label}</span>
          </button>
        ))}
      </div>
      
      {/* Content */}
      <div className={styles.content}>
        {/* Providers Tab */}
        {activeTab === 'providers' && (
          <div className={styles.providersTab}>
            <div className={styles.tabHeader}>
              <div>
                <h3>API Provider Configuration</h3>
                <p className={styles.tabDescription}>
                  Manage API keys for AI providers. Keys are encrypted with AES-256-GCM.
                </p>
              </div>
              <Button variant="primary" onClick={handleOpenWallet}>
                🔑 Manage Wallet
              </Button>
            </div>
            
            <div className={styles.providerGrid}>
              {wallet.providerStatus.map(status => (
                <ProviderCard
                  key={status.provider}
                  provider={status.provider}
                  hasKey={status.hasKey}
                  onConfigure={handleOpenWallet}
                />
              ))}
            </div>
          </div>
        )}
        
        {/* Models Tab */}
        {activeTab === 'models' && (
          <div className={styles.modelsTab}>
            <div className={styles.tabHeader}>
              <div>
                <h3>Default Model Configuration</h3>
                <p className={styles.tabDescription}>
                  Set default model parameters for agent interactions
                </p>
              </div>
            </div>
            
            <ModelConfigPanel config={modelConfig} onChange={setModelConfig} />
            
            <Card variant="outlined" className={styles.infoCard}>
              <h4>💡 Model Selection Tips</h4>
              <ul className={styles.tipsList}>
                <li><strong>GPT-4o:</strong> Best for complex reasoning and coding tasks</li>
                <li><strong>Claude 3.5 Sonnet:</strong> Excellent for creative writing and analysis</li>
                <li><strong>Gemini Pro:</strong> Strong multimodal capabilities</li>
                <li><strong>Temperature:</strong> Lower = more focused, Higher = more creative</li>
              </ul>
            </Card>
          </div>
        )}
        
        {/* Voice Tab */}
        {activeTab === 'voice' && (
          <div className={styles.voiceTab}>
            <div className={styles.tabHeader}>
              <div>
                <h3>Voice Configuration</h3>
                <p className={styles.tabDescription}>
                  Configure text-to-speech and voice synthesis
                </p>
              </div>
            </div>
            
            <div className={styles.configGrid}>
              <div className={styles.configField}>
                <label>Voice Provider</label>
                <select
                  value={voiceConfig.provider}
                  onChange={(e) => setVoiceConfig({ 
                    ...voiceConfig, 
                    provider: e.target.value as VoiceConfig['provider']
                  })}
                  className={styles.select}
                >
                  <option value="none">None (Disabled)</option>
                  <option value="elevenlabs">🎵 ElevenLabs</option>
                  <option value="openai">🤖 OpenAI TTS</option>
                  <option value="azure">☁️ Azure Speech</option>
                </select>
              </div>
              
              {voiceConfig.provider !== 'none' && (
                <>
                  <div className={styles.configField}>
                    <label>Voice Model</label>
                    <Input
                      value={voiceConfig.model || ''}
                      onChange={(e) => setVoiceConfig({ ...voiceConfig, model: e.target.value })}
                      placeholder="e.g., tts-1, eleven_multilingual_v2"
                    />
                  </div>
                  
                  <div className={styles.configField}>
                    <label>Voice ID</label>
                    <Input
                      value={voiceConfig.voiceId || ''}
                      onChange={(e) => setVoiceConfig({ ...voiceConfig, voiceId: e.target.value })}
                      placeholder="Voice identifier"
                    />
                  </div>
                </>
              )}
            </div>
            
            <Card variant="outlined" className={styles.infoCard}>
              <h4>🎤 Voice Features</h4>
              <p>Voice synthesis is currently in beta. Supported features:</p>
              <ul className={styles.tipsList}>
                <li>Real-time text-to-speech for agent responses</li>
                <li>Multiple voice styles and languages</li>
                <li>Voice activity indicators in chat</li>
              </ul>
            </Card>
          </div>
        )}
        
        {/* System Tab */}
        {activeTab === 'system' && (
          <div className={styles.systemTab}>
            <div className={styles.tabHeader}>
              <div>
                <h3>System Preferences</h3>
                <p className={styles.tabDescription}>
                  Configure application behavior and appearance
                </p>
              </div>
            </div>
            
            <div className={styles.configGrid}>
              <div className={styles.configField}>
                <label>Theme</label>
                <select
                  value={systemConfig.theme}
                  onChange={(e) => setSystemConfig({ 
                    ...systemConfig, 
                    theme: e.target.value as SystemConfig['theme']
                  })}
                  className={styles.select}
                >
                  <option value="dark">🌙 Dark</option>
                  <option value="light">☀️ Light</option>
                  <option value="auto">🌓 Auto (System)</option>
                </select>
              </div>
              
              <div className={styles.configField}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={systemConfig.autoSave}
                    onChange={(e) => setSystemConfig({ 
                      ...systemConfig, 
                      autoSave: e.target.checked 
                    })}
                  />
                  <span>Auto-save sessions</span>
                </label>
              </div>
              
              <div className={styles.configField}>
                <label>
                  Wallet Auto-Lock
                  <span className={styles.fieldValue}>{systemConfig.autoLockMinutes} min</span>
                </label>
                <input
                  type="range"
                  min="5"
                  max="120"
                  step="5"
                  value={systemConfig.autoLockMinutes}
                  onChange={(e) => setSystemConfig({ 
                    ...systemConfig, 
                    autoLockMinutes: parseInt(e.target.value)
                  })}
                  className={styles.slider}
                />
              </div>
              
              <div className={styles.configField}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={systemConfig.telemetry}
                    onChange={(e) => setSystemConfig({ 
                      ...systemConfig, 
                      telemetry: e.target.checked 
                    })}
                  />
                  <span>Share anonymous usage data (helps improve Chrysalis)</span>
                </label>
              </div>
            </div>
          </div>
        )}
        
        {/* Advanced Tab */}
        {activeTab === 'advanced' && (
          <div className={styles.advancedTab}>
            <div className={styles.tabHeader}>
              <div>
                <h3>Advanced Settings</h3>
                <p className={styles.tabDescription}>
                  Developer options and experimental features
                </p>
              </div>
            </div>
            
            <Card variant="outlined" className={styles.dangerCard}>
              <h4>⚠️ Danger Zone</h4>
              <div className={styles.dangerActions}>
                <div className={styles.dangerAction}>
                  <div>
                    <strong>Reset All Settings</strong>
                    <p>Reset all configuration to defaults (keeps API keys)</p>
                  </div>
                  <Button variant="danger" size="sm">
                    Reset Settings
                  </Button>
                </div>
                
                <div className={styles.dangerAction}>
                  <div>
                    <strong>Clear Wallet</strong>
                    <p>Remove all API keys and wallet data (requires confirmation)</p>
                  </div>
                  <Button variant="danger" size="sm">
                    Clear Wallet
                  </Button>
                </div>
              </div>
            </Card>
            
            <Card variant="outlined" className={styles.infoCard}>
              <h4>🔧 Developer Tools</h4>
              <div className={styles.devTools}>
                <Button variant="ghost" size="sm">
                  View Console Logs
                </Button>
                <Button variant="ghost" size="sm">
                  Export Debug Info
                </Button>
                <Button variant="ghost" size="sm">
                  Test YJS Connection
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default SettingsCanvas;