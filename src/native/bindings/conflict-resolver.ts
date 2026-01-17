/**
 * TypeScript bindings for Conflict Resolution
 *
 * This mirrors the OCaml conflict_resolver module, providing
 * Social Choice Theory-based conflict detection and resolution
 * for multi-agent persona evaluation outputs.
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
};

export type ConflictType =
  | 'risk_disagreement'
  | 'confidence_mismatch'
  | 'threshold_boundary'
  | 'blind_spot'
  | 'unanimous_concern';

export type ResolutionStrategy =
  | 'weighted_average'
  | 'conservative_merge'
  | 'human_escalation';

export interface Scorecard {
  overconfidenceRisk?: number;
  blindSpots: string[];
}

export interface PersonaOutput {
  personaId: string;
  riskScore?: number;
  confidence: number;
  scorecard?: Scorecard;
}

export interface Conflict {
  conflictType: ConflictType;
  personas: string[];
  severity: number;
  description: string;
  data?: Record<string, any>;
}

export interface Resolution {
  originalConflict: Conflict;
  strategy: ResolutionStrategy;
  adjustment: number;
  resolved: boolean;
  explanation: string;
}

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
};

// ============================================================================
// Conflict Detection
// ============================================================================

function detectRiskDisagreement(
  thresholds: Thresholds,
  personas: PersonaOutput[]
): Conflict | null {
  const withRisk = personas.filter((p) => p.riskScore !== undefined);

  if (withRisk.length < 2) return null;

  const scores = withRisk.map((p) => p.riskScore!);
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  const diff = maxScore - minScore;

  if (diff > thresholds.riskDisagreement) {
    return {
      conflictType: 'risk_disagreement',
      personas: withRisk.map((p) => p.personaId),
      severity: Math.min(1.0, diff / 0.5),
      description: `Risk score disagreement of ${diff.toFixed(2)} between personas (threshold: ${thresholds.riskDisagreement})`,
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

  const davidOverconf = david?.scorecard?.overconfidenceRisk;
  const philConf = phil?.confidence;

  if (
    davidOverconf !== undefined &&
    philConf !== undefined &&
    davidOverconf > thresholds.overconfidenceRisk &&
    philConf > thresholds.philConfidence
  ) {
    return {
      conflictType: 'confidence_mismatch',
      personas: ['david', 'phil'],
      severity: Math.min(1.0, (davidOverconf / 10.0) * philConf),
      description: `David overconfidence risk ${davidOverconf} > ${thresholds.overconfidenceRisk} with Phil confidence ${philConf.toFixed(2)} > ${thresholds.philConfidence}`,
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
    .map((p) => p.riskScore!);

  if (riskScores.length === 0) return null;

  const avgRisk = riskScores.reduce((a, b) => a + b, 0) / riskScores.length;

  if (
    avgRisk >= thresholds.thresholdBoundaryLow &&
    avgRisk <= thresholds.thresholdBoundaryHigh
  ) {
    return {
      conflictType: 'threshold_boundary',
      personas: personas
        .filter((p) => p.riskScore !== undefined)
        .map((p) => p.personaId),
      severity: 0.8,
      description: `Average risk ${avgRisk.toFixed(3)} is near decision boundary [${thresholds.thresholdBoundaryLow}, ${thresholds.thresholdBoundaryHigh}]`,
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
  const blindSpots = david?.scorecard?.blindSpots || [];

  if (blindSpots.length >= thresholds.blindSpotsMinimum) {
    return {
      conflictType: 'blind_spot',
      personas: ['david'],
      severity: Math.min(1.0, blindSpots.length / 5.0),
      description: `Detected ${blindSpots.length} blind spots (minimum: ${thresholds.blindSpotsMinimum}): ${blindSpots.join(', ')}`,
      data: { blindSpots, count: blindSpots.length },
    };
  }

  return null;
}

function detectUnanimousConcern(
  thresholds: Thresholds,
  personas: PersonaOutput[]
): Conflict | null {
  const confidences = personas.map((p) => p.confidence);

  if (confidences.length === 0) return null;

  const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;

  if (avgConfidence > thresholds.unanimousConfidence) {
    return {
      conflictType: 'unanimous_concern',
      personas: personas.map((p) => p.personaId),
      severity: (avgConfidence - thresholds.unanimousConfidence) / 0.15,
      description: `Average confidence ${avgConfidence.toFixed(2)} exceeds unanimous threshold ${thresholds.unanimousConfidence}`,
      data: { averageConfidence: avgConfidence, threshold: thresholds.unanimousConfidence },
    };
  }

  return null;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Detect all conflicts in persona outputs.
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
 * Check if any conflicts exist.
 */
