//! Chrysalis Cryptographic Operations
//!
//! High-performance cryptographic primitives compiled to WASM for use in
//! the Chrysalis distributed agent framework.

use wasm_bindgen::prelude::*;
use sha2::{Sha256, Sha384, Sha512, Digest};
use sha3::{Sha3_256, Sha3_384, Sha3_512};
use ed25519_dalek::{SigningKey, VerifyingKey, Signature, Signer, Verifier};
use rand::rngs::OsRng;

// ============================================================================
// Error Handling
// ============================================================================

#[derive(Debug, thiserror::Error)]
pub enum CryptoError {
    #[error("Invalid key length: expected {expected}, got {actual}")]
    InvalidKeyLength { expected: usize, actual: usize },

    #[error("Invalid signature format")]
    InvalidSignature,

    #[error("Signature verification failed")]
    VerificationFailed,

    #[error("Invalid hex encoding: {0}")]
    HexError(#[from] hex::FromHexError),

    #[error("Serialization error: {0}")]
    SerializationError(String),
}

impl From<CryptoError> for JsValue {
    fn from(err: CryptoError) -> Self {
        JsValue::from_str(&err.to_string())
    }
}

// ============================================================================
// Hashing Operations
// ============================================================================

/// Hash algorithm selection
#[wasm_bindgen]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum HashAlgorithm {
    Sha256,
    Sha384,
    Sha512,
    Sha3_256,
    Sha3_384,
    Sha3_512,
    Blake3,
}

/// Compute hash of data using specified algorithm
#[wasm_bindgen]
pub fn hash(data: &[u8], algorithm: HashAlgorithm) -> Vec<u8> {
    match algorithm {
        HashAlgorithm::Sha256 => Sha256::digest(data).to_vec(),
        HashAlgorithm::Sha384 => Sha384::digest(data).to_vec(),
        HashAlgorithm::Sha512 => Sha512::digest(data).to_vec(),
        HashAlgorithm::Sha3_256 => Sha3_256::digest(data).to_vec(),
        HashAlgorithm::Sha3_384 => Sha3_384::digest(data).to_vec(),
        HashAlgorithm::Sha3_512 => Sha3_512::digest(data).to_vec(),
        HashAlgorithm::Blake3 => blake3::hash(data).as_bytes().to_vec(),
    }
}

/// Compute hash and return as hex string
#[wasm_bindgen]
pub fn hash_hex(data: &[u8], algorithm: HashAlgorithm) -> String {
    hex::encode(hash(data, algorithm))
}

/// Compute SHA-384 hash (primary algorithm for agent fingerprints)
#[wasm_bindgen]
pub fn sha384(data: &[u8]) -> Vec<u8> {
    Sha384::digest(data).to_vec()
}

/// Compute SHA-384 hash as hex string
#[wasm_bindgen]
pub fn sha384_hex(data: &[u8]) -> String {
    hex::encode(sha384(data))
}

/// Compute BLAKE3 hash (fast, parallel-friendly)
#[wasm_bindgen]
pub fn blake3_hash(data: &[u8]) -> Vec<u8> {
    blake3::hash(data).as_bytes().to_vec()
}

/// Compute BLAKE3 hash as hex string
#[wasm_bindgen]
pub fn blake3_hex(data: &[u8]) -> String {
    hex::encode(blake3_hash(data))
}

/// Incremental hasher for streaming data
#[wasm_bindgen]
pub struct IncrementalHasher {
    state: HasherState,
}

enum HasherState {
    Sha256(Sha256),
    Sha384(Sha384),
    Sha512(Sha512),
    Sha3_256(Sha3_256),
    Sha3_384(Sha3_384),
    Sha3_512(Sha3_512),
    Blake3(blake3::Hasher),
}

#[wasm_bindgen]
impl IncrementalHasher {
    #[wasm_bindgen(constructor)]
    pub fn new(algorithm: HashAlgorithm) -> Self {
        let state = match algorithm {
            HashAlgorithm::Sha256 => HasherState::Sha256(Sha256::new()),
            HashAlgorithm::Sha384 => HasherState::Sha384(Sha384::new()),
            HashAlgorithm::Sha512 => HasherState::Sha512(Sha512::new()),
            HashAlgorithm::Sha3_256 => HasherState::Sha3_256(Sha3_256::new()),
            HashAlgorithm::Sha3_384 => HasherState::Sha3_384(Sha3_384::new()),
            HashAlgorithm::Sha3_512 => HasherState::Sha3_512(Sha3_512::new()),
            HashAlgorithm::Blake3 => HasherState::Blake3(blake3::Hasher::new()),
        };
        Self { state }
    }

