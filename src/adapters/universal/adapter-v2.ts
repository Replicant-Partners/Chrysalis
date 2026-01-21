/**
 * Universal LLM-Powered Adapter v2.0
 * 
 * An enhanced universal adapter that translates between ALL agent protocols by:
 * 1. Using semantic category mapping (IDENTITY, CAPABILITIES, INSTRUCTIONS, STATE, etc.)
 * 2. Leveraging protocol-specific semantic hints from registry-v2
 * 3. Supporting agent morphing for identity-preserving transformations
 * 4. Caching specs and field mappings with intelligent TTL management
 * 5. Verifying translations through bidirectional round-trip checks
 * 
 * KEY INSIGHT: Map by the MEANING of the category in the schema, not by field names.
 * "tool" in MCP === "skill" in A2A === "function" in OpenAI === "action" in LMOS
 * 
 * @module adapters/universal/adapter-v2
 * @version 2.0.0
 */

import {
  PROTOCOL_REGISTRY_V2,
  ProtocolEntryV2,
  SemanticHints,
  getProtocol,
  getSpecUrls,
  getSemanticHints,
  isProtocolRegistered,
  getRegisteredProtocols,
  getProtocolsByTrustLevel
} from './registry-v2';

import {
  SEMANTIC_CATEGORIES,
  MAPPING_PRINCIPLES_COMPACT,
  buildTranslationPromptV2,
  buildValidationPromptV2,
  buildCapabilityDiscoveryPromptV2,
  buildFieldMappingPromptV2,
  buildAgentMorphingPrompt
} from './prompts-v2';

import type {
  ProtocolId,
  TrustLevel,
  TranslationOptions,
  TranslationResult,
  ValidationResult,
  FieldMapping,
  LLMProvider,
  LLMCompletionOptions,
  LLMResponse,
  ProtocolCapabilities,
  ProtocolFeature,
  FeatureLevel,
  CacheKey,
  CachedMappings
} from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * LLM provider interface for v2 adapter
 */
export interface LLMProviderV2 {
  /** Provider name */
  name: string;
  
  /** Complete a prompt and return structured response */
  complete(prompt: string, options?: LLMCompletionOptions): Promise<LLMResponse>;
  
  /** Check if provider is available */
  isAvailable?(): Promise<boolean>;
}

/**
 * Spec cache entry with TTL tracking
 */
interface SpecCacheEntry {
  /** Cached specification content */
  content: string;
  
  /** Protocol entry this spec is for */
  protocol: ProtocolEntryV2;
  
  /** When the spec was fetched */
  fetchedAt: Date;
  
  /** When the cache expires */
  expiresAt: Date;
  
  /** Whether this is a fallback spec */
  isFallback: boolean;
  
  /** Source URL that was fetched */
  sourceUrl?: string;
}

/**
 * Field mapping cache with learning
 */
interface FieldMappingCache {
  /** Cache key (source -> target) */
  key: string;
  
  /** Learned field mappings */
  mappings: FieldMapping[];
  
  /** Number of successful uses */
  useCount: number;
  
  /** Average confidence across uses */
  avgConfidence: number;
  
  /** Last updated timestamp */
  updatedAt: Date;
}

/**
 * Translation result with full metadata
 */
export interface TranslationResultV2 {
  /** Translated agent data */
  translatedAgent: Record<string, unknown>;
  
  /** Source protocol */
  sourceProtocol: string;
  
  /** Target protocol */
  targetProtocol: string;
  
  /** Translation confidence (0-1) */
  confidence: number;
  
  /** Field mappings used */
  fieldMappings: FieldMapping[];
  
  /** Fields that couldn't be directly mapped (stored in extensions) */
  unmappedFields: string[];
  
  /** Warnings about the translation */
  warnings: string[];
  
  /** Whether translation was verified via round-trip */
  verified?: boolean;
  
  /** Round-trip fidelity score (if verified) */
  fidelityScore?: number;
  
  /** Translation duration in ms */
  durationMs: number;
  
  /** Cache hits used */
  cacheHits: {
    specCache: boolean;
    mappingCache: boolean;
  };
}

/**
 * Morphing result preserving agent identity
 */
export interface MorphingResult extends TranslationResultV2 {
  /** Morphing-specific report */
  morphingReport: {
    identityPreserved: boolean;
    capabilitiesCount: { source: number; target: number };
    instructionsTransferred: boolean;
    statePreserved: boolean;
    dataLoss: string[];
    transformations: Array<{
      field: string;
      action: string;
      from?: string;
      to?: string;
    }>;
  };
}

