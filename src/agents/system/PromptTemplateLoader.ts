/**
 * PromptTemplateLoader - Load and render evaluation prompts for system agents
 *
 * This module provides a template loading system that:
 * 1. Loads prompt templates based on promptSetId from persona configs
 * 2. Supports variable interpolation ({{variable}})
 * 3. Caches loaded templates for performance
 * 4. Falls back to embedded defaults if templates not found
 *
 * @module agents/system/PromptTemplateLoader
 */

import type { SystemAgentPersonaId, PersonaConfig } from './types';

// =============================================================================
// Types
// =============================================================================

/**
 * Template variables for prompt rendering
 */
export interface TemplateVariables {
  artifact: string;
  context: string;
  evaluationDimensions?: string;
  dependencyOutputs?: string;
  calibrationStatus?: string;
  metacognitiveAlerts?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Loaded prompt template with metadata
 */
export interface PromptTemplate {
  id: string;
  personaId: SystemAgentPersonaId;
  template: string;
  version: string;
  dimensions: string[];
}

// =============================================================================
// Embedded Default Templates
// =============================================================================

/**
 * Default templates embedded in code as fallback.
 * These match the inline prompts from EvaluationCoordinator.
 */
const DEFAULT_TEMPLATES: Record<SystemAgentPersonaId, PromptTemplate> = {
  ada: {
    id: 'ada_evaluation_prompts',
    personaId: 'ada',
    version: '1.0.0',
    dimensions: ['structuralElegance', 'composability', 'reasoningChainEfficiency', 'patternNovelty', 'crossDomainPotential'],
    template: `You are Ada, a Pattern Analyst evaluating structural elegance and conceptual coherence.

## Artifact to Evaluate
{{artifact}}

## Context
{{context}}

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
}`
  },

  lea: {
    id: 'lea_evaluation_prompts',
    personaId: 'lea',
    version: '1.0.0',
    dimensions: ['practicalApplicability', 'maintainability', 'scalabilityPotential', 'developerErgonomics', 'antiPatternRisk'],
    template: `You are Lea, an Implementation Analyst evaluating practical feasibility and code quality.

## Artifact to Evaluate
{{artifact}}

## Context
{{context}}

## Input from Ada (Pattern Analysis)
{{dependencyOutputs}}

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
}`
  },

  phil: {
    id: 'phil_evaluation_prompts',
    personaId: 'phil',
    version: '1.0.0',
    dimensions: ['successProbability', 'confidenceCalibration', 'baseRateAlignment', 'falsifiability', 'updateMagnitude'],
    template: `You are Phil (Philip Tetlock), a Forecast Analyst applying superforecasting principles.

## Artifact to Evaluate
{{artifact}}

## Context
{{context}}

## Input from Prior Evaluators
{{dependencyOutputs}}

## Your Calibration Status
{{calibrationStatus}}

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
  "brierScore": null,
  "riskScore": <0-1>,
  "confidence": <0-1>,
  "recommendations": ["..."],
  "requiresHumanReview": <boolean>
}`
  },

  david: {
    id: 'david_evaluation_prompts',
    personaId: 'david',
    version: '1.0.0',
    dimensions: ['overconfidenceRisk', 'blindSpotDetection', 'biasesIdentified', 'selfAssessmentAccuracy', 'humilityScore'],
    template: `You are David (David Dunning), a Metacognitive Guardian monitoring for cognitive biases.

## Artifact Being Evaluated
{{artifact}}

## Context
{{context}}

## Full Pipeline Outputs to Review
{{dependencyOutputs}}

## Metacognitive Alerts
{{metacognitiveAlerts}}

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
}`
  }
};

// =============================================================================
// PromptTemplateLoader Class
// =============================================================================

/**
 * Loads and renders prompt templates for system agent evaluations.
 *
 * Templates are loaded from:
 * 1. External template files (if available) based on promptSetId
 * 2. Embedded defaults (fallback)
 *
 * Variables in templates use {{variableName}} syntax.
 */
export class PromptTemplateLoader {
  private cache: Map<string, PromptTemplate> = new Map();
  private templateBasePath: string;

  constructor(templateBasePath: string = 'Agents/system-agents/prompts') {
    this.templateBasePath = templateBasePath;
    this.initializeCache();
  }

  /**
   * Initialize cache with default templates
   */
  private initializeCache(): void {
    for (const [personaId, template] of Object.entries(DEFAULT_TEMPLATES)) {
      this.cache.set(template.id, template);
    }
  }

  /**
   * Get template for a persona by promptSetId
   *
   * @param promptSetId - The prompt set ID from persona config
   * @param personaId - Fallback persona ID if promptSetId not found
   * @returns The prompt template
   */
  getTemplate(promptSetId: string, personaId: SystemAgentPersonaId): PromptTemplate {
    // Try to get by promptSetId first
    let template = this.cache.get(promptSetId);

    // Fall back to persona default
    if (!template) {
      template = DEFAULT_TEMPLATES[personaId];
    }

    if (!template) {
      throw new Error(`No template found for promptSetId: ${promptSetId} or personaId: ${personaId}`);
    }

    return template;
  }

