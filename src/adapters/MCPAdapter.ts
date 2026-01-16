import { FrameworkAdapterV2 } from '../core/FrameworkAdapterV2';
import type { UniformSemanticAgentV2, ValidationResult } from '../core/UniformSemanticAgentV2';
import type { EncryptedShadow } from '../core/FrameworkAdapter';

class NotImplementedError extends Error {
  constructor(method: string) {
    super(`NotImplementedError: MCPAdapter.${method} is not implemented. Use mcp-unified-adapter instead.`);
    this.name = 'NotImplementedError';
  }
}

/**
 * MCP adapter placeholder - not implemented.
 * 
 * Use MCPUnifiedAdapter from mcp-unified-adapter.ts for actual MCP integration.
 * This class exists only to satisfy legacy imports and will throw on all operations.
 * 
 * @throws {NotImplementedError} All methods throw - use MCPUnifiedAdapter instead
 */
export class MCPAdapter extends FrameworkAdapterV2 {
  readonly name = 'mcp';
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
