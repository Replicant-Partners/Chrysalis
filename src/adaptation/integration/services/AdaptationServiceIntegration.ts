/**
 * Adaptation Service Integration
 *
 * Integrates AI Lead Adaptation System with Chrysalis services:
 * - Ledger Service: Record adaptation events
 * - Capability Gateway: Expose adaptation capabilities
 *
 * Design Pattern: Facade Pattern (GoF, p. 185)
 * - Provides unified interface for service integrations
 * - Hides complexity of multiple service integrations
 *
 * References:
 * - Gamma, E., Helm, R., Johnson, R., & Vlissides, J. (1994). Design Patterns: Elements of Reusable Object-Oriented Software. Addison-Wesley. p. 185.
 */

import { LedgerService } from '../../../services/ledger/LedgerService';
import { CapabilityGatewayService } from '../../../services/capability-gateway/CapabilityGatewayService';
import { AdaptationIntegrationFacade } from '../AdaptationIntegrationFacade';
import { ChangeProposal } from '../../AgentCoordinator';
import { AdaptationEvent } from '../../AdaptationTracker';

/**
 * Adaptation Service Integration Configuration
 */
export interface AdaptationServiceIntegrationConfig {
    ledgerService?: LedgerService;
    capabilityGateway?: CapabilityGatewayService;
    adaptationFacade: AdaptationIntegrationFacade;
    enableLedgerLogging?: boolean;
    enableCapabilityExposure?: boolean;
}

/**
 * Adaptation Service Integration
 *
 * Integrates Adaptation System with Chrysalis services.
 */
export class AdaptationServiceIntegration {
    private ledgerService?: LedgerService;
    private capabilityGateway?: CapabilityGatewayService;
    private adaptationFacade: AdaptationIntegrationFacade;
    private enableLedgerLogging: boolean;
    private enableCapabilityExposure: boolean;

    constructor(config: AdaptationServiceIntegrationConfig) {
        this.ledgerService = config.ledgerService;
        this.capabilityGateway = config.capabilityGateway;
        this.adaptationFacade = config.adaptationFacade;
        this.enableLedgerLogging = config.enableLedgerLogging ?? true;
        this.enableCapabilityExposure = config.enableCapabilityExposure ?? true;

        if (this.enableCapabilityExposure && this.capabilityGateway) {
            this.registerCapabilities();
        }
    }

    /**
     * Register adaptation capabilities with Capability Gateway
     */
    private registerCapabilities(): void {
        // In production: Register adaptation capabilities
        // For now: Placeholder implementation

        // Example capabilities to register:
        // - quality_analysis: Analyze code quality
        // - refactoring: Identify refactoring opportunities
        // - kata_cycle: Start Toyota Kata improvement cycle
        // - validation: Submit change for validation
    }

    /**
     * Record adaptation event to Ledger Service
     */
    async recordAdaptationEvent(event: AdaptationEvent): Promise<void> {
        if (!this.enableLedgerLogging || !this.ledgerService) {
            return;
        }

        // In production: Commit event to ledger
        // For now: Placeholder implementation

        // Example ledger commit:
        // await this.ledgerService.commit({
        //     agentId: 'adaptation_system',
        //     instanceId: 'adaptation_instance',
        //     event: {
        //         type: 'adaptation_event',
        //         event_id: event.event_id,
        //         event_type: event.event_type,
        //         change_proposal_id: event.change_proposal_id,
        //         timestamp: event.timestamp,
        //         metadata: event.metadata,
        //     },
        // });
    }

    /**
     * Record change proposal to Ledger Service
     */
    async recordChangeProposal(proposal: ChangeProposal): Promise<void> {
        if (!this.enableLedgerLogging || !this.ledgerService) {
            return;
        }

        // In production: Commit proposal to ledger
        // Placeholder implementation
    }

    /**
     * Get adaptation statistics via Capability Gateway
     */
    async getAdaptationStatistics(): Promise<any> {
        return this.adaptationFacade.getStatistics();
    }

    /**
     * Request quality analysis via Capability Gateway
     */
    async requestQualityAnalysis(targetPath: string, priority: number = 5): Promise<any> {
        return this.adaptationFacade.requestQualityAnalysis(targetPath, priority);
    }

    /**
     * Request refactoring analysis via Capability Gateway
     */
    async requestRefactoringAnalysis(targetPath: string, priority: number = 5): Promise<any> {
        return this.adaptationFacade.requestRefactoringAnalysis(targetPath, priority);
    }

    /**
     * Start Kata cycle via Capability Gateway
     */
    async startKataCycle(
        targetCondition: any,
        currentMetrics: Record<string, number>
    ): Promise<any> {
        return this.adaptationFacade.startKataCycle(targetCondition, currentMetrics);
    }
}
