/**
 * Evidence-Based Adaptation - Metrics-driven adaptation using Toyota Kata principles
 *
 * Following the complex learner pattern and Toyota Kata (Mike Rother), evidence-based
 * adaptation uses metrics-driven decisions and continuous improvement (Kata) cycles.
 */

import { AdaptationTracker, AdaptationOutcome } from './AdaptationTracker';
import { LearningLoop, LearningPattern } from './LearningLoop';
import { ChangeProposal } from './AgentCoordinator';

/**
 * Kata cycle state (Toyota Kata)
 */
export enum KataState {
    CURRENT_CONDITION = 'current_condition',
    TARGET_CONDITION = 'target_condition',
    OBSTACLES = 'obstacles',
    NEXT_STEP = 'next_step',
    EXPERIMENT = 'experiment',
}

/**
 * Kata cycle
 */
export interface KataCycle {
    cycle_id: string;
    state: KataState;
    current_condition: ConditionMeasurement;
    target_condition: TargetCondition;
    obstacles: Obstacle[];
    next_steps: NextStep[];
    experiments: Experiment[];
    created_at: string;
    updated_at: string;
}

/**
 * Condition measurement (Current Condition in Kata)
 */
export interface ConditionMeasurement {
    metrics: Record<string, number>;
    timestamp: string;
    context: Record<string, any>;
    baseline?: Record<string, number>;
}

/**
 * Target condition (Target Condition in Kata)
 */
export interface TargetCondition {
    metrics: Record<string, number>;
    description: string;
    deadline?: string;
    rationale: string;
}

/**
 * Obstacle (Obstacles in Kata)
 */
export interface Obstacle {
    obstacle_id: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    blocking: boolean;
    mitigation_strategy?: string;
}

/**
 * Next step (Next Steps in Kata)
 */
export interface NextStep {
    step_id: string;
    description: string;
    target_metric: string;
    target_value: number;
    deadline?: string;
    rationale: string;
}

/**
 * Experiment (Experiments in Kata)
 */
export interface Experiment {
    experiment_id: string;
    hypothesis: string;
    change_proposal_id?: string;
    metrics_to_observe: string[];
    expected_outcome: Record<string, number>;
    actual_outcome?: Record<string, number>;
    success: boolean;
    started_at: string;
    completed_at?: string;
    learnings?: string;
}

/**
 * Evidence-Based Adaptation
 *
 * Metrics-driven adaptation using Toyota Kata principles.
 *
 * Following Toyota Kata (Mike Rother):
 * - Current Condition: Measure current state
 * - Target Condition: Define target state
 * - Obstacles: Identify blockers
 * - Next Steps: Plan next actions
 * - Experiments: Test hypotheses
 */
export class EvidenceBasedAdaptation {
    private tracker: AdaptationTracker;
    private learningLoop: LearningLoop;
    private kataCycles: Map<string, KataCycle> = new Map();
    private metricsHistory: ConditionMeasurement[] = [];

    constructor(tracker: AdaptationTracker, learningLoop: LearningLoop) {
        this.tracker = tracker;
        this.learningLoop = learningLoop;
    }

