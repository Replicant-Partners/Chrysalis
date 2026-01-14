/**
 * Universal Quality Tool Adapter
 *
 * Implements the "Semantic Mediation via LLM Delegation" pattern:
 *
 * REGISTRY (declarative)  +  PROMPTS (semantic)  +  LLM (flexible)
 *         ↓                        ↓                      ↓
 *   Tool specs/hints      Parsing principles      Output interpreter
 *
 * Benefits:
 * - Add new tools by adding registry entries (no code)
 * - Handle any output format (JSON, text, SARIF)
 * - Graceful handling of malformed output
 * - Unified issue format across all tools
 *
 * @module quality/tools/universal
 * @version 1.0.0
 */

// Registry
export {
  TOOL_CATEGORIES,
  QUALITY_TOOL_REGISTRY,
  getTool,
  getToolsByLanguage,
  getToolsByCategory,
  listTools,
  type ToolCategory,
  type QualityToolEntry,
} from './registry';

// Prompts
export {
  OUTPUT_PARSING_PRINCIPLES,
  buildOutputParsePrompt,
  buildAggregationPrompt,
  buildFixSuggestionPrompt,
} from './prompts';

// Adapter
export {
  UniversalQualityAdapter,
  createUniversalQualityAdapter,
  type QualityIssue,
  type QualityResult,
  type LLMProvider,
} from './adapter';

// Default export: the adapter class
export { UniversalQualityAdapter as default } from './adapter';
