/**
 * Gateway-Universal Adapter Bridge
 * 
 * Connects the Universal Adapter V2 to the Go LLM Gateway,
 * enabling protocol translation with local Ollama models.
 * 
 * @module adapters/universal/gateway-bridge
 */

import { GatewayLLMClient } from '../../services/gateway/GatewayLLMClient';
import { UniversalAdapterV2, createUniversalAdapterV2, type LLMProviderV2 } from './adapter-v2';
import { DEFAULT_ADA_MODEL } from '../../config/ollama-models';
import { createLogger } from '../../shared/logger';

const log = createLogger('gateway-bridge');

/**
 * Gateway LLM Provider for Universal Adapter
 * 
 * Adapts GatewayLLMClient to the LLMProviderV2 interface
 */
export class GatewayLLMProvider implements LLMProviderV2 {
  name = 'gateway';
  
  constructor(
    private client: GatewayLLMClient,
    private agentId: string = 'universal-adapter',
    private model?: string
  ) {}

  async complete(prompt: string, options?: {
    responseFormat?: 'text' | 'json';
    maxTokens?: number;
    temperature?: number;
    timeoutMs?: number;
  }) {
    const messages = [
      {
        role: 'system' as const,
        content: 'You are a protocol translation expert. Respond with valid JSON only.'
      },
      {
        role: 'user' as const,
        content: prompt
      }
    ];

    try {
      const response = await this.client.chat({
        agentId: this.agentId,
        messages,
        temperature: options?.temperature ?? 0.1,
        model: this.model,
        maxTokens: options?.maxTokens,
      });

      // Parse JSON response
      let json: Record<string, unknown> | undefined;
      try {
        json = JSON.parse(response.content);
      } catch (error) {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = response.content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          json = JSON.parse(jsonMatch[1].trim());
        }
      }

      return {
        content: response.content,
        json,
        metadata: {
          model: response.model,
          provider: response.provider,
        }
      };
    } catch (error) {
      log.error('Gateway LLM call failed', { error, prompt: prompt.slice(0, 200) });
      throw error;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Simple ping test
      const response = await this.client.chat({
        agentId: 'health-check',
        messages: [{ role: 'user', content: 'ping' }],
        temperature: 0,
        model: this.model,
      });
      return response.content.length > 0;
    } catch {
      return false;
    }
  }
}

/**
 * Create Universal Adapter connected to Gateway
 */
export function createGatewayAdapter(options?: {
  gatewayBaseUrl?: string;
  gatewayModel?: string;
  agentId?: string;
  enableSpecCache?: boolean;
  enableMappingCache?: boolean;
  enableVerification?: boolean;
}): UniversalAdapterV2 {
  const client = new GatewayLLMClient({
    baseUrl: options?.gatewayBaseUrl || 'http://localhost:8080',
    defaultModel: options?.gatewayModel || DEFAULT_ADA_MODEL
  });

  const provider = new GatewayLLMProvider(
    client,
    options?.agentId || 'universal-adapter',
    options?.gatewayModel || DEFAULT_ADA_MODEL
  );

  return createUniversalAdapterV2(provider, {
    enableSpecCache: options?.enableSpecCache ?? true,
    enableMappingCache: options?.enableMappingCache ?? true,
    enableVerification: options?.enableVerification ?? false,
    fetchSpecs: true // Allow network fetches
  });
}

/**
 * Singleton instance for shared use
 */
let sharedAdapter: UniversalAdapterV2 | null = null;

/**
 * Get or create shared adapter instance
 */
export function getSharedAdapter(options?: Parameters<typeof createGatewayAdapter>[0]): UniversalAdapterV2 {
  if (!sharedAdapter) {
    sharedAdapter = createGatewayAdapter(options);
    log.info('Created shared Universal Adapter instance', {
      model: options?.gatewayModel || DEFAULT_ADA_MODEL,
      gatewayUrl: options?.gatewayBaseUrl || 'http://localhost:8080'
    });
  }
  return sharedAdapter;
}

/**
 * Reset shared adapter (useful for testing)
 */
export function resetSharedAdapter(): void {
  sharedAdapter = null;
}

/**
 * Quick translation helper using shared adapter
 */
export async function quickTranslate(
  agent: Record<string, unknown>,
  from: string,
  to: string
) {
  const adapter = getSharedAdapter();
  return adapter.translate(agent, from, to);
}

/**
 * Quick morphing helper using shared adapter
 */
export async function quickMorph(
  agent: Record<string, unknown>,
  from: string,
  to: string,
  options?: Parameters<UniversalAdapterV2['morph']>[3]
) {
  const adapter = getSharedAdapter();
  return adapter.morph(agent, from, to, options);
}

export default {
  createGatewayAdapter,
  getSharedAdapter,
  resetSharedAdapter,
  quickTranslate,
  quickMorph,
  GatewayLLMProvider
};