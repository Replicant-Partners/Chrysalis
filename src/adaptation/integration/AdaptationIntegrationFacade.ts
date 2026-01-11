/**
 * Adaptation Integration Facade
 *
 * Provides a unified interface to the AI Lead Adaptation System for Chrysalis components.
 *
 * Design Pattern: Facade (GoF, p. 185)
 * - Provides a simplified interface to a complex subsystem
 * - Hides complexity of Adaptation System from clients
 * - Decouples clients from Adaptation System internals
 *
 * References:
 * - Gamma, E., Helm, R., Johnson, R., & Vlissides, J. (1994). Design Patterns: Elements of Reusable Object-Oriented Software. Addison-Wesley. p. 185.
 */

import { AgentCoordinator, ChangeProposal } from '../AgentCoordinator';
import { HumanValidationSystem } from '../HumanValidationSystem';
import { AdaptationTracker } from '../AdaptationTracker';
import { LearningLoop } from '../LearningLoop';
import { EvidenceBasedAdaptation, KataCycle, TargetCondition } from '../EvidenceBasedAdaptation';
import { QualityAnalysisAgent } from '../agents/QualityAnalysisAgent';
import { RefactoringAgent } from '../agents/RefactoringAgent';

/**
 * Adaptation System Configuration
 */
export interface AdaptationSystemConfig {
    coordinator?: {
        max_concurrent_tasks?: number;
        task_timeout?: number;
        conflict_resolution?: 'first_wins' | 'priority' | 'merge' | 'human_review';
    };
    validation?: {
        auto_approve_low_risk?: boolean;
        auto_approve_high_confidence?: number;
        require_approval_for?: string[];
    };
    quality_thresholds?: {
        complexity?: number;
        maintainability?: number;
        test_coverage?: number;
        duplication?: number;
        technical_debt?: number;
    };
}

/**
 * Adaptation Request
 */
export interface AdaptationRequest {
    request_id?: string;
    request_type: 'quality_analysis' | 'refactoring' | 'architecture' | 'kata_cycle';
    target_path?: string;
    target_condition?: TargetCondition;
    priority?: number;
    metadata?: Record<string, any>;
}

/**
 * Adaptation Response
 */
export interface AdaptationResponse {
    request_id: string;
    success: boolean;
    task_id?: string;
    cycle_id?: string;
    proposals?: ChangeProposal[];
    errors?: string[];
    metrics?: Record<string, number>;
}

/**
 * Adaptation Integration Facade
 *
 * Provides a unified interface to the AI Lead Adaptation System.
 *
 * Following Facade Pattern (GoF, p. 185):
 * - Simplifies complex subsystem interface
 * - Provides single point of entry
 * - Hides internal complexity
 */
export class AdaptationIntegrationFacade {
    private coordinator: AgentCoordinator;
    private validationSystem: HumanValidationSystem;
    private tracker: AdaptationTracker;
    private learningLoop: LearningLoop;
    private evidenceAdaptation: EvidenceBasedAdaptation;
    private qualityAgent: QualityAnalysisAgent;
    private refactoringAgent: RefactoringAgent;
    private initialized: boolean = false;

    constructor(config: AdaptationSystemConfig = {}) {
        // Initialize core components
        this.coordinator = new AgentCoordinator(config.coordinator);
        this.validationSystem = new HumanValidationSystem(config.validation);
        this.tracker = new AdaptationTracker();
        this.learningLoop = new LearningLoop(this.tracker);
        this.evidenceAdaptation = new EvidenceBasedAdaptation(this.tracker, this.learningLoop);

        // Initialize agents
        this.qualityAgent = new QualityAnalysisAgent(this.coordinator, config.quality_thresholds);
        this.refactoringAgent = new RefactoringAgent(this.coordinator);

        this.initialized = true;
    }

    /**
     * Request quality analysis
     */
    async requestQualityAnalysis(targetPath: string, priority: number = 5): Promise<AdaptationResponse> {
        if (!this.initialized) {
            throw new Error('Adaptation system not initialized');
        }

        const request_id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            // Submit task to coordinator
            const task_id = await this.coordinator.submitTask({
                task_type: 'quality_analysis',
                priority,
                target_path: targetPath,
                description: `Quality analysis for ${targetPath}`,
            });

            // Execute quality analysis
            const result = await this.qualityAgent.analyzeQuality(targetPath);

            // Complete task
            await this.coordinator.completeTask(task_id, result);

            // Track proposals
            if (result.changes_proposed) {
                for (const proposal of result.changes_proposed) {
                    this.tracker.trackProposal(proposal);
                }
            }

            return {
                request_id,
                success: true,
                task_id,
                proposals: result.changes_proposed,
                metrics: result.metrics,
            };
        } catch (error: any) {
            return {
                request_id,
                success: false,
                errors: [error.message || String(error)],
            };
        }
    }

    /**
     * Request refactoring analysis
     */
    async requestRefactoringAnalysis(targetPath: string, priority: number = 5): Promise<AdaptationResponse> {
        if (!this.initialized) {
            throw new Error('Adaptation system not initialized');
        }

        const request_id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            // Submit task to coordinator
            const task_id = await this.coordinator.submitTask({
                task_type: 'refactoring',
                priority,
                target_path: targetPath,
                description: `Refactoring analysis for ${targetPath}`,
            });

            // Execute refactoring analysis
            const result = await this.refactoringAgent.identifyRefactorings(targetPath);

            // Complete task
            await this.coordinator.completeTask(task_id, result);

            // Track proposals
            if (result.changes_proposed) {
                for (const proposal of result.changes_proposed) {
                    this.tracker.trackProposal(proposal);
                }
            }

            return {
                request_id,
                success: true,
                task_id,
                proposals: result.changes_proposed,
                metrics: result.metrics,
            };
        } catch (error: any) {
            return {
                request_id,
                success: false,
                errors: [error.message || String(error)],
            };
        }
    }

    /**
     * Start Kata cycle
     */
    async startKataCycle(
        targetCondition: TargetCondition,
        currentMetrics: Record<string, number>
    ): Promise<AdaptationResponse> {
        if (!this.initialized) {
            throw new Error('Adaptation system not initialized');
        }

        const request_id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            const cycle_id = await this.evidenceAdaptation.startKataCycle(
                targetCondition,
                currentMetrics
            );

            return {
                request_id,
                success: true,
                cycle_id,
                metrics: currentMetrics,
            };
        } catch (error: any) {
            return {
                request_id,
                success: false,
                errors: [error.message || String(error)],
            };
        }
    }

    /**
     * Submit adaptation for validation
     */
    async submitForValidation(changeProposal: any): Promise<string> {
        if (!this.initialized) {
            throw new Error('Adaptation system not initialized');
        }

        return await this.validationSystem.submitForValidation(changeProposal);
    }

    /**
     * Get adaptation statistics
     */
    getStatistics(): {
        coordinator: any;
        validation: any;
        tracker: any;
        learning: any;
        kata: any;
    } {
        return {
            coordinator: this.coordinator.getStats(),
            validation: this.validationSystem.getStats(),
            tracker: this.tracker.getMetrics(),
            learning: this.learningLoop.getStats(),
            kata: this.evidenceAdaptation.getStats(),
        };
    }

    /**
     * Get Kata cycle
     */
    getKataCycle(cycle_id: string): KataCycle | undefined {
        return this.evidenceAdaptation.getKataCycle(cycle_id);
    }

    /**
     * Get active Kata cycles
     */
    getActiveKataCycles(): KataCycle[] {
        return this.evidenceAdaptation.getActiveCycles();
    }
}
