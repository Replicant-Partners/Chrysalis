/**
 * Pattern #2: Digital Signatures (Unforgeable Identity)
 * 
 * Universal Pattern: Unique identification
 * Natural Analogy: DNA sequences, fingerprints, biometric markers
 * Mathematical Property: Unforgeability (EUF-CMA security)
 * 
 * Application: Agent authentication, morph verification, identity proof
 */

import * as ed25519 from '@noble/ed25519';
import { bls12_381 as bls } from '@noble/curves/bls12-381';
import { sha512 } from '@noble/hashes/sha512';

// Enable synchronous methods
ed25519.etc.sha512Sync = (...m) => sha512(ed25519.etc.concatBytes(...m));

export type SignatureAlgorithm = 'ed25519' | 'bls12-381';

/**
 * Generate keypair
 */
export async function generateKeypair(
  algorithm: SignatureAlgorithm = 'ed25519'
): Promise<{ privateKey: Uint8Array; publicKey: Uint8Array }> {
  if (algorithm === 'ed25519') {
    const privateKey = ed25519.utils.randomPrivateKey();
    const publicKey = await ed25519.getPublicKey(privateKey);
    return { privateKey, publicKey };
  } else {
    // BLS12-381
    const privateKey = bls.utils.randomPrivateKey();
    const publicKey = bls.getPublicKey(privateKey);
    return { privateKey, publicKey };
  }
}

/**
 * Sign message
 */
export async function sign(
  message: Uint8Array | string,
  privateKey: Uint8Array,
  algorithm: SignatureAlgorithm = 'ed25519'
): Promise<Uint8Array> {
  const bytes = typeof message === 'string'
    ? new TextEncoder().encode(message)
    : message;
  
  if (algorithm === 'ed25519') {
    return await ed25519.sign(bytes, privateKey);
  } else {
    return bls.sign(bytes, privateKey);
  }
}

/**
 * Verify signature
 */
export async function verify(
  message: Uint8Array | string,
  signature: Uint8Array,
  publicKey: Uint8Array,
  algorithm: SignatureAlgorithm = 'ed25519'
): Promise<boolean> {
  const bytes = typeof message === 'string'
    ? new TextEncoder().encode(message)
    : message;
  
  try {
    if (algorithm === 'ed25519') {
      return await ed25519.verify(signature, bytes, publicKey);
    } else {
      return bls.verify(signature, bytes, publicKey);
    }
  } catch {
    return false;
  }
}

/**
 * Sign agent operation (Pattern #2 applied to agents)
 */
export async function signAgentOperation(
  operation: {
    type: string;
    agent_id: string;
    timestamp: number;
    data: any;
  },
  privateKey: Uint8Array
): Promise<Uint8Array> {
  // Canonicalize operation
  const canonical = JSON.stringify({
    type: operation.type,
    agent_id: operation.agent_id,
    timestamp: operation.timestamp,
    data: operation.data
  });
  
  return await sign(canonical, privateKey, 'ed25519');
}

/**
 * Verify agent signature
 */
export async function verifyAgentSignature(
  operation: any,
  signature: Uint8Array,
  publicKey: Uint8Array
): Promise<boolean> {
  const canonical = JSON.stringify(operation);
  return await verify(canonical, signature, publicKey, 'ed25519');
}

/**
 * BLS Signature Aggregation (for multi-instance verification)
 * From LAYER1_UNIVERSAL_PATTERNS_ANCHORED.md, Pattern 2
 */
export function aggregateSignatures(signatures: Uint8Array[]): Uint8Array {
  return bls.aggregateSignatures(signatures);
}

export function aggregatePublicKeys(publicKeys: Uint8Array[]): Uint8Array {
  // BLS allows public key aggregation
  const points = publicKeys.map(pk => bls.G1.ProjectivePoint.fromHex(pk));
  const aggregated = points.reduce((acc, point) => acc.add(point));
  return aggregated.toRawBytes();
}

export async function verifyAggregatedSignature(
  message: Uint8Array | string,
  aggregatedSignature: Uint8Array,
  aggregatedPublicKey: Uint8Array
): Promise<boolean> {
  return await verify(message, aggregatedSignature, aggregatedPublicKey, 'bls12-381');
}

/**
 * Detect equivocation (Pattern #2 application)
 * From DEEP_RESEARCH_SECURITY_ATTACKS.md, Attack 4
 */
export interface EquivocationEvidence {
  detected: boolean;
  event1?: any;
  event2?: any;
  creator: string;
}

export function detectEquivocation(
  events: Array<{ creator: string; round: number; hash: string; signature: Uint8Array }>,
  creator: string
): EquivocationEvidence {
  const creatorEvents = events.filter(e => e.creator === creator);
  
  // Group by round
  const byRound = new Map<number, any[]>();
  for (const event of creatorEvents) {
    if (!byRound.has(event.round)) {
      byRound.set(event.round, []);
    }
    byRound.get(event.round)!.push(event);
  }
  
  // Check for multiple events in same round
  for (const [round, roundEvents] of byRound) {
    if (roundEvents.length > 1) {
      // Multiple events in same round
      if (roundEvents[0].hash !== roundEvents[1].hash) {
        // Different events! Equivocation detected!
        return {
          detected: true,
          event1: roundEvents[0],
          event2: roundEvents[1],
          creator
        };
      }
    }
  }
  
  return { detected: false, creator };
}
