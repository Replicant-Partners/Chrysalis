/**
 * TypeScript bindings for Conflict Resolution
 *
 * This mirrors the OCaml conflict_resolver module, providing
 * Social Choice Theory-based conflict detection and resolution
 * for multi-agent persona evaluation outputs.
 *
 * Replaces: src/agents/system/ConflictResolver.ts
 */

// ============================================================================
// Types
// ============================================================================

export interface Thresholds {
  riskDisagreement: number;
  overconfidenceRisk: number;
  philConfidence: number;
  thresholdBoundaryLow: number;
  thresholdBoundaryHigh: number;
  blindSpotsMinimum: number;
  confidenceReduction: number;
  unanimousConfidence: number;
  /** Confidence cap when conflicts detected */
  confidenceCapOnConflict: number;
  /** High average confidence threshold for metacognitive alerts */
  highAvgConfidence: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  riskDisagreement: 0.3,
  overconfidenceRisk: 7,
  philConfidence: 0.7,
  thresholdBoundaryLow: 0.28,
  thresholdBoundaryHigh: 0.32,
  blindSpotsMinimum: 3,
  confidenceReduction: 0.8,
  unanimousConfidence: 0.85,
  confidenceCapOnConflict: 0.6,
  highAvgConfidence: 0.8,
};

/** Backwards compatibility alias */
export const CONFLICT_THRESHOLDS = {
  RISK_DISAGREEMENT: DEFAULT_THRESHOLDS.riskDisagreement,
  OVERCONFIDENCE_RISK: DEFAULT_THRESHOLDS.overconfidenceRisk,
  PHIL_CONFIDENCE: DEFAULT_THRESHOLDS.philConfidence,
  THRESHOLD_BOUNDARY_LOW: DEFAULT_THRESHOLDS.thresholdBoundaryLow,
  THRESHOLD_BOUNDARY_HIGH: DEFAULT_THRESHOLDS.thresholdBoundaryHigh,
  BLIND_SPOTS_MINIMUM: DEFAULT_THRESHOLDS.blindSpotsMinimum,
  CONFIDENCE_REDUCTION_FACTOR: DEFAULT_THRESHOLDS.confidenceReduction,
  CONFIDENCE_CAP_ON_CONFLICT: DEFAULT_THRESHOLDS.confidenceCapOnConflict,
  UNANIMOUS_CONFIDENCE: DEFAULT_THRESHOLDS.unanimousConfidence,
  HIGH_AVG_CONFIDENCE: DEFAULT_THRESHOLDS.highAvgConfidence,
  BRIER_DRIFT_THRESHOLD: 0.25,
} as const;

export type ConflictType =
  | 'risk_disagreement'
  | 'confidence_mismatch'
  | 'threshold_boundary'
  | 'blind_spot'
  | 'unanimous_concern'
  | 'unanimous_warning';

export type ResolutionStrategy =
  | 'weighted_average'
  | 'conservative_merge'
  | 'human_escalation'
  | 'defer_to_expert'
  | 'defer_to_coordinator'
  | 'conservative_bound';

/** Flexible scorecard - accepts any shape */
export type Scorecard = Record<string, number | string | string[] | boolean | undefined>;

export interface PersonaOutput {
  personaId: string;
  riskScore: number;
  confidence: number;
  scorecard: Scorecard;
  recommendations?: string[];
  requiresHumanReview?: boolean;
  timestamp?: Date;
  latencyMs?: number;
}

export interface Conflict {
  type: ConflictType;
  personas: string[];
  severity: number;
  description: string;
  suggestedResolution: ResolutionStrategy;
  data?: Record<string, any>;
}

/** Backwards compat alias */
export type DetectedConflict = Conflict;

export interface Resolution {
  resolved: boolean;
  strategy: ResolutionStrategy;
  confidenceAdjustment: number;
  explanation: string;
}

/** Backwards compat alias */
export type ConflictResolutionResult = Resolution;

export interface ResolutionResult {
  totalAdjustment: number;
  requiresHumanReview: boolean;
  explanations: string[];
  finalConfidenceCap: number;
  conflictsDetected: number;
  conflictsResolved: number;
}

// ============================================================================
// Strategy Mapping
// ============================================================================

const CONFLICT_STRATEGIES: Record<ConflictType, { strategy: ResolutionStrategy; adjustment: number }> = {
  risk_disagreement: { strategy: 'weighted_average', adjustment: -0.1 },
  confidence_mismatch: { strategy: 'conservative_merge', adjustment: -0.2 },
  threshold_boundary: { strategy: 'human_escalation', adjustment: -0.2 },
  blind_spot: { strategy: 'human_escalation', adjustment: -0.2 },
  unanimous_concern: { strategy: 'conservative_merge', adjustment: -0.15 },
  unanimous_warning: { strategy: 'conservative_merge', adjustment: -0.15 },
};

// ============================================================================
// Conflict Detection (from array)
// ============================================================================

