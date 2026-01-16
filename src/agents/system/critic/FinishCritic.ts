/**
 * FinishCritic
 *
 * Minimal OpenHands-lite finish critic. Checks if a response looks complete
 * and actionable relative to the user request.
 */

import type { CriticContext, CriticResult } from './types';
import { BaseCritic } from './BaseCritic';

export interface FinishCriticConfig {
  minLength?: number;
  requireActionable?: boolean;
}

const DEFAULT_CONFIG: FinishCriticConfig = {
  minLength: 24,
  requireActionable: true,
};

export class FinishCritic extends BaseCritic {
  readonly criticId = 'finish';
  private config: FinishCriticConfig;

  constructor(config: FinishCriticConfig = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  evaluate(context: CriticContext): CriticResult {
    const responseText = context.response.content.trim();
    const userText = context.userMessage.content.trim();

    const suggestions: string[] = [];
    let score = 0.5;
    let verdict: CriticResult['verdict'] = 'pass';

    if (!responseText) {
      return {
        criticId: this.criticId,
        score: 0,
        verdict: 'reject',
        message: 'Response is empty.',
        suggestions: ['Provide a concrete response addressing the user request.'],
      };
    }

    if (responseText.length < (this.config.minLength ?? 0)) {
      score -= 0.2;
      suggestions.push('Expand the response to include concrete details.');
    } else {
      score += 0.1;
    }

    if (this.config.requireActionable) {
      const actionableSignals = /(next step|try|recommend|suggest|here\s*(is|are)|you\s+can|steps?|run|use)/i;
      if (!actionableSignals.test(responseText)) {
        score -= 0.2;
        suggestions.push('Add clear next steps or actionable guidance.');
      } else {
        score += 0.1;
      }
    }

    if (context.stuckDetected) {
      score -= 0.15;
      suggestions.push('Acknowledge the loop/stuck state and propose a different approach.');
    }

    if (userText.length > 0 && !responseText.toLowerCase().includes(userText.split(' ')[0].toLowerCase())) {
      // heuristic: response may not be anchored to user request
      score -= 0.05;
      suggestions.push('Explicitly reference the user request to show alignment.');
    }

    score = Math.max(0, Math.min(1, score));

    if (score < 0.35) {
      verdict = 'revise';
    }

    if (score < 0.2) {
      verdict = 'reject';
    }

    return {
      criticId: this.criticId,
      score,
      verdict,
      message: verdict === 'pass' ? 'Response appears complete.' : 'Response needs improvement.',
      suggestions,
    };
  }
}
