/**
 * EvaluationCoordinator - Multi-Agent Evaluation Aggregation System
 *
 * Theoretical Foundations:
 * - Delphi Method: Iterative expert consensus with anonymous feedback
 * - Tetlock Superforecasting: Brier scores, calibration tracking, belief updating
 * - Social Choice Theory: Weighted aggregation with conflict resolution
 * - Dunning-Kruger Metacognition: Bias detection and overconfidence monitoring
 *
 * Pipeline Architecture (DAG, not strictly sequential):
 *   Ada (Pattern) ─┬─► Lea (Implementation) ─┬─► Phil (Forecast) ─┬─► David (Meta)
 *                  │                         │                    │
 *                  └─────────────────────────┴────────────────────┘
 *
 * David receives ALL outputs for metacognitive oversight.
 * Phil tracks Brier scores across evaluations for calibration.
 *
 * @see Tetlock, P.E. & Gardner, D. (2015). Superforecasting: The Art and Science of Prediction
 * @see Mellers et al. (2015). Identifying and Cultivating Superforecasters
 */

import type {
  SystemAgentBinding,
  AggregatedEvaluation,
  EscalationRules,
  SystemAgentPersonaId
} from './types';

import { AGGREGATION_WEIGHTS } from './types';

import { PromptTemplateLoader, createPromptTemplateLoader } from './PromptTemplateLoader';

/**
 * Represents a single persona's evaluation output
 */
export interface PersonaOutput {
  personaId: 'ada' | 'lea' | 'phil' | 'david';
  scorecard: Record<string, number | string[]>;
  riskScore: number;
  confidence: number;
  recommendations: string[];
  requiresHumanReview: boolean;
  timestamp: Date;
  latencyMs: number;
}

/**
 * Represents Phil's forecast tracking for Brier score calibration
 * @see https://faculty.wharton.upenn.edu/wp-content/uploads/2015/07/2015---superforecasters.pdf
 */
export interface ForecastRecord {
  id: string;
  prediction: number;  // Probability 0-1
  outcome?: boolean;   // True if event occurred, null if unresolved
  brierScore?: number; // (prediction - outcome)^2, lower is better
  timestamp: Date;
  context: string;
}

// =============================================================================
// Conflict Detection Thresholds
// =============================================================================

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
  /** Default Brier score when no history (random guess baseline) */
  DEFAULT_BRIER_SCORE: 0.25,
  /** Brier score threshold for calibration drift warning */
  BRIER_DRIFT_THRESHOLD: 0.25,
  /** Average confidence threshold for unanimous warning */
  UNANIMOUS_CONFIDENCE: 0.85,
  /** High average confidence threshold for metacognitive alerts */
  HIGH_AVG_CONFIDENCE: 0.8,
} as const;

/**
 * Escalation risk boundaries for determining approval level.
 * Based on routing_config.json aggregation rules.
 */
export const ESCALATION_RISK_BOUNDARIES = {
  /** Maximum risk for auto-apply (no human needed) */
  AUTO_APPLY_MAX: 0.3,
  /** Maximum risk for supervised mode */
  SUPERVISED_MAX: 0.7,
} as const;

/**
 * Escalation thresholds per persona - extracted from persona configs at runtime.
 * Falls back to these defaults if config not available.
 */
interface EscalationThresholds {
  autoApply: { max: number };
  supervised: { min: number; max: number };
  humanApproval: { min: number };
}

const DEFAULT_ESCALATION_THRESHOLDS: Record<string, EscalationThresholds> = {
  ada: { autoApply: { max: 0.3 }, supervised: { min: 0.3, max: 0.7 }, humanApproval: { min: 0.7 } },
  lea: { autoApply: { max: 0.25 }, supervised: { min: 0.25, max: 0.7 }, humanApproval: { min: 0.7 } },
  phil: { autoApply: { max: 0.35 }, supervised: { min: 0.35, max: 0.75 }, humanApproval: { min: 0.75 } },
  david: { autoApply: { max: 0.2 }, supervised: { min: 0.2, max: 0.5 }, humanApproval: { min: 0.5 } }
};

// ConflictType and ResolutionStrategy are imported from ./types
// to avoid duplication and maintain single source of truth
import type { ConflictType, ResolutionStrategy } from './types';

/**
 * EvaluationCoordinator orchestrates the multi-agent evaluation pipeline.
 * 
 * Key responsibilities:
 * 1. Execute evaluation DAG with proper dependency ordering
 * 2. Aggregate persona outputs using weighted combination
 * 3. Detect and resolve conflicts between personas
 * 4. Track Brier scores for Phil's calibration
 * 5. Apply David's metacognitive checks to the final output
 */