    /**
     * Start a new Kata cycle
     */
    async startKataCycle(
        targetCondition: TargetCondition,
        currentMetrics: Record<string, number>
    ): Promise<string> {
        const cycle_id = `kata_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const currentCondition: ConditionMeasurement = {
            metrics: currentMetrics,
            timestamp: new Date().toISOString(),
            context: {},
        };

        const cycle: KataCycle = {
            cycle_id,
            state: KataState.CURRENT_CONDITION,
            current_condition: currentCondition,
            target_condition: targetCondition,
            obstacles: [],
            next_steps: [],
            experiments: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        this.kataCycles.set(cycle_id, cycle);
        this.metricsHistory.push(currentCondition);

        // Move to target condition
        await this.defineTargetCondition(cycle_id, targetCondition);

        return cycle_id;
    }

    /**
     * Define target condition
     */
    async defineTargetCondition(cycle_id: string, targetCondition: TargetCondition): Promise<void> {
        const cycle = this.kataCycles.get(cycle_id);
        if (!cycle) throw new Error(`Cycle ${cycle_id} not found`);

        cycle.target_condition = targetCondition;
        cycle.state = KataState.TARGET_CONDITION;
        cycle.updated_at = new Date().toISOString();

        // Automatically identify obstacles
        await this.identifyObstacles(cycle_id);
    }

    /**
     * Identify obstacles
     */
    async identifyObstacles(cycle_id: string): Promise<void> {
        const cycle = this.kataCycles.get(cycle_id);
        if (!cycle) throw new Error(`Cycle ${cycle_id} not found`);

        const obstacles: Obstacle[] = [];

        // Compare current vs target metrics
        for (const [metric, targetValue] of Object.entries(cycle.target_condition.metrics)) {
            const currentValue = cycle.current_condition.metrics[metric] || 0;
            const gap = targetValue - currentValue;

            if (gap > 0) {
                obstacles.push({
                    obstacle_id: `obstacle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    description: `${metric} is ${currentValue}, target is ${targetValue} (gap: ${gap})`,
                    impact: this.calculateImpact(gap, targetValue),
                    blocking: gap > targetValue * 0.5, // Blocking if gap > 50% of target
                });
            }
        }

        // Check for patterns from learning loop
        const patterns = this.learningLoop.getPatternsForContext(cycle.current_condition.context);
        const failurePatterns = patterns.filter(p => p.pattern_type === 'failure');

        for (const pattern of failurePatterns) {
            obstacles.push({
                obstacle_id: `obstacle_pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                description: `Known failure pattern: ${pattern.description}`,
                impact: pattern.outcomes.successful / pattern.outcomes.total < 0.3 ? 'high' : 'medium',
                blocking: pattern.outcomes.successful / pattern.outcomes.total < 0.2,
                mitigation_strategy: `Avoid this pattern or address root cause`,
            });
        }

        cycle.obstacles = obstacles;
        cycle.state = KataState.OBSTACLES;
        cycle.updated_at = new Date().toISOString();

        // Automatically plan next steps
        await this.planNextSteps(cycle_id);
    }

    /**
     * Plan next steps
     */
    async planNextSteps(cycle_id: string): Promise<void> {
        const cycle = this.kataCycles.get(cycle_id);
        if (!cycle) throw new Error(`Cycle ${cycle_id} not found`);

        const nextSteps: NextStep[] = [];

        // Prioritize obstacles (high impact, blocking first)
        const sortedObstacles = [...cycle.obstacles].sort((a, b) => {
            if (a.blocking && !b.blocking) return -1;
            if (!a.blocking && b.blocking) return 1;
            if (a.impact === 'high' && b.impact !== 'high') return -1;
            if (a.impact !== 'high' && b.impact === 'high') return 1;
            return 0;
        });

        // Create next steps from top obstacles
        for (const obstacle of sortedObstacles.slice(0, 3)) { // Top 3 obstacles
            const step: NextStep = {
                step_id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                description: `Address obstacle: ${obstacle.description}`,
                target_metric: this.extractMetricFromObstacle(obstacle),
                target_value: this.extractTargetValueFromObstacle(obstacle, cycle.target_condition),
                rationale: `Addressing blocking obstacle to move toward target condition`,
            };

            nextSteps.push(step);
        }

        cycle.next_steps = nextSteps;
        cycle.state = KataState.NEXT_STEP;
        cycle.updated_at = new Date().toISOString();
    }

    /**
     * Start experiment
     */
    async startExperiment(
        cycle_id: string,
        hypothesis: string,
        changeProposal?: ChangeProposal
    ): Promise<string> {
        const cycle = this.kataCycles.get(cycle_id);
        if (!cycle) throw new Error(`Cycle ${cycle_id} not found`);

        const experiment_id = `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const currentMetrics = cycle.current_condition.metrics;
        const metricsToObserve = Object.keys(cycle.target_condition.metrics);

        const experiment: Experiment = {
            experiment_id,
            hypothesis,
            change_proposal_id: changeProposal?.proposal_id,
            metrics_to_observe: metricsToObserve,
            expected_outcome: this.calculateExpectedOutcome(
                currentMetrics,
                cycle.target_condition.metrics,
                0.1 // 10% improvement expected
            ),
            success: false,
            started_at: new Date().toISOString(),
        };

        cycle.experiments.push(experiment);
        cycle.state = KataState.EXPERIMENT;
        cycle.updated_at = new Date().toISOString();

        return experiment_id;
    }

    /**
     * Complete experiment
     */
    async completeExperiment(
        cycle_id: string,
        experiment_id: string,
        actualOutcome: Record<string, number>,
        learnings?: string
    ): Promise<void> {
        const cycle = this.kataCycles.get(cycle_id);
        if (!cycle) throw new Error(`Cycle ${cycle_id} not found`);

        const experiment = cycle.experiments.find(e => e.experiment_id === experiment_id);
        if (!experiment) throw new Error(`Experiment ${experiment_id} not found`);

        experiment.actual_outcome = actualOutcome;
        experiment.completed_at = new Date().toISOString();
        experiment.learnings = learnings;

        // Determine success (within 20% of expected outcome)
        experiment.success = this.isSuccess(experiment.expected_outcome, actualOutcome);

        // Update current condition based on outcome
        cycle.current_condition.metrics = {
            ...cycle.current_condition.metrics,
            ...actualOutcome,
        };
        cycle.current_condition.timestamp = new Date().toISOString();
        this.metricsHistory.push(cycle.current_condition);

        // Collect experience
        if (experiment.change_proposal_id) {
            const outcome: AdaptationOutcome = {
                change_proposal_id: experiment.change_proposal_id,
                task_id: '',
                implemented: true,
                success: experiment.success,
                metrics_before: cycle.current_condition.metrics,
                metrics_after: actualOutcome,
                implemented_at: experiment.completed_at,
            };

            this.tracker.recordOutcome(outcome);
            await this.learningLoop.collectExperience(outcome, cycle.current_condition.context);
        }

        cycle.updated_at = new Date().toISOString();

        // If successful, check if target condition reached
        if (experiment.success && this.isTargetConditionReached(cycle)) {
            await this.completeKataCycle(cycle_id);
        } else if (experiment.success) {
            // Plan next steps
            await this.planNextSteps(cycle_id);
        } else {
            // Re-identify obstacles after failure
            await this.identifyObstacles(cycle_id);
        }
    }

    /**
     * Complete Kata cycle
     */
    async completeKataCycle(cycle_id: string): Promise<void> {
        const cycle = this.kataCycles.get(cycle_id);
        if (!cycle) throw new Error(`Cycle ${cycle_id} not found`);

        // Cycle is complete when target condition is reached
        // (handled in completeExperiment)
    }

    /**
     * Check if target condition is reached
     */
    private isTargetConditionReached(cycle: KataCycle): boolean {
        for (const [metric, targetValue] of Object.entries(cycle.target_condition.metrics)) {
            const currentValue = cycle.current_condition.metrics[metric] || 0;
            if (currentValue < targetValue * 0.9) { // Within 10% of target
                return false;
            }
        }
        return true;
    }

    /**
     * Calculate impact from gap
     */
    private calculateImpact(gap: number, target: number): Obstacle['impact'] {
        const gapPercentage = (gap / target) * 100;
        if (gapPercentage > 50) return 'high';
        if (gapPercentage > 20) return 'medium';
        return 'low';
    }

    /**
     * Extract metric from obstacle description
     */
    private extractMetricFromObstacle(obstacle: Obstacle): string {
        // Simple extraction (would use NLP in production)
        const match = obstacle.description.match(/(\w+) is/);
        return match ? match[1] : 'unknown';
    }

    /**
     * Extract target value from obstacle
     */
    private extractTargetValueFromObstacle(obstacle: Obstacle, targetCondition: TargetCondition): number {
        const metric = this.extractMetricFromObstacle(obstacle);
        return targetCondition.metrics[metric] || 0;
    }

    /**
     * Calculate expected outcome (10% improvement)
     */
    private calculateExpectedOutcome(
        current: Record<string, number>,
        target: Record<string, number>,
        improvementRate: number
    ): Record<string, number> {
        const expected: Record<string, number> = {};

        for (const [metric, targetValue] of Object.entries(target)) {
            const currentValue = current[metric] || 0;
            const gap = targetValue - currentValue;
            const improvement = gap * improvementRate;
            expected[metric] = currentValue + improvement;
        }

        return expected;
    }

    /**
     * Check if experiment is successful (within 20% of expected)
     */
    private isSuccess(expected: Record<string, number>, actual: Record<string, number>): boolean {
        for (const [metric, expectedValue] of Object.entries(expected)) {
            const actualValue = actual[metric] || 0;
            const tolerance = expectedValue * 0.2; // 20% tolerance
            if (Math.abs(actualValue - expectedValue) > tolerance) {
                return false;
            }
        }
        return true;
    }

    /**
     * Get Kata cycle
     */
    getKataCycle(cycle_id: string): KataCycle | undefined {
        return this.kataCycles.get(cycle_id);
    }

    /**
     * Get active Kata cycles
     */
    getActiveCycles(): KataCycle[] {
        return Array.from(this.kataCycles.values()).filter(
            c => c.state !== KataState.CURRENT_CONDITION && c.experiments.some(e => !e.completed_at)
        );
    }

    /**
     * Get statistics
     */
    getStats(): {
        total_cycles: number;
        active_cycles: number;
        completed_experiments: number;
        successful_experiments: number;
        average_success_rate: number;
    } {
        const cycles = Array.from(this.kataCycles.values());
        const allExperiments = cycles.flatMap(c => c.experiments);
        const completed = allExperiments.filter(e => e.completed_at);
        const successful = completed.filter(e => e.success);

        return {
            total_cycles: cycles.length,
            active_cycles: this.getActiveCycles().length,
            completed_experiments: completed.length,
            successful_experiments: successful.length,
            average_success_rate: completed.length > 0 ? successful.length / completed.length : 0,
        };
    }
}