/**
 * Adapter configuration options
 */
export interface UniversalAdapterV2Config {
  /** LLM provider for translation */
  llm: LLMProviderV2;
  
  /** Enable spec caching (default: true) */
  enableSpecCache?: boolean;
  
  /** Enable field mapping caching (default: true) */
  enableMappingCache?: boolean;
  
  /** Enable bidirectional verification (default: false - expensive) */
  enableVerification?: boolean;
  
  /** Default timeout for LLM calls in ms (default: 30000) */
  defaultTimeoutMs?: number;
  
  /** Maximum cached specs (default: 50) */
  maxCachedSpecs?: number;
  
  /** Maximum cached mappings (default: 100) */
  maxCachedMappings?: number;
  
  /** Fetch specs over network (default: true, false uses fallback only) */
  fetchSpecs?: boolean;
}

// ============================================================================
// Universal Adapter V2
// ============================================================================

/**
 * Universal Adapter v2 - One adapter for all protocols
 * 
 * Enhanced version using semantic category mapping, protocol hints,
 * and intelligent caching.
 */
export class UniversalAdapterV2 {
  private llm: LLMProviderV2;
  private specCache: Map<string, SpecCacheEntry> = new Map();
  private mappingCache: Map<string, FieldMappingCache> = new Map();
  private config: Required<UniversalAdapterV2Config>;
  
  constructor(config: UniversalAdapterV2Config) {
    this.llm = config.llm;
    this.config = {
      llm: config.llm,
      enableSpecCache: config.enableSpecCache ?? true,
      enableMappingCache: config.enableMappingCache ?? true,
      enableVerification: config.enableVerification ?? false,
      defaultTimeoutMs: config.defaultTimeoutMs ?? 30000,
      maxCachedSpecs: config.maxCachedSpecs ?? 50,
      maxCachedMappings: config.maxCachedMappings ?? 100,
      fetchSpecs: config.fetchSpecs ?? true
    };
  }

  // ==========================================================================
  // Core Translation
  // ==========================================================================

  /**
   * Translate agent from one protocol to another
   */
  async translate(
    agent: Record<string, unknown>,
    sourceProtocol: string,
    targetProtocol: string,
    options?: TranslationOptions
  ): Promise<TranslationResultV2> {
    const startTime = Date.now();
    const cacheHits = { specCache: false, mappingCache: false };
    
    // 1. Get protocol entries
    const sourceEntry = this.getProtocolEntry(sourceProtocol);
    const targetEntry = this.getProtocolEntry(targetProtocol);
    
    // 2. Get protocol specs (with caching)
    const [sourceSpec, targetSpec] = await Promise.all([
      this.getSpec(sourceProtocol),
      this.getSpec(targetProtocol)
    ]);
    
    // Check if we got specs from cache
    if (this.specCache.has(sourceProtocol)) cacheHits.specCache = true;
    
    // 3. Check mapping cache for this protocol pair
    const cachedMappings = this.getCachedMappings(sourceProtocol, targetProtocol);
    if (cachedMappings) {
      cacheHits.mappingCache = true;
    }
    
    // 4. Build translation prompt
    const prompt = buildTranslationPromptV2(
      agent,
      sourceProtocol,
      targetProtocol,
      sourceEntry,
      targetEntry,
      sourceSpec.content,
      targetSpec.content
    );
    
    // 5. Call LLM for translation
    const response = await this.llm.complete(prompt, {
      responseFormat: 'json',
      maxTokens: 8192,
      temperature: 0.1, // Low temperature for consistent translations
      timeoutMs: options?.timeoutMs ?? this.config.defaultTimeoutMs
    });
    
    // 6. Parse response
    const parsed = this.parseTranslationResponse(response);
    
    // 7. Optionally verify via round-trip
    let verified = false;
    let fidelityScore: number | undefined;
    if (this.config.enableVerification || options?.includeConfidence) {
      const verificationResult = await this.verifyTranslation(
        agent,
        parsed.translatedAgent,
        sourceProtocol,
        targetProtocol
      );
      verified = verificationResult.success;
      fidelityScore = verificationResult.fidelityScore;
    }
    
    // 8. Update mapping cache
    if (this.config.enableMappingCache && parsed.fieldMappings) {
      this.updateMappingCache(sourceProtocol, targetProtocol, parsed.fieldMappings, parsed.confidence);
    }
    
    return {
      translatedAgent: parsed.translatedAgent,
      sourceProtocol,
      targetProtocol,
      confidence: parsed.confidence,
      fieldMappings: parsed.fieldMappings,
      unmappedFields: parsed.unmappedFields,
      warnings: parsed.warnings,
      verified,
      fidelityScore,
      durationMs: Date.now() - startTime,
      cacheHits
    };
  }

