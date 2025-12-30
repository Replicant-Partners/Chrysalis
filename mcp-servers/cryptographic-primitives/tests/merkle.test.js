/**
 * Tests for Merkle tree operations
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { merkleRoot, merkleProof, verifyMerkleProof } from '../dist/merkle.js';
import { toHex } from '../dist/hash.js';

function makeLeaves(count) {
  return Array.from({ length: count }, (_, i) => 
    new TextEncoder().encode(`leaf${i}`)
  );
}

test('merkleRoot - single leaf', () => {
  const leaves = [new TextEncoder().encode('single')];
  const root = merkleRoot(leaves);
  
  // Root should be hash of single leaf
  assert.strictEqual(root.length, 32); // SHA-256
});

test('merkleRoot - power of 2', () => {
  const leaves = makeLeaves(4);
  const root = merkleRoot(leaves);
  
  assert.strictEqual(root.length, 32);
});

test('merkleRoot - non-power of 2', () => {
  const leaves = makeLeaves(3);
  const root = merkleRoot(leaves);
  
  assert.strictEqual(root.length, 32);
});

test('merkleRoot - deterministic', () => {
  const leaves = makeLeaves(5);
  const root1 = merkleRoot(leaves);
  const root2 = merkleRoot(leaves);
  
  assert.strictEqual(toHex(root1), toHex(root2));
});

test('merkleRoot - empty array throws', () => {
  assert.throws(() => merkleRoot([]), {
    message: 'Cannot build Merkle tree from empty array'
  });
});

test('merkleProof - first leaf', () => {
  const leaves = makeLeaves(4);
  const proof = merkleProof(leaves, 0);
  
  assert.strictEqual(proof.leafIndex, 0);
  assert.deepStrictEqual(proof.leaf, leaves[0]);
  assert.strictEqual(proof.siblings.length, 2); // log2(4) = 2
});

test('merkleProof - last leaf', () => {
  const leaves = makeLeaves(4);
  const proof = merkleProof(leaves, 3);
  
  assert.strictEqual(proof.leafIndex, 3);
  assert.deepStrictEqual(proof.leaf, leaves[3]);
});

test('merkleProof - middle leaf', () => {
  const leaves = makeLeaves(8);
  const proof = merkleProof(leaves, 3);
  
  assert.strictEqual(proof.leafIndex, 3);
  assert.strictEqual(proof.siblings.length, 3); // log2(8) = 3
});

test('merkleProof - out of bounds throws', () => {
  const leaves = makeLeaves(4);
  
  assert.throws(() => merkleProof(leaves, 4), {
    message: 'Leaf index 4 out of bounds [0, 4)'
  });
  
  assert.throws(() => merkleProof(leaves, -1), {
    message: 'Leaf index -1 out of bounds [0, 4)'
  });
});

test('verifyMerkleProof - valid proof', () => {
  const leaves = makeLeaves(8);
  const proof = merkleProof(leaves, 3);
  
  assert.strictEqual(verifyMerkleProof(proof), true);
});

test('verifyMerkleProof - all leaves', () => {
  const leaves = makeLeaves(7);
  
  for (let i = 0; i < leaves.length; i++) {
    const proof = merkleProof(leaves, i);
    assert.strictEqual(verifyMerkleProof(proof), true, `Proof for leaf ${i} should be valid`);
  }
});

test('verifyMerkleProof - tampered leaf', () => {
  const leaves = makeLeaves(4);
  const proof = merkleProof(leaves, 1);
  
  // Tamper with leaf
  proof.leaf = new TextEncoder().encode('tampered');
  
  assert.strictEqual(verifyMerkleProof(proof), false);
});

test('verifyMerkleProof - tampered root', () => {
  const leaves = makeLeaves(4);
  const proof = merkleProof(leaves, 1);
  
  // Tamper with root
  proof.root = new Uint8Array(32);
  
  assert.strictEqual(verifyMerkleProof(proof), false);
});

test('verifyMerkleProof - tampered sibling', () => {
  const leaves = makeLeaves(4);
  const proof = merkleProof(leaves, 1);
  
  // Tamper with a sibling
  proof.siblings[0] = new Uint8Array(32);
  
  assert.strictEqual(verifyMerkleProof(proof), false);
});

test('Merkle tree - comprehensive scenario', () => {
  // Build tree with 10 leaves
  const leaves = makeLeaves(10);
  const root = merkleRoot(leaves);
  
  // Generate and verify proofs for all leaves
  for (let i = 0; i < leaves.length; i++) {
    const proof = merkleProof(leaves, i);
    
    // Verify proof is valid
    assert.strictEqual(verifyMerkleProof(proof), true);
    
    // Verify root matches
    assert.strictEqual(toHex(proof.root), toHex(root));
  }
});
