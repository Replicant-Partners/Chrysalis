/**
 * Types for Semantic Diff Analysis
 */

/**
 * Represents an API endpoint or function signature
 */
export interface APISignature {
  name: string;
  path?: string;
  method?: string;
  parameters: ParameterSignature[];
  returnType?: string;
  deprecated?: boolean;
  deprecationMessage?: string;
  version?: string;
}

/**
 * Parameter in an API signature
 */
export interface ParameterSignature {
  name: string;
  type: string;
  required: boolean;
  default?: unknown;
  description?: string;
}

/**
 * Schema definition for validation
 */
export interface SchemaDefinition {
  name: string;
  version: string;
  fields: SchemaField[];
  required: string[];
}

/**
 * Individual field in a schema
 */
export interface SchemaField {
  name: string;
  type: string;
  nullable?: boolean;
  enum?: string[];
  nested?: SchemaField[];
}

/**
 * Result of comparing two API surfaces
 */
export interface APISurfaceComparison {
  added: APISignature[];
  removed: APISignature[];
  modified: APIModification[];
  deprecated: APISignature[];
  undeprecated: APISignature[];
}

/**
 * Modification to an existing API
 */
export interface APIModification {
  before: APISignature;
  after: APISignature;
  changes: APIChangeDetail[];
  isBreaking: boolean;
}

/**
 * Specific change within an API modification
 */
export interface APIChangeDetail {
  type:
    | 'parameter_added'
    | 'parameter_removed'
    | 'parameter_type_changed'
    | 'return_type_changed'
    | 'path_changed'
    | 'method_changed'
    | 'required_changed'
    | 'default_changed';
  field: string;
  before?: unknown;
  after?: unknown;
  isBreaking: boolean;
  reason?: string;
}

/**
 * Result of comparing two schemas
 */
export interface SchemaComparison {
  added: SchemaField[];
  removed: SchemaField[];
  modified: FieldModification[];
  isCompatible: boolean;
  migrationRequired: boolean;
}

/**
 * Modification to a schema field
 */
export interface FieldModification {
  field: string;
  before: SchemaField;
  after: SchemaField;
  isBreaking: boolean;
  reason: string;
}

/**
 * Configuration for the semantic diff analyzer
 */
export interface SemanticDiffConfig {
  strictMode: boolean;
  detectBehavioralChanges: boolean;
  includeDocumentationChanges: boolean;
  ignorePatterns: string[];
  breakingChangeThreshold: number;
}

/**
 * Behavioral change that may not be visible in signatures
 */
export interface BehavioralChange {
  type: 'error_handling' | 'timeout' | 'retry' | 'authentication' | 'logging' | 'other';
  description: string;
  file: string;
  isPotentiallyBreaking: boolean;
  confidence: number;
  suggestedAction: string;
}

/**
 * File content change for analysis
 */
export interface FileContentChange {
  path: string;
  before?: string;
  after?: string;
}

/**
 * Extended analysis result
 */
export interface ExtendedAnalysisResult {
  repositoryId: string;
  changeId: string;
  analyzedAt: string;
  analysisTimeMs: number;

  apiSurfaceChanges: APISurfaceComparison;
  schemaComparison: SchemaComparison;
  behavioralChanges: BehavioralChange[];

  semanticDiff: import('../types').SemanticDiff;

  impactScore: number;
  summary: string;
  affectedAdapters: string[];
  recommendedActions: string[];
}
