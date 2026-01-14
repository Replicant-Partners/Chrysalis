/**
 * ConflictResolver - Multi-Agent Conflict Detection and Resolution
 *
 * Detects and resolves conflicts between persona evaluation outputs.
 * Implements Social Choice Theory principles for weighted aggregation.
 *
 * @module agents/system/ConflictResolver
 */

import type { ConflictType, ResolutionStrategy } from './types';
import type { PersonaOutput } from './EvaluationCoordinator';

// ============================================================================
// Conflict Thresholds
// ============================================================================

/**
 * Thresholds for detecting conflicts between persona outputs.
 * Centralized for maintainability and easy tuning.
 */
export const CONFLICT_THRESHOLDS = {
  /** Risk score difference to trigger risk_disagreement conflict */
  RISK_DISAGREEMENT: 0.3,
  /** Overconfidence risk score (0-10) to trigger confidence_mismatch */
  OVERCONFIDENCE_RISK: 7,
  /** Phil confidence threshold for confidence_mismatch detection */
  PHIL_CONFIDENCE: 0.7,
  /** Lower bound for threshold_boundary detection */
  THRESHOLD_BOUNDARY_LOW: 0.28,
  /** Upper bound for threshold_boundary detection */
  THRESHOLD_BOUNDARY_HIGH: 0.32,
  /** Minimum blind spots to force human review */
  BLIND_SPOTS_MINIMUM: 3,
  /** Confidence reduction factor when overconfidence detected */
  CONFIDENCE_REDUCTION_FACTOR: 0.8,
  /** Confidence cap when conflicts detected */
  CONFIDENCE_CAP_ON_CONFLICT: 0.6,
  /** Average confidence threshold for unanimous warning */
  UNANIMOUS_CONFIDENCE: 0.85,
  /** High average confidence threshold for metacognitive alerts */
  HIGH_AVG_CONFIDENCE: 0.8,
} as const;

// ============================================================================
// Types
// ============================================================================

/**
 * Detected conflict between persona evaluations
 */
export interface DetectedConflict {
  /** Type of conflict */
  type: ConflictType;
  /** Personas involved in the conflict */
  personas: string[];
  /** Severity of the conflict (0-1) */
  severity: number;
  /** Human-readable description */
  description: string;
  /** Suggested resolution strategy */
  suggestedResolution: ResolutionStrategy;
}

/**
 * Resolution result after processing conflicts
 */
export interface ConflictResolutionResult {
  /** Whether resolution was successful */
  resolved: boolean;
  /** Strategy used to resolve */
  strategy: ResolutionStrategy;
  /** Adjustment to confidence score */
  confidenceAdjustment: number;
  /** Explanation of the resolution */
  explanation: string;
}

// ============================================================================
// ConflictResolver Class
// ============================================================================

/**
 * ConflictResolver handles detection and resolution of disagreements
 * between system agent personas.
 */
export class ConflictResolver {
  private readonly thresholds: typeof CONFLICT_THRESHOLDS;

  constructor(thresholds?: Partial<typeof CONFLICT_THRESHOLDS>) {
    this.thresholds = { ...CONFLICT_THRESHOLDS, ...thresholds };
  }

  /**
   * Detect all conflicts between persona outputs.
   *
   * @param outputs - Map of persona ID to evaluation output
   * @returns Array of detected conflicts
   */
  detectConflicts(outputs: Map<string, PersonaOutput>): DetectedConflict[] {
    const conflicts: DetectedConflict[] = [];

    const ada = outputs.get('ada');
    const lea = outputs.get('lea');
    const phil = outputs.get('phil');
    const david = outputs.get('david');

    // 1. Risk score disagreement between Ada and Lea
    if (ada && lea) {
      const riskDiff = Math.abs(ada.riskScore - lea.riskScore);
      if (riskDiff > this.thresholds.RISK_DISAGREEMENT) {
        conflicts.push({
          type: 'risk_disagreement',
          personas: ['ada', 'lea'],
          severity: riskDiff,
          description: `Ada and Lea disagree on risk by ${(riskDiff * 100).toFixed(0)}%`,
          suggestedResolution: 'weighted_average'
        });
      }
    }

    // 2. Confidence mismatch between Phil's forecast and David's overconfidence detection
    if (phil && david) {
      const overconfidenceRisk = david.scorecard.overconfidenceRisk as number ?? 0;
      if (
        overconfidenceRisk > this.thresholds.OVERCONFIDENCE_RISK &&
        phil.confidence > this.thresholds.PHIL_CONFIDENCE
      ) {
        conflicts.push({
          type: 'confidence_mismatch',
          personas: ['phil', 'david'],
          severity: overconfidenceRisk / 10,
          description: `David flags overconfidence (${overconfidenceRisk}/10) but Phil is ${(phil.confidence * 100).toFixed(0)}% confident`,
          suggestedResolution: 'conservative_merge'
        });
      }
    }

    // 3. Threshold boundary case - risk near decision boundary
    if (ada && lea) {
      const avgRisk = (ada.riskScore + lea.riskScore) / 2;
      if (
        avgRisk > this.thresholds.THRESHOLD_BOUNDARY_LOW &&
        avgRisk < this.thresholds.THRESHOLD_BOUNDARY_HIGH
      ) {
        conflicts.push({
          type: 'threshold_boundary',
          personas: ['ada', 'lea'],
          severity: 0.5,
          description: `Risk score ${(avgRisk * 100).toFixed(0)}% is near decision boundary`,
          suggestedResolution: 'human_escalation'
        });
      }
    }

    // 4. Blind spots detected by David
    if (david) {
      const blindSpots = david.scorecard.blindSpots as string[] ?? [];
      if (blindSpots.length >= this.thresholds.BLIND_SPOTS_MINIMUM) {
        conflicts.push({
          type: 'blind_spot',
          personas: ['david'],
          severity: blindSpots.length / 10,
          description: `David identified ${blindSpots.length} potential blind spots`,
          suggestedResolution: 'human_escalation'
        });
      }
    }

    // 5. Unanimous high confidence (potential groupthink)
    const allOutputs = [ada, lea, phil, david].filter(Boolean) as PersonaOutput[];
    if (allOutputs.length >= 3) {
      const avgConfidence = allOutputs.reduce((sum, o) => sum + o.confidence, 0) / allOutputs.length;
      if (avgConfidence > this.thresholds.UNANIMOUS_CONFIDENCE) {
        conflicts.push({
          type: 'unanimous_concern',
          personas: allOutputs.map(o => o.personaId),
          severity: avgConfidence - this.thresholds.UNANIMOUS_CONFIDENCE,
          description: `Suspiciously high agreement (${(avgConfidence * 100).toFixed(0)}% avg confidence) - possible groupthink`,
          suggestedResolution: 'conservative_merge'
        });
      }
    }

    return conflicts;
  }

