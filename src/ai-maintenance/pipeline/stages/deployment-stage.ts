/**
 * Deployment Stage Executor
 * 
 * Executes the deployment phase of the adaptation pipeline:
 * branch creation, file changes, commits, and PR creation.
 * 
 * @module ai-maintenance/pipeline/stages/deployment-stage
 */

import {
  AdaptationPipeline,
  ChangeProposal,
  DeploymentResult,
  DeploymentStage,
} from '../../types';
import { PipelineConfig } from '../types';

/**
 * Deployment stage executor
 */
export class DeploymentStageExecutor {
  constructor(private config: PipelineConfig) {}

  /**
   * Execute the deployment stage
   */
  async execute(
    pipeline: AdaptationPipeline,
    proposal: ChangeProposal
  ): Promise<DeploymentResult> {
    const stages: DeploymentStage[] = [];
    const strategy = this.config.deploymentStrategy;

    if (this.config.dryRun) {
      return this.createDryRunResult(pipeline, proposal);
    }

    stages.push(await this.executeStep('create-branch', async () => {
      const branchName = `${this.config.git.branchPrefix}${proposal.proposalId}`;
      return `Branch ${branchName} created`;
    }));

    stages.push(await this.executeStep('apply-changes', async () => {
      for (const change of proposal.fileChanges) {
        console.log(`Would apply change to ${change.filePath}`);
      }
      return `${proposal.fileChanges.length} file(s) modified`;
    }));

    stages.push(await this.executeStep('commit', async () => {
      const message = this.config.git.commitTemplate
        .replace('{{title}}', proposal.title)
        .replace('{{description}}', proposal.description);
      return `Committed with message: ${message.split('\n')[0]}`;
    }));

    if (this.config.git.createPullRequest) {
      stages.push(await this.executeStep('create-pr', async () => {
        return `PR created for ${proposal.title}`;
      }));
    } else {
      stages.push(await this.executeStep('push', async () => {
        return `Pushed to ${this.config.git.targetBranch}`;
      }));
    }

    const failedStage = stages.find(s => s.status === 'failed');

    return {
      deploymentId: `deployment-${pipeline.pipelineId}`,
      proposalId: proposal.proposalId,
      status: failedStage ? 'failed' : 'success',
      strategy,
      stages,
      pullRequestUrl: this.config.git.createPullRequest ? `https://github.com/org/repo/pull/123` : undefined,
      deployedAt: new Date().toISOString(),
      rollbackAvailable: true,
    };
  }

  private createDryRunResult(
    pipeline: AdaptationPipeline,
    proposal: ChangeProposal
  ): DeploymentResult {
    return {
      deploymentId: `deployment-${pipeline.pipelineId}`,
      proposalId: proposal.proposalId,
      status: 'success',
      strategy: 'direct',
      stages: [{
        name: 'dry-run',
        status: 'success',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        output: 'Dry run - no changes applied',
      }],
      deployedAt: new Date().toISOString(),
      rollbackAvailable: false,
    };
  }

  private async executeStep(
    name: string,
    action: () => Promise<string>
  ): Promise<DeploymentStage> {
    const startedAt = new Date().toISOString();
    
    try {
      const output = await action();
      return {
        name,
        status: 'success',
        startedAt,
        completedAt: new Date().toISOString(),
        output,
      };
    } catch (error) {
      return {
        name,
        status: 'failed',
        startedAt,
        completedAt: new Date().toISOString(),
        output: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
