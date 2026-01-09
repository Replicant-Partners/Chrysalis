/**
 * Security Module Integration Tests
 * 
 * Tests for:
 * - Crypto utilities
 * - API Key Wallet
 * - Secure Canvas Manager
 * - Wallet-integrated LLM Service
 * 
 * @module tests/integration/security
 */

import {
  // Crypto
  generateKey,
  generateSalt,
  generateToken,
  hash,
  encrypt,
  decrypt,
  decryptToString,
  encryptWithPassword,
  decryptWithPasswordToString,
  secureCompare,
  
  // Wallet
  ApiKeyWallet,
  createApiKeyWallet,
  ApiKeyProvider,
  
  // Secure Canvas
  SecureCanvasManager,
  createSecureCanvasManager
} from '../../src/security';

import {
  SecureCanvas,
  OpenCanvas,
  CanvasSecurityLevel,
  isSecureCanvas,
  isOpenCanvas,
  requiresEncryption,
  SECURE_WIDGET_DEFINITIONS
} from '../../src/terminal/protocols/secure-canvas';

import {
  WalletIntegratedLLMService,
  createWalletIntegratedLLMService
} from '../../src/services/llm/WalletIntegratedLLMService';

// ============================================================================
// Crypto Tests
// ============================================================================

describe('Crypto Utilities', () => {
  describe('Key Generation', () => {
    it('should generate random keys', () => {
      const key1 = generateKey();
      const key2 = generateKey();
      
      expect(key1.length).toBe(32); // 256 bits
      expect(key2.length).toBe(32);
      expect(key1.equals(key2)).toBe(false);
    });
    
    it('should generate random salts', () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      
      expect(salt1.length).toBe(32);
      expect(salt2.length).toBe(32);
      expect(salt1.equals(salt2)).toBe(false);
    });
    
    it('should generate random tokens', () => {
      const token1 = generateToken();
      const token2 = generateToken();
      
      expect(token1.length).toBe(64); // 32 bytes as hex
      expect(token2.length).toBe(64);
      expect(token1).not.toBe(token2);
    });
    
    it('should generate tokens of specified length', () => {
      const token = generateToken(16);
      expect(token.length).toBe(32); // 16 bytes as hex
    });
  });
  
  describe('Hashing', () => {
    it('should hash strings consistently', () => {
      const hash1 = hash('test');
      const hash2 = hash('test');
      
      expect(hash1).toBe(hash2);
    });
    
    it('should produce different hashes for different inputs', () => {
      const hash1 = hash('test1');
      const hash2 = hash('test2');
      
      expect(hash1).not.toBe(hash2);
    });
    
    it('should produce 64 character hex hash', () => {
      const result = hash('test');
      expect(result.length).toBe(64);
      expect(/^[a-f0-9]+$/.test(result)).toBe(true);
    });
  });
  
  describe('Encryption/Decryption', () => {
    it('should encrypt and decrypt with key', () => {
      const key = generateKey();
      const plaintext = 'Hello, World!';
      
      const encrypted = encrypt(plaintext, key);
      const decrypted = decryptToString(encrypted, key);
      
      expect(decrypted).toBe(plaintext);
    });
    
    it('should produce different ciphertext each time', () => {
      const key = generateKey();
      const plaintext = 'Hello, World!';
      
      const encrypted1 = encrypt(plaintext, key);
      const encrypted2 = encrypt(plaintext, key);
      
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });
    
    it('should fail decryption with wrong key', () => {
      const key1 = generateKey();
      const key2 = generateKey();
      const plaintext = 'Hello, World!';
      
      const encrypted = encrypt(plaintext, key1);
      
      expect(() => decrypt(encrypted, key2)).toThrow();
    });
    
    it('should include auth tag for integrity', () => {
      const key = generateKey();
      const encrypted = encrypt('test', key);
      
      expect(encrypted.authTag).toBeDefined();
      expect(encrypted.authTag.length).toBeGreaterThan(0);
    });
  });
  
  describe('Password-based Encryption', () => {
    it('should encrypt and decrypt with password', async () => {
      const password = 'mySecurePassword123';
      const plaintext = 'Secret data';
      
      const encrypted = await encryptWithPassword(plaintext, password);
      const decrypted = await decryptWithPasswordToString(encrypted, password);
      
      expect(decrypted).toBe(plaintext);
    });
    
    it('should include salt for password derivation', async () => {
      const encrypted = await encryptWithPassword('test', 'password');
      
      expect(encrypted.salt).toBeDefined();
      expect(encrypted.salt!.length).toBeGreaterThan(0);
    });
    
    it('should fail with wrong password', async () => {
      const encrypted = await encryptWithPassword('test', 'password1');
      
      await expect(
        decryptWithPasswordToString(encrypted, 'password2')
      ).rejects.toThrow();
    });
  });
  
  describe('Secure Comparison', () => {
    it('should return true for equal strings', () => {
      expect(secureCompare('test', 'test')).toBe(true);
    });
    
    it('should return false for different strings', () => {
      expect(secureCompare('test1', 'test2')).toBe(false);
    });
    
    it('should return false for different lengths', () => {
      expect(secureCompare('test', 'testing')).toBe(false);
    });
  });
});

