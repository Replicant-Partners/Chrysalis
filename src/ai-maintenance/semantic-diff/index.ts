/**
 * Semantic Diff Analysis Module
 *
 * Barrel exports for the semantic diff analyzer components.
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
} from './types';

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
} from './parsers';

export {
  apiSignaturesMatch,
  apiSignaturesEqual,
  compareAPISignatures,
  compareSchemas,
} from './comparators';

export {
  detectErrorHandlingChanges,
  detectTimeoutChanges,
  detectAuthenticationChanges,
} from './behavioral-detectors';

export {
  SemanticDiffAnalyzer,
  createSemanticDiffAnalyzer,
  analyzeRepositoryChange,
} from './analyzer';
