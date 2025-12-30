/**
 * Digital signature operations
 * 
 * Ed25519: Fast, compact signatures (64 bytes)
 * BLS12-381: Signature aggregation, threshold signatures
 */

import * as ed25519 from '@noble/ed25519';
import { bls12_381 as bls } from '@noble/curves/bls12-381';

// ============================================================================
// Ed25519 Operations
// ============================================================================

export interface Ed25519Keypair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

/**
 * Generate Ed25519 keypair
 * 
 * Ed25519 properties:
 * - 32-byte private key
 * - 32-byte public key  
 * - 64-byte signature
 * - Deterministic (no nonce reuse vulnerability)
 * - Constant-time (side-channel resistant)
 */
export async function ed25519GenerateKeypair(): Promise<Ed25519Keypair> {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = await ed25519.getPublicKeyAsync(privateKey);
  
  return {
    privateKey,
    publicKey
  };
}

/**
 * Sign message with Ed25519
 */
export async function ed25519Sign(
  message: Uint8Array,
  privateKey: Uint8Array
): Promise<Uint8Array> {
  return await ed25519.signAsync(message, privateKey);
}

/**
 * Verify Ed25519 signature
 */
export async function ed25519Verify(
  message: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array
): Promise<boolean> {
  try {
    return await ed25519.verifyAsync(signature, message, publicKey);
  } catch (error) {
    // Invalid signature format or parameters
    return false;
  }
}

// ============================================================================
// BLS12-381 Operations
// ============================================================================

export interface BLSKeypair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

/**
 * Generate BLS12-381 keypair
 * 
 * BLS12-381 properties:
 * - 32-byte private key
 * - 48-byte public key (G1) or 96-byte (G2)
 * - 96-byte signature (G2) or 48-byte (G1)
 * - Signature aggregation: combine multiple signatures into one
 * - Public key aggregation: combine multiple public keys
 * - Pairing-based cryptography
 */
export function blsGenerateKeypair(): BLSKeypair {
  const privateKey = bls.utils.randomPrivateKey();
  const publicKey = bls.getPublicKey(privateKey);
  
  return {
    privateKey,
    publicKey
  };
}

/**
 * Sign message with BLS
 * 
 * Uses G2 for signatures (standard approach for minimal signature size)
 */
export function blsSign(
  message: Uint8Array,
  privateKey: Uint8Array
): Uint8Array {
  return bls.sign(message, privateKey);
}

/**
 * Verify BLS signature
 */
export function blsVerify(
  message: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array
): boolean {
  try {
    return bls.verify(signature, message, publicKey);
  } catch (error) {
    // Invalid signature format or parameters
    return false;
  }
}

/**
 * Aggregate multiple BLS signatures
 * 
 * Multiple signatures on different messages can be combined.
 * This is a key feature of BLS signatures.
 */
export function blsAggregateSignatures(signatures: Uint8Array[]): Uint8Array {
  if (signatures.length === 0) {
    throw new Error('Cannot aggregate empty signature array');
  }
  
  return bls.aggregateSignatures(signatures);
}

/**
 * Aggregate multiple BLS public keys
 * 
 * Used for verifying aggregated signatures efficiently.
 */
export function blsAggregatePublicKeys(publicKeys: Uint8Array[]): Uint8Array {
  if (publicKeys.length === 0) {
    throw new Error('Cannot aggregate empty public key array');
  }
  
  return bls.aggregatePublicKeys(publicKeys);
}

/**
 * Verify aggregated BLS signature
 * 
 * For multiple messages signed by multiple keys.
 * More complex than single signature verification.
 */
export function blsVerifyBatch(
  messages: Uint8Array[],
  signatures: Uint8Array[],
  publicKeys: Uint8Array[]
): boolean {
  if (messages.length !== signatures.length || messages.length !== publicKeys.length) {
    throw new Error('Messages, signatures, and public keys must have same length');
  }
  
  if (messages.length === 0) {
    return true;
  }
  
  try {
    // Verify each signature individually for now
    // Note: True batch verification with pairings would be more efficient
    for (let i = 0; i < messages.length; i++) {
      if (!blsVerify(messages[i], signatures[i], publicKeys[i])) {
        return false;
      }
    }
    return true;
  } catch (error) {
    return false;
  }
}
