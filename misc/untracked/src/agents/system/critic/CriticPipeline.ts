/**
 * CriticPipeline
 *
 * Runs a set of critics and aggregates results into a single verdict.
 */

import type { CriticContext, CriticResult } from './types';
import { BaseCritic } from './BaseCritic';

export interface CriticPipelineResult {
  aggregateScore: number;
  verdict: 'pass' | 'revise' | 'reject';
  results: CriticResult[];
  suggestions: string[];
}

export interface CriticPipelineConfig {
  reviseThreshold?: number;
  rejectThreshold?: number;
}

const DEFAULT_CONFIG: Required<CriticPipelineConfig> = {
  reviseThreshold: 0.35,
  rejectThreshold: 0.2,
};

export class CriticPipeline {
  private critics: BaseCritic[];
  private config: Required<CriticPipelineConfig>;

  constructor(critics: BaseCritic[], config: CriticPipelineConfig = {}) {
    this.critics = critics;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  evaluate(context: CriticContext): CriticPipelineResult {
    const results = this.critics.map(critic => critic.evaluate(context));
    const aggregateScore = results.reduce((sum, r) => sum + r.score, 0) / (results.length || 1);
    const suggestions = results.flatMap(r => r.suggestions);

    let verdict: CriticPipelineResult['verdict'] = 'pass';
    if (results.some(r => r.verdict === 'reject') || aggregateScore <= this.config.rejectThreshold) {
      verdict = 'reject';
    } else if (results.some(r => r.verdict === 'revise') || aggregateScore <= this.config.reviseThreshold) {
      verdict = 'revise';
    }

    return {
      aggregateScore: Math.max(0, Math.min(1, aggregateScore)),
      verdict,
      results,
      suggestions,
    };
  }
}
