import { ed25519 } from '@noble/curves/ed25519';
import { sha384 } from '@noble/hashes/sha512';

export function sha384Hex(data: Uint8Array): string {
  const digest = sha384(data);
  return Buffer.from(digest).toString('hex');
}

export function base64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

export function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

export function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(Buffer.from(hex, 'hex'));
}

export function bytesToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

export function newKeypair(): { privateKey: Uint8Array; publicKey: Uint8Array } {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = ed25519.getPublicKey(privateKey);
  return { privateKey, publicKey };
}

export async function signHashHex(privateKey: Uint8Array, hashHex: string): Promise<Uint8Array> {
  return ed25519.sign(hexToBytes(hashHex), privateKey);
}

export async function verifyHashHex(
  publicKey: Uint8Array,
  hashHex: string,
  signature: Uint8Array
): Promise<boolean> {
  return ed25519.verify(signature, hexToBytes(hashHex), publicKey);
}
