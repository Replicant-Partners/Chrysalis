/**
 * Adaptation System - AI Lead Adaptation Infrastructure
 *
 * Exports for the adaptation system components.
 */

export { AgentCoordinator, AgentCoordinatorConfig, AgentTask, TaskResult, ChangeProposal, ImpactAnalysis } from './AgentCoordinator';
export { HumanValidationSystem, ValidationRequest, ValidationResponse, ValidationWorkflowConfig } from './HumanValidationSystem';
export { AdaptationTracker, AdaptationEvent, AdaptationOutcome, AdaptationMetrics } from './AdaptationTracker';
export { LearningLoop, LearningPattern, ExperienceEntry } from './LearningLoop';
export { EvidenceBasedAdaptation, KataCycle, KataState, ConditionMeasurement, TargetCondition, Obstacle, NextStep, Experiment } from './EvidenceBasedAdaptation';

// Code evolution agents
export { QualityAnalysisAgent, QualityMetrics, QualityIssue } from './agents/QualityAnalysisAgent';
export { RefactoringAgent, RefactoringPattern, RefactoringProposal } from './agents/RefactoringAgent';