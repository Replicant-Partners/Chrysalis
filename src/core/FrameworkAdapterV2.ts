/**
 * Framework Adapter V2 - For three-type agent system
 * 
 * Enhanced adapter interface supporting UniversalAgentV2 with
 * experience sync, instance management, and protocol stack.
 */

import type { UniversalAgentV2, ValidationResult } from './UniversalAgentV2';
import type { EncryptedShadow } from './FrameworkAdapter';

/**
 * Abstract Framework Adapter V2
 */
export abstract class FrameworkAdapterV2 {
  // Adapter metadata
  abstract readonly name: string;
  abstract readonly version: string;
  abstract readonly supports_shadow: boolean;
  abstract readonly supports_experience_sync: boolean;
  
  /**
   * Convert framework-specific agent to Universal Agent V2
   */
  abstract toUniversal(frameworkAgent: any): Promise<UniversalAgentV2>;
  
  /**
   * Convert Universal Agent V2 to framework-specific format
   */
  abstract fromUniversal(universalAgent: UniversalAgentV2): Promise<any>;
  
  /**
   * Embed encrypted shadow data in framework agent
   */
  abstract embedShadow(
    frameworkAgent: any,
    shadow: EncryptedShadow
  ): Promise<any>;
  
  /**
   * Extract encrypted shadow data from framework agent
   */
  abstract extractShadow(frameworkAgent: any): Promise<EncryptedShadow | null>;
  
  /**
   * Validate framework-specific agent
   */
  abstract validate(frameworkAgent: any): Promise<ValidationResult>;
  
  /**
   * Extract experience from instance (for sync)
   */
  async extractExperience?(
    frameworkAgent: any,
    since?: string
  ): Promise<any> {
    // Optional: Override if adapter supports experience extraction
    return null;
  }
}

/**
 * Type guard to check if object is a FrameworkAdapterV2
 */
export function isFrameworkAdapterV2(obj: any): obj is FrameworkAdapterV2 {
  return (
    typeof obj === 'object' &&
    'name' in obj &&
    'version' in obj &&
    'toUniversal' in obj &&
    'fromUniversal' in obj &&
    'embedShadow' in obj &&
    'extractShadow' in obj &&
    'validate' in obj &&
    'supports_experience_sync' in obj
  );
}