export class EvaluationCoordinator {
  private personas: Map<string, SystemAgentBinding>;
  private weights: Record<string, number>;
  private forecastHistory: ForecastRecord[] = [];
  private readonly brierScoreWindow = 100;  // Rolling window for calibration
  private promptLoader: PromptTemplateLoader;
  private escalationThresholds: Map<string, EscalationThresholds>;
  
  constructor(
    personas: Map<string, SystemAgentBinding>,
    weights: Record<string, number> = AGGREGATION_WEIGHTS
  ) {
    this.personas = personas;
    this.weights = weights;
    this.promptLoader = createPromptTemplateLoader();
    this.escalationThresholds = this.extractEscalationThresholds();
    this.validateWeights();
  }
  
  /**
   * Extract escalation thresholds from persona configs.
   * Falls back to defaults if config not available.
   */
  private extractEscalationThresholds(): Map<string, EscalationThresholds> {
    const thresholds = new Map<string, EscalationThresholds>();
    
    for (const [personaId, persona] of this.personas) {
      const configThresholds = persona.config?.escalationRules?.riskThresholds;
      
      if (configThresholds) {
        // Extract from persona config
        thresholds.set(personaId, {
          autoApply: { max: configThresholds.autoApply?.max ?? 0.3 },
          supervised: {
            min: configThresholds.supervised?.min ?? 0.3,
            max: configThresholds.supervised?.max ?? 0.7
          },
          humanApproval: { min: configThresholds.humanApproval?.min ?? 0.7 }
        });
      } else {
        // Fall back to defaults
        thresholds.set(personaId, DEFAULT_ESCALATION_THRESHOLDS[personaId] || {
          autoApply: { max: 0.3 },
          supervised: { min: 0.3, max: 0.7 },
          humanApproval: { min: 0.7 }
        });
      }
    }
    
    return thresholds;
  }
  
  /**
   * Get escalation threshold for a specific persona.
   */
  getEscalationThreshold(personaId: string): EscalationThresholds {
    return this.escalationThresholds.get(personaId) || DEFAULT_ESCALATION_THRESHOLDS[personaId] || {
      autoApply: { max: 0.3 },
      supervised: { min: 0.3, max: 0.7 },
      humanApproval: { min: 0.7 }
    };
  }
  
  /**
   * Compute aggregated escalation boundaries from all persona thresholds.
   * Uses the most conservative (lowest) autoApply and supervised max.
   */
  private computeAggregatedEscalationBoundaries(): { autoApplyMax: number; supervisedMax: number } {
    let autoApplyMax: number = ESCALATION_RISK_BOUNDARIES.AUTO_APPLY_MAX;
    let supervisedMax: number = ESCALATION_RISK_BOUNDARIES.SUPERVISED_MAX;
    
    for (const thresholds of this.escalationThresholds.values()) {
      autoApplyMax = Math.min(autoApplyMax, thresholds.autoApply.max);
      supervisedMax = Math.min(supervisedMax, thresholds.supervised.max);
    }
    
    return { autoApplyMax, supervisedMax };
  }
  