    /// Update hasher with additional data
    pub fn update(&mut self, data: &[u8]) {
        match &mut self.state {
            HasherState::Sha256(h) => h.update(data),
            HasherState::Sha384(h) => h.update(data),
            HasherState::Sha512(h) => h.update(data),
            HasherState::Sha3_256(h) => h.update(data),
            HasherState::Sha3_384(h) => h.update(data),
            HasherState::Sha3_512(h) => h.update(data),
            HasherState::Blake3(h) => { h.update(data); },
        }
    }

    /// Finalize and return hash
    pub fn finalize(self) -> Vec<u8> {
        match self.state {
            HasherState::Sha256(h) => h.finalize().to_vec(),
            HasherState::Sha384(h) => h.finalize().to_vec(),
            HasherState::Sha512(h) => h.finalize().to_vec(),
            HasherState::Sha3_256(h) => h.finalize().to_vec(),
            HasherState::Sha3_384(h) => h.finalize().to_vec(),
            HasherState::Sha3_512(h) => h.finalize().to_vec(),
            HasherState::Blake3(h) => h.finalize().as_bytes().to_vec(),
        }
    }

    /// Finalize and return hash as hex string
    pub fn finalize_hex(self) -> String {
        hex::encode(self.finalize())
    }
}

// ============================================================================
// Digital Signatures (Ed25519)
// ============================================================================

/// Ed25519 key pair for signing operations
#[wasm_bindgen]
pub struct Ed25519KeyPair {
    signing_key: SigningKey,
}

#[wasm_bindgen]
impl Ed25519KeyPair {
    /// Generate a new random key pair
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        let signing_key = SigningKey::generate(&mut OsRng);
        Self { signing_key }
    }

    /// Create key pair from secret key bytes (32 bytes)
    pub fn from_secret(secret: &[u8]) -> Result<Ed25519KeyPair, JsValue> {
        if secret.len() != 32 {
            return Err(CryptoError::InvalidKeyLength {
                expected: 32,
                actual: secret.len(),
            }.into());
        }
        let bytes: [u8; 32] = secret.try_into().unwrap();
        let signing_key = SigningKey::from_bytes(&bytes);
        Ok(Self { signing_key })
    }

    /// Get the secret key bytes
    pub fn secret_key(&self) -> Vec<u8> {
        self.signing_key.to_bytes().to_vec()
    }

    /// Get the public key bytes
    pub fn public_key(&self) -> Vec<u8> {
        self.signing_key.verifying_key().to_bytes().to_vec()
    }

    /// Get the public key as hex string
    pub fn public_key_hex(&self) -> String {
        hex::encode(self.public_key())
    }

    /// Sign a message
    pub fn sign(&self, message: &[u8]) -> Vec<u8> {
        self.signing_key.sign(message).to_bytes().to_vec()
    }

    /// Sign a message and return as hex string
    pub fn sign_hex(&self, message: &[u8]) -> String {
        hex::encode(self.sign(message))
    }
}

impl Default for Ed25519KeyPair {
    fn default() -> Self {
        Self::new()
    }
}

/// Verify an Ed25519 signature
#[wasm_bindgen]
pub fn ed25519_verify(
    public_key: &[u8],
    message: &[u8],
    signature: &[u8],
) -> Result<bool, JsValue> {
    if public_key.len() != 32 {
        return Err(CryptoError::InvalidKeyLength {
            expected: 32,
            actual: public_key.len(),
        }.into());
    }
    if signature.len() != 64 {
        return Err(CryptoError::InvalidSignature.into());
    }

    let pk_bytes: [u8; 32] = public_key.try_into().unwrap();
    let sig_bytes: [u8; 64] = signature.try_into().unwrap();

    let verifying_key = VerifyingKey::from_bytes(&pk_bytes)
        .map_err(|_| CryptoError::InvalidSignature)?;
    let signature = Signature::from_bytes(&sig_bytes);

    Ok(verifying_key.verify(message, &signature).is_ok())
}

/// Verify an Ed25519 signature from hex strings
#[wasm_bindgen]
pub fn ed25519_verify_hex(
    public_key_hex: &str,
    message: &[u8],
    signature_hex: &str,
) -> Result<bool, JsValue> {
    let public_key = hex::decode(public_key_hex)
        .map_err(CryptoError::from)?;
    let signature = hex::decode(signature_hex)
        .map_err(CryptoError::from)?;
    ed25519_verify(&public_key, message, &signature)
}

// ============================================================================
// Agent Fingerprinting
// ============================================================================

/// Compute agent fingerprint from core identity data
#[wasm_bindgen]
pub fn compute_agent_fingerprint(
    agent_id: &str,
    name: &str,
    created_at: &str,
) -> String {
    let data = format!("{}:{}:{}", agent_id, name, created_at);
    sha384_hex(data.as_bytes())
}

/// Compute content-addressed hash for agent state
#[wasm_bindgen]
pub fn compute_state_hash(state_json: &str) -> String {
    blake3_hex(state_json.as_bytes())
}

// ============================================================================
// Batch Operations (optimized for multiple items)
// ============================================================================

