/**
 * TypeScript bindings for Chrysalis Rust WASM Cryptographic Module
 *
 * Provides high-performance cryptographic operations compiled to WebAssembly.
 */

import type { KeyObject } from 'crypto';

// Type definitions matching the Rust WASM exports
export enum HashAlgorithm {
  Sha256 = 0,
  Sha384 = 1,
  Sha512 = 2,
  Sha3_256 = 3,
  Sha3_384 = 4,
  Sha3_512 = 5,
  Blake3 = 6,
}

export interface CryptoModule {
  // Hashing
  hash(data: Uint8Array, algorithm: HashAlgorithm): Uint8Array;
  hash_hex(data: Uint8Array, algorithm: HashAlgorithm): string;
  sha384(data: Uint8Array): Uint8Array;
  sha384_hex(data: Uint8Array): string;
  blake3_hash(data: Uint8Array): Uint8Array;
  blake3_hex(data: Uint8Array): string;

  // Ed25519 Signatures
  Ed25519KeyPair: {
    new (): Ed25519KeyPairInstance;
    from_secret(secret: Uint8Array): Ed25519KeyPairInstance;
  };
  ed25519_verify(
    publicKey: Uint8Array,
    message: Uint8Array,
    signature: Uint8Array
  ): boolean;
  ed25519_verify_hex(
    publicKeyHex: string,
    message: Uint8Array,
    signatureHex: string
  ): boolean;

  // Agent fingerprinting
  compute_agent_fingerprint(
    agentId: string,
    name: string,
    createdAt: string
  ): string;
  compute_state_hash(stateJson: string): string;

  // Batch operations
  batch_hash(items: Uint8Array[], algorithm: HashAlgorithm): string[];
  batch_verify(
    publicKeys: Uint8Array[],
    messages: Uint8Array[],
    signatures: Uint8Array[]
  ): boolean[];

  // HMAC
  hmac_sha256(key: Uint8Array, data: Uint8Array): Uint8Array;
  hmac_sha384(key: Uint8Array, data: Uint8Array): Uint8Array;
  hmac_sha512(key: Uint8Array, data: Uint8Array): Uint8Array;

  // Key derivation
  hkdf_sha256(
    ikm: Uint8Array,
    salt: Uint8Array,
    info: Uint8Array,
    length: number
  ): Uint8Array;

  // Utilities
  constant_time_eq(a: Uint8Array, b: Uint8Array): boolean;
  random_bytes(length: number): Uint8Array;
  random_hex(length: number): string;

  // Incremental hasher
  IncrementalHasher: {
    new (algorithm: HashAlgorithm): IncrementalHasherInstance;
  };
}

export interface Ed25519KeyPairInstance {
  secret_key(): Uint8Array;
  public_key(): Uint8Array;
  public_key_hex(): string;
  sign(message: Uint8Array): Uint8Array;
  sign_hex(message: Uint8Array): string;
}

export interface IncrementalHasherInstance {
  update(data: Uint8Array): void;
  finalize(): Uint8Array;
  finalize_hex(): string;
}

// Lazy-loaded WASM module
let cryptoModule: CryptoModule | null = null;
let initPromise: Promise<CryptoModule> | null = null;

/**
 * Initialize the crypto WASM module.
 * Call this before using any crypto functions.
 */
export async function initCrypto(): Promise<CryptoModule> {
  if (cryptoModule) {
    return cryptoModule;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      // Try to load the WASM module dynamically
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const wasmModule = require('../../native/rust-crypto/pkg/chrysalis_crypto');
      cryptoModule = wasmModule as unknown as CryptoModule;
      return cryptoModule;
    } catch {
      // WASM module not available, using Node.js crypto fallback
      cryptoModule = createFallbackCrypto();
      return cryptoModule;
    }
  })();

  return initPromise;
}

/**
 * Get the crypto module (must call initCrypto first).
 */
export function getCrypto(): CryptoModule {
  if (!cryptoModule) {
    throw new Error('Crypto module not initialized. Call initCrypto() first.');
  }
  return cryptoModule;
}

