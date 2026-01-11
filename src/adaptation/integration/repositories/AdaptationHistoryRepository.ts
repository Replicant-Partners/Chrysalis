/**
 * Adaptation History Repository
 *
 * Repository pattern for storing and retrieving adaptation history.
 *
 * Design Pattern: Repository Pattern (Fowler, "Patterns of Enterprise Application Architecture")
 * - Abstracts data access from business logic
 * - Provides interface for persistence operations
 * - Enables testability and flexibility
 *
 * References:
 * - Fowler, M. (2002). Patterns of Enterprise Application Architecture. Addison-Wesley.
 */

import { ChangeProposal } from '../../AgentCoordinator';
import { AdaptationEvent, AdaptationOutcome, AdaptationMetrics } from '../../AdaptationTracker';
import { LearningPattern } from '../../LearningLoop';
import { KataCycle } from '../../EvidenceBasedAdaptation';
import { IMemorySystem } from '../adapters/MemorySystemAdapter';

/**
 * Adaptation History Repository Interface
 */
export interface IAdaptationHistoryRepository {
    /**
     * Store adaptation event
     */
    storeEvent(event: AdaptationEvent): Promise<void>;

    /**
     * Store adaptation outcome
     */
    storeOutcome(outcome: AdaptationOutcome): Promise<void>;

    /**
     * Store change proposal
     */
    storeProposal(proposal: ChangeProposal): Promise<void>;

    /**
     * Store learning pattern
     */
    storePattern(pattern: LearningPattern): Promise<void>;

    /**
     * Store Kata cycle
     */
    storeKataCycle(cycle: KataCycle): Promise<void>;

    /**
     * Retrieve events
     */
    getEvents(filters?: EventFilters, limit?: number): Promise<AdaptationEvent[]>;

    /**
     * Retrieve outcomes
     */
    getOutcomes(filters?: OutcomeFilters, limit?: number): Promise<AdaptationOutcome[]>;

    /**
     * Retrieve proposals
     */
    getProposals(filters?: ProposalFilters, limit?: number): Promise<ChangeProposal[]>;

    /**
     * Retrieve patterns
     */
    getPatterns(filters?: PatternFilters, limit?: number): Promise<LearningPattern[]>;

    /**
     * Retrieve Kata cycles
     */
    getKataCycles(filters?: KataCycleFilters): Promise<KataCycle[]>;

    /**
     * Get metrics
     */
    getMetrics(timeRange?: { start: string; end: string }): Promise<AdaptationMetrics>;
}

/**
 * Event filters
 */
export interface EventFilters {
    proposal_id?: string;
    event_type?: string;
    timestamp_from?: string;
    timestamp_to?: string;
}

/**
 * Outcome filters
 */
export interface OutcomeFilters {
    proposal_id?: string;
    success?: boolean;
    implemented?: boolean;
    timestamp_from?: string;
    timestamp_to?: string;
}

/**
 * Proposal filters
 */
export interface ProposalFilters {
    task_id?: string;
    change_type?: string;
    file_path?: string;
    requires_validation?: boolean;
    timestamp_from?: string;
    timestamp_to?: string;
}

/**
 * Pattern filters
 */
export interface PatternFilters {
    pattern_type?: 'success' | 'failure' | 'neutral';
    context?: Record<string, any>;
    min_confidence?: number;
}

/**
 * Kata cycle filters
 */
export interface KataCycleFilters {
    cycle_id?: string;
    state?: string;
    active_only?: boolean;
}

/**
 * Adaptation History Repository Implementation
 *
 * Uses Memory System Adapter for persistence.
 */
export class AdaptationHistoryRepository implements IAdaptationHistoryRepository {
    private memorySystem: IMemorySystem;
    private cache: {
        events: Map<string, AdaptationEvent>;
        outcomes: Map<string, AdaptationOutcome>;
        proposals: Map<string, ChangeProposal>;
        patterns: Map<string, LearningPattern>;
        cycles: Map<string, KataCycle>;
    };

    constructor(memorySystem: IMemorySystem) {
        this.memorySystem = memorySystem;
        this.cache = {
            events: new Map(),
            outcomes: new Map(),
            proposals: new Map(),
            patterns: new Map(),
            cycles: new Map(),
        };
    }

    /**
     * Store adaptation event
     */
    async storeEvent(event: AdaptationEvent): Promise<void> {
        // Cache locally
        this.cache.events.set(event.event_id, event);

        // Persist to memory system
        await this.memorySystem.storeAdaptationEvent(event);
    }

    /**
     * Store adaptation outcome
     */
    async storeOutcome(outcome: AdaptationOutcome): Promise<void> {
        // Cache locally
        this.cache.outcomes.set(outcome.change_proposal_id, outcome);

        // Persist to memory system
        await this.memorySystem.storeAdaptationOutcome(outcome);
    }

    /**
     * Store change proposal
     */
    async storeProposal(proposal: ChangeProposal): Promise<void> {
        // Cache locally
        this.cache.proposals.set(proposal.proposal_id, proposal);

        // Persist to memory system
        await this.memorySystem.storeChangeProposal(proposal);
    }

    /**
     * Store learning pattern
     */
    async storePattern(pattern: LearningPattern): Promise<void> {
        // Cache locally
        this.cache.patterns.set(pattern.pattern_id, pattern);

        // Persist to memory system
        await this.memorySystem.storeLearningPattern(pattern);
    }

    /**
     * Store Kata cycle
     */
    async storeKataCycle(cycle: KataCycle): Promise<void> {
        // Cache locally
        this.cache.cycles.set(cycle.cycle_id, cycle);

        // Persist to memory system
        await this.memorySystem.storeKataCycle(cycle);
    }