function detectRiskDisagreement(
  thresholds: Thresholds,
  personas: PersonaOutput[]
): Conflict | null {
  const withRisk = personas.filter((p) => p.riskScore !== undefined);

  if (withRisk.length < 2) return null;

  const scores = withRisk.map((p) => p.riskScore);
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  const diff = maxScore - minScore;

  if (diff > thresholds.riskDisagreement) {
    return {
      type: 'risk_disagreement',
      personas: withRisk.map((p) => p.personaId),
      severity: Math.min(1.0, diff / 0.5),
      description: `Risk score disagreement of ${(diff * 100).toFixed(0)}% between personas`,
      suggestedResolution: 'weighted_average',
      data: { maxRisk: maxScore, minRisk: minScore, difference: diff },
    };
  }

  return null;
}

function detectConfidenceMismatch(
  thresholds: Thresholds,
  personas: PersonaOutput[]
): Conflict | null {
  const david = personas.find((p) => p.personaId === 'david');
  const phil = personas.find((p) => p.personaId === 'phil');

  const davidOverconf = david?.scorecard?.overconfidenceRisk as number | undefined;
  const philConf = phil?.confidence;

  if (
    davidOverconf !== undefined &&
    philConf !== undefined &&
    davidOverconf > thresholds.overconfidenceRisk &&
    philConf > thresholds.philConfidence
  ) {
    return {
      type: 'confidence_mismatch',
      personas: ['david', 'phil'],
      severity: Math.min(1.0, (davidOverconf / 10.0) * philConf),
      description: `David flags overconfidence (${davidOverconf}/10) but Phil is ${(philConf * 100).toFixed(0)}% confident`,
      suggestedResolution: 'conservative_merge',
      data: { overconfidenceRisk: davidOverconf, philConfidence: philConf },
    };
  }

  return null;
}

function detectThresholdBoundary(
  thresholds: Thresholds,
  personas: PersonaOutput[]
): Conflict | null {
  const riskScores = personas
    .filter((p) => p.riskScore !== undefined)
    .map((p) => p.riskScore);

  if (riskScores.length === 0) return null;

  const avgRisk = riskScores.reduce((a, b) => a + b, 0) / riskScores.length;

  if (
    avgRisk >= thresholds.thresholdBoundaryLow &&
    avgRisk <= thresholds.thresholdBoundaryHigh
  ) {
    return {
      type: 'threshold_boundary',
      personas: personas
        .filter((p) => p.riskScore !== undefined)
        .map((p) => p.personaId),
      severity: 0.5,
      description: `Risk score ${(avgRisk * 100).toFixed(0)}% is near decision boundary`,
      suggestedResolution: 'human_escalation',
      data: {
        averageRisk: avgRisk,
        boundaryLow: thresholds.thresholdBoundaryLow,
        boundaryHigh: thresholds.thresholdBoundaryHigh,
      },
    };
  }

  return null;
}

function detectBlindSpots(
  thresholds: Thresholds,
  personas: PersonaOutput[]
): Conflict | null {
  const david = personas.find((p) => p.personaId === 'david');
  const blindSpots = (david?.scorecard?.blindSpots as string[]) ||
                     (david?.scorecard?.blindSpotDetection as string[]) || [];

  if (blindSpots.length >= thresholds.blindSpotsMinimum) {
    return {
      type: 'blind_spot',
      personas: ['david'],
      severity: Math.min(1.0, blindSpots.length / 10.0),
      description: `David identified ${blindSpots.length} potential blind spots`,
      suggestedResolution: 'human_escalation',
      data: { blindSpots, count: blindSpots.length },
    };
  }

  return null;
}