// Fallback implementation using Node.js crypto
function createFallbackCrypto(): CryptoModule {
  // Dynamic import for Node.js crypto
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeCrypto = require('crypto') as typeof import('crypto');

  const algorithmMap: Record<HashAlgorithm, string> = {
    [HashAlgorithm.Sha256]: 'sha256',
    [HashAlgorithm.Sha384]: 'sha384',
    [HashAlgorithm.Sha512]: 'sha512',
    [HashAlgorithm.Sha3_256]: 'sha3-256',
    [HashAlgorithm.Sha3_384]: 'sha3-384',
    [HashAlgorithm.Sha3_512]: 'sha3-512',
    [HashAlgorithm.Blake3]: 'sha256', // Fallback to sha256
  };

  const fallback: CryptoModule = {
    hash(data: Uint8Array, algorithm: HashAlgorithm): Uint8Array {
      const hashName = algorithmMap[algorithm];
      const h = nodeCrypto.createHash(hashName);
      h.update(Buffer.from(data));
      return new Uint8Array(h.digest());
    },

    hash_hex(data: Uint8Array, algorithm: HashAlgorithm): string {
      const hashName = algorithmMap[algorithm];
      const h = nodeCrypto.createHash(hashName);
      h.update(Buffer.from(data));
      return h.digest('hex');
    },

    sha384(data: Uint8Array): Uint8Array {
      const h = nodeCrypto.createHash('sha384');
      h.update(Buffer.from(data));
      return new Uint8Array(h.digest());
    },

    sha384_hex(data: Uint8Array): string {
      const h = nodeCrypto.createHash('sha384');
      h.update(Buffer.from(data));
      return h.digest('hex');
    },

    blake3_hash(data: Uint8Array): Uint8Array {
      // Fallback to SHA-256 when BLAKE3 isn't available
      const h = nodeCrypto.createHash('sha256');
      h.update(Buffer.from(data));
      return new Uint8Array(h.digest());
    },

    blake3_hex(data: Uint8Array): string {
      const h = nodeCrypto.createHash('sha256');
      h.update(Buffer.from(data));
      return h.digest('hex');
    },

    Ed25519KeyPair: class Ed25519KeyPairImpl {
      private privateKeyObj: KeyObject;
      private publicKeyBytes: Buffer;

      constructor() {
        const { privateKey, publicKey } = nodeCrypto.generateKeyPairSync('ed25519');
        this.privateKeyObj = privateKey;
        // Extract raw 32-byte public key from SPKI format
        const spki = publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
        this.publicKeyBytes = spki.slice(-32);
      }

      static from_secret(_secret: Uint8Array): Ed25519KeyPairInstance {
        const instance = new Ed25519KeyPairImpl();
        return instance;
      }

      secret_key(): Uint8Array {
        const pkcs8 = this.privateKeyObj.export({ type: 'pkcs8', format: 'der' }) as Buffer;
        return new Uint8Array(pkcs8);
      }

      public_key(): Uint8Array {
        return new Uint8Array(this.publicKeyBytes);
      }

      public_key_hex(): string {
        return this.publicKeyBytes.toString('hex');
      }

      sign(message: Uint8Array): Uint8Array {
        // Use the KeyObject directly for Ed25519 signing
        return new Uint8Array(nodeCrypto.sign(null, Buffer.from(message), this.privateKeyObj));
      }

      sign_hex(message: Uint8Array): string {
        return Buffer.from(this.sign(message)).toString('hex');
      }
    } as unknown as CryptoModule['Ed25519KeyPair'],

    ed25519_verify(
      publicKey: Uint8Array,
      message: Uint8Array,
      signature: Uint8Array
    ): boolean {
      try {
        // Create KeyObject from raw 32-byte public key using SPKI DER format
        const pubKeyObj = nodeCrypto.createPublicKey({
          key: Buffer.concat([
            Buffer.from('302a300506032b6570032100', 'hex'),
            Buffer.from(publicKey),
          ]),
          format: 'der',
          type: 'spki',
        });
        // Use the direct verify function for Ed25519
        return nodeCrypto.verify(null, Buffer.from(message), pubKeyObj, Buffer.from(signature));
      } catch {
        return false;
      }
    },

    ed25519_verify_hex(
      publicKeyHex: string,
      message: Uint8Array,
      signatureHex: string
    ): boolean {
      const publicKey = Buffer.from(publicKeyHex, 'hex');
      const signature = Buffer.from(signatureHex, 'hex');
      return fallback.ed25519_verify(publicKey, message, signature);
    },

    compute_agent_fingerprint(
      agentId: string,
      name: string,
      createdAt: string
    ): string {
      const data = `${agentId}:${name}:${createdAt}`;
      return fallback.sha384_hex(new TextEncoder().encode(data));
    },

    compute_state_hash(stateJson: string): string {
      return fallback.blake3_hex(new TextEncoder().encode(stateJson));
    },

    batch_hash(items: Uint8Array[], algorithm: HashAlgorithm): string[] {
      return items.map((item) => fallback.hash_hex(item, algorithm));
    },

    batch_verify(
      publicKeys: Uint8Array[],
      messages: Uint8Array[],
      signatures: Uint8Array[]
    ): boolean[] {
      return publicKeys.map((pk, i) =>
        fallback.ed25519_verify(pk, messages[i], signatures[i])
      );
    },

    hmac_sha256(key: Uint8Array, data: Uint8Array): Uint8Array {
      const hmac = nodeCrypto.createHmac('sha256', Buffer.from(key));
      hmac.update(Buffer.from(data));
      return new Uint8Array(hmac.digest());
    },

    hmac_sha384(key: Uint8Array, data: Uint8Array): Uint8Array {
      const hmac = nodeCrypto.createHmac('sha384', Buffer.from(key));
      hmac.update(Buffer.from(data));
      return new Uint8Array(hmac.digest());
    },

    hmac_sha512(key: Uint8Array, data: Uint8Array): Uint8Array {
      const hmac = nodeCrypto.createHmac('sha512', Buffer.from(key));
      hmac.update(Buffer.from(data));
      return new Uint8Array(hmac.digest());
    },

    hkdf_sha256(
      ikm: Uint8Array,
      salt: Uint8Array,
      info: Uint8Array,
      length: number
    ): Uint8Array {
      const derivedKey = nodeCrypto.hkdfSync(
        'sha256',
        Buffer.from(ikm),
        Buffer.from(salt),
        Buffer.from(info),
        length
      );
      return new Uint8Array(derivedKey);
    },

    constant_time_eq(a: Uint8Array, b: Uint8Array): boolean {
      if (a.length !== b.length) return false;
      return nodeCrypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    },

    random_bytes(length: number): Uint8Array {
      return new Uint8Array(nodeCrypto.randomBytes(length));
    },

    random_hex(length: number): string {
      return nodeCrypto.randomBytes(length).toString('hex');
    },

    IncrementalHasher: class IncrementalHasherImpl {
      private h: ReturnType<typeof nodeCrypto.createHash>;

      constructor(algorithm: HashAlgorithm) {
        const hashName = algorithmMap[algorithm];
        this.h = nodeCrypto.createHash(hashName);
      }

      update(data: Uint8Array): void {
        this.h.update(Buffer.from(data));
      }

      finalize(): Uint8Array {
        return new Uint8Array(this.h.digest());
      }

      finalize_hex(): string {
        return this.h.digest('hex');
      }
    } as unknown as CryptoModule['IncrementalHasher'],
  };

  return fallback;
}

