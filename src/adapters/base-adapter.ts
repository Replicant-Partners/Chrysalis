/**
 * Chrysalis Universal Agent Bridge - Base Protocol Adapter
 * 
 * Abstract base class defining the contract for all framework-specific adapters.
 * Provides bidirectional translation between native formats and canonical RDF.
 * 
 * @module adapters/base-adapter
 * @version 1.0.0
 */

import {
  Quad,
  Subject,
  Predicate,
  QuadObject,
  NamedNode,
  Literal,
  BlankNode,
  Term,
  DataFactory,
  CHRYSALIS_NS,
  RDF_NS,
  RDFS_NS,
  XSD_NS,
  PROV_NS,
  chrysalis,
  rdf,
  xsd
} from '../rdf/temporal-store';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Supported agent specification frameworks
 */
export type AgentFramework = 
  | 'usa'       // Chrysalis Uniform Semantic Agent
  | 'lmos'      // Eclipse LMOS Protocol
  | 'mcp'       // Anthropic Model Context Protocol
  | 'langchain' // LangChain Agent
  | 'openai'    // OpenAI Function Calling
  | 'autogpt'   // AutoGPT
  | 'semantic-kernel'; // Microsoft Semantic Kernel

/**
 * Native agent representation (framework-specific JSON/object)
 *
 * P2 Type Safety: Generic type parameter allows type-safe data access
 * when the specific framework type is known at compile time.
 *
 * @typeParam TData - Framework-specific data type (defaults to Record<string, unknown>)
 */
export interface NativeAgent<TData extends Record<string, unknown> = Record<string, unknown>> {
  /** Raw JSON/object from the source framework */
  data: TData;
  /** Source framework identifier */
  framework: AgentFramework;
  /** Original format version (if available) */
  version?: string;
  /** Source URI/path (if available) */
  source?: string;
}

// ============================================================================
// Framework Type Guards (P2 Type Safety)
// ============================================================================

/**
 * USA Agent data structure for type-safe access
 */
export interface USAAgentData extends Record<string, unknown> {
  id?: string;
  name?: string;
  description?: string;
  version?: string;
  tools?: Array<{
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  }>;
  memory?: {
    type?: string;
    config?: Record<string, unknown>;
  };
  llm?: {
    provider?: string;
    model?: string;
  };
}

/**
 * LMOS Agent data structure for type-safe access
 */
export interface LMOSAgentData extends Record<string, unknown> {
  id?: string;
  name?: string;
  description?: string;
  version?: string;
  capabilities?: Array<{
    name: string;
    type?: string;
    parameters?: Record<string, unknown>;
  }>;
  protocols?: string[];
}

/**
 * Type guard to check if agent is a USA framework agent
 *
 * @param agent - Agent to check
 * @returns True if agent.framework is 'usa'
 */
export function isUSAAgent(agent: NativeAgent): agent is NativeAgent<USAAgentData> {
  return agent.framework === 'usa';
}

/**
 * Type guard to check if agent is an LMOS framework agent
 *
 * @param agent - Agent to check
 * @returns True if agent.framework is 'lmos'
 */
export function isLMOSAgent(agent: NativeAgent): agent is NativeAgent<LMOSAgentData> {
  return agent.framework === 'lmos';
}

/**
 * Type guard to check if agent is an MCP framework agent
 *
 * @param agent - Agent to check
 * @returns True if agent.framework is 'mcp'
 */
export function isMCPAgent(agent: NativeAgent): agent is NativeAgent {
  return agent.framework === 'mcp';
}

/**
 * Type guard to check if agent is a LangChain framework agent
 *
 * @param agent - Agent to check
 * @returns True if agent.framework is 'langchain'
 */
export function isLangChainAgent(agent: NativeAgent): agent is NativeAgent {
  return agent.framework === 'langchain';
}

/**
 * Canonical RDF representation of an agent
 */
export interface CanonicalAgent {
  /** Agent identifier (URI) */
  uri: string;
  /** RDF quads representing the agent */
  quads: Quad[];
  /** Framework that produced this canonical form */
  sourceFramework: AgentFramework;
  /** Extension properties that couldn't be mapped canonically */
  extensions: ExtensionProperty[];
  /** Translation metadata */
  metadata: TranslationMetadata;
}