  /**
   * Morph agent while preserving identity across protocols
   * 
   * Morphing is a higher-fidelity translation that explicitly focuses on:
   * - Preserving agent identity (name, role, purpose)
   * - Maintaining capability equivalence
   * - Transferring behavioral instructions
   * - Minimizing data loss
   */
  async morph(
    agent: Record<string, unknown>,
    sourceProtocol: string,
    targetProtocol: string,
    options?: {
      preserveExtensions?: boolean;
      targetCapabilities?: string[];
      customMappings?: Record<string, string>;
    }
  ): Promise<MorphingResult> {
    const startTime = Date.now();
    
    // 1. Get protocol entries
    const sourceEntry = this.getProtocolEntry(sourceProtocol);
    const targetEntry = this.getProtocolEntry(targetProtocol);
    
    // 2. Build morphing prompt (more detailed than translation)
    const prompt = buildAgentMorphingPrompt(
      agent,
      sourceProtocol,
      targetProtocol,
      sourceEntry,
      targetEntry,
      options
    );
    
    // 3. Call LLM
    const response = await this.llm.complete(prompt, {
      responseFormat: 'json',
      maxTokens: 12000, // Larger for detailed morphing
      temperature: 0.1,
      timeoutMs: this.config.defaultTimeoutMs * 2 // More time for morphing
    });
    
    // 4. Parse morphing response
    const parsed = this.parseMorphingResponse(response);
    
    return {
      translatedAgent: parsed.morphedAgent,
      sourceProtocol,
      targetProtocol,
      confidence: parsed.confidence,
      fieldMappings: [],
      unmappedFields: [],
      warnings: parsed.warnings,
      durationMs: Date.now() - startTime,
      cacheHits: { specCache: false, mappingCache: false },
      morphingReport: parsed.morphingReport
    };
  }

  // ==========================================================================
  // Validation
  // ==========================================================================

  /**
   * Validate agent against protocol specification
   */
  async validate(
    agent: Record<string, unknown>,
    protocol: string
  ): Promise<ValidationResult> {
    const protocolEntry = this.getProtocolEntry(protocol);
    const spec = await this.getSpec(protocol);
    
    const prompt = buildValidationPromptV2(agent, protocolEntry, spec.content);
    
    const response = await this.llm.complete(prompt, {
      responseFormat: 'json',
      maxTokens: 2048,
      temperature: 0.1
    });
    
    return this.parseValidationResponse(response);
  }

  // ==========================================================================
  // Capability Discovery
  // ==========================================================================

  /**
   * Discover capabilities of a protocol
   */
  async discoverCapabilities(protocol: string): Promise<ProtocolCapabilities> {
    const protocolEntry = this.getProtocolEntry(protocol);
    const spec = await this.getSpec(protocol);
    
    const prompt = buildCapabilityDiscoveryPromptV2(protocolEntry, spec.content);
    
    const response = await this.llm.complete(prompt, {
      responseFormat: 'json',
      maxTokens: 2048,
      temperature: 0.1
    });
    
    return this.parseCapabilityResponse(response, protocol);
  }

  /**
   * Generate field mappings between two protocols
   */
  async generateFieldMappings(
    sourceProtocol: string,
    targetProtocol: string
  ): Promise<FieldMapping[]> {
    const sourceEntry = this.getProtocolEntry(sourceProtocol);
    const targetEntry = this.getProtocolEntry(targetProtocol);
    
    const [sourceSpec, targetSpec] = await Promise.all([
      this.getSpec(sourceProtocol),
      this.getSpec(targetProtocol)
    ]);
    
    const prompt = buildFieldMappingPromptV2(
      sourceEntry,
      targetEntry,
      sourceSpec.content,
      targetSpec.content
    );
    
    const response = await this.llm.complete(prompt, {
      responseFormat: 'json',
      maxTokens: 4096,
      temperature: 0.1
    });
    
    return this.parseFieldMappingsResponse(response);
  }

  // ==========================================================================
  // Protocol Registry
  // ==========================================================================