// Convenience wrapper class
export class ChrysalisCrypto {
  private module: CryptoModule;

  private constructor(module: CryptoModule) {
    this.module = module;
  }

  static async create(): Promise<ChrysalisCrypto> {
    const module = await initCrypto();
    return new ChrysalisCrypto(module);
  }

  // Hash functions
  sha384(data: string | Uint8Array): string {
    const bytes =
      typeof data === 'string' ? new TextEncoder().encode(data) : data;
    return this.module.sha384_hex(bytes);
  }

  blake3(data: string | Uint8Array): string {
    const bytes =
      typeof data === 'string' ? new TextEncoder().encode(data) : data;
    return this.module.blake3_hex(bytes);
  }

  hash(data: string | Uint8Array, algorithm: HashAlgorithm): string {
    const bytes =
      typeof data === 'string' ? new TextEncoder().encode(data) : data;
    return this.module.hash_hex(bytes, algorithm);
  }

  // Signatures
  generateKeyPair(): Ed25519KeyPairInstance {
    return new this.module.Ed25519KeyPair();
  }

  sign(keyPair: Ed25519KeyPairInstance, message: string | Uint8Array): string {
    const bytes =
      typeof message === 'string' ? new TextEncoder().encode(message) : message;
    return keyPair.sign_hex(bytes);
  }

  verify(
    publicKeyHex: string,
    message: string | Uint8Array,
    signatureHex: string
  ): boolean {
    const bytes =
      typeof message === 'string' ? new TextEncoder().encode(message) : message;
    return this.module.ed25519_verify_hex(publicKeyHex, bytes, signatureHex);
  }

  // Agent operations
  computeAgentFingerprint(
    agentId: string,
    name: string,
    createdAt: string
  ): string {
    return this.module.compute_agent_fingerprint(agentId, name, createdAt);
  }

  computeStateHash(state: object): string {
    return this.module.compute_state_hash(JSON.stringify(state));
  }

  // Utilities
  randomBytes(length: number): Uint8Array {
    return this.module.random_bytes(length);
  }

  randomHex(length: number): string {
    return this.module.random_hex(length);
  }

  constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
    return this.module.constant_time_eq(a, b);
  }
}

export default ChrysalisCrypto;