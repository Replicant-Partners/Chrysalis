/**
 * Adaptation Tracker - Tracks code evolution and adaptation outcomes
 *
 * Following the complex learner pattern, tracking serves as a learning interface
 * that helps the system understand adaptation patterns and improve over time.
 */

/**
 * Adaptation event
 */
export interface AdaptationEvent {
    event_id: string;
    event_type: 'proposal' | 'approval' | 'rejection' | 'implementation' | 'rollback' | 'validation';
    change_proposal_id?: string;
    task_id?: string;
    timestamp: string;
    metadata?: Record<string, any>;
}

/**
 * Adaptation outcome
 */
export interface AdaptationOutcome {
    change_proposal_id: string;
    task_id: string;
    implemented: boolean;
    success: boolean;
    metrics_before?: Record<string, number>;
    metrics_after?: Record<string, number>;
    errors?: string[];
    feedback?: string;
    implemented_at?: string;
    rolled_back_at?: string;
    rollback_reason?: string;
}

/**
 * Adaptation metrics
 */
export interface AdaptationMetrics {
    total_proposals: number;
    approved_proposals: number;
    rejected_proposals: number;
    implemented_proposals: number;
    rolled_back_proposals: number;
    average_confidence: number;
    success_rate: number;
    improvement_rate: number; // Percentage of successful adaptations
}

/**
 * Adaptation Tracker
 *
 * Tracks code evolution and adaptation outcomes.
 *
 * Following the complex learner pattern: tracking serves as a learning
 * interface for understanding adaptation patterns and improving over time.
 */
export class AdaptationTracker {
    private events: AdaptationEvent[] = [];
    private outcomes: Map<string, AdaptationOutcome> = new Map();
    private metricsHistory: AdaptationMetrics[] = [];

    /**
     * Track adaptation event
     */
    trackEvent(event: Omit<AdaptationEvent, 'event_id' | 'timestamp'>): string {
        const event_id = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const fullEvent: AdaptationEvent = {
            ...event,
            event_id,
            timestamp: new Date().toISOString(),
        };

        this.events.push(fullEvent);
        return event_id;
    }

    /**
     * Record adaptation outcome
     */
    recordOutcome(outcome: AdaptationOutcome): void {
        this.outcomes.set(outcome.change_proposal_id, outcome);

        // Track outcome event
        this.trackEvent({
            event_type: outcome.success ? 'implementation' : 'rollback',
            change_proposal_id: outcome.change_proposal_id,
            task_id: outcome.task_id,
            metadata: {
                success: outcome.success,
                errors: outcome.errors,
            },
        });
    }

    /**
     * Track change proposal
     */
    trackProposal(changeProposal: any): string {
        return this.trackEvent({
            event_type: 'proposal',
            change_proposal_id: changeProposal.proposal_id || changeProposal.id,
            metadata: {
                change_type: changeProposal.change_type,
                file_path: changeProposal.file_path,
                confidence: changeProposal.confidence,
            },
        });
    }

    /**
     * Track validation result
     */
    trackValidation(validationResponse: any): string {
        return this.trackEvent({
            event_type: validationResponse.approved ? 'approval' : 'rejection',
            change_proposal_id: validationResponse.change_proposal_id,
            metadata: {
                feedback: validationResponse.feedback,
                constraints: validationResponse.constraints,
            },
        });
    }

    /**
     * Track rollback
     */
    trackRollback(changeProposalId: string, reason: string): string {
        const outcome = this.outcomes.get(changeProposalId);
        if (outcome) {
            outcome.rolled_back_at = new Date().toISOString();
            outcome.rollback_reason = reason;
            outcome.success = false;
        }

        return this.trackEvent({
            event_type: 'rollback',
            change_proposal_id: changeProposalId,
            metadata: { reason },
        });
    }

    /**
     * Get adaptation outcome
     */
    getOutcome(changeProposalId: string): AdaptationOutcome | undefined {
        return this.outcomes.get(changeProposalId);
    }

    /**
     * Get events for change proposal
     */
    getEventsForProposal(changeProposalId: string): AdaptationEvent[] {
        return this.events.filter(e => e.change_proposal_id === changeProposalId);
    }

    /**
     * Get current metrics
     */
    getMetrics(): AdaptationMetrics {
        const proposals = this.events.filter(e => e.event_type === 'proposal');
        const approvals = this.events.filter(e => e.event_type === 'approval');
        const rejections = this.events.filter(e => e.event_type === 'rejection');
        const implementations = this.events.filter(e => e.event_type === 'implementation');
        const rollbacks = this.events.filter(e => e.event_type === 'rollback');

        const outcomes = Array.from(this.outcomes.values());
        const successful = outcomes.filter(o => o.success && !o.rolled_back_at).length;
        const implemented = outcomes.filter(o => o.implemented).length;

        const avgConfidence = proposals.length > 0
            ? proposals.reduce((sum, p) => sum + (p.metadata?.confidence || 0), 0) / proposals.length
            : 0;

        const successRate = implementations.length > 0
            ? successful / implementations.length
            : 0;

        const improvementRate = outcomes.length > 0
            ? successful / outcomes.length
            : 0;

        return {
            total_proposals: proposals.length,
            approved_proposals: approvals.length,
            rejected_proposals: rejections.length,
            implemented_proposals: implemented,
            rolled_back_proposals: rollbacks.length,
            average_confidence: avgConfidence,
            success_rate: successRate,
            improvement_rate: improvementRate,
        };
    }

    /**
     * Get metrics history
     */
    getMetricsHistory(limit: number = 100): AdaptationMetrics[] {
        return this.metricsHistory.slice(-limit);
    }

    /**
     * Calculate impact analysis
     */
    calculateImpact(
        changeProposalId: string,
        metricsBefore: Record<string, number>,
        metricsAfter: Record<string, number>
    ): Record<string, number> {
        const impact: Record<string, number> = {};

        for (const key in metricsBefore) {
            if (metricsAfter[key] !== undefined) {
                const before = metricsBefore[key];
                const after = metricsAfter[key];
                const change = ((after - before) / before) * 100;
                impact[key] = change;
            }
        }

        return impact;
    }

    /**
     * Learn from outcomes
     */
    analyzePatterns(): {
        successful_patterns: string[];
        failed_patterns: string[];
        recommendations: string[];
    } {
        const outcomes = Array.from(this.outcomes.values());
        const successful = outcomes.filter(o => o.success && !o.rolled_back_at);
        const failed = outcomes.filter(o => !o.success || o.rolled_back_at);

        // Analyze patterns (simplified - would use ML in production)
        const successful_patterns: string[] = [];
        const failed_patterns: string[] = [];
        const recommendations: string[] = [];

        // High confidence successful adaptations
        const highConfSuccess = successful.filter(o => {
            const events = this.getEventsForProposal(o.change_proposal_id);
            const proposal = events.find(e => e.event_type === 'proposal');
            return (proposal?.metadata?.confidence || 0) > 0.9;
        });

        if (highConfSuccess.length > 0) {
            successful_patterns.push('High-confidence proposals tend to succeed');
            recommendations.push('Continue proposing high-confidence changes');
        }

        // Rollback patterns
        const rollbacks = outcomes.filter(o => o.rolled_back_at);
        if (rollbacks.length > 0) {
            failed_patterns.push('Some adaptations require rollback');
            recommendations.push('Improve impact analysis for high-risk changes');
        }

        return {
            successful_patterns,
            failed_patterns,
            recommendations,
        };
    }
}