  /**
   * List all registered protocols
   */
  listProtocols(): Array<{
    id: string;
    name: string;
    version: string;
    trustLevel: TrustLevel;
    docsUrl: string;
  }> {
    return getRegisteredProtocols().map(id => {
      const entry = PROTOCOL_REGISTRY_V2[id];
      return {
        id,
        name: entry.name,
        version: entry.specVersion,
        trustLevel: entry.trustLevel,
        docsUrl: entry.docsUrl
      };
    });
  }

  /**
   * Get protocols by trust level
   */
  getProtocolsByTrust(level: TrustLevel): string[] {
    return getProtocolsByTrustLevel(level);
  }

  /**
   * Register a custom protocol
   */
  registerProtocol(id: string, entry: ProtocolEntryV2): void {
    PROTOCOL_REGISTRY_V2[id] = entry;
    // Clear any cached specs for this protocol
    this.specCache.delete(id);
  }

  /**
   * Get semantic hints for a protocol
   */
  getSemanticHints(protocol: string): SemanticHints | undefined {
    return getSemanticHints(protocol);
  }

  /**
   * Get semantic categories
   */
  getSemanticCategories(): typeof SEMANTIC_CATEGORIES {
    return SEMANTIC_CATEGORIES;
  }

  // ==========================================================================
  // Cache Management
  // ==========================================================================

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.specCache.clear();
    this.mappingCache.clear();
  }

  /**
   * Clear spec cache only
   */
  clearSpecCache(): void {
    this.specCache.clear();
  }

  /**
   * Clear mapping cache only
   */
  clearMappingCache(): void {
    this.mappingCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    specCache: { size: number; hitRate: number };
    mappingCache: { size: number; totalUses: number; avgConfidence: number };
  } {
    const mappingStats = Array.from(this.mappingCache.values());
    return {
      specCache: {
        size: this.specCache.size,
        hitRate: 0 // Would need to track hits/misses for accurate rate
      },
      mappingCache: {
        size: this.mappingCache.size,
        totalUses: mappingStats.reduce((sum, m) => sum + m.useCount, 0),
        avgConfidence: mappingStats.length > 0
          ? mappingStats.reduce((sum, m) => sum + m.avgConfidence, 0) / mappingStats.length
          : 0
      }
    };
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Get protocol entry or throw
   */
  private getProtocolEntry(protocol: string): ProtocolEntryV2 {
    const entry = getProtocol(protocol);
    if (!entry) {
      throw new Error(
        `Unknown protocol: ${protocol}. Available: ${getRegisteredProtocols().join(', ')}`
      );
    }
    return entry;
  }

  /**
   * Get spec for protocol with caching and fallback
   */
  private async getSpec(protocol: string): Promise<SpecCacheEntry> {
    const entry = this.getProtocolEntry(protocol);
    
    // Check cache
    if (this.config.enableSpecCache) {
      const cached = this.specCache.get(protocol);
      if (cached && cached.expiresAt > new Date()) {
        return cached;
      }
    }
    
    // Try to fetch spec
    let content: string;
    let isFallback = false;
    let sourceUrl: string | undefined;
    
    if (this.config.fetchSpecs) {
      const urls = getSpecUrls(protocol);
      
      for (const url of urls) {
        // Skip internal URLs
        if (url.startsWith('internal://')) continue;
        
        try {
          const response = await fetch(url, {
            signal: AbortSignal.timeout(10000) // 10 second timeout
          });
          
          if (response.ok) {
            content = await response.text();
            sourceUrl = url;
            break;
          }
        } catch (error) {
          // Try next URL
          continue;
        }
      }
    }
    
    // Fall back to embedded schema
    if (!content!) {
      if (entry.fallbackSchema) {
        content = JSON.stringify(entry.fallbackSchema, null, 2);
        isFallback = true;
      } else {
        // Last resort - create minimal spec from hints
        content = this.createMinimalSpec(entry);
        isFallback = true;
      }
    }
    
    // Cache the spec
    const cacheEntry: SpecCacheEntry = {
      content,
      protocol: entry,
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + entry.cacheTtl * 1000),
      isFallback,
      sourceUrl
    };
    
    if (this.config.enableSpecCache) {
      this.manageSpecCacheSize();
      this.specCache.set(protocol, cacheEntry);
    }
    
    return cacheEntry;
  }

  /**
   * Create minimal spec from semantic hints
   */
  private createMinimalSpec(entry: ProtocolEntryV2): string {
    const hints = entry.semanticHints;
    return JSON.stringify({
      protocol: entry.name,
      version: entry.specVersion,
      identityField: hints.identityField,
      capabilitiesField: hints.capabilitiesField,
      descriptionField: hints.descriptionField,
      extensionField: hints.extensionField,
      fieldMappings: hints.fieldMappings,
      notes: hints.notes
    }, null, 2);
  }

  /**
   * Manage spec cache size
   */
  private manageSpecCacheSize(): void {
    if (this.specCache.size >= this.config.maxCachedSpecs) {
      // Remove oldest entries
      const entries = Array.from(this.specCache.entries())
        .sort((a, b) => a[1].fetchedAt.getTime() - b[1].fetchedAt.getTime());
      
      const toRemove = entries.slice(0, Math.ceil(this.config.maxCachedSpecs * 0.2));
      for (const [key] of toRemove) {
        this.specCache.delete(key);
      }
    }
  }

  /**
   * Get cached field mappings for protocol pair
   */
  private getCachedMappings(source: string, target: string): FieldMappingCache | undefined {
    if (!this.config.enableMappingCache) return undefined;
    const key = `${source}:${target}`;
    return this.mappingCache.get(key);
  }

  /**
   * Update field mapping cache with new mappings
   */
  private updateMappingCache(
    source: string,
    target: string,
    mappings: FieldMapping[],
    confidence: number
  ): void {
    const key = `${source}:${target}`;
    const existing = this.mappingCache.get(key);
    
    if (existing) {
      // Update existing entry
      existing.mappings = this.mergeMappings(existing.mappings, mappings);
      existing.useCount++;
      existing.avgConfidence = (existing.avgConfidence * (existing.useCount - 1) + confidence) / existing.useCount;
      existing.updatedAt = new Date();
    } else {
      // Create new entry
      this.manageMappingCacheSize();
      this.mappingCache.set(key, {
        key,
        mappings,
        useCount: 1,
        avgConfidence: confidence,
        updatedAt: new Date()
      });
    }
  }

  /**
   * Merge new mappings with existing ones
   */
  private mergeMappings(existing: FieldMapping[], newMappings: FieldMapping[]): FieldMapping[] {
    const merged = new Map<string, FieldMapping>();
    
    for (const mapping of existing) {
      merged.set(`${mapping.source}:${mapping.target}`, mapping);
    }
    
    for (const mapping of newMappings) {
      const key = `${mapping.source}:${mapping.target}`;
      const existingMapping = merged.get(key);
      if (existingMapping) {
        // Average the confidence
        existingMapping.confidence = (existingMapping.confidence + mapping.confidence) / 2;
      } else {
        merged.set(key, mapping);
      }
    }
    
    return Array.from(merged.values());
  }

  /**
   * Manage mapping cache size
   */
  private manageMappingCacheSize(): void {
    if (this.mappingCache.size >= this.config.maxCachedMappings) {
      // Remove least used entries
      const entries = Array.from(this.mappingCache.entries())
        .sort((a, b) => a[1].useCount - b[1].useCount);
      
      const toRemove = entries.slice(0, Math.ceil(this.config.maxCachedMappings * 0.2));
      for (const [key] of toRemove) {
        this.mappingCache.delete(key);
      }
    }
  }

  /**
   * Verify translation via round-trip
   */
  private async verifyTranslation(
    originalAgent: Record<string, unknown>,
    translatedAgent: Record<string, unknown>,
    sourceProtocol: string,
    targetProtocol: string
  ): Promise<{ success: boolean; fidelityScore: number }> {
    try {
      // Translate back to source protocol
      const roundTrip = await this.translate(
        translatedAgent,
        targetProtocol,
        sourceProtocol,
        { includeConfidence: false } // Avoid infinite recursion
      );
      
      // Calculate fidelity score
      const fidelityScore = this.calculateFidelity(originalAgent, roundTrip.translatedAgent);
      
      return {
        success: fidelityScore >= 0.8, // 80% threshold
        fidelityScore
      };
    } catch {
      return { success: false, fidelityScore: 0 };
    }
  }

  /**
   * Calculate fidelity score between original and round-tripped agent
   */
  private calculateFidelity(original: Record<string, unknown>, roundTripped: Record<string, unknown>): number {
    // Simple field comparison - could be enhanced with semantic comparison
    const originalFields = this.flattenObject(original);
    const roundTrippedFields = this.flattenObject(roundTripped);
    
    const allKeys = new Set([...Object.keys(originalFields), ...Object.keys(roundTrippedFields)]);
    let matches = 0;
    
    for (const key of allKeys) {
      if (key.startsWith('_')) continue; // Skip extension fields
      
      const origValue = originalFields[key];
      const rtValue = roundTrippedFields[key];
      
      if (origValue === rtValue) {
        matches++;
      } else if (
        typeof origValue === 'string' &&
        typeof rtValue === 'string' &&
        origValue.toLowerCase() === rtValue.toLowerCase()
      ) {
        matches += 0.9; // Case-insensitive match
      }
    }
    
    return allKeys.size > 0 ? matches / allKeys.size : 1;
  }

  /**
   * Flatten nested object to dot-notation keys
   */
  private flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
    const result: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, this.flattenObject(value as Record<string, unknown>, newKey));
      } else {
        result[newKey] = String(value);
      }
    }
    
    return result;
  }

  // ==========================================================================
  // Response Parsers
  // ==========================================================================

  /**
   * Parse translation response from LLM
   */
  private parseTranslationResponse(response: LLMResponse): {
    translatedAgent: Record<string, unknown>;
    confidence: number;
    fieldMappings: FieldMapping[];
    unmappedFields: string[];
    warnings: string[];
  } {
    const json = response.json || this.parseJson(response.content);
    
    return {
      translatedAgent: (json.translatedAgent as Record<string, unknown>) || {},
      confidence: (json.confidence as number) || 0.8,
      fieldMappings: (json.fieldMappings as FieldMapping[]) || [],
      unmappedFields: (json.unmappedFields as string[]) || [],
      warnings: (json.warnings as string[]) || []
    };
  }

  /**
   * Parse morphing response from LLM
   */
  private parseMorphingResponse(response: LLMResponse): {
    morphedAgent: Record<string, unknown>;
    confidence: number;
    warnings: string[];
    morphingReport: MorphingResult['morphingReport'];
  } {
    const json = response.json || this.parseJson(response.content);
    
    return {
      morphedAgent: (json.morphedAgent as Record<string, unknown>) || {},
      confidence: (json.confidence as number) || 0.8,
      warnings: (json.warnings as string[]) || [],
      morphingReport: (json.morphingReport as MorphingResult['morphingReport']) || {
        identityPreserved: true,
        capabilitiesCount: { source: 0, target: 0 },
        instructionsTransferred: true,
        statePreserved: true,
        dataLoss: [],
        transformations: []
      }
    };
  }

  /**
   * Parse validation response from LLM
   */
  private parseValidationResponse(response: LLMResponse): ValidationResult {
    const json = response.json || this.parseJson(response.content);
    
    return {
      valid: (json.valid as boolean) ?? false,
      errors: (json.errors as ValidationResult['errors']) || [],
      warnings: (json.warnings as ValidationResult['warnings']) || []
    };
  }

  /**
   * Parse capability discovery response from LLM
   */
  private parseCapabilityResponse(response: LLMResponse, protocol: string): ProtocolCapabilities {
    const json = response.json || this.parseJson(response.content);
    
    const features = new Map<ProtocolFeature, FeatureLevel>();
    const featureMap = json.features as Record<string, string> || {};
    
    for (const [feature, level] of Object.entries(featureMap)) {
      features.set(feature as ProtocolFeature, level as FeatureLevel);
    }
    
    return {
      protocol,
      features
    };
  }

  /**
   * Parse field mappings response from LLM
   */
  private parseFieldMappingsResponse(response: LLMResponse): FieldMapping[] {
    const json = response.json || this.parseJson(response.content);
    return (json.mappings as FieldMapping[]) || [];
  }

  /**
   * Safely parse JSON from string
   */
  private parseJson(content: string): Record<string, unknown> {
    try {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1].trim());
      }
      return JSON.parse(content);
    } catch {
      return {};
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a universal adapter v2 with the given LLM provider
 */
export function createUniversalAdapterV2(
  llm: LLMProviderV2,
  options?: Omit<UniversalAdapterV2Config, 'llm'>
): UniversalAdapterV2 {
  return new UniversalAdapterV2({
    llm,
    ...options
  });
}

/**
 * Create a universal adapter v2 with simple LLM interface
 * (Convenience wrapper for basic use cases)
 */
export function createSimpleAdapter(
  complete: (prompt: string) => Promise<Record<string, unknown>>
): UniversalAdapterV2 {
  return new UniversalAdapterV2({
    llm: {
      name: 'simple',
      async complete(prompt: string): Promise<LLMResponse> {
        const result = await complete(prompt);
        return {
          content: JSON.stringify(result),
          json: result
        };
      }
    }
  });
}

// ============================================================================
// Default Export
// ============================================================================

export default UniversalAdapterV2;