  /**
   * Render a template with variables
   *
   * @param template - The template string or PromptTemplate object
   * @param variables - Variables to interpolate
   * @returns Rendered prompt string
   */
  render(template: string | PromptTemplate, variables: TemplateVariables): string {
    const templateStr = typeof template === 'string' ? template : template.template;

    // Replace all {{variableName}} patterns
    return templateStr.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = variables[key];
      if (value === undefined) {
        return match; // Keep original if no value
      }
      return String(value);
    });
  }

  /**
   * Get and render template in one call
   *
   * @param promptSetId - The prompt set ID from persona config
   * @param personaId - Fallback persona ID
   * @param variables - Variables to interpolate
   * @returns Rendered prompt string
   */
  getAndRender(
    promptSetId: string,
    personaId: SystemAgentPersonaId,
    variables: TemplateVariables
  ): string {
    const template = this.getTemplate(promptSetId, personaId);
    return this.render(template, variables);
  }

  /**
   * Register a custom template
   *
   * @param template - Template to register
   */
  registerTemplate(template: PromptTemplate): void {
    this.cache.set(template.id, template);
  }

  /**
   * Build Ada-specific prompt with dependency outputs
   */
  buildAdaPrompt(
    config: PersonaConfig,
    artifact: string,
    context: string
  ): string {
    return this.getAndRender(config.promptSetId, 'ada', {
      artifact,
      context
    });
  }

  /**
   * Build Lea-specific prompt with Ada's output
   */
  buildLeaPrompt(
    config: PersonaConfig,
    artifact: string,
    context: string,
    adaScores: Record<string, number | string[]>
  ): string {
    const dependencyOutputs = `- Structural Elegance: ${adaScores.structuralElegance ?? 'N/A'}
- Composability: ${adaScores.composability ?? 'N/A'}
- Pattern Novelty: ${adaScores.patternNovelty ?? 'N/A'}`;

    return this.getAndRender(config.promptSetId, 'lea', {
      artifact,
      context,
      dependencyOutputs
    });
  }

  /**
   * Build Phil-specific prompt with Ada's and Lea's outputs
   */
  buildPhilPrompt(
    config: PersonaConfig,
    artifact: string,
    context: string,
    adaScores: Record<string, number | string[]>,
    leaScores: Record<string, number | string[]>,
    brierScore: number,
    brierThreshold: number
  ): string {
    const dependencyOutputs = `### Ada (Pattern Analysis)
- Structural Elegance: ${adaScores.structuralElegance ?? 'N/A'}
- Composability: ${adaScores.composability ?? 'N/A'}
- Pattern Novelty: ${adaScores.patternNovelty ?? 'N/A'}

### Lea (Implementation Analysis)
- Practical Applicability: ${leaScores.practicalApplicability ?? 'N/A'}
- Developer Ergonomics: ${leaScores.developerErgonomics ?? 'N/A'}
- Anti-Pattern Risk: ${leaScores.antiPatternRisk ?? 'N/A'}`;

    const calibrationStatus = `Current rolling Brier score: ${brierScore.toFixed(3)} (window: 100)
${brierScore > brierThreshold ? '⚠️ Calibration drift detected - be more conservative' : '✓ Calibration acceptable'}`;

    return this.getAndRender(config.promptSetId, 'phil', {
      artifact,
      context,
      dependencyOutputs,
      calibrationStatus
    });
  }

  /**
   * Build David-specific prompt with all prior outputs
   */
  buildDavidPrompt(
    config: PersonaConfig,
    artifact: string,
    context: string,
    adaOutput: { riskScore?: number; confidence?: number; requiresHumanReview?: boolean },
    leaOutput: { riskScore?: number; confidence?: number; requiresHumanReview?: boolean },
    philOutput: { riskScore?: number; confidence?: number; requiresHumanReview?: boolean; scorecard?: Record<string, number | string[]> },
    unanimousThreshold: number,
    highConfidenceThreshold: number
  ): string {
    const dependencyOutputs = `### Ada (Pattern Analysis)
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
- Requires Human Review: ${philOutput.requiresHumanReview ?? 'N/A'}`;

    // Check for unanimous high confidence
    const confidences = [adaOutput.confidence, leaOutput.confidence, philOutput.confidence]
      .filter((c): c is number => c !== undefined);
    const avgConfidence = confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0;
    const unanimousHighConfidence = avgConfidence > unanimousThreshold;

    let metacognitiveAlerts = '';
    if (unanimousHighConfidence) {
      metacognitiveAlerts += '🚨 UNANIMOUS HIGH CONFIDENCE DETECTED - This is a red flag per Delphi method\n';
    }
    if (avgConfidence > highConfidenceThreshold) {
      metacognitiveAlerts += '⚠️ Average confidence very high - check for overconfidence';
    }

    return this.getAndRender(config.promptSetId, 'david', {
      artifact,
      context,
      dependencyOutputs,
      metacognitiveAlerts: metacognitiveAlerts || 'No alerts'
    });
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new PromptTemplateLoader instance
 */
export function createPromptTemplateLoader(basePath?: string): PromptTemplateLoader {
  return new PromptTemplateLoader(basePath);
}

// =============================================================================
// Exports
// =============================================================================

export { DEFAULT_TEMPLATES };
