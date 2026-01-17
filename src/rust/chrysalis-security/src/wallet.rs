//! API Key Wallet - Clean Rust implementation
//!
//! Replaces TypeScript src/security/ApiKeyWallet.ts with proper security.

use std::collections::HashMap;
use std::time::{Duration, Instant};
use base64ct::Encoding;
use zeroize::{Zeroize, ZeroizeOnDrop};
use super::crypto::*;

const CACHE_TTL_SECS: u64 = 300;
const DEFAULT_AUTO_LOCK_MINS: u64 = 30;

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ApiKeyProvider {
    Openai,
    Anthropic,
    Ollama,
    Huggingface,
    Google,
    Azure,
    Cohere,
    Replicate,
    Custom,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ApiKeyEntry {
    pub id: String,
    pub provider: ApiKeyProvider,
    pub name: String,
    pub key_prefix: String,
    pub created_at: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_used_at: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<u64>,
    pub is_default: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct EncryptedKeyEntry {
    entry: ApiKeyEntry,
    encrypted_key: EncryptedData,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct WalletStorage {
    version: u8,
    created_at: u64,
    updated_at: u64,
    password_hash: String,
    entries: Vec<EncryptedKeyEntry>,
    settings: EncryptedData,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct WalletSettings {
    pub auto_lock_timeout: u64,
    pub require_password_on_access: bool,
    pub default_providers: HashMap<String, String>,
}

impl Default for WalletSettings {
    fn default() -> Self {
        Self {
            auto_lock_timeout: DEFAULT_AUTO_LOCK_MINS,
            require_password_on_access: false,
            default_providers: HashMap::new(),
        }
    }
}

#[derive(Zeroize, ZeroizeOnDrop)]
struct CachedKey {
    #[zeroize(skip)]
    key: String,
    #[zeroize(skip)]
    expires_at: Instant,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WalletState {
    Locked,
    Unlocked,
    Uninitialized,
}

pub struct ApiKeyWallet {
    storage: Option<WalletStorage>,
    master_key: Option<SecureKey>,
    key_cache: HashMap<String, CachedKey>,
    state: WalletState,
    settings: WalletSettings,
    last_access: Option<Instant>,
}

impl ApiKeyWallet {
    pub fn new() -> Self {
        Self {
            storage: None,
            master_key: None,
            key_cache: HashMap::new(),
            state: WalletState::Uninitialized,
            settings: WalletSettings::default(),
            last_access: None,
        }
    }

    pub fn initialize(&mut self, password: &str) -> Result<(), WalletError> {
        if self.state != WalletState::Uninitialized {
            return Err(WalletError::AlreadyInitialized);
        }

        let password_hash = hash_sha256(password);
        let settings_json = serde_json::to_vec(&self.settings)
            .map_err(|e| WalletError::SerializationError(e.to_string()))?;
        let encrypted_settings = encrypt_with_password(&settings_json, password)?;

        // Derive master key from password using the same salt as settings encryption
        // This ensures unlock() can derive the same key
        let salt_bytes = base64ct::Base64::decode_vec(
            encrypted_settings.salt.as_ref().ok_or(WalletError::CryptoError(CryptoError::MissingSalt))?
        ).map_err(|_| WalletError::CryptoError(CryptoError::InvalidEncoding))?;
        let master_key = derive_key_from_password(password, &salt_bytes)?;

        self.storage = Some(WalletStorage {
            version: 1,
            created_at: Self::now(),
            updated_at: Self::now(),
            password_hash,
            entries: Vec::new(),
            settings: encrypted_settings,
        });

        self.master_key = Some(master_key);
        self.state = WalletState::Unlocked;
        self.last_access = Some(Instant::now());

        Ok(())
    }

    pub fn unlock(&mut self, password: &str) -> Result<(), WalletError> {
        let storage = self.storage.as_ref().ok_or(WalletError::Uninitialized)?;
        let password_hash = hash_sha256(password);

        if password_hash != storage.password_hash {
            return Err(WalletError::InvalidPassword);
        }

        let settings_json = decrypt_with_password(&storage.settings, password)?;
        self.settings = serde_json::from_slice(&settings_json)
            .map_err(|e| WalletError::SerializationError(e.to_string()))?;

        // Derive the master key from password deterministically
        // This ensures the same key is derived on each unlock
        let salt = storage.settings.salt.as_ref()
            .ok_or(WalletError::CryptoError(CryptoError::MissingSalt))?;
        let salt_bytes = base64ct::Base64::decode_vec(salt)
            .map_err(|_| WalletError::CryptoError(CryptoError::InvalidEncoding))?;
        let master_key = derive_key_from_password(password, &salt_bytes)?;

        self.master_key = Some(master_key);
        self.state = WalletState::Unlocked;
        self.last_access = Some(Instant::now());

        Ok(())
    }

    pub fn lock(&mut self) {
        // Explicitly zeroize the inner key before dropping
        if let Some(ref mut key) = self.master_key {
            key.zeroize();
        }
        self.master_key = None;
        self.key_cache.clear();
        self.state = WalletState::Locked;
    }

    pub fn add_key(&mut self, provider: ApiKeyProvider, name: String, key: String) -> Result<String, WalletError> {
        self.check_unlocked()?;
        let master_key = self.master_key.as_ref().ok_or(WalletError::Locked)?;
        let storage = self.storage.as_mut().ok_or(WalletError::Uninitialized)?;

        let id = uuid::Uuid::new_v4().to_string();
        let key_prefix = key.chars().take(8).collect();
        let encrypted_key = encrypt(key.as_bytes(), master_key)?;

        let entry = ApiKeyEntry {
            id: id.clone(),
            provider,
            name,
            key_prefix,
            created_at: Self::now(),
            last_used_at: None,
            expires_at: None,
            is_default: storage.entries.is_empty(),
            metadata: None,
        };

        storage.entries.push(EncryptedKeyEntry { entry, encrypted_key });
        storage.updated_at = Self::now();

        Ok(id)
    }

    pub fn get_key(&mut self, id: &str) -> Result<String, WalletError> {
        self.check_unlocked()?;
        self.check_auto_lock();

        if let Some(cached) = self.key_cache.get(id) {
            if cached.expires_at > Instant::now() {
                self.last_access = Some(Instant::now());
                return Ok(cached.key.clone());
            }
        }

        let master_key = self.master_key.as_ref().ok_or(WalletError::Locked)?;
        let storage = self.storage.as_mut().ok_or(WalletError::Uninitialized)?;

        let entry = storage.entries.iter_mut()
            .find(|e| e.entry.id == id)
            .ok_or_else(|| WalletError::KeyNotFound(id.to_string()))?;

        let key_bytes = decrypt(&entry.encrypted_key, master_key)?;
        let key = String::from_utf8(key_bytes).map_err(|_| WalletError::InvalidKeyData)?;

        entry.entry.last_used_at = Some(Self::now());

        self.key_cache.insert(id.to_string(), CachedKey {
            key: key.clone(),
            expires_at: Instant::now() + Duration::from_secs(CACHE_TTL_SECS),
        });

        self.last_access = Some(Instant::now());
        Ok(key)
    }

    pub fn state(&self) -> WalletState {
        self.state
    }

    fn check_unlocked(&self) -> Result<(), WalletError> {
        match self.state {
            WalletState::Unlocked => Ok(()),
            WalletState::Locked => Err(WalletError::Locked),
            WalletState::Uninitialized => Err(WalletError::Uninitialized),
        }
    }

    fn check_auto_lock(&mut self) {
        if let Some(last_access) = self.last_access {
            let elapsed = Instant::now() - last_access;
            let timeout = Duration::from_secs(self.settings.auto_lock_timeout * 60);
            if elapsed > timeout {
                self.lock();
            }
        }
    }

    fn now() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
    }
}

impl Default for ApiKeyWallet {
    fn default() -> Self {
        Self::new()
    }
}

impl Drop for ApiKeyWallet {
    fn drop(&mut self) {
        self.key_cache.clear();
        if let Some(mut key) = self.master_key.take() {
            key.zeroize();
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum WalletError {
    #[error("Wallet is locked")]
    Locked,
    #[error("Wallet is uninitialized")]
    Uninitialized,
    #[error("Wallet is already initialized")]
    AlreadyInitialized,
    #[error("Invalid password")]
    InvalidPassword,
    #[error("Key not found: {0}")]
    KeyNotFound(String),
    #[error("Invalid key data")]
    InvalidKeyData,
    #[error("Serialization error: {0}")]
    SerializationError(String),
    #[error("Crypto error: {0}")]
    CryptoError(#[from] CryptoError),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_wallet() {
        let wallet = ApiKeyWallet::new();
        assert_eq!(wallet.state(), WalletState::Uninitialized);
    }

    #[test]
    fn test_initialize_and_unlock() {
        let mut wallet = ApiKeyWallet::new();
        wallet.initialize("password").unwrap();
        assert_eq!(wallet.state(), WalletState::Unlocked);

        wallet.lock();
        assert_eq!(wallet.state(), WalletState::Locked);

        wallet.unlock("password").unwrap();
        assert_eq!(wallet.state(), WalletState::Unlocked);
    }

    #[test]
    fn test_add_and_get_key() {
        let mut wallet = ApiKeyWallet::new();
        wallet.initialize("password").unwrap();

        let id = wallet.add_key(
            ApiKeyProvider::Openai,
            "Test Key".to_string(),
            "sk-test123".to_string(),
        ).unwrap();

        let key = wallet.get_key(&id).unwrap();
        assert_eq!(key, "sk-test123");
    }

    #[test]
    fn test_wrong_password() {
        let mut wallet = ApiKeyWallet::new();
        wallet.initialize("correct").unwrap();
        wallet.lock();
        let result = wallet.unlock("wrong");
        assert!(result.is_err());
    }
}
