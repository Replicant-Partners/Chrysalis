import { FrameworkAdapterV2 } from '../core/FrameworkAdapterV2';
import type { UniformSemanticAgentV2, ValidationResult } from '../core/UniformSemanticAgentV2';
import type { EncryptedShadow } from '../core/FrameworkAdapter';

class NotImplementedError extends Error {
  constructor(method: string) {
    super(`NotImplementedError: CrewAIAdapter.${method} is not implemented. CrewAI integration requires crewai-tools package.`);
    this.name = 'NotImplementedError';
  }
}

/**
 * CrewAI adapter placeholder - not implemented.
 * 
 * This class exists only to satisfy legacy imports and will throw on all operations.
 * Real CrewAI integration requires the crewai Python package and proper bindings.
 * 
 * @throws {NotImplementedError} All methods throw - CrewAI integration required
 */
export class CrewAIAdapter extends FrameworkAdapterV2 {
  readonly name = 'crewai';
  readonly version = '0.1.0';
  readonly supports_shadow = false;
  readonly supports_experience_sync = true;

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
