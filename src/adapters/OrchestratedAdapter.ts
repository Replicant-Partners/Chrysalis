import { FrameworkAdapterV2 } from '../core/FrameworkAdapterV2';
import type { UniformSemanticAgentV2, ValidationResult } from '../core/UniformSemanticAgentV2';
import type { EncryptedShadow } from '../core/FrameworkAdapter';

class NotImplementedError extends Error {
  constructor(method: string) {
    super(`NotImplementedError: OrchestratedAdapter.${method} is not implemented. Orchestration requires real workflow engine.`);
    this.name = 'NotImplementedError';
  }
}

/**
 * Orchestrated adapter placeholder - not implemented.
 * 
 * This class exists only to satisfy legacy imports and will throw on all operations.
 * Real orchestration requires implementing actual workflow coordination logic.
 * 
 * @throws {NotImplementedError} All methods throw - orchestration engine required
 */
export class OrchestratedAdapter extends FrameworkAdapterV2 {
  readonly name = 'orchestrated';
  readonly version = '0.1.0';
  readonly supports_shadow = true;
  readonly supports_experience_sync = true;

  async toUniversal(_agent: any): Promise<UniformSemanticAgentV2> {
    throw new NotImplementedError('toUniversal');
  }

  async fromUniversal(_universalAgent: UniformSemanticAgentV2): Promise<any> {
    throw new NotImplementedError('fromUniversal');
  }

  async embedShadow(_frameworkAgent: any, _shadow: EncryptedShadow): Promise<any> {
    throw new NotImplementedError('embedShadow');
  }

  async extractShadow(_frameworkAgent: any): Promise<EncryptedShadow | null> {
    throw new NotImplementedError('extractShadow');
  }

  async validate(): Promise<ValidationResult> {
    throw new NotImplementedError('validate');
  }
}
