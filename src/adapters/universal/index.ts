/**
 * Universal LLM-Powered Adapter
 * 
 * A single adapter that translates between ALL agent protocols by:
 * 1. Using semantic category mapping (IDENTITY, CAPABILITIES, INSTRUCTIONS, STATE, etc.)
 * 2. Fetching protocol specifications from registered URLs (with fallbacks)
 * 3. Applying mapping principles via LLM prompts
 * 4. Returning the translated agent representation
 * 
 * This replaces 22 hand-coded adapters with one LLM-delegated adapter.
 * 
 * KEY INSIGHT: Map by the MEANING of the category in the schema, not by field names.
 * "tool" in MCP === "skill" in A2A === "function" in OpenAI === "action" in LMOS
 * 
 * ## Version History
 * - v1.0: Basic adapter with simple registry and prompts
 * - v2.0: Enhanced adapter with semantic categories, morphing, caching, verification
 * 
 * @module adapters/universal
 * @version 2.0.0
 */

import { MAPPING_PRINCIPLES_PROMPT, buildTranslationPrompt } from './prompts';

// ============================================================================
// Protocol Specification Registry
// ============================================================================

/**
 * Registry of agent framework specifications.
 * 
 * Each entry contains:
 * - name: Human-readable protocol name
 * - specUrl: URL to the official JSON Schema / OpenAPI spec
 * - docsUrl: URL to human-readable documentation
 * 
 * Adding a new protocol = adding a URL entry (no code required)
 */
export const PROTOCOL_REGISTRY: Record<string, ProtocolEntry> = {
  // Chrysalis Native Format (internal)
  usa: {
    name: 'Uniform Semantic Agent',
    specUrl: 'https://raw.githubusercontent.com/chrysalis-ai/schemas/main/usa/v2.0/schema.json',
    docsUrl: 'https://chrysalis.dev/docs/usa'
  },
  
  // Anthropic Model Context Protocol
  mcp: {
    name: 'Model Context Protocol',
    specUrl: 'https://raw.githubusercontent.com/modelcontextprotocol/specification/main/schema/schema.json',
    docsUrl: 'https://spec.modelcontextprotocol.io/'
  },
  
  // Google Agent-to-Agent Protocol
  a2a: {
    name: 'Agent-to-Agent Protocol',
    specUrl: 'https://raw.githubusercontent.com/google/A2A/main/specification/json/a2a.json',
    docsUrl: 'https://google.github.io/A2A/'
  },
  
  // Agent Network Protocol
  anp: {
    name: 'Agent Network Protocol',
    specUrl: 'https://agent-network-protocol.org/spec/v1/schema.json',
    docsUrl: 'https://agent-network-protocol.org/'
  },
  
  // Eclipse LMOS
  lmos: {
    name: 'Eclipse LMOS',
    specUrl: 'https://eclipse.dev/lmos/api/agent-spec.json',
    docsUrl: 'https://eclipse.dev/lmos/'
  },
  
  // LangChain
  langchain: {
    name: 'LangChain Agent',
    specUrl: 'https://api.python.langchain.com/schemas/agent.json',
    docsUrl: 'https://python.langchain.com/docs/'
  },
  
  // CrewAI
  crewai: {
    name: 'CrewAI Agent',
    specUrl: 'https://docs.crewai.com/api/schemas/agent.json',
    docsUrl: 'https://docs.crewai.com/'
  },
  
  // OpenAI Assistants API
  openai: {
    name: 'OpenAI Assistants',
    specUrl: 'https://raw.githubusercontent.com/openai/openai-openapi/master/openapi.yaml',
    docsUrl: 'https://platform.openai.com/docs/assistants/overview'
  },
  
  // Microsoft AutoGen
  autogen: {
    name: 'Microsoft AutoGen',
    specUrl: 'https://microsoft.github.io/autogen/schemas/agent.json',
    docsUrl: 'https://microsoft.github.io/autogen/'
  }
};

// ============================================================================
// Types (Minimal)
// ============================================================================

/**
 * Protocol identifier - keys from PROTOCOL_REGISTRY
 */
export type ProtocolId = keyof typeof PROTOCOL_REGISTRY | string;

/**
 * Protocol specification entry
 */
export interface ProtocolSpec {
  name: string;
  specUrl: string;
  docsUrl: string;
}

/** @deprecated Use ProtocolSpec instead */
export type ProtocolEntry = ProtocolSpec;

export interface TranslationResult {
  /** Translated agent data */
  result: Record<string, unknown>;
  /** Source protocol */
  sourceProtocol: string;
  /** Target protocol */
  targetProtocol: string;
  /** Translation confidence (0-1) */
  confidence: number;
  /** Fields that couldn't be mapped */
  unmappedFields: string[];
  /** Any warnings */
  warnings: string[];
}

export interface LLMProvider {
  /** Complete a prompt and return JSON */
  complete(prompt: string): Promise<Record<string, unknown>>;
}

// ============================================================================
// Universal Adapter
// ============================================================================

/**
 * Universal Adapter - One adapter for all protocols
 * 
 * Instead of hand-coding transformation logic, this adapter:
 * 1. Fetches specs from URLs
 * 2. Builds a prompt with mapping principles
 * 3. Delegates translation to an LLM
 */
export class UniversalAdapter {
  private llm: LLMProvider;
  private specCache: Map<string, string> = new Map();

  constructor(llm: LLMProvider) {
    this.llm = llm;
  }