    /**
     * Retrieve events with filters
     */
    async getEvents(filters?: EventFilters, limit: number = 100): Promise<AdaptationEvent[]> {
        // Get from memory system
        let events = await this.memorySystem.getAdaptationEvents(filters?.proposal_id, limit);

        // Apply filters
        if (filters) {
            events = events.filter(event => {
                if (filters.event_type && event.event_type !== filters.event_type) {
                    return false;
                }
                if (filters.timestamp_from && event.timestamp < filters.timestamp_from) {
                    return false;
                }
                if (filters.timestamp_to && event.timestamp > filters.timestamp_to) {
                    return false;
                }
                return true;
            });
        }

        return events;
    }

    /**
     * Retrieve outcomes with filters
     */
    async getOutcomes(filters?: OutcomeFilters, limit: number = 100): Promise<AdaptationOutcome[]> {
        // Get from memory system
        let outcomes = await this.memorySystem.getAdaptationOutcomes(filters?.proposal_id, limit);

        // Apply filters
        if (filters) {
            outcomes = outcomes.filter(outcome => {
                if (filters.success !== undefined && outcome.success !== filters.success) {
                    return false;
                }
                if (filters.implemented !== undefined && outcome.implemented !== filters.implemented) {
                    return false;
                }
                if (filters.timestamp_from && outcome.implemented_at && outcome.implemented_at < filters.timestamp_from) {
                    return false;
                }
                if (filters.timestamp_to && outcome.implemented_at && outcome.implemented_at > filters.timestamp_to) {
                    return false;
                }
                return true;
            });
        }

        return outcomes;
    }

    /**
     * Retrieve proposals with filters
     */
    async getProposals(filters?: ProposalFilters, limit: number = 100): Promise<ChangeProposal[]> {
        // Get from memory system
        let proposals = await this.memorySystem.getChangeProposals(filters?.task_id, limit);

        // Apply filters
        if (filters) {
            proposals = proposals.filter(proposal => {
                if (filters.change_type && proposal.change_type !== filters.change_type) {
                    return false;
                }
                if (filters.file_path && proposal.file_path !== filters.file_path) {
                    return false;
                }
                if (filters.requires_validation !== undefined && proposal.requires_validation !== filters.requires_validation) {
                    return false;
                }
                if (filters.timestamp_from && proposal.created_at < filters.timestamp_from) {
                    return false;
                }
                if (filters.timestamp_to && proposal.created_at > filters.timestamp_to) {
                    return false;
                }
                return true;
            });
        }

        return proposals;
    }

    /**
     * Retrieve patterns with filters
     */
    async getPatterns(filters?: PatternFilters, limit: number = 100): Promise<LearningPattern[]> {
        // Get from memory system
        let patterns = await this.memorySystem.getLearningPatterns(filters?.context, limit);

        // Apply filters
        if (filters) {
            patterns = patterns.filter(pattern => {
                if (filters.pattern_type && pattern.pattern_type !== filters.pattern_type) {
                    return false;
                }
                if (filters.min_confidence && pattern.confidence < filters.min_confidence) {
                    return false;
                }
                return true;
            });
        }

        return patterns;
    }

    /**
     * Retrieve Kata cycles with filters
     */
    async getKataCycles(filters?: KataCycleFilters): Promise<KataCycle[]> {
        // Get from memory system
        let cycles = await this.memorySystem.getKataCycles(filters?.cycle_id, filters?.active_only);

        // Apply filters
        if (filters) {
            cycles = cycles.filter(cycle => {
                if (filters.state && cycle.state !== filters.state) {
                    return false;
                }
                return true;
            });
        }

        return cycles;
    }

    /**
     * Get metrics for time range
     */
    async getMetrics(timeRange?: { start: string; end: string }): Promise<AdaptationMetrics> {
        // Get events and outcomes for time range
        const events = await this.getEvents(
            timeRange ? { timestamp_from: timeRange.start, timestamp_to: timeRange.end } : undefined
        );
        const outcomes = await this.getOutcomes(
            timeRange ? { timestamp_from: timeRange.start, timestamp_to: timeRange.end } : undefined
        );

        // Calculate metrics
        const proposals = events.filter(e => e.event_type === 'proposal');
        const approvals = events.filter(e => e.event_type === 'approval');
        const rejections = events.filter(e => e.event_type === 'rejection');
        const implementations = events.filter(e => e.event_type === 'implementation');
        const rollbacks = events.filter(e => e.event_type === 'rollback');

        const successful = outcomes.filter(o => o.success && !o.rolled_back_at).length;
        const implemented = outcomes.filter(o => o.implemented).length;
        const rolledBack = outcomes.filter(o => o.rolled_back_at).length;

        // Calculate average confidence from successful outcomes
        // Confidence is derived from success rate, not stored directly
        const successfulOutcomes = outcomes.filter(o => o.success);
        const avgConfidence = outcomes.length > 0 ? successfulOutcomes.length / outcomes.length : 0;

        const successRate = outcomes.length > 0 ? successful / outcomes.length : 0;
        const improvementRate = outcomes.length > 0 ? (successful - rolledBack) / outcomes.length : 0;

        return {
            total_proposals: proposals.length,
            approved_proposals: approvals.length,
            rejected_proposals: rejections.length,
            implemented_proposals: implemented,
            rolled_back_proposals: rolledBack,
            average_confidence: avgConfidence,
            success_rate: successRate,
            improvement_rate: improvementRate,
        };
    }
}
