import { FrameworkAdapterV2 } from '../core/FrameworkAdapterV2';
import type { UniformSemanticAgentV2, ValidationResult } from '../core/UniformSemanticAgentV2';
import type { EncryptedShadow } from '../core/FrameworkAdapter';

class NotImplementedError extends Error {
  constructor(method: string) {
    super(`NotImplementedError: ElizaOSAdapter.${method} is not implemented. ElizaOS integration requires @elizaos/core package.`);
    this.name = 'NotImplementedError';
  }
}

/**
 * ElizaOS adapter placeholder - not implemented.
 * 
 * This class exists only to satisfy legacy imports and will throw on all operations.
 * Real ElizaOS integration requires the @elizaos/core package.
 * 
 * @throws {NotImplementedError} All methods throw - ElizaOS integration required
 */
export class ElizaOSAdapter extends FrameworkAdapterV2 {
  readonly name = 'eliza';
  readonly version = '0.1.0';
  readonly supports_shadow = false;
  readonly supports_experience_sync = false;

  async toUniversal(_agent: any): Promise<UniformSemanticAgentV2> {
    throw new NotImplementedError('toUniversal');
  }

  async fromUniversal(_universalAgent: UniformSemanticAgentV2): Promise<any> {
    throw new NotImplementedError('fromUniversal');
  }

  async embedShadow(_frameworkAgent: any): Promise<any> {
    throw new NotImplementedError('embedShadow');
  }

  async extractShadow(): Promise<EncryptedShadow | null> {
    throw new NotImplementedError('extractShadow');
  }

  async validate(): Promise<ValidationResult> {
    throw new NotImplementedError('validate');
  }
}
