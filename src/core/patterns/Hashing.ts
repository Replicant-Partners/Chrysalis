/**
 * Pattern #1: Hash Functions (One-Way Transformation)
 * 
 * Universal Pattern: Entropy increase, irreversible processes
 * Natural Analogy: Thermodynamics, DNA transcription
 * Mathematical Property: Preimage resistance
 * 
 * Application: Agent fingerprinting, integrity verification, content addressing
 */

import { sha256 } from '@noble/hashes/sha256';
import { sha384, sha512 } from '@noble/hashes/sha512';
import { blake3 } from '@noble/hashes/blake3';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

export type HashAlgorithm = 'SHA-256' | 'SHA-384' | 'SHA-512' | 'BLAKE3';

/**
 * Hash data with specified algorithm
 */
export function hash(data: Uint8Array | string, algorithm: HashAlgorithm = 'SHA-384'): Uint8Array {
  const bytes = typeof data === 'string' 
    ? new TextEncoder().encode(data)
    : data;
  
  switch (algorithm) {
    case 'SHA-256':
      return sha256(bytes);
    case 'SHA-384':
      return sha384(bytes);
    case 'SHA-512':
      return sha512(bytes);
    case 'BLAKE3':
      return blake3(bytes);
    default:
      return sha384(bytes);
  }
}

/**
 * Hash to hex string
 */
export function hashToHex(data: Uint8Array | string, algorithm: HashAlgorithm = 'SHA-384'): string {
  return bytesToHex(hash(data, algorithm));
}

/**
 * Verify data matches hash
 */
export function verifyHash(
  data: Uint8Array | string,
  expectedHash: Uint8Array | string,
  algorithm: HashAlgorithm = 'SHA-384'
): boolean {
  const computedHash = hash(data, algorithm);
  const expected = typeof expectedHash === 'string'
    ? hexToBytes(expectedHash)
    : expectedHash;
  
  // Constant-time comparison (timing attack resistance)
  if (computedHash.length !== expected.length) return false;
  
  let diff = 0;
  for (let i = 0; i < computedHash.length; i++) {
    diff |= computedHash[i] ^ expected[i];
  }
  return diff === 0;
}

/**
 * Generate agent fingerprint (Pattern #1 applied)
 */
export function generateAgentFingerprint(identity: {
  id: string;
  name: string;
  designation: string;
  created: string;
  values?: string[];
}): string {
  // Canonicalize identity (deterministic serialization)
  const canonical = JSON.stringify({
    id: identity.id,
    name: identity.name,
    designation: identity.designation,
    created: identity.created,
    values: identity.values?.sort() || []
  });
  
  return hashToHex(canonical, 'SHA-384');
}

/**
 * Merkle tree operations (for efficient proofs)
 */
export class MerkleTree {
  private leaves: Uint8Array[];
  private tree: Uint8Array[][];
  
  constructor(leaves: Uint8Array[]) {
    this.leaves = leaves;
    this.tree = this.buildTree(leaves);
  }
  
  private buildTree(leaves: Uint8Array[]): Uint8Array[][] {
    if (leaves.length === 0) return [[]];
    
    const tree: Uint8Array[][] = [leaves];
    let level = leaves;
    
    while (level.length > 1) {
      const nextLevel: Uint8Array[] = [];
      for (let i = 0; i < level.length; i += 2) {
        if (i + 1 < level.length) {
          // Hash pair
          const combined = new Uint8Array(level[i].length + level[i + 1].length);
          combined.set(level[i], 0);
          combined.set(level[i + 1], level[i].length);
          nextLevel.push(sha384(combined));
        } else {
          // Odd one out, promote to next level
          nextLevel.push(level[i]);
        }
      }
      tree.push(nextLevel);
      level = nextLevel;
    }
    
    return tree;
  }
  
  getRoot(): Uint8Array {
    return this.tree[this.tree.length - 1][0];
  }
  
  getProof(index: number): Uint8Array[] {
    const proof: Uint8Array[] = [];
    let idx = index;
    
    for (let level = 0; level < this.tree.length - 1; level++) {
      const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
      if (siblingIdx < this.tree[level].length) {
        proof.push(this.tree[level][siblingIdx]);
      }
      idx = Math.floor(idx / 2);
    }
    
    return proof;
  }
  
  static verifyProof(
    leaf: Uint8Array,
    proof: Uint8Array[],
    root: Uint8Array,
    index: number
  ): boolean {
    let computedHash = leaf;
    let idx = index;
    
    for (const sibling of proof) {
      const combined = idx % 2 === 0
        ? new Uint8Array([...computedHash, ...sibling])
        : new Uint8Array([...sibling, ...computedHash]);
      
      computedHash = sha384(combined);
      idx = Math.floor(idx / 2);
    }
    
    return verifyHash(computedHash, root, 'SHA-384');
  }
}

/**
 * Content addressing (IPFS-style)
 */
export function contentAddress(data: any): string {
  const canonical = JSON.stringify(data);
  return 'chrysalis:' + hashToHex(canonical, 'BLAKE3');
}
