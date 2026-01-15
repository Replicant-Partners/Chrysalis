/**
 * Scenarios Canvas - Type Definitions
 * 
 * Future planning through scenario analysis
 */

export type TimeHorizonRange = '0-3 months' | '3-12 months' | '1-3 years' | '3-5 years' | '5+ years';
export type ScenarioStatus = 'active' | 'archived' | 'happened' | 'ruled-out';
export type Criticality = 'low' | 'medium' | 'high';
export type IndicatorType = 'leading' | 'lagging';
export type IndicatorCategory = 'political' | 'economic' | 'social' | 'technological' | 'environmental' | 'custom';
export type MeasurementMethod = 'manual' | 'automated' | 'agent-monitored';
export type TrendDirection = 'increasing' | 'decreasing' | 'stable' | 'volatile';
export type OutcomeCategory = 'opportunity' | 'threat' | 'neutral';
export type Impact = 'low' | 'medium' | 'high';
export type TriggerStatus = 'monitoring' | 'triggered' | 'executed';

export interface TimeHorizon {
  range: TimeHorizonRange;
  description?: string;
}

export interface Assumption {
  id: string;
  description: string;
  criticality: Criticality;
  confidence: number; // 0-100
  evidence?: string;
}

export interface Observation {
  id: string;
  date: number;
  value: string | number;
  source?: string;
  notes?: string;
  recordedBy: string;
}

export interface Indicator {
  id: string;
  name: string;
  description: string;
  type: IndicatorType;
  category: IndicatorCategory;
  measurementMethod: MeasurementMethod;
  currentValue?: string | number;
  targetValue?: string | number;
  observations: Observation[];
  trend?: TrendDirection;
  weight: number; // 1-10
  threshold?: number;
}

export interface Outcome {
  id: string;
  category: OutcomeCategory;
  description: string;
  impact: Impact;
  likelihood: number; // 0-100
}

export interface ProbabilityUpdate {
  date: number;
  oldProbability: number;
  newProbability: number;
  reason: string;
  updatedBy: string;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  probability: number; // 0-100
  timeHorizon: TimeHorizon;
  assumptions: Assumption[];
  indicators: Indicator[];
  outcomes: Outcome[];
  probabilityHistory: ProbabilityUpdate[];
  metadata: {
    createdAt: number;
    createdBy: string;
    tags: string[];
    status: ScenarioStatus;
  };
}

export interface DecisionTrigger {
  id: string;
  name: string;
  condition: string;
  action: string;
  status: TriggerStatus;
  triggeredAt?: number;
}

export interface ScenariosCanvasData {
  id: string;
  topic: string;
  description: string;
  scenarios: Scenario[];
  globalIndicators: Indicator[];
  decisionFramework: DecisionTrigger[];
  metadata: {
    createdAt: number;
    lastReviewDate: number;
    nextReviewDate: number;
  };
}

export interface ScenariosCanvasState {
  // UI State
  viewMode: 'board' | 'indicators' | 'timeline' | 'comparison';
  selectedScenarioIds: string[];
  filterByStatus: ScenarioStatus[];
  sortBy: 'probability' | 'name' | 'updated';
  comparisonScenarioIds: string[];
  
  // Computed
  totalProbability: number;
  needsReconciliation: boolean;
  overdueIndicators: Indicator[];
  
  // Actions
  createScenario: (scenario: Omit<Scenario, 'id' | 'probabilityHistory'>) => void;
  updateProbability: (scenarioId: string, newProb: number, reason: string) => void;
  addObservation: (indicatorId: string, obs: Omit<Observation, 'id'>) => void;
  archiveScenario: (scenarioId: string, reason: string) => void;
  scheduleReview: (date: number) => void;
  setViewMode: (mode: 'board' | 'indicators' | 'timeline' | 'comparison') => void;
  setSelectedScenarios: (ids: string[]) => void;
}