function detectUnanimousConcern(
  thresholds: Thresholds,
  personas: PersonaOutput[]
): Conflict | null {
  const confidences = personas.map((p) => p.confidence).filter(c => c !== undefined);

  if (confidences.length < 3) return null;

  const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;

  if (avgConfidence > thresholds.unanimousConfidence) {
    return {
      type: 'unanimous_concern',
      personas: personas.map((p) => p.personaId),
      severity: avgConfidence - thresholds.unanimousConfidence,
      description: `Suspiciously high agreement (${(avgConfidence * 100).toFixed(0)}% avg confidence) - possible groupthink`,
      suggestedResolution: 'conservative_merge',
      data: { averageConfidence: avgConfidence, threshold: thresholds.unanimousConfidence },
    };
  }

  return null;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Detect all conflicts in persona outputs (array version).
 */
export function detectConflicts(
  personas: PersonaOutput[],
  thresholds: Thresholds = DEFAULT_THRESHOLDS
): Conflict[] {
  const detectors = [
    detectRiskDisagreement,
    detectConfidenceMismatch,
    detectThresholdBoundary,
    detectBlindSpots,
    detectUnanimousConcern,
  ];

  return detectors
    .map((detect) => detect(thresholds, personas))
    .filter((c): c is Conflict => c !== null);
}

/**
 * Detect all conflicts from a Map (for EvaluationCoordinator compatibility).
 */
export function detectConflictsFromMap(
  outputs: Map<string, PersonaOutput>,
  thresholds: Thresholds = DEFAULT_THRESHOLDS
): Conflict[] {
  const personas = Array.from(outputs.values());
  return detectConflicts(personas, thresholds);
}

/**
 * Check if any conflicts exist.
 */
export function hasConflicts(
  personas: PersonaOutput[] | Map<string, PersonaOutput>,
  thresholds: Thresholds = DEFAULT_THRESHOLDS
): boolean {
  const arr = personas instanceof Map ? Array.from(personas.values()) : personas;
  return detectConflicts(arr, thresholds).length > 0;
}

/**
 * Resolve a single conflict.
 */
export function resolveConflict(
  conflict: Conflict,
  _outputs?: Map<string, PersonaOutput>
): Resolution {
  const { strategy, adjustment } = CONFLICT_STRATEGIES[conflict.type];
  const resolved = strategy !== 'human_escalation';

  let explanation: string;
  switch (strategy) {
    case 'weighted_average':
      explanation = `Resolved ${conflict.type} by weighted averaging. Confidence reduced.`;
      break;
    case 'conservative_merge':
      explanation = `Applied conservative merge for ${conflict.type}. Using more cautious estimates.`;
      break;
    case 'human_escalation':
      explanation = `${conflict.type} requires human review. Confidence capped.`;
      break;
    default:
      explanation = `Applied ${strategy} for ${conflict.type}.`;
  }

  return {
    resolved,
    strategy,
    confidenceAdjustment: adjustment,
    explanation,
  };
}

/**
 * Resolve all conflicts.
 */
export function resolveConflicts(
  conflicts: Conflict[],
  outputs?: Map<string, PersonaOutput>
): Resolution[] {
  return conflicts.map(c => resolveConflict(c, outputs));
}

/**
 * Resolve all conflicts and aggregate results.
 */
export function resolveAllConflicts(
  conflicts: Conflict[],
  outputs?: Map<string, PersonaOutput>
): ResolutionResult {
  const resolutions = resolveConflicts(conflicts, outputs);

  let totalAdjustment = resolutions.reduce((acc, r) => acc + r.confidenceAdjustment, 0);
  totalAdjustment = Math.max(-0.4, totalAdjustment);

  const requiresHumanReview = resolutions.some(
    (r) => !r.resolved || r.strategy === 'human_escalation'
  );

  return {
    totalAdjustment,
    requiresHumanReview,
    explanations: resolutions.map((r) => r.explanation),
    finalConfidenceCap: 1.0 + totalAdjustment,
    conflictsDetected: resolutions.length,
    conflictsResolved: resolutions.filter((r) => r.resolved).length,
  };
}

/**
 * Full pipeline: detect, resolve, and aggregate.
 */
export function resolvePersonaConflicts(
  personas: PersonaOutput[] | Map<string, PersonaOutput>,
  thresholds: Thresholds = DEFAULT_THRESHOLDS
): ResolutionResult {
  const arr = personas instanceof Map ? Array.from(personas.values()) : personas;
  const map = personas instanceof Map ? personas : new Map(arr.map(p => [p.personaId, p]));
  const conflicts = detectConflicts(arr, thresholds);
  return resolveAllConflicts(conflicts, map);
}

// ============================================================================
// Conflict Resolver Class
// ============================================================================

export class ConflictResolver {
  private thresholds: Thresholds;

  constructor(thresholds?: Partial<Thresholds>) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  /** Detect conflicts from array */
  detect(personas: PersonaOutput[]): Conflict[] {
    return detectConflicts(personas, this.thresholds);
  }

  /** Detect conflicts from Map (EvaluationCoordinator compatibility) */
  detectConflicts(outputs: Map<string, PersonaOutput>): Conflict[] {
    return detectConflictsFromMap(outputs, this.thresholds);
  }

  hasConflicts(personas: PersonaOutput[] | Map<string, PersonaOutput>): boolean {
    return hasConflicts(personas, this.thresholds);
  }

  resolve(personas: PersonaOutput[] | Map<string, PersonaOutput>): ResolutionResult {
    return resolvePersonaConflicts(personas, this.thresholds);
  }

  resolveConflict(conflict: Conflict, outputs?: Map<string, PersonaOutput>): Resolution {
    return resolveConflict(conflict, outputs);
  }

  resolveAllConflicts(
    conflicts: Conflict[],
    outputs?: Map<string, PersonaOutput>
  ): ResolutionResult {
    return resolveAllConflicts(conflicts, outputs);
  }

  setThresholds(thresholds: Partial<Thresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  getThresholds(): Thresholds {
    return { ...this.thresholds };
  }
}

/** Factory function for backwards compatibility */
export function createConflictResolver(
  thresholds?: Partial<Thresholds>
): ConflictResolver {
  return new ConflictResolver(thresholds);
}

export default ConflictResolver;
