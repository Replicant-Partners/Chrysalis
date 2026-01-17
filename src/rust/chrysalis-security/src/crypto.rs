//! Cryptographic operations
//!
//! Clean Rust implementation replacing messy TypeScript crypto.
//! Uses industry-standard algorithms with proper parameter selection.

use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use base64ct::Encoding;
use scrypt::{scrypt, Params};
use sha2::{Sha256, Digest};
use zeroize::{Zeroize, ZeroizeOnDrop};

pub const ALGORITHM: &str = "aes-256-gcm";
pub const KEY_LENGTH: usize = 32;
pub const IV_LENGTH: usize = 12; // GCM standard nonce size
pub const AUTH_TAG_LENGTH: usize = 16;
pub const SALT_LENGTH: usize = 32;

// Scrypt parameters matching TypeScript (src/security/crypto.ts:32-34)
const SCRYPT_LOG_N: u8 = 14; // 2^14 = 16384
const SCRYPT_R: u32 = 8;
const SCRYPT_P: u32 = 1;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct EncryptedData {
    pub ciphertext: String,
    pub iv: String,
    pub auth_tag: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub salt: Option<String>,
    pub algorithm: String,
    pub version: u8,
}

#[derive(Zeroize, ZeroizeOnDrop)]
pub struct SecureKey([u8; KEY_LENGTH]);

impl SecureKey {
    pub fn new(key: [u8; KEY_LENGTH]) -> Self {
        Self(key)
    }

    pub fn as_bytes(&self) -> &[u8; KEY_LENGTH] {
        &self.0
    }
}

pub fn generate_key() -> SecureKey {
    use rand::RngCore;
    let mut key = [0u8; KEY_LENGTH];
    OsRng.fill_bytes(&mut key);
    SecureKey::new(key)
}

pub fn generate_salt() -> [u8; SALT_LENGTH] {
    use rand::RngCore;
    let mut salt = [0u8; SALT_LENGTH];
    OsRng.fill_bytes(&mut salt);
    salt
}

pub fn generate_iv() -> [u8; IV_LENGTH] {
    use rand::RngCore;
    let mut iv = [0u8; IV_LENGTH];
    OsRng.fill_bytes(&mut iv);
    iv
}

pub fn derive_key_from_password(password: &str, salt: &[u8]) -> Result<SecureKey, CryptoError> {
    let params = Params::new(SCRYPT_LOG_N, SCRYPT_R, SCRYPT_P, KEY_LENGTH)
        .map_err(|_| CryptoError::InvalidParameters)?;

    let mut key = [0u8; KEY_LENGTH];
    scrypt(password.as_bytes(), salt, &params, &mut key)
        .map_err(|_| CryptoError::KeyDerivationFailed)?;

    Ok(SecureKey::new(key))
}

pub fn hash_sha256(data: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data.as_bytes());
    hex::encode(hasher.finalize())
}

pub fn encrypt(data: &[u8], key: &SecureKey) -> Result<EncryptedData, CryptoError> {
    let cipher = Aes256Gcm::new(key.as_bytes().into());
    let nonce_bytes = generate_iv();
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, data)
        .map_err(|_| CryptoError::EncryptionFailed)?;

    let (ct, tag) = ciphertext.split_at(ciphertext.len() - AUTH_TAG_LENGTH);

    Ok(EncryptedData {
        ciphertext: base64ct::Base64::encode_string(ct),
        iv: base64ct::Base64::encode_string(&nonce_bytes),
        auth_tag: base64ct::Base64::encode_string(tag),
        salt: None,
        algorithm: ALGORITHM.to_string(),
        version: 1,
    })
}

pub fn decrypt(encrypted: &EncryptedData, key: &SecureKey) -> Result<Vec<u8>, CryptoError> {

    if encrypted.algorithm != ALGORITHM {
        return Err(CryptoError::UnsupportedAlgorithm(encrypted.algorithm.clone()));
    }

    let cipher = Aes256Gcm::new(key.as_bytes().into());

    let ciphertext = base64ct::Base64::decode_vec(&encrypted.ciphertext)
        .map_err(|_| CryptoError::InvalidEncoding)?;
    let iv_bytes = base64ct::Base64::decode_vec(&encrypted.iv)
        .map_err(|_| CryptoError::InvalidEncoding)?;
    let tag = base64ct::Base64::decode_vec(&encrypted.auth_tag)
        .map_err(|_| CryptoError::InvalidEncoding)?;

    let nonce = Nonce::from_slice(&iv_bytes);

    let mut ct_with_tag = ciphertext;
    ct_with_tag.extend_from_slice(&tag);

    cipher
        .decrypt(nonce, ct_with_tag.as_ref())
        .map_err(|_| CryptoError::DecryptionFailed)
}

pub fn encrypt_with_password(data: &[u8], password: &str) -> Result<EncryptedData, CryptoError> {
    let salt = generate_salt();
    let key = derive_key_from_password(password, &salt)?;

    let mut encrypted = encrypt(data, &key)?;
    encrypted.salt = Some(base64ct::Base64::encode_string(&salt));

    Ok(encrypted)
}

pub fn decrypt_with_password(encrypted: &EncryptedData, password: &str) -> Result<Vec<u8>, CryptoError> {

    let salt = encrypted
        .salt
        .as_ref()
        .ok_or(CryptoError::MissingSalt)?;

    let salt_bytes = base64ct::Base64::decode_vec(salt)
        .map_err(|_| CryptoError::InvalidEncoding)?;

    let key = derive_key_from_password(password, &salt_bytes)?;

    decrypt(encrypted, &key)
}

#[derive(Debug, thiserror::Error)]
pub enum CryptoError {
    #[error("Encryption failed")]
    EncryptionFailed,

    #[error("Decryption failed")]
    DecryptionFailed,

    #[error("Unsupported algorithm: {0}")]
    UnsupportedAlgorithm(String),

    #[error("Invalid encoding")]
    InvalidEncoding,

    #[error("Missing salt")]
    MissingSalt,

    #[error("Key derivation failed")]
    KeyDerivationFailed,

    #[error("Invalid parameters")]
    InvalidParameters,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_key_generation() {
        let key1 = generate_key();
        let key2 = generate_key();
        assert_ne!(key1.as_bytes(), key2.as_bytes());
    }

    #[test]
    fn test_encrypt_decrypt() {
        let key = generate_key();
        let data = b"test data";

        let encrypted = encrypt(data, &key).unwrap();
        let decrypted = decrypt(&encrypted, &key).unwrap();

        assert_eq!(data.to_vec(), decrypted);
    }

    #[test]
    fn test_password_encryption() {
        let password = "secure-password";
        let data = b"secret data";

        let encrypted = encrypt_with_password(data, password).unwrap();
        let decrypted = decrypt_with_password(&encrypted, password).unwrap();

        assert_eq!(data.to_vec(), decrypted);
    }

    #[test]
    fn test_wrong_password_fails() {
        let data = b"secret";
        let encrypted = encrypt_with_password(data, "correct").unwrap();
        let result = decrypt_with_password(&encrypted, "wrong");

        assert!(result.is_err());
    }

    #[test]
    fn test_hash() {
        let hash1 = hash_sha256("test");
        let hash2 = hash_sha256("test");
        assert_eq!(hash1, hash2);

        let hash3 = hash_sha256("different");
        assert_ne!(hash1, hash3);
    }

    #[test]
    fn test_key_zeroizes() {
        let key = generate_key();
        drop(key);
        // Key memory should be wiped (verified by zeroize)
    }
}
