/**
 * Tests for hash operations
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { hash, verifyHash, hashString, toHex, fromHex } from '../dist/hash.js';

test('SHA-256 hash', () => {
  const data = new TextEncoder().encode('hello world');
  const result = hash(data, 'SHA-256');
  
  // Known SHA-256 hash of "hello world"
  const expected = 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9';
  assert.strictEqual(toHex(result), expected);
});

test('SHA-384 hash', () => {
  const data = new TextEncoder().encode('hello world');
  const result = hash(data, 'SHA-384');
  
  // Known SHA-384 hash
  const expected = 'fdbd8e75a67f29f701a4e040385e2e23986303ea10239211af907fcbb83578b3e417cb71ce646efd0819dd8c088de1bd';
  assert.strictEqual(toHex(result), expected);
});

test('SHA-512 hash', () => {
  const data = new TextEncoder().encode('hello world');
  const result = hash(data, 'SHA-512');
  
  // Known SHA-512 hash
  const expected = '309ecc489c12d6eb4cc40f50c902f2b4d0ed77ee511a7c7a9bcd3ca86d4cd86f989dd35bc5ff499670da34255b45b0cfd830e81f605dcf7dc5542e93ae9cd76f';
  assert.strictEqual(toHex(result), expected);
});

test('BLAKE3 hash', () => {
  const data = new TextEncoder().encode('hello world');
  const result = hash(data, 'BLAKE3');
  
  // BLAKE3 is deterministic, check it's 32 bytes
  assert.strictEqual(result.length, 32);
  
  // Verify it's consistent
  const result2 = hash(data, 'BLAKE3');
  assert.strictEqual(toHex(result), toHex(result2));
});

test('verifyHash - valid', () => {
  const data = new TextEncoder().encode('test data');
  const expectedHash = hash(data, 'SHA-256');
  
  assert.strictEqual(verifyHash(data, expectedHash, 'SHA-256'), true);
});

test('verifyHash - invalid', () => {
  const data = new TextEncoder().encode('test data');
  const wrongData = new TextEncoder().encode('wrong data');
  const expectedHash = hash(data, 'SHA-256');
  
  assert.strictEqual(verifyHash(wrongData, expectedHash, 'SHA-256'), false);
});

test('hashString', () => {
  const result = hashString('hello world', 'SHA-256');
  const expected = 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9';
  
  assert.strictEqual(toHex(result), expected);
});

test('toHex/fromHex roundtrip', () => {
  const original = new Uint8Array([0, 1, 2, 255, 254, 253]);
  const hex = toHex(original);
  const decoded = fromHex(hex);
  
  assert.deepStrictEqual(decoded, original);
});

test('fromHex - invalid length', () => {
  assert.throws(() => fromHex('abc'), {
    message: 'Hex string must have even length'
  });
});
