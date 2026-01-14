/**
 * Factory Functions for Pipeline Orchestrator
 * @module ai-maintenance/pipeline/factory
 */

import { AgentFramework } from '../../adapters/protocol-types';
import { AdaptationPipelineOrchestrator } from './orchestrator';
import { PipelineConfig } from './types';

/**
 * Create a pre-configured pipeline orchestrator
 */
export function createPipelineOrchestrator(
  config?: Partial<PipelineConfig>
): AdaptationPipelineOrchestrator {
  return new AdaptationPipelineOrchestrator(config);
}

/**
 * Create and start a pipeline orchestrator with default protocol monitors
 */
export function createAndStartOrchestrator(
  protocols: AgentFramework[],
  config?: Partial<PipelineConfig>
): AdaptationPipelineOrchestrator {
  const orchestrator = createPipelineOrchestrator(config);
  
  protocols.forEach(protocol => {
    orchestrator.addRepository(protocol);
  });
  
  orchestrator.start();
  
  return orchestrator;
}