  /**
   * Validate that weights sum to 1.0 (allowing for floating point tolerance)
   */
  private validateWeights(): void {
    const sum = Object.values(this.weights).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1.0) > 0.001) {
      throw new Error(`Aggregation weights must sum to 1.0, got ${sum}`);
    }
  }
  
  /**
   * Execute the full evaluation pipeline for an artifact.
   * 
   * The pipeline follows dependency order:
   * 1. Ada evaluates pattern quality (no dependencies)
   * 2. Lea evaluates implementation feasibility (depends on Ada)
   * 3. Phil forecasts success probability (depends on Ada, Lea)
   * 4. David performs metacognitive checks (depends on all)
   * 
   * @param artifact - The item being evaluated (prompt, code, design, etc.)
   * @param context - Additional context for evaluation
   * @returns Aggregated evaluation with conflict resolution
   */
  async evaluate(
    artifact: string,
    context: EvaluationContext
  ): Promise<AggregatedEvaluation> {
    const outputs: Map<string, PersonaOutput> = new Map();
    const startTime = Date.now();
    
    // Stage 1: Ada (Pattern Analysis) - No dependencies
    const adaOutput = await this.executePersona('ada', artifact, context, {});
    outputs.set('ada', adaOutput);
    
    // Stage 2: Lea (Implementation Analysis) - Depends on Ada
    const leaContext = this.buildDependencyContext(['ada'], outputs);
    const leaOutput = await this.executePersona('lea', artifact, context, leaContext);
    outputs.set('lea', leaOutput);
    
    // Stage 3: Phil (Forecast Analysis) - Depends on Ada, Lea
    const philContext = this.buildDependencyContext(['ada', 'lea'], outputs);
    const philOutput = await this.executePersona('phil', artifact, context, philContext);
    outputs.set('phil', philOutput);
    
    // Record Phil's forecast for Brier tracking
    if (philOutput.scorecard.successProbability !== undefined) {
      this.recordForecast(
        context.evaluationId,
        philOutput.scorecard.successProbability as number,
        context.description
      );
    }
    
    // Stage 4: David (Metacognitive Checks) - Depends on all
    const davidContext = this.buildDependencyContext(['ada', 'lea', 'phil'], outputs);
    const davidOutput = await this.executePersona('david', artifact, context, davidContext);
    outputs.set('david', davidOutput);
    
    // Detect conflicts between persona outputs
    const conflicts = this.detectConflicts(outputs);
    
    // Aggregate outputs with weighted combination
    const aggregated = this.aggregateOutputs(outputs, conflicts);
    
    // Apply David's final metacognitive checks
    const finalResult = this.applyMetacognitiveChecks(aggregated, davidOutput);
    
    finalResult.totalLatencyMs = Date.now() - startTime;
    finalResult.evaluationId = context.evaluationId;
    
    return finalResult;
  }
  
  /**
   * Execute a single persona's evaluation.
   * 
   * @param personaId - Which persona to invoke
   * @param artifact - Item being evaluated
   * @param context - Global evaluation context
   * @param dependencyOutputs - Outputs from dependency personas
   */
  private async executePersona(
    personaId: string,
    artifact: string,
    context: EvaluationContext,
    dependencyOutputs: Record<string, Partial<PersonaOutput>>
  ): Promise<PersonaOutput> {
    const persona = this.personas.get(personaId);
    if (!persona) {
      throw new Error(`Persona ${personaId} not loaded`);
    }
    
    const startTime = Date.now();
    
    // Build prompt with persona-specific instructions and dependency context
    const prompt = this.buildEvaluationPrompt(personaId, artifact, context, dependencyOutputs);
    
    // Execute via the SystemAgentBinding (which handles model routing)
    const result = await persona.evaluate(prompt, {
      temperature: persona.config.modelConfig.defaultTemperature,
      maxTokens: 2048,
      timeout: persona.config.modelConfig.latencyBudgetMs
    });
    
    const latencyMs = Date.now() - startTime;
    
    return {
      personaId: personaId as PersonaOutput['personaId'],
      scorecard: result.scorecard,
      riskScore: result.riskScore,
      confidence: result.confidence,
      recommendations: result.recommendations,
      requiresHumanReview: result.requiresHumanReview,
      timestamp: new Date(),
      latencyMs
    };
  }
  
  /**
   * Build the evaluation prompt for a specific persona.
   * Each persona has different evaluation dimensions and receives
   * different inputs from their dependencies.
   */
  private buildEvaluationPrompt(
    personaId: string,
    artifact: string,
    context: EvaluationContext,
    dependencyOutputs: Record<string, Partial<PersonaOutput>>
  ): string {
    const prompts: Record<string, (a: string, c: EvaluationContext, d: Record<string, Partial<PersonaOutput>>) => string> = {
      ada: this.buildAdaPrompt.bind(this),
      lea: this.buildLeaPrompt.bind(this),
      phil: this.buildPhilPrompt.bind(this),
      david: this.buildDavidPrompt.bind(this)
    };
    
    const builder = prompts[personaId];
    if (!builder) {
      throw new Error(`Unknown persona: ${personaId}`);
    }
    
    return builder(artifact, context, dependencyOutputs);
  }
  
  /**
   * Ada: Pattern Quality Analysis
   * Evaluates: structuralElegance, composability, reasoningChainEfficiency, patternNovelty, crossDomainPotential
   */
  private buildAdaPrompt(
    artifact: string,
    context: EvaluationContext,
    _deps: Record<string, Partial<PersonaOutput>>
  ): string {
    return `You are Ada, a Pattern Analyst evaluating structural elegance and conceptual coherence.

## Artifact to Evaluate
${artifact}

## Context
${context.description}

## Evaluation Dimensions (rate each 0-10)

1. **Structural Elegance** (weight: 0.25)
   - How well-organized and aesthetically pleasing is the structure?
   - Are there unnecessary complications or redundancies?

2. **Composability** (weight: 0.25)
   - Can components be combined in different ways?
   - Are interfaces clean and modular?

3. **Reasoning Chain Efficiency** (weight: 0.20)
   - How direct is the logical flow?
   - Are there unnecessary steps or circular reasoning?

4. **Pattern Novelty** (weight: 0.15)
   - Does this introduce useful new patterns?
   - Is it appropriately innovative vs. proven?

5. **Cross-Domain Potential** (weight: 0.15)
   - Can these patterns transfer to other domains?
   - Is the abstraction level appropriate?

## Output Format (JSON)
{
  "scorecard": {
    "structuralElegance": <0-10>,
    "composability": <0-10>,
    "reasoningChainEfficiency": <0-10>,
    "patternNovelty": <0-10>,
    "crossDomainPotential": <0-10>
  },
  "riskScore": <0-1>,
  "confidence": <0-1>,
  "recommendations": ["..."],
  "requiresHumanReview": <boolean>
}`;
  }
  
  /**
   * Lea: Implementation Quality Analysis
   * Evaluates: practicalApplicability, maintainability, scalabilityPotential, developerErgonomics, antiPatternRisk
   * Receives: Ada's pattern scores
   */
  private buildLeaPrompt(
    artifact: string,
    context: EvaluationContext,
    deps: Record<string, Partial<PersonaOutput>>
  ): string {
    const adaScores = deps.ada?.scorecard || {};
    
    return `You are Lea, an Implementation Analyst evaluating practical feasibility and code quality.

## Artifact to Evaluate
${artifact}

## Context
${context.description}

## Input from Ada (Pattern Analysis)
- Structural Elegance: ${adaScores.structuralElegance ?? 'N/A'}
- Composability: ${adaScores.composability ?? 'N/A'}
- Pattern Novelty: ${adaScores.patternNovelty ?? 'N/A'}

Consider Ada's assessment when evaluating implementation feasibility.
High elegance + low practicality = over-engineered.
Low elegance + high practicality = technical debt risk.

## Evaluation Dimensions (rate each 0-10)

1. **Practical Applicability** (weight: 0.30)
   - Can this be implemented with current resources?
   - Are there blocking dependencies?

2. **Maintainability** (weight: 0.25)
   - How easy will this be to maintain long-term?
   - Is the complexity justified?

3. **Scalability Potential** (weight: 0.20)
   - Will this scale to expected load?
   - Are there performance bottlenecks?

4. **Developer Ergonomics** (weight: 0.15)
   - How easy is this to work with?
   - Is the API intuitive?

5. **Anti-Pattern Risk** (weight: 0.10)
   - Does this use known anti-patterns?
   - What technical debt risks exist?

## Output Format (JSON)
{
  "scorecard": {
    "practicalApplicability": <0-10>,
    "maintainability": <0-10>,
    "scalabilityPotential": <0-10>,
    "developerErgonomics": <0-10>,
    "antiPatternRisk": <0-10>
  },
  "riskScore": <0-1>,
  "confidence": <0-1>,
  "recommendations": ["..."],
  "requiresHumanReview": <boolean>
}`;
  }
  
  /**
   * Phil: Forecast & Probability Analysis
   * Evaluates: successProbability, confidenceCalibration, baseRateAlignment, falsifiability, updateMagnitude
   * Receives: Ada's and Lea's scores
   * 
   * Key insight from Tetlock: Break problems into components, use base rates,
   * express uncertainty in precise probabilities.
   */
  private buildPhilPrompt(
    artifact: string,
    context: EvaluationContext,
    deps: Record<string, Partial<PersonaOutput>>
  ): string {
    const adaScores = deps.ada?.scorecard || {};
    const leaScores = deps.lea?.scorecard || {};
    const currentBrierScore = this.calculateRollingBrierScore();
    
    return `You are Phil (Philip Tetlock), a Forecast Analyst applying superforecasting principles.

## Artifact to Evaluate
${artifact}

## Context
${context.description}

## Input from Prior Evaluators
### Ada (Pattern Analysis)
- Structural Elegance: ${adaScores.structuralElegance ?? 'N/A'}
- Composability: ${adaScores.composability ?? 'N/A'}
- Pattern Novelty: ${adaScores.patternNovelty ?? 'N/A'}

### Lea (Implementation Analysis)
- Practical Applicability: ${leaScores.practicalApplicability ?? 'N/A'}
- Developer Ergonomics: ${leaScores.developerErgonomics ?? 'N/A'}
- Anti-Pattern Risk: ${leaScores.antiPatternRisk ?? 'N/A'}

## Your Calibration Status
Current rolling Brier score: ${currentBrierScore.toFixed(3)} (window: ${this.brierScoreWindow})
${currentBrierScore > CONFLICT_THRESHOLDS.BRIER_DRIFT_THRESHOLD ? '⚠️ Calibration drift detected - be more conservative' : '✓ Calibration acceptable'}

## Superforecasting Principles (apply these)
1. Break the problem into tractable sub-questions
2. Start with base rates (outside view) before specifics (inside view)
3. Express uncertainty in precise probabilities (not ranges)
4. Consider clashing causal forces
5. Update beliefs incrementally with new evidence

## Evaluation Dimensions

1. **Success Probability** (0-1, precise)
   - What's the probability this achieves its intended outcome?
   - Use base rates: What % of similar efforts succeed?

2. **Confidence Calibration** (0-10)
   - How well-calibrated are the stated confidence levels?
   - 70% predictions should be right ~70% of the time

3. **Base Rate Alignment** (0-10)
   - Are estimates consistent with historical base rates?
   - Is the inside view overriding outside view?

4. **Falsifiability** (0-10)
   - Can this be proven wrong? Are success criteria clear?
   - How will we know if we're right or wrong?

5. **Update Magnitude** (0-10)
   - Are belief updates proportional to evidence strength?
   - Neither under- nor over-reacting to new information

## Output Format (JSON)
{
  "scorecard": {
    "successProbability": <0-1, e.g., 0.72>,
    "confidenceCalibration": <0-10>,
    "baseRateAlignment": <0-10>,
    "falsifiability": <0-10>,
    "updateMagnitude": <0-10>
  },
  "brierScore": null,  // Will be calculated when outcome is known
  "riskScore": <0-1>,
  "confidence": <0-1>,
  "recommendations": ["..."],
  "requiresHumanReview": <boolean>
}`;
  }
  
  /**
   * David: Metacognitive Guardian
   * Evaluates: overconfidenceRisk, blindSpotDetection, biasesIdentified, selfAssessmentAccuracy, humilityScore
   * Receives: ALL prior outputs
   * 
   * Key insight from Dunning-Kruger: Those least competent are often most confident.
   * David's role is to detect when the evaluation pipeline itself may be biased.
   */
  private buildDavidPrompt(
    artifact: string,
    context: EvaluationContext,
    deps: Record<string, Partial<PersonaOutput>>
  ): string {
    const adaOutput = deps.ada || {};
    const leaOutput = deps.lea || {};
    const philOutput = deps.phil || {};
    
    // Check for unanimous agreement (suspicious per Delphi method)
    const confidences = [adaOutput.confidence, leaOutput.confidence, philOutput.confidence].filter(c => c !== undefined);
    const avgConfidence = confidences.length > 0 ? confidences.reduce((a, b) => a! + b!, 0)! / confidences.length : 0;
    const unanimousHighConfidence = avgConfidence > CONFLICT_THRESHOLDS.UNANIMOUS_CONFIDENCE;
    
    return `You are David (David Dunning), a Metacognitive Guardian monitoring for cognitive biases.

## Artifact Being Evaluated
${artifact}

## Context
${context.description}

## Full Pipeline Outputs to Review

### Ada (Pattern Analysis)
- Risk Score: ${adaOutput.riskScore ?? 'N/A'}
- Confidence: ${adaOutput.confidence ?? 'N/A'}
- Requires Human Review: ${adaOutput.requiresHumanReview ?? 'N/A'}

### Lea (Implementation Analysis)
- Risk Score: ${leaOutput.riskScore ?? 'N/A'}
- Confidence: ${leaOutput.confidence ?? 'N/A'}
- Requires Human Review: ${leaOutput.requiresHumanReview ?? 'N/A'}

### Phil (Forecast Analysis)
- Success Probability: ${philOutput.scorecard?.successProbability ?? 'N/A'}
- Risk Score: ${philOutput.riskScore ?? 'N/A'}
- Confidence: ${philOutput.confidence ?? 'N/A'}
- Requires Human Review: ${philOutput.requiresHumanReview ?? 'N/A'}

## ⚠️ Metacognitive Alerts
${unanimousHighConfidence ? '🚨 UNANIMOUS HIGH CONFIDENCE DETECTED - This is a red flag per Delphi method' : ''}
${avgConfidence > CONFLICT_THRESHOLDS.HIGH_AVG_CONFIDENCE ? '⚠️ Average confidence very high - check for overconfidence' : ''}

## Dunning-Kruger Principles (apply these)
1. The unskilled are often unaware of their incompetence
2. High confidence without corresponding evidence is suspect
3. Look for what's NOT being considered (blind spots)
4. Unanimous agreement may indicate groupthink
5. Check if stated confidence matches demonstrated competence

## Evaluation Dimensions

1. **Overconfidence Risk** (0-10)
   - Is stated confidence justified by evidence?
   - Are limitations acknowledged appropriately?

2. **Blind Spot Detection** (list of strings)
   - What factors are NOT being considered?
   - What perspectives are missing?

3. **Biases Identified** (list of strings)
   - What cognitive biases may be affecting the evaluation?
   - (anchoring, confirmation, availability, hindsight, etc.)

4. **Self-Assessment Accuracy** (0-10)
   - Do confidence levels match demonstrated accuracy?
   - Is there evidence of calibration?

5. **Humility Score** (0-10)
   - Are uncertainties acknowledged?
   - Is there appropriate epistemic humility?

## Output Format (JSON)
{
  "scorecard": {
    "overconfidenceRisk": <0-10>,
    "blindSpotDetection": ["...", "..."],
    "biasesIdentified": ["...", "..."],
    "selfAssessmentAccuracy": <0-10>,
    "humilityScore": <0-10>
  },
  "riskScore": <0-1>,
  "confidence": <0-1>,
  "recommendations": ["..."],
  "requiresHumanReview": <boolean>
}`;
  }
  
  /**
   * Build context from dependency outputs for a persona
   */
  private buildDependencyContext(
    dependencies: string[],
    outputs: Map<string, PersonaOutput>
  ): Record<string, Partial<PersonaOutput>> {
    const context: Record<string, Partial<PersonaOutput>> = {};
    for (const dep of dependencies) {
      const output = outputs.get(dep);
      if (output) {
        context[dep] = {
          scorecard: output.scorecard,
          riskScore: output.riskScore,
          confidence: output.confidence,
          requiresHumanReview: output.requiresHumanReview
        };
      }
    }
    return context;
  }
  
  /**
   * Detect conflicts between persona outputs.
   * 
   * Conflict types:
   * - risk_disagreement: >0.3 difference in risk scores
   * - confidence_mismatch: Phil flags overconfidence, others don't
   * - unanimous_warning: David flags high unanimous confidence
   * - threshold_boundary: Aggregated score near escalation boundary
   */
  private detectConflicts(outputs: Map<string, PersonaOutput>): ConflictType[] {
    const conflicts: ConflictType[] = [];
    
    // Check risk disagreement
    const riskScores = Array.from(outputs.values()).map(o => o.riskScore);
    const maxRisk = Math.max(...riskScores);
    const minRisk = Math.min(...riskScores);
    if (maxRisk - minRisk > CONFLICT_THRESHOLDS.RISK_DISAGREEMENT) {
      conflicts.push('risk_disagreement');
    }
    
    // Check confidence mismatch
    const philOutput = outputs.get('phil');
    const davidOutput = outputs.get('david');
    if (philOutput && davidOutput) {
      const philConfidence = philOutput.confidence;
      const davidOverconfidenceRisk = davidOutput.scorecard.overconfidenceRisk as number;
      if (davidOverconfidenceRisk > CONFLICT_THRESHOLDS.OVERCONFIDENCE_RISK && philConfidence > CONFLICT_THRESHOLDS.PHIL_CONFIDENCE) {
        conflicts.push('confidence_mismatch');
      }
    }
    
    // Check unanimous warning
    if (davidOutput) {
      const biases = davidOutput.scorecard.biasesIdentified as string[] || [];
      if (biases.some(b => b.toLowerCase().includes('groupthink') || b.toLowerCase().includes('unanimous'))) {
        conflicts.push('unanimous_warning');
      }
    }
    
    // Check threshold boundary
    const aggregatedRisk = this.calculateWeightedRisk(outputs);
    if (aggregatedRisk > CONFLICT_THRESHOLDS.THRESHOLD_BOUNDARY_LOW && aggregatedRisk < CONFLICT_THRESHOLDS.THRESHOLD_BOUNDARY_HIGH) {
      conflicts.push('threshold_boundary');
    }
    
    return conflicts;
  }
  
  /**
   * Calculate weighted risk score from all persona outputs
   */
  private calculateWeightedRisk(outputs: Map<string, PersonaOutput>): number {
    let totalWeight = 0;
    let weightedSum = 0;
    
    for (const [personaId, output] of outputs) {
      const weight = this.weights[personaId] || 0;
      weightedSum += output.riskScore * weight;
      totalWeight += weight;
    }
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }
  
  /**
   * Aggregate outputs using weighted combination with conflict resolution.
   * 
   * Aggregation strategy (from routing_config.json):
   * - Use weighted averages per persona weight
   * - Conflicts resolved via "defer_to_coordinator" (this function)
   */
  private aggregateOutputs(
    outputs: Map<string, PersonaOutput>,
    conflicts: ConflictType[]
  ): AggregatedEvaluation {
    // Weighted risk score
    const aggregatedRisk = this.calculateWeightedRisk(outputs);
    
    // Weighted confidence
    let weightedConfidence = 0;
    for (const [personaId, output] of outputs) {
      weightedConfidence += output.confidence * (this.weights[personaId] || 0);
    }
    
    // Collect all recommendations (deduplicated)
    const allRecommendations = new Set<string>();
    for (const output of outputs.values()) {
      output.recommendations.forEach(r => allRecommendations.add(r));
    }
    
    // Determine if human review required
    const anyRequiresHuman = Array.from(outputs.values()).some(o => o.requiresHumanReview);
    
    // Apply conflict resolution
    let resolution: ResolutionStrategy = 'defer_to_coordinator';
    if (conflicts.includes('unanimous_warning') || conflicts.includes('confidence_mismatch')) {
      resolution = 'conservative_bound';
      // When David flags overconfidence, use the most conservative estimate
      const maxRisk = Math.max(...Array.from(outputs.values()).map(o => o.riskScore));
      return {
        aggregatedRiskScore: maxRisk,
        aggregatedConfidence: Math.min(weightedConfidence, CONFLICT_THRESHOLDS.CONFIDENCE_CAP_ON_CONFLICT),  // Cap confidence
        recommendations: Array.from(allRecommendations),
        requiresHumanReview: true,  // Force human review on conflicts
        conflicts,
        resolution,
        personaOutputs: Object.fromEntries(outputs) as Record<string, PersonaOutput>,
        evaluationId: '',
        totalLatencyMs: 0
      };
    }
    
    // Determine escalation level using aggregated thresholds from persona configs
    const { autoApplyMax, supervisedMax } = this.computeAggregatedEscalationBoundaries();
    let escalationLevel: 'autoApply' | 'supervised' | 'humanApproval';
    if (aggregatedRisk < autoApplyMax) {
      escalationLevel = 'autoApply';
    } else if (aggregatedRisk < supervisedMax) {
      escalationLevel = 'supervised';
    } else {
      escalationLevel = 'humanApproval';
    }
    
    return {
      aggregatedRiskScore: aggregatedRisk,
      aggregatedConfidence: weightedConfidence,
      recommendations: Array.from(allRecommendations),
      requiresHumanReview: anyRequiresHuman || escalationLevel === 'humanApproval',
      conflicts,
      resolution,
      escalationLevel,
      personaOutputs: Object.fromEntries(outputs) as Record<string, PersonaOutput>,
      evaluationId: '',
      totalLatencyMs: 0
    };
  }
  
  /**
   * Apply David's metacognitive checks to the final aggregated output.
   * This is the "meta-evaluation" that checks if the entire pipeline may be biased.
   */
  private applyMetacognitiveChecks(
    aggregated: AggregatedEvaluation,
    davidOutput: PersonaOutput
  ): AggregatedEvaluation {
    const result = { ...aggregated };
    
    // Add metacognitive metadata
    result.metacognitive = {
      overconfidenceRisk: davidOutput.scorecard.overconfidenceRisk as number,
      blindSpots: davidOutput.scorecard.blindSpotDetection as string[],
      biasesIdentified: davidOutput.scorecard.biasesIdentified as string[],
      humilityScore: davidOutput.scorecard.humilityScore as number
    };
    
    // Force human review if David identifies significant blind spots
    const blindSpots = davidOutput.scorecard.blindSpotDetection as string[] || [];
    if (blindSpots.length >= CONFLICT_THRESHOLDS.BLIND_SPOTS_MINIMUM) {
      result.requiresHumanReview = true;
      result.recommendations = [
        `⚠️ ${blindSpots.length} blind spots identified - human review recommended`,
        ...result.recommendations
      ];
    }
    
    // Adjust confidence based on overconfidence risk
    const overconfidenceRisk = davidOutput.scorecard.overconfidenceRisk as number;
    if (overconfidenceRisk > CONFLICT_THRESHOLDS.OVERCONFIDENCE_RISK) {
      result.aggregatedConfidence *= CONFLICT_THRESHOLDS.CONFIDENCE_REDUCTION_FACTOR;  // Reduce confidence by 20%
      result.recommendations = [
        '⚠️ Overconfidence risk detected - confidence adjusted downward',
        ...result.recommendations
      ];
    }
    
    return result;
  }
  
  /**
   * Record a forecast for Brier score tracking.
   * The outcome will be recorded later when known.
   */
  private recordForecast(id: string, prediction: number, context: string): void {
    this.forecastHistory.push({
      id,
      prediction,
      outcome: undefined,  // Will be set when outcome is known
      brierScore: undefined,
      timestamp: new Date(),
      context
    });
    
    // Trim to window size
    if (this.forecastHistory.length > this.brierScoreWindow * 2) {
      this.forecastHistory = this.forecastHistory.slice(-this.brierScoreWindow);
    }
  }
  
  /**
   * Record the outcome of a prior forecast and calculate its Brier score.
   * 
   * Brier Score = (prediction - outcome)²
   * - 0.0 = perfect prediction
   * - 0.25 = random guessing (50% predictions)
   * - 2.0 = worst possible (100% confidence, wrong)
   */
  recordOutcome(forecastId: string, outcome: boolean): void {
    const forecast = this.forecastHistory.find(f => f.id === forecastId);
    if (forecast && forecast.outcome === undefined) {
      forecast.outcome = outcome;
      const outcomeValue = outcome ? 1 : 0;
      forecast.brierScore = Math.pow(forecast.prediction - outcomeValue, 2);
    }
  }
  
  /**
   * Calculate rolling Brier score for calibration monitoring.
   * 
   * Per Tetlock's research:
   * - Score < 0.2: Excellent calibration (superforecaster level)
   * - Score 0.2-0.25: Good calibration
   * - Score > 0.25: Calibration drift, need adjustment
   */
  calculateRollingBrierScore(): number {
    const resolvedForecasts = this.forecastHistory.filter(f => f.brierScore !== undefined);
    if (resolvedForecasts.length === 0) {
      return CONFLICT_THRESHOLDS.DEFAULT_BRIER_SCORE;  // Default to random guess baseline
    }
    
    const recentForecasts = resolvedForecasts.slice(-this.brierScoreWindow);
    const totalScore = recentForecasts.reduce((sum, f) => sum + f.brierScore!, 0);
    return totalScore / recentForecasts.length;
  }
  
  /**
   * Get calibration statistics for Phil's forecast tracking.
   */
  getCalibrationStats(): CalibrationStats {
    const resolved = this.forecastHistory.filter(f => f.outcome !== undefined);
    
    // Group by probability bucket (0-10%, 10-20%, etc.)
    const buckets: Map<string, { predictions: number; hits: number }> = new Map();
    for (const f of resolved) {
      const bucket = Math.floor(f.prediction * 10) * 10;
      const key = `${bucket}-${bucket + 10}%`;
      const existing = buckets.get(key) || { predictions: 0, hits: 0 };
      existing.predictions++;
      if (f.outcome) existing.hits++;
      buckets.set(key, existing);
    }
    
    // Calculate calibration per bucket
    const calibration: Record<string, { expected: number; actual: number; count: number }> = {};
    for (const [key, data] of buckets) {
      const bucketMid = parseInt(key) / 100 + 0.05;
      calibration[key] = {
        expected: bucketMid,
        actual: data.predictions > 0 ? data.hits / data.predictions : 0,
        count: data.predictions
      };
    }
    
    return {
      rollingBrierScore: this.calculateRollingBrierScore(),
      totalForecasts: this.forecastHistory.length,
      resolvedForecasts: resolved.length,
      calibrationByBucket: calibration
    };
  }
}

/**
 * Context provided for each evaluation
 */
export interface EvaluationContext {
  evaluationId: string;
  description: string;
  artifactType: 'prompt' | 'code' | 'design' | 'proposal' | 'other';
  requestedBy?: string;
  urgency?: 'low' | 'normal' | 'high';
  additionalContext?: Record<string, unknown>;
}

/**
 * Calibration statistics for forecast tracking
 */
export interface CalibrationStats {
  rollingBrierScore: number;
  totalForecasts: number;
  resolvedForecasts: number;
  calibrationByBucket: Record<string, { expected: number; actual: number; count: number }>;
}
