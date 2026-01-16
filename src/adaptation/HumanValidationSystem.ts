/**
 * Human Validation System - Manages human validation workflows for agent-proposed changes
 *
 * Following the complex learner pattern, validation serves as a learning interface
 * that helps the system understand which changes are acceptable and why.
 */

/**
 * Validation request
 */
export interface ValidationRequest {
    request_id: string;
    change_proposal_id: string;
    change_type: string;
    file_path: string;
    description: string;
    diff?: string;
    impact_analysis?: any;
    submitted_at: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    requires_immediate_review: boolean;
}

/**
 * Validation response
 */
export interface ValidationResponse {
    request_id: string;
    change_proposal_id: string;
    approved: boolean;
    rejected: boolean;
    feedback?: string;
    constraints?: string[];
    modified_proposal?: any;
    validated_by?: string;
    validated_at: string;
    confidence_override?: number;
}

/**
 * Validation workflow configuration
 */
export interface ValidationWorkflowConfig {
    auto_approve_low_risk: boolean;
    auto_approve_high_confidence: number; // 0.0-1.0
    require_approval_for: string[]; // List of change types requiring approval
    approval_timeout: number; // Milliseconds
    notification_channels: string[];
}

/**
 * Human Validation System
 *
 * Manages validation workflows for agent-proposed changes.
 *
 * Following the complex learner pattern: validation serves as a learning
 * interface for understanding which changes are acceptable and why.
 */
export class HumanValidationSystem {
    private config: ValidationWorkflowConfig;
    private pendingValidations: Map<string, ValidationRequest> = new Map();
    private validationHistory: Map<string, ValidationResponse> = new Map();

    constructor(config: Partial<ValidationWorkflowConfig> = {}) {
        this.config = {
            auto_approve_low_risk: config.auto_approve_low_risk ?? false,
            auto_approve_high_confidence: config.auto_approve_high_confidence ?? 0.95,
            require_approval_for: config.require_approval_for || ['breaking_change', 'security', 'architecture'],
            approval_timeout: config.approval_timeout || 86400000, // 24 hours
            notification_channels: config.notification_channels || [],
        };
    }

    /**
     * Submit change proposal for validation
     */
    async submitForValidation(changeProposal: any, context?: any): Promise<string> {
        const request_id = `val_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const validationRequest: ValidationRequest = {
            request_id,
            change_proposal_id: changeProposal.proposal_id || changeProposal.id,
            change_type: changeProposal.change_type,
            file_path: changeProposal.file_path,
            description: changeProposal.description,
            diff: changeProposal.diff,
            impact_analysis: changeProposal.impact_analysis,
            submitted_at: new Date().toISOString(),
            priority: this.calculatePriority(changeProposal),
            requires_immediate_review: this.requiresImmediateReview(changeProposal),
        };

        this.pendingValidations.set(request_id, validationRequest);

        // Check if auto-approval is possible
        if (await this.checkAutoApproval(validationRequest, changeProposal)) {
            const autoResponse: ValidationResponse = {
                request_id,
                change_proposal_id: changeProposal.proposal_id || changeProposal.id,
                approved: true,
                rejected: false,
                validated_at: new Date().toISOString(),
                feedback: 'Auto-approved based on configuration',
            };
            await this.recordValidation(autoResponse);
            return request_id;
        }

        // Notify validation channels
        await this.notifyValidationRequest(validationRequest);

        return request_id;
    }

    /**
     * Calculate priority for validation request
     */
    private calculatePriority(changeProposal: any): ValidationRequest['priority'] {
        const impact = changeProposal.impact_analysis;

        if (impact?.breaking_changes || impact?.security_impact === 'negative') {
            return 'urgent';
        }
        if (impact?.estimated_risk === 'high') {
            return 'high';
        }
        if (impact?.estimated_risk === 'medium') {
            return 'medium';
        }
        return 'low';
    }

    /**
     * Check if immediate review is required
     */
    private requiresImmediateReview(changeProposal: any): boolean {
        const impact = changeProposal.impact_analysis;
        return !!(
            impact?.breaking_changes ||
            impact?.security_impact === 'negative' ||
            this.config.require_approval_for.includes(changeProposal.change_type)
        );
    }

    /**
     * Check if auto-approval is possible
     */
    private async checkAutoApproval(
        request: ValidationRequest,
        changeProposal: any
    ): Promise<boolean> {
        // Don't auto-approve if requires approval
        if (this.requiresImmediateReview(changeProposal)) {
            return false;
        }

        // Auto-approve low-risk if configured
        if (this.config.auto_approve_low_risk && request.priority === 'low') {
            return true;
        }

        // Auto-approve high-confidence if configured
        if (
            changeProposal.confidence &&
            changeProposal.confidence >= this.config.auto_approve_high_confidence
        ) {
            return true;
        }

        return false;
    }

    /**
     * Record validation response
     */
    async recordValidation(response: ValidationResponse): Promise<void> {
        this.validationHistory.set(response.request_id, response);
        this.pendingValidations.delete(response.request_id);
    }

    /**
     * Get validation request
     */
    getValidationRequest(request_id: string): ValidationRequest | undefined {
        return this.pendingValidations.get(request_id);
    }

    /**
     * Get validation response
     */
    getValidationResponse(request_id: string): ValidationResponse | undefined {
        return this.validationHistory.get(request_id);
    }

    /**
     * List pending validations
     */
    listPendingValidations(priority?: ValidationRequest['priority']): ValidationRequest[] {
        const validations = Array.from(this.pendingValidations.values());
        if (priority) {
            return validations.filter(v => v.priority === priority);
        }
        return validations;
    }

    /**
     * Notify validation channels
     *
     * Logs pending validation requests to configured channels.
     * Currently implements console logging; full integration with
     * Slack, email, and GitHub PRs is planned for future release.
     */
    private async notifyValidationRequest(request: ValidationRequest): Promise<void> {
        if (this.config.notification_channels.length === 0) {
            // No channels configured - log locally for visibility
            console.info(`[HumanValidationSystem] Validation pending: ${request.request_id}`, {
                change_type: request.change_type,
                priority: request.priority,
                file_path: request.file_path,
                description: request.description.slice(0, 100)
            });
            return;
        }

        for (const channel of this.config.notification_channels) {
            // Channel integrations not yet implemented
            throw new Error(
                `NotImplementedError: Channel integration for "${channel}" is not implemented. ` +
                `Requires actual Slack webhook, email, or GitHub API integration.`
            );
        }
    }

    /**
     * Get validation statistics
     */
    getStats(): {
        pending: number;
        approved: number;
        rejected: number;
        auto_approved: number;
        average_confidence: number;
    } {
        const history = Array.from(this.validationHistory.values());
        const approved = history.filter(r => r.approved).length;
        const rejected = history.filter(r => r.rejected).length;
        const autoApproved = history.filter(r => r.feedback?.includes('Auto-approved')).length;

        return {
            pending: this.pendingValidations.size,
            approved,
            rejected,
            auto_approved: autoApproved,
            average_confidence: history.length > 0
                ? history.reduce((sum, r) => sum + (r.confidence_override || 0), 0) / history.length
                : 0,
        };
    }
}
