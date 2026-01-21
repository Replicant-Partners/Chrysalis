/**
 * Semantic Diff Analyzer for AI-Led Adaptive Maintenance
 *
 * This file is a facade that re-exports from the semantic-diff subdirectory.
 * For direct imports, use './semantic-diff' instead.
 */

export type {
  APISignature,
  ParameterSignature,
  SchemaDefinition,
  SchemaField,
  APISurfaceComparison,
  APIModification,
  APIChangeDetail,
  SchemaComparison,
  FieldModification,
  SemanticDiffConfig,
  BehavioralChange,
  FileContentChange,
  ExtendedAnalysisResult,
} from './semantic-diff';

export {
  parseAPIsFromContent,
  parseParameters,
  parseOpenAPIParameters,
  parseSchema,
  extractSchemaFields,
  parseTypeScriptFields,
  createFileChangesFromPaths,
  shouldIgnoreFile,
  isAPIRelatedFile,
  isSchemaFile,
  getDefaultConfig,
} from './semantic-diff';

export {
  apiSignaturesMatch,
  apiSignaturesEqual,
  compareAPISignatures,
  compareSchemas,
} from './semantic-diff';

export {
  detectErrorHandlingChanges,
  detectTimeoutChanges,
  detectAuthenticationChanges,
} from './semantic-diff';

export {
  SemanticDiffAnalyzer,
  createSemanticDiffAnalyzer,
  analyzeRepositoryChange,
} from './semantic-diff';
