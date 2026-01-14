/**
 * Generation Stage Executor
 * 
 * Executes the change proposal generation phase of the adaptation pipeline.
 * 
 * @module ai-maintenance/pipeline/stages/generation-stage
 */

import {
  AdaptationPipeline,
  AnalysisResult,
  ChangeProposal,
} from '../../types';
import { SemanticDiffAnalyzer } from '../../semantic-diff-analyzer';
import { AdapterModificationGenerator } from '../../adapter-modification-generator';
import { AgentFramework } from '../../../adapters/protocol-types';

/**
 * Protocol to repository ID mapping
 */
const REPO_TO_PROTOCOL: Record<string, AgentFramework> = {
  'modelcontextprotocol/typescript-sdk': 'mcp',
  'anthropics/anthropic-sdk-npm': 'mcp',
  'google/a2a-sdk': 'a2a',
  'agent-network-protocol/anp-sdk': 'anp',
  'langchain-ai/langchainjs': 'langchain',
  'microsoft/semantic-kernel': 'semantic-kernel',
  'openai/openai-node': 'openai',
};

/**
 * Generation stage executor
 */
export class GenerationStageExecutor {
  constructor(
    private semanticAnalyzer: SemanticDiffAnalyzer,
    private modificationGenerator: AdapterModificationGenerator
  ) {}

  /**
   * Execute the generation stage
   */
  async execute(
    pipeline: AdaptationPipeline,
    analysis: AnalysisResult
  ): Promise<ChangeProposal> {
    const change = pipeline.triggeringChange;
    
    const protocol = this.getProtocolFromRepository(change.repositoryId);
    const adapterFiles = await this.getAdapterFiles(protocol);
    const existingContent = await this.getExistingContent(adapterFiles);
    const extendedAnalysis = await this.semanticAnalyzer.analyzeChange(change);

    const result = await this.modificationGenerator.generateProposal({
      protocol,
      analysis: extendedAnalysis,
      patterns: analysis.matchedPatterns,
      adapterFiles,
      existingContent,
    });

    if (!result.success || !result.proposal) {
      throw new Error('Failed to generate change proposal: ' + result.errors.map(e => e.message).join(', '));
    }

    return result.proposal;
  }

  private getProtocolFromRepository(repositoryId: string): AgentFramework {
    return REPO_TO_PROTOCOL[repositoryId] || 'usa';
  }

  private async getAdapterFiles(protocol: AgentFramework): Promise<string[]> {
    return [
      `src/adapters/${protocol}-adapter.ts`,
      `src/adapters/${protocol}-client.ts`,
    ];
  }

  private async getExistingContent(files: string[]): Promise<Map<string, string>> {
    const content = new Map<string, string>();
    for (const file of files) {
      content.set(file, '// Existing adapter content');
    }
    return content;
  }
}