/**
 * Extension property for framework-specific data
 */
export interface ExtensionProperty {
  /** Extension namespace prefix */
  namespace: string;
  /** Property local name */
  property: string;
  /** Property value (JSON-serialized if complex) */
  value: string;
  /** Original path in source document */
  sourcePath: string;
}

/**
 * Metadata about a translation operation
 */
export interface TranslationMetadata {
  /** Semantic fidelity score (0.0 - 1.0) */
  fidelityScore: number;
  /** Fields that were successfully mapped */
  mappedFields: string[];
  /** Fields that couldn't be mapped (moved to extensions) */
  unmappedFields: string[];
  /** Fields that were lost (no suitable mapping) */
  lostFields: string[];
  /** Translation warnings */
  warnings: TranslationWarning[];
  /** Translation timestamp */
  timestamp: Date;
  /** Translation duration in milliseconds */
  durationMs: number;
  /** Adapter version used */
  adapterVersion: string;
}

/**
 * Warning generated during translation
 */
export interface TranslationWarning {
  /** Warning severity */
  severity: 'info' | 'warning' | 'error';
  /** Warning code for programmatic handling */
  code: string;
  /** Human-readable message */
  message: string;
  /** Source path that triggered the warning */
  sourcePath?: string;
}

/**
 * Field mapping definition
 */
export interface FieldMapping {
  /** Source field path (dot notation) */
  sourcePath: string;
  /** Target RDF predicate */
  predicate: string;
  /** Target datatype or 'uri' for references */
  datatype: string;
  /** Whether the field is required */
  required: boolean;
  /** Transform function name (if any) */
  transform?: string;
  /** Default value if missing */
  defaultValue?: string | number | boolean;
}

/**
 * Adapter validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors */
  errors: ValidationError[];
  /** Validation warnings */
  warnings: ValidationWarning[];
}

/**
 * Validation error detail
 */
export interface ValidationError {
  /** Error code */
  code: string;
  /** Human-readable message */
  message: string;
  /** Path to the problematic field */
  path: string;
  /** Expected value/type */
  expected?: string;
  /** Actual value/type */
  actual?: string;
}

/**
 * Validation warning detail
 */
export interface ValidationWarning {
  /** Warning code */
  code: string;
  /** Human-readable message */
  message: string;
  /** Path to the field */
  path: string;
}

/**
 * Adapter configuration options
 */
export interface AdapterConfig {
  /** Strict mode - fail on any unmapped fields */
  strict?: boolean;
  /** Preserve all extensions (even if not standard) */
  preserveExtensions?: boolean;
  /** Custom field mappings to override defaults */
  customMappings?: FieldMapping[];
  /** Minimum acceptable fidelity score (default 0.7) */
  minFidelityScore?: number;
  /** Include provenance triples */
  includeProvenance?: boolean;
  /** Extension namespace URI for this adapter */
  extensionNamespace?: string;
}

/**
 * Round-trip test result
 */
export interface RoundTripResult {
  /** Whether round-trip succeeded */
  success: boolean;
  /** Original native agent */
  original: NativeAgent;
  /** Canonical form */
  canonical: CanonicalAgent;
  /** Reconstructed native agent */
  reconstructed: NativeAgent;
  /** Semantic diff between original and reconstructed */
  diff: SemanticDiff;
  /** Overall fidelity score */
  fidelityScore: number;
}

/**
 * Semantic difference between two agent representations
 */
export interface SemanticDiff {
  /** Fields present in original but missing in reconstructed */
  missing: string[];
  /** Fields present in reconstructed but not in original */
  added: string[];
  /** Fields with different values */
  changed: Array<{
    path: string;
    originalValue: unknown;
    newValue: unknown;
  }>;
  /** Fields that are semantically equivalent despite format differences */
  equivalent: string[];
}

// ============================================================================
// Abstract Base Adapter Class
// ============================================================================