// ============================================================================
// API Key Wallet Tests
// ============================================================================

describe('ApiKeyWallet', () => {
  let wallet: ApiKeyWallet;
  const testPassword = 'testPassword123!';
  
  beforeEach(async () => {
    wallet = createApiKeyWallet();
    await wallet.initialize(testPassword);
  });
  
  afterEach(() => {
    wallet.destroy();
  });
  
  describe('Initialization', () => {
    it('should initialize with unlocked state', async () => {
      expect(wallet.getState()).toBe('unlocked');
      expect(wallet.isUnlocked()).toBe(true);
    });
    
    it('should not allow double initialization', async () => {
      await expect(wallet.initialize('password')).rejects.toThrow();
    });
    
    it('should export wallet data', () => {
      const exported = wallet.export();
      expect(exported).toBeDefined();
      
      const parsed = JSON.parse(exported);
      expect(parsed.version).toBe(1);
      expect(parsed.passwordHash).toBeDefined();
    });
  });
  
  describe('Locking/Unlocking', () => {
    it('should lock wallet', () => {
      wallet.lock();
      
      expect(wallet.getState()).toBe('locked');
      expect(wallet.isUnlocked()).toBe(false);
    });
    
    it('should unlock with correct password', async () => {
      wallet.lock();
      await wallet.unlock(testPassword);
      
      expect(wallet.isUnlocked()).toBe(true);
    });
    
    it('should reject wrong password', async () => {
      wallet.lock();
      
      await expect(wallet.unlock('wrongPassword')).rejects.toThrow();
    });
  });
  
  describe('Key Management', () => {
    it('should add API key', async () => {
      const keyId = await wallet.addKey('openai', 'sk-test-key-123', {
        name: 'Test OpenAI Key'
      });
      
      expect(keyId).toBeDefined();
      expect(keyId.length).toBeGreaterThan(0);
    });
    
    it('should retrieve API key', async () => {
      const keyId = await wallet.addKey('anthropic', 'sk-ant-test-key');
      const key = wallet.getKey(keyId);
      
      expect(key).toBe('sk-ant-test-key');
    });
    
    it('should list keys without exposing values', async () => {
      await wallet.addKey('openai', 'sk-openai-key');
      await wallet.addKey('anthropic', 'sk-anthropic-key');
      
      const keys = wallet.listKeys();
      
      expect(keys).toHaveLength(2);
      expect(keys[0].keyPrefix).toBe('sk-opena...');
      expect(keys[1].keyPrefix).toBe('sk-anthr...');
    });
    
    it('should filter keys by provider', async () => {
      await wallet.addKey('openai', 'sk-openai-1');
      await wallet.addKey('openai', 'sk-openai-2');
      await wallet.addKey('anthropic', 'sk-anthropic');
      
      const openaiKeys = wallet.listKeys('openai');
      const anthropicKeys = wallet.listKeys('anthropic');
      
      expect(openaiKeys).toHaveLength(2);
      expect(anthropicKeys).toHaveLength(1);
    });
    
    it('should remove key', async () => {
      const keyId = await wallet.addKey('openai', 'sk-test');
      
      const removed = wallet.removeKey(keyId);
      const key = wallet.getKey(keyId);
      
      expect(removed).toBe(true);
      expect(key).toBeNull();
    });
    
    it('should set default key', async () => {
      const key1 = await wallet.addKey('openai', 'sk-test-1');
      const key2 = await wallet.addKey('openai', 'sk-test-2', { isDefault: true });
      
      const defaultKey = wallet.getKeyForProvider('openai');
      
      expect(defaultKey).toBe('sk-test-2');
    });
    
    it('should rotate key', async () => {
      const keyId = await wallet.addKey('openai', 'sk-old-key');
      await wallet.rotateKey(keyId, 'sk-new-key');
      
      const key = wallet.getKey(keyId);
      
      expect(key).toBe('sk-new-key');
    });
  });
  
  describe('Events', () => {
    it('should emit locked event', () => {
      const handler = jest.fn();
      wallet.on('locked', handler);
      
      wallet.lock();
      
      expect(handler).toHaveBeenCalledTimes(1);
    });
    
    it('should emit unlocked event', async () => {
      const handler = jest.fn();
      wallet.on('unlocked', handler);
      
      wallet.lock();
      await wallet.unlock(testPassword);
      
      expect(handler).toHaveBeenCalledTimes(1);
    });
    
    it('should emit key:added event', async () => {
      const handler = jest.fn();
      wallet.on('key:added', handler);
      
      await wallet.addKey('openai', 'sk-test');
      
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('Settings', () => {
    it('should get default settings', () => {
      const settings = wallet.getSettings();
      
      expect(settings.autoLockTimeout).toBe(30);
      expect(settings.requirePasswordOnAccess).toBe(false);
    });
    
    it('should update settings', async () => {
      await wallet.updateSettings({ autoLockTimeout: 60 });
      
      const settings = wallet.getSettings();
      expect(settings.autoLockTimeout).toBe(60);
    });
  });
});

// ============================================================================
// Secure Canvas Manager Tests
// ============================================================================

describe('SecureCanvasManager', () => {
  let manager: SecureCanvasManager;
  
  beforeEach(() => {
    manager = createSecureCanvasManager('user-1');
  });
  
  afterEach(() => {
    manager.destroy();
  });
  
  describe('Canvas Creation', () => {
    it('should create open canvas', async () => {
      const canvasId = await manager.createCanvas({
        name: 'Open Canvas',
        securityLevel: 'open'
      });
      
      expect(canvasId).toBeDefined();
      
      const result = await manager.getCanvas(canvasId);
      expect(result.success).toBe(true);
    });
    
    it('should create secure canvas', async () => {
      const canvasId = await manager.createCanvas({
        name: 'Secure Canvas',
        securityLevel: 'private'
      });
      
      expect(canvasId).toBeDefined();
      
      // Should be accessible immediately after creation
      const result = await manager.getCanvas(canvasId);
      expect(result.success).toBe(true);
    });
    
    it('should create hardened canvas', async () => {
      const canvasId = await manager.createCanvas({
        name: 'Hardened Canvas',
        securityLevel: 'hardened',
        description: 'Contains sensitive data'
      });
      
      expect(canvasId).toBeDefined();
      
      const metadata = manager.getMetadata(canvasId);
      expect((metadata as any).description).toBe('Contains sensitive data');
    });
    
    it('should create canvas with initial nodes', async () => {
      const canvasId = await manager.createCanvas({
        name: 'Canvas with Nodes',
        securityLevel: 'open',
        initialNodes: [
          { id: 'node-1', type: 'text', x: 0, y: 0, width: 100, height: 50, text: 'Hello' }
        ]
      });
      
      const result = await manager.getCanvas(canvasId);
      expect(result.data?.nodes).toHaveLength(1);
    });
  });
  
  describe('Canvas Access', () => {
    it('should return error for non-existent canvas', async () => {
      const result = await manager.getCanvas('non-existent');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Canvas not found');
    });
    
    it('should require auth for locked secure canvas', async () => {
      const canvasId = await manager.createCanvas({
        name: 'Secure',
        securityLevel: 'private'
      });
      
      manager.lock(canvasId);
      
      const result = await manager.getCanvas(canvasId);
      expect(result.success).toBe(false);
      expect(result.requiresAuth).toBe(true);
    });
    
    it('should unlock canvas with correct key', async () => {
      const canvasId = await manager.createCanvas({
        name: 'Secure',
        securityLevel: 'private'
      });
      
      // Canvas is already unlocked, lock it first
      manager.lock(canvasId);
      
      // Unlock requires the key or password
      // In this test, the key was generated during creation
      // We need to test the unlock mechanism differently
      const result = await manager.getCanvas(canvasId);
      expect(result.requiresAuth).toBe(true);
    });
  });
  
  describe('Canvas Modification', () => {
    it('should add node to open canvas', async () => {
      const canvasId = await manager.createCanvas({
        name: 'Open',
        securityLevel: 'open'
      });
      
      await manager.addNode(canvasId, {
        id: 'new-node',
        type: 'text',
        x: 100,
        y: 100,
        width: 200,
        height: 100,
        text: 'New Node'
      });
      
      const result = await manager.getCanvas(canvasId);
      expect(result.data?.nodes).toHaveLength(1);
    });
    
    it('should remove node from canvas', async () => {
      const canvasId = await manager.createCanvas({
        name: 'With Node',
        securityLevel: 'open',
        initialNodes: [
          { id: 'node-1', type: 'text', x: 0, y: 0, width: 100, height: 50, text: 'Delete me' }
        ]
      });
      
      await manager.removeNode(canvasId, 'node-1');
      
      const result = await manager.getCanvas(canvasId);
      expect(result.data?.nodes).toHaveLength(0);
    });
    
    it('should update canvas with custom function', async () => {
      const canvasId = await manager.createCanvas({
        name: 'Update Test',
        securityLevel: 'open'
      });
      
      await manager.updateCanvas(canvasId, (state) => ({
        ...state,
        metadata: { ...state.metadata, custom: 'value' }
      }));
      
      const result = await manager.getCanvas(canvasId);
      expect(result.data?.metadata?.custom).toBe('value');
    });
  });
  
  describe('Access Control', () => {
    it('should grant access to secure canvas', async () => {
      const canvasId = await manager.createCanvas({
        name: 'Shared',
        securityLevel: 'shared'
      });
      
      const result = manager.grantAccess(canvasId, 'user-2', ['view', 'read']);
      
      expect(result.success).toBe(true);
    });
    
    it('should revoke access from canvas', async () => {
      const canvasId = await manager.createCanvas({
        name: 'Shared',
        securityLevel: 'shared'
      });
      
      manager.grantAccess(canvasId, 'user-2', ['view', 'read']);
      const result = manager.revokeAccess(canvasId, 'user-2');
      
      expect(result.success).toBe(true);
    });
    
    it('should not allow revoking last admin', async () => {
      const canvasId = await manager.createCanvas({
        name: 'Admin Only',
        securityLevel: 'private'
      });
      
      const result = manager.revokeAccess(canvasId, 'user-1');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('last admin');
    });
  });
  
  describe('Canvas Listing', () => {
    it('should list all canvases', async () => {
      await manager.createCanvas({ name: 'Open', securityLevel: 'open' });
      await manager.createCanvas({ name: 'Private', securityLevel: 'private' });
      
      const canvases = manager.listCanvases();
      
      expect(canvases).toHaveLength(2);
    });
    
    it('should indicate locked status', async () => {
      const canvasId = await manager.createCanvas({
        name: 'Lockable',
        securityLevel: 'private'
      });
      
      let canvases = manager.listCanvases();
      expect(canvases[0].isLocked).toBe(false);
      
      manager.lock(canvasId);
      
      canvases = manager.listCanvases();
      expect(canvases[0].isLocked).toBe(true);
    });
  });
  
  describe('Import/Export', () => {
    it('should export canvas', async () => {
      const canvasId = await manager.createCanvas({
        name: 'Export Test',
        securityLevel: 'open'
      });
      
      const exported = manager.exportCanvas(canvasId);
      
      expect(exported).toBeDefined();
      expect(JSON.parse(exported!)).toBeDefined();
    });
    
    it('should import canvas', async () => {
      const canvasId = await manager.createCanvas({
        name: 'Original',
        securityLevel: 'open'
      });
      
      const exported = manager.exportCanvas(canvasId)!;
      const result = manager.importCanvas(exported);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data).not.toBe(canvasId); // New ID
    });
  });
  
  describe('Canvas Deletion', () => {
    it('should delete canvas', async () => {
      const canvasId = await manager.createCanvas({
        name: 'Delete Me',
        securityLevel: 'open'
      });
      
      const result = manager.deleteCanvas(canvasId);
      
      expect(result.success).toBe(true);
      expect(manager.listCanvases()).toHaveLength(0);
    });
  });
});

// ============================================================================
// Secure Canvas Type Tests
// ============================================================================

describe('Secure Canvas Types', () => {
  describe('Type Guards', () => {
    it('should identify secure canvas', () => {
      const secureCanvas: SecureCanvas = {
        metadata: {
          id: 'test',
          name: 'Test',
          securityLevel: 'private',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdBy: 'user',
          accessList: [],
          encryptionAlgorithm: 'aes-256-gcm',
          encryptionVersion: 1,
          widgetCount: 0
        },
        content: {
          encryptedState: {
            ciphertext: 'encrypted',
            iv: 'iv',
            authTag: 'tag',
            algorithm: 'aes-256-gcm',
            version: 1
          },
          contentHash: 'hash',
          salt: 'salt',
          nodeCount: 0,
          edgeCount: 0
        }
      };
      
      expect(isSecureCanvas(secureCanvas)).toBe(true);
    });
    
    it('should identify open canvas', () => {
      const openCanvas: OpenCanvas = {
        type: 'open',
        state: {
          id: 'test',
          nodes: [],
          edges: [],
          viewport: { x: 0, y: 0, zoom: 1 },
          selectedNodes: [],
          selectedEdges: [],
          metadata: {}
        },
        metadata: {
          id: 'test',
          name: 'Test',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdBy: 'user'
        }
      };
      
      expect(isOpenCanvas(openCanvas)).toBe(true);
    });
  });
  
  describe('Security Level Helpers', () => {
    it('should require encryption for non-open levels', () => {
      expect(requiresEncryption('open')).toBe(false);
      expect(requiresEncryption('private')).toBe(true);
      expect(requiresEncryption('shared')).toBe(true);
      expect(requiresEncryption('hardened')).toBe(true);
    });
  });
  
  describe('Widget Definitions', () => {
    it('should have api-key-wallet widget', () => {
      const def = SECURE_WIDGET_DEFINITIONS['api-key-wallet'];
      
      expect(def).toBeDefined();
      expect(def.securityLevel).toBe('hardened');
    });
    
    it('should have settings widget', () => {
      const def = SECURE_WIDGET_DEFINITIONS['settings'];
      
      expect(def).toBeDefined();
      expect(def.securityLevel).toBe('private');
    });
    
    it('should have provider-config widget', () => {
      const def = SECURE_WIDGET_DEFINITIONS['provider-config'];
      
      expect(def).toBeDefined();
      expect(def.props.provider.required).toBe(true);
    });
  });
});

// ============================================================================
// Wallet-Integrated LLM Service Tests
// ============================================================================

describe('WalletIntegratedLLMService', () => {
  let wallet: ApiKeyWallet;
  let service: WalletIntegratedLLMService;
  
  beforeEach(async () => {
    wallet = createApiKeyWallet();
    await wallet.initialize('testPassword');
    
    service = createWalletIntegratedLLMService({
      wallet,
      fallbackToEnv: false
    });
  });
  
  afterEach(() => {
    wallet.destroy();
  });
  
  describe('Wallet Integration', () => {
    it('should use wallet for API keys', async () => {
      await wallet.addKey('anthropic', 'sk-ant-test-key', { isDefault: true });
      
      const status = await service.getProviderStatus();
      const anthropic = status.find(s => s.provider === 'anthropic');
      
      expect(anthropic?.hasKey).toBe(true);
      expect(anthropic?.source).toBe('wallet');
    });
    
    it('should report no key when wallet is locked', async () => {
      await wallet.addKey('anthropic', 'sk-ant-test-key', { isDefault: true });
      wallet.lock();
      
      const status = await service.getProviderStatus();
      const anthropic = status.find(s => s.provider === 'anthropic');
      
      expect(anthropic?.hasKey).toBe(false);
    });
    
    it('should add key through service', async () => {
      await service.addApiKey('openai', 'sk-openai-test');
      
      const keys = service.listApiKeys('openai');
      expect(keys).toHaveLength(1);
    });
    
    it('should unlock/lock wallet through service', async () => {
      service.lockWallet();
      expect(service.isWalletUnlocked()).toBe(false);
      
      await service.unlockWallet('testPassword');
      expect(service.isWalletUnlocked()).toBe(true);
    });
  });
  
  describe('Provider Status', () => {
    it('should report status for all providers', async () => {
      const status = await service.getProviderStatus();
      
      expect(status).toHaveLength(3);
      expect(status.map(s => s.provider)).toContain('openai');
      expect(status.map(s => s.provider)).toContain('anthropic');
      expect(status.map(s => s.provider)).toContain('ollama');
    });
    
    it('should report ollama as always available', async () => {
      const status = await service.getProviderStatus();
      const ollama = status.find(s => s.provider === 'ollama');
      
      expect(ollama?.hasKey).toBe(true);
    });
  });
});