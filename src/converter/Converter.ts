// @ts-nocheck
/**
 * Uniform Semantic Agent Converter - Main conversion logic
 *
 * Handles bidirectional conversion between any two frameworks
 * using framework-specific adapters and encrypted shadow fields.
 */

import * as crypto from 'crypto';
import type { SemanticAgent } from '../core/SemanticAgent';
import type { FrameworkAdapter, ShadowData, EncryptedShadow } from '../core/FrameworkAdapter';
import {
  encryptShadow,
  decryptShadow,
  generateFingerprint,
  generateRestorationKey,
  encrypt,
  generateChecksum,
  createSignature as createCryptoSignature
} from '../core/Encryption';

/**
 * Conversion options
 */
export interface ConversionOptions {
  privateKey?: string;    // For signing shadow data
  includeOriginal?: boolean;  // Include complete original in shadow
  includeUniversal?: boolean; // Include universal representation in shadow
}

/**
 * Conversion result
 */
export interface ConversionResult {
  agent: any;                     // Converted agent
  universal: SemanticAgent;      // Universal representation
  restorationKey: string;         // Key for restoration
  metadata: {
    from: string;                 // Source framework
    to: string;                   // Target framework
    timestamp: number;
    fingerprint: string;
  };
}

/**
 * Restoration options
 */
export interface RestorationOptions {
  publicKey?: string;        // For verifying signature
  mergeChanges?: boolean;    // Merge changes from morphed agent
}

/**
 * Uniform Semantic Agent Converter
 */
export class Converter {
  /**
   * Convert agent from one framework to another
   */
  async convert(
    sourceAgent: any,
    fromAdapter: FrameworkAdapter,
    toAdapter: FrameworkAdapter,
    options: ConversionOptions = {}
  ): Promise<ConversionResult> {
    console.log(`Converting from ${fromAdapter.name} to ${toAdapter.name}...`);

    // 1. Validate source agent
    const validation = await fromAdapter.validate(sourceAgent);
    if (!validation.valid) {
      throw new Error(
        `Invalid source agent:\n${validation.errors.join('\n')}`
      );
    }

    // 2. Convert to universal format
    console.log('  → Converting to universal format...');
    const universal = await fromAdapter.toUniversal(sourceAgent);

    // 3. Ensure fingerprint exists
    if (!universal.identity.fingerprint) {
      universal.identity.fingerprint = generateFingerprint(universal.identity);
    }

    // 4. Convert to target framework
    console.log('  → Converting to target framework...');
    let targetAgent = await toAdapter.fromUniversal(universal);

    // 5. Create shadow data if target supports it
    if (toAdapter.supports_shadow) {
      console.log('  → Creating encrypted shadow...');

      // Extract non-mappable fields
      const nonMappable = fromAdapter.getNonMappableFields(sourceAgent);

      // Create shadow data
      const shadowData: ShadowData = {
        framework: fromAdapter.name,
        version: fromAdapter.version,
        timestamp: Date.now(),
        data: {
          ...nonMappable,
          _original: sourceAgent,  // Always include
          _universal: universal     // Always include
        },
        checksum: ''  // Will be set below
      };

      // Add checksum to shadow data
      shadowData.checksum = generateChecksum(shadowData.data);

      // Encrypt shadow and get restoration key components
      const encryptionResult = encrypt(shadowData, universal.identity.fingerprint);

      // Create encrypted shadow with signature
      const encryptedShadow: EncryptedShadow = {
        encrypted: encryptionResult.encrypted,
        algorithm: 'aes-256-gcm',
        iv: encryptionResult.iv,
        authTag: encryptionResult.authTag,
        signature: options.privateKey
          ? this.createSignature(encryptionResult, universal.identity.fingerprint, options.privateKey)
          : this.createHashSignature(encryptionResult, universal.identity.fingerprint),
        metadata: {
          framework: fromAdapter.name,
          version: fromAdapter.version,
          timestamp: Date.now(),
          checksum: shadowData.checksum
        }
      };

      // Embed in target agent
      targetAgent = await toAdapter.embedShadow(targetAgent, encryptedShadow);

      // Generate restoration key
      const restorationKey = generateRestorationKey(
        encryptionResult.salt,
        encryptionResult.authTag
      );

      console.log('  ✓ Shadow embedded');

      return {
        agent: targetAgent,
        universal,
        restorationKey,
        metadata: {
          from: fromAdapter.name,
          to: toAdapter.name,
          timestamp: Date.now(),
          fingerprint: universal.identity.fingerprint
        }
      };
    } else {
      console.log('  ⚠ Target framework does not support shadow data');
      console.log('  ⚠ Non-mappable data will be lost');

      return {
        agent: targetAgent,
        universal,
        restorationKey: '',
        metadata: {
          from: fromAdapter.name,
          to: toAdapter.name,
          timestamp: Date.now(),
          fingerprint: universal.identity.fingerprint
        }
      };
    }
  }