/**
 * Abstract base class for all framework-specific adapters.
 * 
 * Subclasses must implement:
 * - toCanonical(): Convert native format to canonical RDF
 * - fromCanonical(): Convert canonical RDF back to native format
 * - validateNative(): Validate native format structure
 * - getFieldMappings(): Return the field mapping definitions
 */
export abstract class BaseAdapter {
  /** Framework identifier this adapter handles */
  abstract readonly framework: AgentFramework;
  
  /** Human-readable adapter name */
  abstract readonly name: string;
  
  /** Adapter version */
  abstract readonly version: string;
  
  /** Extension namespace URI for this framework */
  abstract readonly extensionNamespace: string;

  /** Adapter configuration */
  protected config: AdapterConfig;

  /** Cached field mappings */
  private _fieldMappings: FieldMapping[] | null = null;

  constructor(config: AdapterConfig = {}) {
    this.config = {
      strict: false,
      preserveExtensions: true,
      minFidelityScore: 0.7,
      includeProvenance: true,
      ...config
    };
  }

  // ==========================================================================
  // Abstract Methods (must be implemented by subclasses)
  // ==========================================================================

  /**
   * Convert native agent format to canonical RDF representation
   */
  abstract toCanonical(native: NativeAgent): Promise<CanonicalAgent>;

  /**
   * Convert canonical RDF representation to native agent format
   */
  abstract fromCanonical(canonical: CanonicalAgent): Promise<NativeAgent>;

  /**
   * Validate native agent format
   */
  abstract validateNative(native: NativeAgent): ValidationResult;

  /**
   * Get field mapping definitions for this framework
   */
  abstract getFieldMappings(): FieldMapping[];

  // ==========================================================================
  // Common Template Methods
  // ==========================================================================

  /**
   * Perform round-trip translation test
   */
  async roundTrip(native: NativeAgent): Promise<RoundTripResult> {
    const startTime = Date.now();
    
    // Forward translation
    const canonical = await this.toCanonical(native);
    
    // Reverse translation
    const reconstructed = await this.fromCanonical(canonical);
    
    // Compute semantic diff
    const diff = this.computeSemanticDiff(native, reconstructed);
    
    // Calculate fidelity
    const fidelityScore = this.calculateRoundTripFidelity(native, reconstructed, diff);
    
    return {
      success: fidelityScore >= (this.config.minFidelityScore ?? 0.7),
      original: native,
      canonical,
      reconstructed,
      diff,
      fidelityScore
    };
  }

  /**
   * Validate canonical representation
   */
  validateCanonical(canonical: CanonicalAgent): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check URI
    if (!canonical.uri || !canonical.uri.startsWith('https://')) {
      errors.push({
        code: 'INVALID_URI',
        message: 'Agent URI must be a valid HTTPS URI',
        path: 'uri',
        expected: 'https://*',
        actual: canonical.uri
      });
    }

    // Check for required triples
    const hasType = canonical.quads.some(q => 
      q.predicate.value === `${RDF_NS}type` &&
      q.object.value === `${CHRYSALIS_NS}Agent`
    );
    if (!hasType) {
      errors.push({
        code: 'MISSING_TYPE',
        message: 'Agent must have rdf:type chrysalis:Agent',
        path: 'quads'
      });
    }

    const hasName = canonical.quads.some(q =>
      q.predicate.value === `${CHRYSALIS_NS}name`
    );
    if (!hasName) {
      errors.push({
        code: 'MISSING_NAME',
        message: 'Agent must have chrysalis:name property',
        path: 'quads'
      });
    }

    const hasIdentity = canonical.quads.some(q =>
      q.predicate.value === `${CHRYSALIS_NS}hasIdentity`
    );
    if (!hasIdentity) {
      warnings.push({
        code: 'MISSING_IDENTITY',
        message: 'Agent should have chrysalis:hasIdentity property',
        path: 'quads'
      });
    }

