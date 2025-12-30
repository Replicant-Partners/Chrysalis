/**
 * Tests for digital signature operations
 */

import { test } from 'node:test';
import assert from 'node:assert';
import {
  ed25519GenerateKeypair,
  ed25519Sign,
  ed25519Verify,
  blsGenerateKeypair,
  blsSign,
  blsVerify,
  blsAggregateSignatures,
  blsAggregatePublicKeys
} from '../dist/signatures.js';

// ============================================================================
// Ed25519 Tests
// ============================================================================

test('Ed25519 - keygen', async () => {
  const keypair = await ed25519GenerateKeypair();
  
  assert.strictEqual(keypair.privateKey.length, 32);
  assert.strictEqual(keypair.publicKey.length, 32);
});

test('Ed25519 - keygen uniqueness', async () => {
  const kp1 = await ed25519GenerateKeypair();
  const kp2 = await ed25519GenerateKeypair();
  
  // Different keypairs should have different keys
  assert.notDeepStrictEqual(kp1.privateKey, kp2.privateKey);
  assert.notDeepStrictEqual(kp1.publicKey, kp2.publicKey);
});

test('Ed25519 - sign and verify', async () => {
  const keypair = await ed25519GenerateKeypair();
  const message = new TextEncoder().encode('test message');
  
  const signature = await ed25519Sign(message, keypair.privateKey);
  
  assert.strictEqual(signature.length, 64);
  
  const valid = await ed25519Verify(message, signature, keypair.publicKey);
  assert.strictEqual(valid, true);
});

test('Ed25519 - verify wrong message', async () => {
  const keypair = await ed25519GenerateKeypair();
  const message = new TextEncoder().encode('test message');
  const wrongMessage = new TextEncoder().encode('wrong message');
  
  const signature = await ed25519Sign(message, keypair.privateKey);
  const valid = await ed25519Verify(wrongMessage, signature, keypair.publicKey);
  
  assert.strictEqual(valid, false);
});

test('Ed25519 - verify wrong public key', async () => {
  const kp1 = await ed25519GenerateKeypair();
  const kp2 = await ed25519GenerateKeypair();
  const message = new TextEncoder().encode('test message');
  
  const signature = await ed25519Sign(message, kp1.privateKey);
  const valid = await ed25519Verify(message, signature, kp2.publicKey);
  
  assert.strictEqual(valid, false);
});

test('Ed25519 - deterministic signatures', async () => {
  const keypair = await ed25519GenerateKeypair();
  const message = new TextEncoder().encode('test message');
  
  const sig1 = await ed25519Sign(message, keypair.privateKey);
  const sig2 = await ed25519Sign(message, keypair.privateKey);
  
  // Ed25519 is deterministic
  assert.deepStrictEqual(sig1, sig2);
});

// ============================================================================
// BLS Tests
// ============================================================================

test('BLS - keygen', () => {
  const keypair = blsGenerateKeypair();
  
  assert.strictEqual(keypair.privateKey.length, 32);
  assert.strictEqual(keypair.publicKey.length, 48); // G1 public key
});

test('BLS - keygen uniqueness', () => {
  const kp1 = blsGenerateKeypair();
  const kp2 = blsGenerateKeypair();
  
  assert.notDeepStrictEqual(kp1.privateKey, kp2.privateKey);
  assert.notDeepStrictEqual(kp1.publicKey, kp2.publicKey);
});

test('BLS - sign and verify', () => {
  const keypair = blsGenerateKeypair();
  const message = new TextEncoder().encode('test message');
  
  const signature = blsSign(message, keypair.privateKey);
  
  assert.strictEqual(signature.length, 96); // G2 signature
  
  const valid = blsVerify(message, signature, keypair.publicKey);
  assert.strictEqual(valid, true);
});

test('BLS - verify wrong message', () => {
  const keypair = blsGenerateKeypair();
  const message = new TextEncoder().encode('test message');
  const wrongMessage = new TextEncoder().encode('wrong message');
  
  const signature = blsSign(message, keypair.privateKey);
  const valid = blsVerify(wrongMessage, signature, keypair.publicKey);
  
  assert.strictEqual(valid, false);
});

test('BLS - verify wrong public key', () => {
  const kp1 = blsGenerateKeypair();
  const kp2 = blsGenerateKeypair();
  const message = new TextEncoder().encode('test message');
  
  const signature = blsSign(message, kp1.privateKey);
  const valid = blsVerify(message, signature, kp2.publicKey);
  
  assert.strictEqual(valid, false);
});

test('BLS - aggregate signatures', () => {
  // Three different signers
  const kp1 = blsGenerateKeypair();
  const kp2 = blsGenerateKeypair();
  const kp3 = blsGenerateKeypair();
  
  const message = new TextEncoder().encode('same message');
  
  const sig1 = blsSign(message, kp1.privateKey);
  const sig2 = blsSign(message, kp2.privateKey);
  const sig3 = blsSign(message, kp3.privateKey);
  
  // Aggregate signatures
  const aggregatedSig = blsAggregateSignatures([sig1, sig2, sig3]);
  assert.strictEqual(aggregatedSig.length, 96);
  
  // Aggregate public keys
  const aggregatedPk = blsAggregatePublicKeys([kp1.publicKey, kp2.publicKey, kp3.publicKey]);
  assert.strictEqual(aggregatedPk.length, 48);
  
  // Verify aggregated signature with aggregated public key
  const valid = blsVerify(message, aggregatedSig, aggregatedPk);
  assert.strictEqual(valid, true);
});

test('BLS - aggregate empty throws', () => {
  assert.throws(() => blsAggregateSignatures([]), {
    message: 'Cannot aggregate empty signature array'
  });
  
  assert.throws(() => blsAggregatePublicKeys([]), {
    message: 'Cannot aggregate empty public key array'
  });
});

test('BLS - aggregate single signature', () => {
  const keypair = blsGenerateKeypair();
  const message = new TextEncoder().encode('test');
  const signature = blsSign(message, keypair.privateKey);
  
  // Aggregating single signature should work
  const aggregated = blsAggregateSignatures([signature]);
  
  // Should verify with original public key
  const valid = blsVerify(message, aggregated, keypair.publicKey);
  assert.strictEqual(valid, true);
});

test('BLS - aggregate invalid signature fails', () => {
  const kp1 = blsGenerateKeypair();
  const kp2 = blsGenerateKeypair();
  
  const message = new TextEncoder().encode('message');
  const wrongMessage = new TextEncoder().encode('wrong');
  
  const sig1 = blsSign(message, kp1.privateKey);
  const sig2 = blsSign(wrongMessage, kp2.privateKey); // Different message!
  
  const aggregatedSig = blsAggregateSignatures([sig1, sig2]);
  const aggregatedPk = blsAggregatePublicKeys([kp1.publicKey, kp2.publicKey]);
  
  // Should fail because signatures are on different messages
  const valid = blsVerify(message, aggregatedSig, aggregatedPk);
  assert.strictEqual(valid, false);
});