export function hasConflicts(
  personas: PersonaOutput[],
  thresholds: Thresholds = DEFAULT_THRESHOLDS
): boolean {
  return detectConflicts(personas, thresholds).length > 0;
}

/**
 * Resolve a single conflict.
 */
export function resolveConflict(conflict: Conflict): Resolution {
  const { strategy, adjustment } = CONFLICT_STRATEGIES[conflict.conflictType];
  const resolved = strategy !== 'human_escalation';

  let explanation: string;
  switch (strategy) {
    case 'weighted_average':
      explanation = `Applied weighted average to resolve ${conflict.description}`;
      break;
    case 'conservative_merge':
      explanation = `Applied conservative merge strategy: ${conflict.description}`;
      break;
    case 'human_escalation':
      explanation = `Escalating to human review: ${conflict.description}`;
      break;
  }

  return {
    originalConflict: conflict,
    strategy,
    adjustment,
    resolved,
    explanation,
  };
}

/**
 * Resolve all conflicts.
 */
export function resolveConflicts(conflicts: Conflict[]): Resolution[] {
  return conflicts.map(resolveConflict);
}

/**
 * Aggregate resolutions into final result.
 */
export function aggregateResolutions(resolutions: Resolution[]): ResolutionResult {
  const totalAdjustment = resolutions.reduce((acc, r) => acc + r.adjustment, 0);
  const cappedAdjustment = Math.max(-0.4, totalAdjustment);

  const requiresHumanReview = resolutions.some(
    (r) => !r.resolved || r.strategy === 'human_escalation'
  );

  const explanations = resolutions.map((r) => r.explanation);
  const resolvedCount = resolutions.filter((r) => r.resolved).length;

  return {
    totalAdjustment: cappedAdjustment,
    requiresHumanReview,
    explanations,
    finalConfidenceCap: 1.0 + cappedAdjustment,
    conflictsDetected: resolutions.length,
    conflictsResolved: resolvedCount,
  };
}

/**
 * Full pipeline: detect, resolve, and aggregate.
 */
export function resolvePersonaConflicts(
  personas: PersonaOutput[],
  thresholds: Thresholds = DEFAULT_THRESHOLDS
): ResolutionResult {
  const conflicts = detectConflicts(personas, thresholds);
  const resolutions = resolveConflicts(conflicts);
  return aggregateResolutions(resolutions);
}

// ============================================================================
// Conflict Resolver Class
// ============================================================================

export class ConflictResolver {
  private thresholds: Thresholds;

  constructor(thresholds: Partial<Thresholds> = {}) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  detect(personas: PersonaOutput[]): Conflict[] {
    return detectConflicts(personas, this.thresholds);
  }

  hasConflicts(personas: PersonaOutput[]): boolean {
    return hasConflicts(personas, this.thresholds);
  }

  resolve(personas: PersonaOutput[]): ResolutionResult {
    return resolvePersonaConflicts(personas, this.thresholds);
  }

  setThresholds(thresholds: Partial<Thresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  getThresholds(): Thresholds {
    return { ...this.thresholds };
  }
}

export default ConflictResolver;