  /**
   * Translate agent from one protocol to another
   */
  async translate(
    agent: Record<string, unknown>,
    sourceProtocol: string,
    targetProtocol: string
  ): Promise<TranslationResult> {
    // 1. Get protocol specs
    const sourceSpec = await this.getSpec(sourceProtocol);
    const targetSpec = await this.getSpec(targetProtocol);

    // 2. Build prompt with mapping principles + specs + agent data
    const prompt = buildTranslationPrompt(
      agent,
      sourceProtocol,
      targetProtocol,
      sourceSpec,
      targetSpec
    );

    // 3. Delegate to LLM
    const response = await this.llm.complete(prompt);

    // 4. Return structured result
    return {
      result: response.translatedAgent as Record<string, unknown>,
      sourceProtocol,
      targetProtocol,
      confidence: (response.confidence as number) || 0.9,
      unmappedFields: (response.unmappedFields as string[]) || [],
      warnings: (response.warnings as string[]) || []
    };
  }

  /**
   * Validate agent against protocol spec
   */
  async validate(
    agent: Record<string, unknown>,
    protocol: string
  ): Promise<{ valid: boolean; errors: string[] }> {
    const spec = await this.getSpec(protocol);
    
    const prompt = `
You are a schema validator. Given the following JSON Schema for the ${protocol} protocol:

${spec}

Validate this agent data:

${JSON.stringify(agent, null, 2)}

Return JSON with:
- valid: boolean
- errors: string[] (list of validation errors, empty if valid)
`;

    const response = await this.llm.complete(prompt);
    return {
      valid: (response.valid as boolean) ?? false,
      errors: (response.errors as string[]) ?? []
    };
  }

  /**
   * List available protocols
   */
  listProtocols(): Array<{ id: string; name: string; docsUrl: string }> {
    return Object.entries(PROTOCOL_REGISTRY).map(([id, entry]) => ({
      id,
      name: entry.name,
      docsUrl: entry.docsUrl
    }));
  }

  /**
   * Register a custom protocol
   */
  registerProtocol(id: string, entry: ProtocolEntry): void {
    PROTOCOL_REGISTRY[id] = entry;
  }

  /**
   * Fetch and cache protocol specification
   */
  private async getSpec(protocol: string): Promise<string> {
    // Check cache
    if (this.specCache.has(protocol)) {
      return this.specCache.get(protocol)!;
    }

    // Get registry entry
    const entry = PROTOCOL_REGISTRY[protocol];
    if (!entry) {
      throw new Error(`Unknown protocol: ${protocol}. Available: ${Object.keys(PROTOCOL_REGISTRY).join(', ')}`);
    }

    // Fetch spec
    try {
      const response = await fetch(entry.specUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch spec: ${response.status}`);
      }
      const spec = await response.text();
      this.specCache.set(protocol, spec);
      return spec;
    } catch (error) {
      // Return placeholder if fetch fails (LLM can still work with docs URL)
      const fallback = `Protocol: ${entry.name}\nDocumentation: ${entry.docsUrl}\nSpec URL: ${entry.specUrl}`;
      this.specCache.set(protocol, fallback);
      return fallback;
    }
  }

  /**
   * Clear cached specs
   */
  clearCache(): void {
    this.specCache.clear();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a universal adapter with the given LLM provider
 */
export function createUniversalAdapter(llm: LLMProvider): UniversalAdapter {
  return new UniversalAdapter(llm);
}

// ============================================================================
// V2 Exports (RECOMMENDED)
// ============================================================================

/**
 * V2 Adapter - Enhanced version with:
 * - Semantic category mapping
 * - Protocol-specific hints
 * - Agent morphing
 * - Intelligent caching with TTL
 * - Bidirectional verification
 * - Field mapping learning
 */
export {
  // Main class
  UniversalAdapterV2,
  
  // Factory functions
  createUniversalAdapterV2,
  createSimpleAdapter,
  
  // Types
  type LLMProviderV2,
  type TranslationResultV2,
  type MorphingResult,
  type UniversalAdapterV2Config
} from './adapter-v2';

// V2 Registry with semantic hints
export {
  PROTOCOL_REGISTRY_V2,
  type ProtocolEntryV2,
  type SemanticHints,
  type MinimalSchema,
  getRegisteredProtocols,
  getProtocol,
  getProtocolsByTrustLevel,
  isProtocolRegistered,
  getSemanticHints,
  getSpecUrls
} from './registry-v2';

// V2 Prompts with semantic categories
export {
  SEMANTIC_CATEGORIES,
  MAPPING_PRINCIPLES_COMPACT,
  buildTranslationPromptV2,
  buildValidationPromptV2,
  buildCapabilityDiscoveryPromptV2,
  buildFieldMappingPromptV2,
  buildAgentMorphingPrompt
} from './prompts-v2';

// V1 Prompts (legacy compatibility)
export {
  MAPPING_PRINCIPLES_PROMPT,
  buildTranslationPrompt,
  buildValidationPrompt,
  buildCapabilityDiscoveryPrompt,
  buildFieldMappingPrompt
} from './prompts';

// Full types
export * from './types';

// Gateway Bridge (for connecting to Go LLM Gateway)
export {
  GatewayLLMProvider,
  createGatewayAdapter,
  getSharedAdapter,
  resetSharedAdapter,
  quickTranslate,
  quickMorph
} from './gateway-bridge';

// ============================================================================
// Default Export
// ============================================================================

export default UniversalAdapter;