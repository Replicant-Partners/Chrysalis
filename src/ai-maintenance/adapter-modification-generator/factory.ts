/**
 * Factory Functions for Adapter Modification Generator
 * 
 * @module ai-maintenance/adapter-modification-generator/factory
 */

import { ExtendedAnalysisResult } from '../semantic-diff-analyzer';
import { AgentFramework } from '../../adapters/protocol-types';
import { PatternMatch } from '../types';

import { GeneratorConfig, GenerationResult } from './types';
import { AdapterModificationGenerator } from './generator';

/**
 * Create a pre-configured modification generator
 */
export function createModificationGenerator(
  config?: Partial<GeneratorConfig>
): AdapterModificationGenerator {
  return new AdapterModificationGenerator(config);
}

/**
 * Generate a proposal from analysis result
 */
export async function generateAdapterProposal(
  protocol: AgentFramework,
  analysis: ExtendedAnalysisResult,
  patterns: PatternMatch[],
  adapterFiles: string[],
  existingContent: Map<string, string>,
  config?: Partial<GeneratorConfig>
): Promise<GenerationResult> {
  const generator = createModificationGenerator(config);
  return generator.generateProposal({
    protocol,
    analysis,
    patterns,
    adapterFiles,
    existingContent,
  });
}