  /**
   * Resolve a detected conflict using the suggested strategy.
   *
   * @param conflict - The conflict to resolve
   * @param outputs - Map of persona ID to evaluation output
   * @returns Resolution result
   */
  resolveConflict(
    conflict: DetectedConflict,
    outputs: Map<string, PersonaOutput>
  ): ConflictResolutionResult {
    switch (conflict.suggestedResolution) {
      case 'weighted_average':
        return {
          resolved: true,
          strategy: 'weighted_average',
          confidenceAdjustment: -0.1, // Reduce confidence slightly
          explanation: `Resolved ${conflict.type} by weighted averaging. Confidence reduced.`
        };

      case 'conservative_merge':
        return {
          resolved: true,
          strategy: 'conservative_merge',
          confidenceAdjustment: -(1 - this.thresholds.CONFIDENCE_REDUCTION_FACTOR),
          explanation: `Applied conservative merge for ${conflict.type}. Using more cautious estimates.`
        };

      case 'human_escalation':
        return {
          resolved: false,
          strategy: 'human_escalation',
          confidenceAdjustment: -0.2,
          explanation: `${conflict.type} requires human review. Confidence capped.`
        };

      case 'defer_to_expert':
        // Defer to the persona with highest confidence in the conflict
        const expertPersonaId = this.findExpertPersona(conflict, outputs);
        return {
          resolved: true,
          strategy: 'defer_to_expert',
          confidenceAdjustment: -0.05,
          explanation: `Deferred to ${expertPersonaId} as domain expert for ${conflict.type}.`
        };

      default:
        return {
          resolved: false,
          strategy: 'human_escalation',
          confidenceAdjustment: -0.2,
          explanation: `Unknown resolution strategy for ${conflict.type}. Escalating to human.`
        };
    }
  }

  /**
   * Find the expert persona in a conflict (highest confidence).
   */
  private findExpertPersona(
    conflict: DetectedConflict,
    outputs: Map<string, PersonaOutput>
  ): string {
    let maxConfidence = 0;
    let expertId = conflict.personas[0];

    for (const personaId of conflict.personas) {
      const output = outputs.get(personaId);
      if (output && output.confidence > maxConfidence) {
        maxConfidence = output.confidence;
        expertId = personaId;
      }
    }

    return expertId;
  }

  /**
   * Apply all conflict resolutions and compute final confidence adjustment.
   *
   * @param conflicts - All detected conflicts
   * @param outputs - Map of persona outputs
   * @returns Total confidence adjustment and whether human review is needed
   */
  resolveAllConflicts(
    conflicts: DetectedConflict[],
    outputs: Map<string, PersonaOutput>
  ): { totalAdjustment: number; requiresHumanReview: boolean; explanations: string[] } {
    let totalAdjustment = 0;
    let requiresHumanReview = false;
    const explanations: string[] = [];

    for (const conflict of conflicts) {
      const result = this.resolveConflict(conflict, outputs);
      totalAdjustment += result.confidenceAdjustment;
      explanations.push(result.explanation);

      if (!result.resolved || result.strategy === 'human_escalation') {
        requiresHumanReview = true;
      }
    }

    // Cap total adjustment
    totalAdjustment = Math.max(totalAdjustment, -0.4);

    return { totalAdjustment, requiresHumanReview, explanations };
  }
}

/**
 * Create a ConflictResolver with default thresholds.
 */
export function createConflictResolver(
  thresholds?: Partial<typeof CONFLICT_THRESHOLDS>
): ConflictResolver {
  return new ConflictResolver(thresholds);
}