    // Check fidelity score
    if (canonical.metadata.fidelityScore < (this.config.minFidelityScore ?? 0.7)) {
      warnings.push({
        code: 'LOW_FIDELITY',
        message: `Fidelity score ${canonical.metadata.fidelityScore} is below threshold`,
        path: 'metadata.fidelityScore'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // ==========================================================================
  // Protected Helper Methods (for use by subclasses)
  // ==========================================================================

  /**
   * Create a named node from a URI
   */
  protected uri(value: string): NamedNode {
    return DataFactory.namedNode(value);
  }

  /**
   * Create a literal with optional datatype
   */
  protected literal(value: string | number | boolean, datatype?: string): Literal {
    const strValue = String(value);
    if (datatype) {
      return DataFactory.literal(strValue, DataFactory.namedNode(datatype));
    }
    
    // Infer datatype from value
    if (typeof value === 'boolean') {
      return DataFactory.literal(strValue, DataFactory.namedNode(`${XSD_NS}boolean`));
    }
    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        return DataFactory.literal(strValue, DataFactory.namedNode(`${XSD_NS}integer`));
      }
      return DataFactory.literal(strValue, DataFactory.namedNode(`${XSD_NS}float`));
    }
    return DataFactory.literal(strValue);
  }

  /**
   * Create a blank node
   */
  protected blank(id?: string): BlankNode {
    return DataFactory.blankNode(id);
  }

  /**
   * Create a quad
   */
  protected quad(
    subject: Subject,
    predicate: NamedNode,
    object: QuadObject
  ): Quad {
    return DataFactory.quad(subject, predicate, object, DataFactory.defaultGraph());
  }

  /**
   * Generate a unique agent URI
   */
  protected generateAgentUri(agentId: string): string {
    return `https://chrysalis.dev/agent/${encodeURIComponent(agentId)}`;
  }

  /**
   * Generate a unique blank node ID
   */
  protected generateBlankId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get value at a nested path in an object
   */
  protected getPath(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    
    return current;
  }

  /**
   * Set value at a nested path in an object
   */
  protected setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split('.');
    let current: Record<string, unknown> = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }
    
