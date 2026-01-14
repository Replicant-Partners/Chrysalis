/**
 * Types for Adapter Modification Generator
 * 
 * @module ai-maintenance/adapter-modification-generator/types
 */

import { ExtendedAnalysisResult } from '../semantic-diff-analyzer';
import { AgentFramework } from '../../adapters/protocol-types';
import { PatternMatch } from '../types';

/**
 * Configuration for the modification generator
 */
export interface GeneratorConfig {
  /** Generate tests for modifications */
  generateTests: boolean;
  /** Generate documentation updates */
  generateDocs: boolean;
  /** Maximum file changes per proposal */
  maxFileChanges: number;
  /** Include rollback procedure */
  includeRollback: boolean;
  /** Target code style/patterns */
  codeStyle: CodeStyleConfig;
  /** Template directory for code generation */
  templateDir?: string;
}

/**
 * Code style configuration
 */
export interface CodeStyleConfig {
  indentation: 'spaces' | 'tabs';
  indentSize: number;
  quotes: 'single' | 'double';
  semicolons: boolean;
  trailingCommas: boolean;
  maxLineLength: number;
}

/**
 * Context for generating modifications
 */
export interface GenerationContext {
  /** Protocol being modified */
  protocol: AgentFramework;
  /** Analysis result from semantic diff */
  analysis: ExtendedAnalysisResult;
  /** Matched patterns */
  patterns: PatternMatch[];
  /** Adapter file paths */
  adapterFiles: string[];
  /** Existing adapter content (file path -> content) */
  existingContent: Map<string, string>;
}

/**
 * Template for code generation
 */
export interface CodeTemplate {
  templateId: string;
  name: string;
  description: string;
  targetPattern: string;
  template: string;
  variables: TemplateVariable[];
}

/**
 * Variable in a code template
 */
export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: unknown;
}

/**
 * Result of modification generation
 */
export interface GenerationResult {
  success: boolean;
  proposal?: import('../types').ChangeProposal;
  errors: GenerationError[];
  warnings: string[];
  stats: GenerationStats;
}

/**
 * Error during generation
 */
export interface GenerationError {
  code: string;
  message: string;
  file?: string;
  line?: number;
  recoverable: boolean;
}

/**
 * Statistics about generation
 */
export interface GenerationStats {
  filesAnalyzed: number;
  filesModified: number;
  testsGenerated: number;
  docsGenerated: number;
  linesChanged: number;
  generationTimeMs: number;
}

/**
 * Planned modification before execution
 */
export interface PlannedModification {
  type: 'remove-api' | 'update-api' | 'deprecate-api' | 'migrate-schema' | 'apply-pattern';
  target: string;
  priority: number;
  template: string;
  variables: Record<string, unknown>;
}
