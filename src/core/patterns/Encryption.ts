/**
 * Pattern #3: Encryption (One-Way Functions with Trapdoor)
 * 
 * Universal Pattern: Reversible transformation with secret key
 * Natural Analogy: Locked container, biological membrane permeability
 * Mathematical Property: Trapdoor one-way function
 * 
 * Application: Agent communication privacy, secure storage, identity protection
 */

import { x25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from '@noble/hashes/utils';

export type EncryptionAlgorithm = 'x25519-xsalsa20-poly1305' | 'secp256k1-aes-gcm';

/**
 * Generate keypair for encryption
 */
export async function generateEncryptionKeypair(
  algorithm: EncryptionAlgorithm = 'x25519-xsalsa20-poly1305'
): Promise<{ privateKey: Uint8Array; publicKey: Uint8Array }> {
  if (algorithm === 'x25519-xsalsa20-poly1305') {
    // X25519 key generation
    const privateKey = randomBytes(32);
    const publicKey = x25519.getPublicKey(privateKey);
    return { privateKey, publicKey };
  } else {
    // For secp256k1-aes-gcm, we'd need additional implementation
    throw new Error(`Algorithm ${algorithm} not yet implemented`);
  }
}

/**
 * Encrypt data with public key (hybrid encryption)
 */
export async function encryptWithPublicKey(
  data: Uint8Array | string,
  recipientPublicKey: Uint8Array,
  algorithm: EncryptionAlgorithm = 'x25519-xsalsa20-poly1305'
): Promise<{ encrypted: Uint8Array; ephemeralPublicKey: Uint8Array }> {
  const bytes = typeof data === 'string' 
    ? new TextEncoder().encode(data) 
    : data;

  if (algorithm === 'x25519-xsalsa20-poly1305') {
    // Generate ephemeral keypair for sender
    const ephemeralPrivateKey = randomBytes(32);
    const ephemeralPublicKey = x25519.getPublicKey(ephemeralPrivateKey);
    
    // Generate shared secret using X25519
    const sharedSecret = x25519.getSharedSecret(ephemeralPrivateKey, recipientPublicKey);
    
    // Use shared secret to derive encryption key (simplified)
    const encryptionKey = sha256(sharedSecret);
    
    // For actual encryption, we'd use XSalsa20-Poly1305
    // This is a simplified placeholder implementation using XOR (not secure for production)
    // In production, we'd use a proper AEAD cipher
    const keystream = sha256(new Uint8Array([...encryptionKey, ...bytes]));
    const encrypted = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      encrypted[i] = bytes[i] ^ keystream[i % keystream.length];
    }
    
    return { encrypted, ephemeralPublicKey };
  } else {
    throw new Error(`Algorithm ${algorithm} not yet implemented`);
  }
}

/**
 * Decrypt data with private key
 */
export async function decryptWithPrivateKey(
  encrypted: Uint8Array,
  ephemeralPublicKey: Uint8Array,
  recipientPrivateKey: Uint8Array,
  algorithm: EncryptionAlgorithm = 'x25519-xsalsa20-poly1305'
): Promise<Uint8Array> {
  if (algorithm === 'x25519-xsalsa20-poly1305') {
    // Generate shared secret using X25519
    const sharedSecret = x25519.getSharedSecret(recipientPrivateKey, ephemeralPublicKey);
    
    // Derive the same encryption key
    const encryptionKey = sha256(sharedSecret);
    
    // For decryption, we'd reverse the encryption process
    // This is a simplified placeholder implementation using XOR (not secure for production)
    // In production, we'd use a proper AEAD cipher
    const keystream = sha256(new Uint8Array([...encryptionKey, ...encrypted]));
    const decrypted = new Uint8Array(encrypted.length);
    for (let i = 0; i < encrypted.length; i++) {
      decrypted[i] = encrypted[i] ^ keystream[i % keystream.length];
    }
    
    return decrypted;
  } else {
    throw new Error(`Algorithm ${algorithm} not yet implemented`);
  }
}

/**
 * Symmetric encryption/decryption (for local secure storage)
 */