    current[parts[parts.length - 1]] = value;
  }

  /**
   * Extract literal value from quads
   */
  protected extractLiteral(quads: Quad[], subject: string, predicate: string): string | null {
    const quad = quads.find(q => 
      q.subject.value === subject && 
      q.predicate.value === predicate &&
      q.object.termType === 'Literal'
    );
    return quad ? quad.object.value : null;
  }

  /**
   * Extract all literal values for a predicate
   */
  protected extractLiterals(quads: Quad[], subject: string, predicate: string): string[] {
    return quads
      .filter(q => 
        q.subject.value === subject && 
        q.predicate.value === predicate &&
        q.object.termType === 'Literal'
      )
      .map(q => q.object.value);
  }

  /**
   * Extract URI value from quads
   */
  protected extractUri(quads: Quad[], subject: string, predicate: string): string | null {
    const quad = quads.find(q => 
      q.subject.value === subject && 
      q.predicate.value === predicate &&
      q.object.termType === 'NamedNode'
    );
    return quad ? quad.object.value : null;
  }

  /**
   * Extract all URI values for a predicate
   */
  protected extractUris(quads: Quad[], subject: string, predicate: string): string[] {
    return quads
      .filter(q => 
        q.subject.value === subject && 
        q.predicate.value === predicate &&
        q.object.termType === 'NamedNode'
      )
      .map(q => q.object.value);
  }

  /**
   * Get all quads with a specific subject
   */
  protected getSubjectQuads(quads: Quad[], subject: string): Quad[] {
    return quads.filter(q => q.subject.value === subject);
  }

  /**
   * Create extension property
   */
  protected createExtension(
    namespace: string,
    property: string,
    value: unknown,
    sourcePath: string
  ): ExtensionProperty {
    return {
      namespace,
      property,
      value: typeof value === 'object' ? JSON.stringify(value) : String(value),
      sourcePath
    };
  }

  /**
   * Calculate fidelity score based on mapping results
   */
  protected calculateFidelity(
    mappedFields: string[],
    unmappedFields: string[],
    lostFields: string[],
    totalFields: number
  ): number {
    if (totalFields === 0) return 1.0;
    
    // Weights: mapped = 1.0, unmapped (preserved in extensions) = 0.5, lost = 0.0
    const score = (
      mappedFields.length * 1.0 +
      unmappedFields.length * 0.5 +
      lostFields.length * 0.0
    ) / totalFields;
    
    return Math.round(score * 1000) / 1000; // Round to 3 decimal places
  }

  /**
   * Create translation metadata
   */
  protected createMetadata(
    startTime: number,
    mappedFields: string[],
    unmappedFields: string[],
    lostFields: string[],
    warnings: TranslationWarning[] = []
  ): TranslationMetadata {
    const totalFields = mappedFields.length + unmappedFields.length + lostFields.length;
    
    return {
      fidelityScore: this.calculateFidelity(mappedFields, unmappedFields, lostFields, totalFields),
      mappedFields,
      unmappedFields,
      lostFields,
      warnings,
      timestamp: new Date(),
      durationMs: Date.now() - startTime,
      adapterVersion: this.version
    };
  }

  /**
   * Add provenance triples for translation activity
   */
  protected addProvenanceTriples(
    quads: Quad[],
    agentUri: string,
    canonical: CanonicalAgent
  ): void {
    if (!this.config.includeProvenance) return;

    const activityUri = `${agentUri}/translation/${Date.now()}`;
    const activity = this.uri(activityUri);

    // Translation activity
    quads.push(this.quad(
      activity,
      rdf('type'),
      chrysalis('TranslationActivity')
    ));

    quads.push(this.quad(
      activity,
      chrysalis('sourceFormat'),
      this.literal(canonical.sourceFramework)
    ));

    quads.push(this.quad(
      activity,
      chrysalis('targetFormat'),
      this.literal('canonical')
    ));

    quads.push(this.quad(
      activity,
      chrysalis('fidelityScore'),
      this.literal(canonical.metadata.fidelityScore, `${XSD_NS}float`)
    ));

    if (canonical.metadata.lostFields.length > 0) {
      quads.push(this.quad(
        activity,
        chrysalis('lostFields'),
        this.literal(JSON.stringify(canonical.metadata.lostFields))
      ));
    }

    quads.push(this.quad(
      activity,
      chrysalis('translationDuration'),
      this.literal(canonical.metadata.durationMs, `${XSD_NS}integer`)
    ));

    // Link agent to translation activity
    quads.push(this.quad(
      this.uri(agentUri),
      chrysalis('translatedBy'),
      activity
    ));
  }

  // ==========================================================================
  // Quad Creation Helpers (P1 Extraction from CODE_QUALITY_REVIEW)
  // ==========================================================================

  /**
   * Create a quad and track the mapped field in a single operation.
   * Reduces boilerplate in toCanonical() implementations.
   *
   * @param quads - Array to push the quad to
   * @param mappedFields - Array to track mapped field paths
   * @param subject - Quad subject
   * @param predicate - Quad predicate
   * @param object - Quad object
   * @param fieldPath - Source field path for tracking
   */
  protected addQuadWithTracking(
    quads: Quad[],
    mappedFields: string[],
    subject: Subject,
    predicate: NamedNode,
    object: QuadObject,
    fieldPath: string
  ): void {
    quads.push(this.quad(subject, predicate, object));
    mappedFields.push(fieldPath);
  }

  /**
   * Conditionally add a literal quad if value exists.
   * Returns true if quad was added, false otherwise.
   *
   * @param quads - Array to push the quad to
   * @param mappedFields - Array to track mapped field paths
   * @param subject - Quad subject
   * @param predicate - Quad predicate
   * @param value - Value to create literal from (if truthy)
   * @param fieldPath - Source field path for tracking
   * @param datatype - Optional XSD datatype URI
   * @returns true if quad was added
   */
  protected addOptionalLiteral(
    quads: Quad[],
    mappedFields: string[],
    subject: Subject,
    predicate: NamedNode,
    value: string | number | boolean | undefined | null,
    fieldPath: string,
    datatype?: string
  ): boolean {
    if (value === undefined || value === null || value === '') {
      return false;
    }
    quads.push(this.quad(subject, predicate, this.literal(value, datatype)));
    mappedFields.push(fieldPath);
    return true;
  }

  /**
   * Conditionally add a URI quad if value exists.
   * Returns true if quad was added, false otherwise.
   *
   * @param quads - Array to push the quad to
   * @param mappedFields - Array to track mapped field paths
   * @param subject - Quad subject
   * @param predicate - Quad predicate
   * @param uriValue - URI value (if truthy)
   * @param fieldPath - Source field path for tracking
   * @returns true if quad was added
   */
  protected addOptionalUri(
    quads: Quad[],
    mappedFields: string[],
    subject: Subject,
    predicate: NamedNode,
    uriValue: string | undefined | null,
    fieldPath: string
  ): boolean {
    if (!uriValue) {
      return false;
    }
    quads.push(this.quad(subject, predicate, this.uri(uriValue)));
    mappedFields.push(fieldPath);
    return true;
  }

  /**
   * Conditionally add a quad with any object type if value is defined.
   *
   * @param quads - Array to push the quad to
   * @param mappedFields - Array to track mapped field paths
   * @param subject - Quad subject
   * @param predicate - Quad predicate
   * @param object - Quad object (if truthy)
   * @param fieldPath - Source field path for tracking
   * @returns true if quad was added
   */
  protected addOptionalQuad(
    quads: Quad[],
    mappedFields: string[],
    subject: Subject,
    predicate: NamedNode,
    object: QuadObject | undefined | null,
    fieldPath: string
  ): boolean {
    if (!object) {
      return false;
    }
    quads.push(this.quad(subject, predicate, object));
    mappedFields.push(fieldPath);
    return true;
  }

  /**
   * Create a typed blank node connected to a parent subject.
   * Commonly used for nested structures like tools, memory components, etc.
   *
   * @param quads - Array to push quads to
   * @param parentSubject - Parent subject to link from
   * @param linkPredicate - Predicate linking parent to new node
   * @param typeUri - rdf:type value for the new node
   * @param idPrefix - Prefix for blank node ID generation
   * @returns The created blank node for further property addition
   */
  protected createTypedBlankNode(
    quads: Quad[],
    parentSubject: Subject,
    linkPredicate: NamedNode,
    typeUri: NamedNode,
    idPrefix: string
  ): BlankNode {
    const node = this.blank(this.generateBlankId(idPrefix));
    quads.push(this.quad(parentSubject, linkPredicate, node));
    quads.push(this.quad(node, rdf('type'), typeUri));
    return node;
  }

  /**
   * Create a typed named node (URI) connected to a parent subject.
   * Used when the nested resource has its own URI identity.
   *
   * @param quads - Array to push quads to
   * @param parentSubject - Parent subject to link from
   * @param linkPredicate - Predicate linking parent to new node
   * @param nodeUri - URI for the new node
   * @param typeUri - rdf:type value for the new node
   * @returns The created named node for further property addition
   */
  protected createTypedNamedNode(
    quads: Quad[],
    parentSubject: Subject,
    linkPredicate: NamedNode,
    nodeUri: string,
    typeUri: NamedNode
  ): NamedNode {
    const node = this.uri(nodeUri);
    quads.push(this.quad(parentSubject, linkPredicate, node));
    quads.push(this.quad(node, rdf('type'), typeUri));
    return node;
  }

  /**
   * Add multiple literal quads for an array of values.
   * Tracks as a single field path.
   *
   * @param quads - Array to push quads to
   * @param mappedFields - Array to track mapped field paths
   * @param subject - Quad subject
   * @param predicate - Quad predicate
   * @param values - Array of values
   * @param fieldPath - Source field path for tracking
   * @param datatype - Optional XSD datatype URI
   * @returns Number of quads added
   */
  protected addLiteralArray(
    quads: Quad[],
    mappedFields: string[],
    subject: Subject,
    predicate: NamedNode,
    values: (string | number | boolean)[] | undefined | null,
    fieldPath: string,
    datatype?: string
  ): number {
    if (!values || values.length === 0) {
      return 0;
    }
    for (const value of values) {
      quads.push(this.quad(subject, predicate, this.literal(value, datatype)));
    }
    mappedFields.push(fieldPath);
    return values.length;
  }

  /**
   * Add a JSON-serialized literal for complex objects.
   * Used for objects that can't be decomposed into individual triples.
   *
   * @param quads - Array to push quads to
   * @param mappedFields - Array to track mapped field paths
   * @param subject - Quad subject
   * @param predicate - Quad predicate
   * @param value - Object to serialize
   * @param fieldPath - Source field path for tracking
   * @returns true if quad was added
   */
  protected addJsonLiteral(
    quads: Quad[],
    mappedFields: string[],
    subject: Subject,
    predicate: NamedNode,
    value: unknown,
    fieldPath: string
  ): boolean {
    if (value === undefined || value === null) {
      return false;
    }
    const json = JSON.stringify(value);
    quads.push(this.quad(subject, predicate, this.literal(json)));
    mappedFields.push(fieldPath);
    return true;
  }

  // ==========================================================================
  // Extension Restoration Helpers (P2 Extraction from CODE_QUALITY_REVIEW)
  // ==========================================================================

  /**
   * Restore an extension value with JSON parsing.
   * Returns undefined if not found or parse fails.
   *
   * @param extensions - Array of extension properties
   * @param namespace - Extension namespace to match
   * @param property - Extension property name to match
   * @param defaultValue - Default value if not found
   * @returns Parsed value or default
   */
  protected restoreExtension<T>(
    extensions: ExtensionProperty[],
    namespace: string,
    property: string,
    defaultValue?: T
  ): T | undefined {
    const ext = extensions.find(e =>
      e.namespace === namespace && e.property === property
    );
    if (!ext) {
      return defaultValue;
    }
    try {
      return JSON.parse(ext.value) as T;
    } catch {
      // Try returning raw value if it's a simple string
      return ext.value as unknown as T;
    }
  }

  /**
   * Restore extension value directly into a target object property.
   *
   * @param target - Object to set property on
   * @param key - Property key to set
   * @param extensions - Array of extension properties
   * @param namespace - Extension namespace to match
   * @param property - Extension property name to match
   */
  protected restoreExtensionInto<T extends Record<string, unknown>, K extends keyof T>(
    target: T,
    key: K,
    extensions: ExtensionProperty[],
    namespace: string,
    property: string
  ): void {
    const value = this.restoreExtension<T[K]>(extensions, namespace, property);
    if (value !== undefined) {
      target[key] = value;
    }
  }

  /**
   * Restore extension value into a nested path.
   * Creates intermediate objects as needed.
   *
   * @param target - Root object
   * @param path - Dot-separated path to set
   * @param extensions - Array of extension properties
   * @param namespace - Extension namespace to match
   * @param property - Extension property name to match
   */
  protected restoreExtensionIntoPath(
    target: Record<string, unknown>,
    path: string,
    extensions: ExtensionProperty[],
    namespace: string,
    property: string
  ): void {
    const value = this.restoreExtension(extensions, namespace, property);
    if (value !== undefined) {
      this.setPath(target, path, value);
    }
  }

  /**
   * Batch restore multiple extensions into a target object.
   *
   * @param target - Object to set properties on
   * @param extensions - Array of extension properties
   * @param mappings - Array of [targetKey, namespace, property] tuples
   */
  protected restoreExtensionsBatch(
    target: Record<string, unknown>,
    extensions: ExtensionProperty[],
    mappings: Array<[string, string, string]>
  ): void {
    for (const [targetPath, namespace, property] of mappings) {
      this.restoreExtensionIntoPath(target, targetPath, extensions, namespace, property);
    }
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Compute semantic diff between original and reconstructed agents
   */
  private computeSemanticDiff(original: NativeAgent, reconstructed: NativeAgent): SemanticDiff {
    const missing: string[] = [];
    const added: string[] = [];
    const changed: Array<{ path: string; originalValue: unknown; newValue: unknown }> = [];
    const equivalent: string[] = [];

    const originalPaths = this.getAllPaths(original.data);
    const reconstructedPaths = this.getAllPaths(reconstructed.data);

    // Find missing fields
    for (const path of originalPaths) {
      if (!reconstructedPaths.includes(path)) {
        missing.push(path);
      }
    }

    // Find added fields
    for (const path of reconstructedPaths) {
      if (!originalPaths.includes(path)) {
        added.push(path);
      }
    }

    // Find changed and equivalent fields
    for (const path of originalPaths) {
      if (reconstructedPaths.includes(path)) {
        const origValue = this.getPath(original.data, path);
        const reconValue = this.getPath(reconstructed.data, path);
        
        if (this.semanticallyEqual(origValue, reconValue)) {
          equivalent.push(path);
        } else {
          changed.push({
            path,
            originalValue: origValue,
            newValue: reconValue
          });
        }
      }
    }

    return { missing, added, changed, equivalent };
  }

  /**
   * Get all leaf paths in an object
   */
  private getAllPaths(obj: Record<string, unknown>, prefix = ''): string[] {
    const paths: string[] = [];
    
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        paths.push(...this.getAllPaths(value as Record<string, unknown>, path));
      } else {
        paths.push(path);
      }
    }
    
    return paths;
  }

  /**
   * Check if two values are semantically equal
   */
  private semanticallyEqual(a: unknown, b: unknown): boolean {
    // Null/undefined equality
    if (a === null || a === undefined) {
      return b === null || b === undefined;
    }
    if (b === null || b === undefined) return false;

    // Type comparison
    if (typeof a !== typeof b) {
      // Allow string/number coercion for numeric strings
      if (typeof a === 'string' && typeof b === 'number') {
        return parseFloat(a) === b;
      }
      if (typeof a === 'number' && typeof b === 'string') {
        return a === parseFloat(b);
      }
      return false;
    }

    // Array comparison
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      // Order-independent comparison for arrays
      const sortedA = [...a].sort();
      const sortedB = [...b].sort();
      return sortedA.every((v, i) => this.semanticallyEqual(v, sortedB[i]));
    }

    // Object comparison
    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a as object);
      const keysB = Object.keys(b as object);
      if (keysA.length !== keysB.length) return false;
      return keysA.every(key => 
        this.semanticallyEqual(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key]
        )
      );
    }

    // Primitive comparison
    return a === b;
  }

  /**
   * Calculate round-trip fidelity score
   */
  private calculateRoundTripFidelity(
    original: NativeAgent,
    reconstructed: NativeAgent,
    diff: SemanticDiff
  ): number {
    const totalOriginal = this.getAllPaths(original.data).length;
    if (totalOriginal === 0) return 1.0;

    const preserved = diff.equivalent.length;
    const partialLoss = diff.changed.length * 0.5; // Changed fields count as 50%
    const fullLoss = diff.missing.length; // Missing fields count as 0%

    const score = (preserved + partialLoss) / (totalOriginal);
    return Math.round(Math.min(1.0, Math.max(0.0, score)) * 1000) / 1000;
  }
}