/// Batch hash multiple items
#[wasm_bindgen]
pub fn batch_hash(items: Vec<js_sys::Uint8Array>, algorithm: HashAlgorithm) -> Vec<String> {
    items
        .iter()
        .map(|item| {
            let data = item.to_vec();
            hash_hex(&data, algorithm)
        })
        .collect()
}

/// Batch verify multiple signatures
/// Returns a Uint8Array where each byte is 0 (false) or 1 (true)
#[wasm_bindgen]
pub fn batch_verify(
    public_keys: Vec<js_sys::Uint8Array>,
    messages: Vec<js_sys::Uint8Array>,
    signatures: Vec<js_sys::Uint8Array>,
) -> Vec<u8> {
    if public_keys.len() != messages.len() || messages.len() != signatures.len() {
        return vec![0u8; public_keys.len().max(messages.len()).max(signatures.len())];
    }

    public_keys
        .iter()
        .zip(messages.iter())
        .zip(signatures.iter())
        .map(|((pk, msg), sig)| {
            if ed25519_verify(&pk.to_vec(), &msg.to_vec(), &sig.to_vec()).unwrap_or(false) {
                1u8
            } else {
                0u8
            }
        })
        .collect()
}

// ============================================================================
// HMAC Operations
// ============================================================================

use hmac::{Hmac, Mac};

type HmacSha256 = Hmac<Sha256>;
type HmacSha384 = Hmac<Sha384>;
type HmacSha512 = Hmac<Sha512>;

/// Compute HMAC-SHA256
#[wasm_bindgen]
pub fn hmac_sha256(key: &[u8], data: &[u8]) -> Vec<u8> {
    use hmac::Mac;
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC accepts any key length");
    mac.update(data);
    mac.finalize().into_bytes().to_vec()
}

/// Compute HMAC-SHA384
#[wasm_bindgen]
pub fn hmac_sha384(key: &[u8], data: &[u8]) -> Vec<u8> {
    use hmac::Mac;
    let mut mac = HmacSha384::new_from_slice(key).expect("HMAC accepts any key length");
    mac.update(data);
    mac.finalize().into_bytes().to_vec()
}

/// Compute HMAC-SHA512
#[wasm_bindgen]
pub fn hmac_sha512(key: &[u8], data: &[u8]) -> Vec<u8> {
    use hmac::Mac;
    let mut mac = HmacSha512::new_from_slice(key).expect("HMAC accepts any key length");
    mac.update(data);
    mac.finalize().into_bytes().to_vec()
}

// ============================================================================
// Key Derivation
// ============================================================================

/// Derive a key using HKDF-SHA256
#[wasm_bindgen]
pub fn hkdf_sha256(
    ikm: &[u8],      // Input key material
    salt: &[u8],     // Optional salt
    info: &[u8],     // Context info
    length: usize,   // Output length
) -> Vec<u8> {
    use hkdf::Hkdf;

    let hk = Hkdf::<Sha256>::new(Some(salt), ikm);
    let mut okm = vec![0u8; length];
    hk.expand(info, &mut okm).expect("length should be valid");
    okm
}

// ============================================================================
// Utilities
// ============================================================================

/// Constant-time comparison of two byte arrays
#[wasm_bindgen]
pub fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut result = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        result |= x ^ y;
    }
    result == 0
}

/// Generate cryptographically secure random bytes
#[wasm_bindgen]
pub fn random_bytes(length: usize) -> Vec<u8> {
    let mut bytes = vec![0u8; length];
    getrandom::getrandom(&mut bytes).expect("Failed to generate random bytes");
    bytes
}

/// Generate a random hex string
#[wasm_bindgen]
pub fn random_hex(length: usize) -> String {
    hex::encode(random_bytes(length))
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sha384() {
        let data = b"hello world";
        let hash = sha384_hex(data);
        assert_eq!(hash.len(), 96); // 384 bits = 48 bytes = 96 hex chars
    }

    #[test]
    fn test_blake3() {
        let data = b"hello world";
        let hash = blake3_hex(data);
        assert_eq!(hash.len(), 64); // 256 bits = 32 bytes = 64 hex chars
    }

    #[test]
    fn test_ed25519_sign_verify() {
        let keypair = Ed25519KeyPair::new();
        let message = b"test message";
        let signature = keypair.sign(message);

        let result = ed25519_verify(&keypair.public_key(), message, &signature);
        assert!(result.unwrap());
    }

    #[test]
    fn test_agent_fingerprint() {
        let fingerprint = compute_agent_fingerprint(
            "agent-001",
            "TestAgent",
            "2024-01-01T00:00:00Z",
        );
        assert_eq!(fingerprint.len(), 96);
    }

    #[test]
    fn test_constant_time_eq() {
        let a = b"hello";
        let b = b"hello";
        let c = b"world";

        assert!(constant_time_eq(a, b));
        assert!(!constant_time_eq(a, c));
    }
}