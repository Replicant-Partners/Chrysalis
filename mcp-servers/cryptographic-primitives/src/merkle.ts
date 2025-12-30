/**
 * Merkle tree operations
 * 
 * Provides efficient proof of membership and integrity for large datasets.
 * Used in blockchains, Git, and distributed systems.
 */

import { hash, HashAlgorithm } from './hash.js';

export interface MerkleProof {
  leaf: Uint8Array;
  leafIndex: number;
  siblings: Uint8Array[];
  root: Uint8Array;
  treeSize: number; // Number of leaves in the original tree
}

/**
 * Build Merkle tree and return root hash
 * 
 * Tree construction:
 * - Leaves are hashed data
 * - Parent = hash(left || right)
 * - Single child is promoted (no duplicate hashing)
 */
export function merkleRoot(
  leaves: Uint8Array[],
  algorithm: HashAlgorithm = 'SHA-256'
): Uint8Array {
  if (leaves.length === 0) {
    throw new Error('Cannot build Merkle tree from empty array');
  }
  
  if (leaves.length === 1) {
    return hash(leaves[0], algorithm);
  }
  
  // Hash all leaves
  let currentLevel = leaves.map(leaf => hash(leaf, algorithm));
  
  // Build tree bottom-up
  while (currentLevel.length > 1) {
    const nextLevel: Uint8Array[] = [];
    
    for (let i = 0; i < currentLevel.length; i += 2) {
      if (i + 1 < currentLevel.length) {
        // Pair exists: hash(left || right)
        const combined = new Uint8Array(currentLevel[i].length + currentLevel[i + 1].length);
        combined.set(currentLevel[i], 0);
        combined.set(currentLevel[i + 1], currentLevel[i].length);
        nextLevel.push(hash(combined, algorithm));
      } else {
        // Odd node: promote to next level
        nextLevel.push(currentLevel[i]);
      }
    }
    
    currentLevel = nextLevel;
  }
  
  return currentLevel[0];
}

/**
 * Generate Merkle proof for leaf at index
 * 
 * Proof contains sibling hashes needed to reconstruct root.
 * For odd nodes without a pair, no sibling is recorded.
 */
export function merkleProof(
  leaves: Uint8Array[],
  leafIndex: number,
  algorithm: HashAlgorithm = 'SHA-256'
): MerkleProof {
  if (leafIndex < 0 || leafIndex >= leaves.length) {
    throw new Error(`Leaf index ${leafIndex} out of bounds [0, ${leaves.length})`);
  }
  
  const siblings: Uint8Array[] = [];
  
  // Hash all leaves
  let currentLevel = leaves.map(leaf => hash(leaf, algorithm));
  let currentIndex = leafIndex;
  
  // Collect siblings up the tree
  while (currentLevel.length > 1) {
    // Determine if current node has a sibling at this level
    const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;
    
    if (siblingIndex < currentLevel.length) {
      // Has a sibling - record it
      siblings.push(currentLevel[siblingIndex]);
    }
    // If no sibling (odd node at end), nothing to record
    
    // Build next level
    const nextLevel: Uint8Array[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      if (i + 1 < currentLevel.length) {
        // Pair exists
        const combined = new Uint8Array(currentLevel[i].length + currentLevel[i + 1].length);
        combined.set(currentLevel[i], 0);
        combined.set(currentLevel[i + 1], currentLevel[i].length);
        nextLevel.push(hash(combined, algorithm));
      } else {
        // Odd node: promote
        nextLevel.push(currentLevel[i]);
      }
    }
    
    currentIndex = Math.floor(currentIndex / 2);
    currentLevel = nextLevel;
  }
  
  return {
    leaf: leaves[leafIndex],
    leafIndex,
    siblings,
    root: currentLevel[0],
    treeSize: leaves.length
  };
}

/**
 * Verify Merkle proof
 * 
 * Reconstructs root from leaf and sibling hashes.
 * Handles odd nodes that were promoted without siblings.
 * 
 * Strategy:
 * 1. Rebuild the tree structure based on treeSize to determine which levels have siblings
 * 2. Process siblings at the correct levels
 * 3. Verify final hash matches root
 */
export function verifyMerkleProof(
  proof: MerkleProof,
  algorithm: HashAlgorithm = 'SHA-256'
): boolean {
  let currentHash = hash(proof.leaf, algorithm);
  let currentIndex = proof.leafIndex;
  let siblingIndex = 0;
  
  // Calculate tree structure to know which levels have siblings
  let levelSizes = [proof.treeSize];
  let size = proof.treeSize;
  while (size > 1) {
    size = Math.ceil(size / 2);
    levelSizes.push(size);
  }
  
  // Process each level
  for (let level = 0; level < levelSizes.length - 1; level++) {
    const nodesAtLevel = levelSizes[level];
    
    // Check if current node has a sibling at this level
    const hasSibling = (currentIndex % 2 === 0 && currentIndex + 1 < nodesAtLevel) ||
                       (currentIndex % 2 === 1);
    
    if (hasSibling && siblingIndex < proof.siblings.length) {
      const sibling = proof.siblings[siblingIndex];
      const combined = new Uint8Array(currentHash.length + sibling.length);
      
      // Left child has even index, right child has odd index
      if (currentIndex % 2 === 0) {
        // Current is left child
        combined.set(currentHash, 0);
        combined.set(sibling, currentHash.length);
      } else {
        // Current is right child
        combined.set(sibling, 0);
        combined.set(currentHash, sibling.length);
      }
      
      currentHash = hash(combined, algorithm);
      siblingIndex++;
    }
    // If no sibling (odd node promoted), currentHash stays the same
    
    currentIndex = Math.floor(currentIndex / 2);
  }
  
  // After processing all levels, currentHash should equal root
  if (currentHash.length !== proof.root.length) {
    return false;
  }
  
  // Constant-time comparison
  let diff = 0;
  for (let i = 0; i < currentHash.length; i++) {
    diff |= currentHash[i] ^ proof.root[i];
  }
  
  return diff === 0;
}
