/**
 * Analysis Stage Executor
 * 
 * Executes the analysis phase of the adaptation pipeline:
 * semantic diff analysis, pattern matching, impact assessment.
 * 
 * @module ai-maintenance/pipeline/stages/analysis-stage
 */

import {
  AdaptationPipeline,
  AnalysisResult,
  PatternMatch,
  ImpactAssessment,
  RecommendedAction,
} from '../../types';
import { SemanticDiffAnalyzer, ExtendedAnalysisResult } from '../../semantic-diff-analyzer';
import { matchPatterns, PatternMatchContext } from '../../evolutionary-patterns';
import { AgentFramework } from '../../../adapters/protocol-types';

/**
 * Analysis stage executor
 */
export class AnalysisStageExecutor {
  constructor(private semanticAnalyzer: SemanticDiffAnalyzer) {}

  /**
   * Execute the analysis stage
   */
  async execute(pipeline: AdaptationPipeline): Promise<AnalysisResult> {
    const change = pipeline.triggeringChange;

    const extendedAnalysis = await this.semanticAnalyzer.analyzeChange(change);

    const matchContext = this.buildPatternMatchContext(change, extendedAnalysis);
    const patterns = matchPatterns(matchContext);

    const impactAssessment = this.buildImpactAssessment(extendedAnalysis, patterns);
    const recommendedActions = this.generateRecommendedActions(extendedAnalysis, patterns);

    return {
      analysisId: `analysis-${pipeline.pipelineId}`,
      semanticDiff: extendedAnalysis.semanticDiff,
      matchedPatterns: patterns,
      impactAssessment,
      recommendedActions,
      confidence: this.calculateAnalysisConfidence(extendedAnalysis, patterns),
      analyzedAt: new Date().toISOString(),
      agentId: 'semantic-diff-analyzer-v1',
    };
  }

  private buildPatternMatchContext(
    change: AdaptationPipeline['triggeringChange'],
    extendedAnalysis: ExtendedAnalysisResult
  ): PatternMatchContext {
    return {
      versionChange: change.previousVersion && change.currentVersion ? {
        from: change.previousVersion,
        to: change.currentVersion,
      } : undefined,
      apiChanges: extendedAnalysis.apiSurfaceChanges ? [
        ...extendedAnalysis.apiSurfaceChanges.removed.map(item => ({
          type: 'removed',
          element: item.name,
          breaking: true,
        })),
        ...extendedAnalysis.apiSurfaceChanges.modified.map(item => ({
          type: 'modified',
          element: item.after.name,
          breaking: item.isBreaking,
        })),
      ] : undefined,
      schemaChanges: extendedAnalysis.semanticDiff.schemaChanges?.map(sc => ({
        type: sc.type,
        fieldPath: sc.fieldPath,
        requiredChange: sc.requiredChange,
      })),
      additional: {
        repositoryId: change.repositoryId,
        changeType: change.changeType,
        changedPaths: change.changedPaths,
        detectedAt: change.detectedAt,
      },
    };
  }

  private buildImpactAssessment(
    analysis: ExtendedAnalysisResult,
    patterns: PatternMatch[]
  ): ImpactAssessment {
    let overallImpact: 'none' | 'minimal' | 'moderate' | 'significant' | 'critical' = 'none';
    const breakingCount = analysis.semanticDiff.breakingChanges.length;
    
    if (breakingCount > 5) overallImpact = 'critical';
    else if (breakingCount > 2) overallImpact = 'significant';
    else if (breakingCount > 0) overallImpact = 'moderate';
    else if (analysis.apiSurfaceChanges.modified.length > 0) overallImpact = 'minimal';

    return {
      overallImpact,
      affectedAdapters: analysis.affectedAdapters.map(adapter => ({
        protocol: adapter as AgentFramework,
        impact: overallImpact,
        requiredChanges: analysis.recommendedActions,
        filesAffected: [],
      })),
      estimatedEffortHours: breakingCount * 2 + patterns.length,
      riskLevel: breakingCount > 2 ? 'high' : breakingCount > 0 ? 'medium' : 'low',
      dependenciesAffected: [],
      testCoverageNeeded: ['unit', 'integration'],
    };
  }

  private generateRecommendedActions(
    analysis: ExtendedAnalysisResult,
    patterns: PatternMatch[]
  ): RecommendedAction[] {
    const actions: RecommendedAction[] = [];
    let priority = 1;

    analysis.recommendedActions.forEach(action => {
      actions.push({
        actionId: `action-${priority}`,
        type: 'modify-file',
        priority: priority++,
        description: action,
        automatable: true,
        estimatedMinutes: 15,
      });
    });

    patterns.forEach(pattern => {
      pattern.recommendedStrategies.forEach(strategy => {
        actions.push({
          actionId: `pattern-action-${priority}`,
          type: 'modify-file',
          priority: priority++,
          description: `Apply strategy: ${strategy} for pattern ${pattern.patternId}`,
          automatable: true,
          estimatedMinutes: 30,
        });
      });
    });

    return actions;
  }

  private calculateAnalysisConfidence(
    analysis: ExtendedAnalysisResult,
    patterns: PatternMatch[]
  ): number {
    const patternConfidence = patterns.length > 0 
      ? patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length 
      : 0.5;
    
    const analysisConfidence = analysis.impactScore < 0.5 ? 0.9 : 0.7;
    
    return (patternConfidence + analysisConfidence) / 2;
  }
}