// ============================================================================
// Adapter Registry
// ============================================================================

/**
 * Global adapter registry for managing framework adapters
 */
export class AdapterRegistry {
  private static instance: AdapterRegistry;
  private adapters: Map<AgentFramework, BaseAdapter> = new Map();

  private constructor() {}

  /**
   * Get the singleton instance
   */
  static getInstance(): AdapterRegistry {
    if (!AdapterRegistry.instance) {
      AdapterRegistry.instance = new AdapterRegistry();
    }
    return AdapterRegistry.instance;
  }

  /**
   * Register an adapter for a framework
   */
  register(adapter: BaseAdapter): void {
    this.adapters.set(adapter.framework, adapter);
  }

  /**
   * Get adapter for a framework
   */
  get(framework: AgentFramework): BaseAdapter | undefined {
    return this.adapters.get(framework);
  }

  /**
   * Check if adapter exists for a framework
   */
  has(framework: AgentFramework): boolean {
    return this.adapters.has(framework);
  }

  /**
   * Get all registered framework identifiers
   */
  getFrameworks(): AgentFramework[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Get all registered adapters
   */
  getAll(): BaseAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Unregister an adapter
   */
  unregister(framework: AgentFramework): boolean {
    return this.adapters.delete(framework);
  }

  /**
   * Clear all registered adapters
   */
  clear(): void {
    this.adapters.clear();
  }
}

// ============================================================================
// Default Export
// ============================================================================

export const adapterRegistry = AdapterRegistry.getInstance();
