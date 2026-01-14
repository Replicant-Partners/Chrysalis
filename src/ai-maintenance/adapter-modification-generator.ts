/**
 * Adapter Modification Generator for AI-Led Adaptive Maintenance
 * 
 * Generates code modifications for protocol adapters based on semantic diffs,
 * matched evolutionary patterns, and LLM-assisted analysis.
 * 
 * @module ai-maintenance/adapter-modification-generator
 * @version 1.0.0
 * 
 * @deprecated Import from './adapter-modification-generator/index' directly for tree-shaking.
 * This facade is maintained for backward compatibility.
 */

export {
  // Types
  GeneratorConfig,
  CodeStyleConfig,
  GenerationContext,
  CodeTemplate,
  TemplateVariable,
  GenerationResult,
  GenerationError,
  GenerationStats,
  PlannedModification,
  
  // Templates
  CODE_TEMPLATES,
  
  // Generator class
  AdapterModificationGenerator,
  
  // Factory functions
  createModificationGenerator,
  generateAdapterProposal,
} from './adapter-modification-generator/index';