  /**
   * Restore agent to original framework
   */
  async restore(
    morphedAgent: any,
    toAdapter: FrameworkAdapter,
    restorationKey: string,
    options: RestorationOptions = {}
  ): Promise<any> {
    console.log(`Restoring agent using ${toAdapter.name} adapter...`);

    // 1. Extract shadow
    console.log('  → Extracting shadow...');
    const shadow = await toAdapter.extractShadow(morphedAgent);

    if (!shadow) {
      throw new Error(
        'No shadow data found. This agent was not converted with morphing, ' +
        'or the target framework does not support shadow data.'
      );
    }

    // 2. Get Uniform Semantic Agent from morphed agent to get fingerprint
    const universal = await toAdapter.toUniversal(morphedAgent);
    const fingerprint = universal.identity.fingerprint;

    if (!fingerprint) {
      throw new Error('Cannot restore: agent has no fingerprint');
    }

    // 3. Decrypt shadow
    console.log('  → Decrypting shadow...');
    const decrypted = decryptShadow(
      shadow,
      restorationKey,
      fingerprint,
      options.publicKey
    );

    // 4. Verify framework match
    const expectedFramework = toAdapter.name;
    if (decrypted.framework !== expectedFramework) {
      throw new Error(
        `Framework mismatch: shadow is from '${decrypted.framework}' ` +
        `but trying to restore with '${expectedFramework}' adapter`
      );
    }

    // 5. Get original agent
    console.log('  → Restoring original agent...');
    let restored = decrypted.data._original;

    if (!restored) {
      throw new Error('Shadow does not contain original agent data');
    }

    // 6. Optionally merge changes
    if (options.mergeChanges) {
      console.log('  → Merging changes from morphed agent...');
      restored = await this.mergeChanges(restored, morphedAgent, toAdapter);
    }

    console.log('  ✓ Agent restored');

    return restored;
  }

  /**
   * Check if agent has shadow data
   */
  async hasShadow(agent: any, adapter: FrameworkAdapter): Promise<boolean> {
    try {
      const shadow = await adapter.extractShadow(agent);
      return shadow !== null;
    } catch (error) {
      // Log extraction failure for debugging but return false since shadow is optional
      console.debug('[Converter] Failed to extract shadow data:',
        error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Get shadow metadata without decrypting
   */
  async getShadowInfo(agent: any, adapter: FrameworkAdapter): Promise<{
    framework: string;
    version: string;
    timestamp: number;
  } | null> {
    const shadow = await adapter.extractShadow(agent);
    return shadow?.metadata || null;
  }

  /**
   * Extract restoration key components from encryption result
   * Note: This needs the encryptionResult which contains salt
   */
  private generateRestorationKeyFromEncryption(
    encryptionResult: { salt: string; authTag: string }
  ): string {
    return `${encryptionResult.salt}:${encryptionResult.authTag}`;
  }

  /**
   * Merge changes from morphed agent back into original
   */
  private async mergeChanges(
    original: any,
    morphed: any,
    adapter: FrameworkAdapter
  ): Promise<any> {
    // Convert both to universal format to identify changes
    const originalUniversal = await adapter.toUniversal(original);
    const morphedUniversal = await adapter.toUniversal(morphed);

    // Merge changes (simple approach - can be more sophisticated)
    const merged = { ...original };

    // Example: if bio/backstory changed, update it
    if (originalUniversal.identity.bio !== morphedUniversal.identity.bio) {
      // Update the bio in the original format
      // This is framework-specific and would need adapter support
    }

    return merged;
  }

  /**
   * Create signature from encryption result
   */
  private createSignature(
    encryptionResult: { encrypted: string; iv: string; authTag: string },
    fingerprint: string,
    privateKey: string
  ): string {
    const dataToSign = `${encryptionResult.encrypted}:${encryptionResult.iv}:${encryptionResult.authTag}:${fingerprint}`;
    return createCryptoSignature(dataToSign, privateKey);
  }

  /**
   * Create hash-based signature (fallback when no private key)
   */
  private createHashSignature(
    encryptionResult: { encrypted: string; iv: string; authTag: string },
    fingerprint: string
  ): string {
    const dataToSign = `${encryptionResult.encrypted}:${encryptionResult.iv}:${encryptionResult.authTag}:${fingerprint}`;
    return crypto.createHash('sha256').update(dataToSign).digest('base64');
  }
}

/**
 * Convenience function to create a converter
 */
export function createConverter(): Converter {
  return new Converter();
}
