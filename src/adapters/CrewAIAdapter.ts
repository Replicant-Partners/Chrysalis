import { FrameworkAdapterV2 } from '../core/FrameworkAdapterV2';
import type { UniformSemanticAgentV2, ValidationResult } from '../core/UniformSemanticAgentV2';
import type { EncryptedShadow } from '../core/FrameworkAdapter';

/**
 * Placeholder CrewAI adapter to maintain backward compatibility.
 */
export class CrewAIAdapter extends FrameworkAdapterV2 {
  readonly name = 'crewai';
  readonly version = '0.1.0';
  readonly supports_shadow = false;
  readonly supports_experience_sync = true;

  async toUniversal(agent: any): Promise<UniformSemanticAgentV2> {
    return agent as UniformSemanticAgentV2;
  }

  async fromUniversal(universalAgent: UniformSemanticAgentV2): Promise<any> {
    return { ...universalAgent };
  }

  async embedShadow(frameworkAgent: any): Promise<any> {
    return frameworkAgent;
  }

  async extractShadow(): Promise<EncryptedShadow | null> {
    return null;
  }

  async validate(): Promise<ValidationResult> {
    return { valid: true, errors: [], warnings: [] };
  }
}