export async function encryptWithPassword(
  data: Uint8Array | string,
  password: string
): Promise<Uint8Array> {
  // Derive key from password using SHA-256 (simplified)
  // In production, we'd use PBKDF2, scrypt, or Argon2
  const key = sha256(new TextEncoder().encode(password));
  const bytes = typeof data === 'string' 
    ? new TextEncoder().encode(data) 
    : data;
  
  // Simplified XOR cipher (not secure for production)
  // In production, we'd use AES-GCM
  const keystream = sha256(new Uint8Array([...key, ...bytes]));
  const encrypted = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    encrypted[i] = bytes[i] ^ keystream[i % keystream.length];
  }
  
  return encrypted;
}

export async function decryptWithPassword(
  encrypted: Uint8Array,
  password: string
): Promise<Uint8Array> {
  // Derive key from password
  const key = sha256(new TextEncoder().encode(password));
  
  // Reverse the encryption process
  const keystream = sha256(new Uint8Array([...key, ...encrypted]));
  const decrypted = new Uint8Array(encrypted.length);
  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i] ^ keystream[i % keystream.length];
  }
  
  return decrypted;
}

/**
 * Encrypt agent data (Pattern #3 applied)
 */
export async function encryptAgentData(
  agentData: any,
  recipientPublicKey: Uint8Array
): Promise<{ encrypted: string; ephemeralPublicKey: string }> {
  const serialized = JSON.stringify(agentData);
  const { encrypted, ephemeralPublicKey } = await encryptWithPublicKey(
    serialized, 
    recipientPublicKey
  );
  
  return {
    encrypted: Array.from(encrypted).map(b => b.toString(16).padStart(2, '0')).join(''),
    ephemeralPublicKey: Array.from(ephemeralPublicKey).map(b => b.toString(16).padStart(2, '0')).join('')
  };
}

/**
 * Decrypt agent data
 */
export async function decryptAgentData(
  encryptedData: { encrypted: string; ephemeralPublicKey: string },
  recipientPrivateKey: Uint8Array
): Promise<any> {
  // Convert hex strings back to Uint8Array
  const encrypted = new Uint8Array(encryptedData.encrypted.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const ephemeralPublicKey = new Uint8Array(encryptedData.ephemeralPublicKey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  
  const decryptedBytes = await decryptWithPrivateKey(
    encrypted,
    ephemeralPublicKey,
    recipientPrivateKey
  );
  
  const jsonString = new TextDecoder().decode(decryptedBytes);
  return JSON.parse(jsonString);
}

/**
 * Zero-knowledge encryption wrapper (for privacy-preserving proofs)
 * From DEEP_RESEARCH_PRIVACY_PRESERVING_PROTOCOLS.md
 */
export class PrivacyPreservingEncryption {
  private key: Uint8Array;
  
  constructor(password: string) {
    this.key = sha256(new TextEncoder().encode(password));
  }
  
  /**
   * Encrypt data but allow specific computations on encrypted data
   * This is a simplified implementation - real homomorphic encryption is complex
   */
  async encryptForComputation(data: any): Promise<Uint8Array> {
    // In a real implementation, we'd use homomorphic encryption
    // For now, we'll use our simplified encryption with a tag for computation
    const serialized = JSON.stringify(data);
    return await encryptWithPassword(serialized, Array.from(this.key).map(b => b.toString(16)).join(''));
  }
  
  /**
   * Perform computation on encrypted data without decrypting
   * This is a placeholder for homomorphic operations
   */
  async computeOnEncrypted<T>(
    encryptedData: Uint8Array,
    operation: (data: any) => T
  ): Promise<Uint8Array> {
    // In a real homomorphic encryption system, this would perform
    // the operation without decryption
    // For now, we'll decrypt, apply operation, then re-encrypt (not actually homomorphic)
    const decrypted = await this.decryptForComputation(encryptedData);
    const result = operation(decrypted);
    return await this.encryptForComputation(result);
  }
  
  private async decryptForComputation(encryptedData: Uint8Array): Promise<any> {
    const decryptedString = await decryptWithPassword(encryptedData, Array.from(this.key).map(b => b.toString(16)).join(''));
    return JSON.parse(new TextDecoder().decode(decryptedString));
  }
}