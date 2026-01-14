/**
 * Experience Sync Adapter
 *
 * Adapts Experience Sync Manager interface to feed Learning Loop with experience data.
 *
 * Design Pattern: Adapter Pattern (GoF, p. 139) + Observer Pattern (GoF, p. 293)
 * - Adapts Experience Sync events to Learning Loop format
 * - Observes Experience Sync Manager for new experiences
 * - Transforms experience data for learning
 *
 * References:
 * - Gamma, E., Helm, R., Johnson, R., & Vlissides, J. (1994). Design Patterns: Elements of Reusable Object-Oriented Software. Addison-Wesley. p. 139, 293.
 */

import { ExperienceSyncManager, SyncStatus, MergeResult } from '../../../sync/ExperienceSyncManager';
import { LearningLoop, ExperienceEntry } from '../../LearningLoop';
import { AdaptationTracker } from '../../AdaptationTracker';

/**
 * Experience Sync Adapter Configuration
 */
export interface ExperienceSyncAdapterConfig {
    experienceSyncManager: ExperienceSyncManager;
    learningLoop: LearningLoop;
    tracker: AdaptationTracker;
    autoCollect?: boolean; // Automatically collect experiences
    filterPatterns?: string[]; // Filter experience types to collect
}

/**
 * Experience Sync Adapter
 *
 * Adapts Experience Sync Manager events to Learning Loop experience entries.
 */
export class ExperienceSyncAdapter {
    private experienceSyncManager: ExperienceSyncManager;
    private learningLoop: LearningLoop;
    private tracker: AdaptationTracker;
    private autoCollect: boolean;
    private filterPatterns?: string[];
    private isCollecting: boolean = false;

    constructor(config: ExperienceSyncAdapterConfig) {
        this.experienceSyncManager = config.experienceSyncManager;
        this.learningLoop = config.learningLoop;
        this.tracker = config.tracker;
        this.autoCollect = config.autoCollect ?? true;
        this.filterPatterns = config.filterPatterns;

        if (this.autoCollect) {
            this.startCollecting();
        }
    }

    /**
     * Start collecting experiences from Experience Sync Manager
     *
     * @stub Event subscription is not yet wired up. The ExperienceSyncManager
     * needs to emit 'experience_synced' and 'merge_completed' events for this
     * to work. Currently just sets a flag without actual subscription.
     */
    startCollecting(): void {
        if (this.isCollecting) {
            return;
        }

        this.isCollecting = true;

        // TODO: Wire up event subscriptions when ExperienceSyncManager emits events
        // The handlers (handleExperienceEvent, handleMergeResult) are implemented
        // but need the event source to be connected.
        //
        // Required changes to ExperienceSyncManager:
        //   1. Extend EventEmitter or use a pub/sub system
        //   2. Emit 'experience_synced' after successful sync
        //   3. Emit 'merge_completed' after memory merge
        //
        // Then uncomment:
        // this.experienceSyncManager.on('experience_synced', (event) => {
        //     this.handleExperienceEvent(event);
        // });
        // this.experienceSyncManager.on('merge_completed', (result) => {
        //     this.handleMergeResult(result);
        // });

        console.warn('[ExperienceSyncAdapter] startCollecting is a stub - event subscriptions not wired', {
            stub_reason: 'ExperienceSyncManager does not emit events yet'
        });
    }

    /**
     * Stop collecting experiences
     */
    stopCollecting(): void {
        this.isCollecting = false;

        // In production: Unsubscribe from events
    }

    /**
     * Handle experience sync event
     */
    private async handleExperienceEvent(event: any): Promise<void> {
        // Transform Experience Sync event to Learning Loop experience entry
        const experienceEntry: ExperienceEntry = {
            entry_id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            event_type: event.type || 'experience_synced',
            context: {
                instance_id: event.instance_id,
                agent_id: event.agent_id,
                sync_protocol: event.protocol,
                transport_type: event.transport_type,
            },
            outcome: event.outcome,
            metrics_before: event.metrics_before,
            metrics_after: event.metrics_after,
            feedback: event.feedback,
        };

        // Filter if patterns specified
        if (this.filterPatterns && !this.filterPatterns.includes(experienceEntry.event_type)) {
            return;
        }

        // Add experience to learning loop via tracker
        // Create a temporary outcome for the experience
        const outcome = {
            change_proposal_id: experienceEntry.entry_id,
            task_id: '',
            implemented: false,
            success: experienceEntry.event_type === 'experience_synced',
            metrics_before: experienceEntry.metrics_before,
            metrics_after: experienceEntry.metrics_after,
            feedback: experienceEntry.feedback,
        };
        this.tracker.recordOutcome(outcome);
        await this.learningLoop.collectExperience(outcome, experienceEntry.context);
    }

    /**
     * Handle merge result from Experience Sync
     */
    private async handleMergeResult(result: MergeResult): Promise<void> {
        // Create experience entry from merge result
        const experienceEntry: ExperienceEntry = {
            entry_id: `merge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: result.merged_at,
            event_type: 'memory_merge',
            context: {
                memories_added: result.memories_added,
                memories_updated: result.memories_updated,
                memories_deduplicated: result.memories_deduplicated,
                skills_added: result.skills_added,
                skills_updated: result.skills_updated,
                knowledge_added: result.knowledge_added,
                conflicts_total: result.conflicts.total,
                conflicts_resolved: result.conflicts.resolved,
            },
            metrics_before: {},
            metrics_after: {
                memories_count: result.memories_added + result.memories_updated,
                skills_count: result.skills_added + result.skills_updated,
                knowledge_count: result.knowledge_added,
            },
        };

        // Add experience to learning loop via tracker
        // Create a temporary outcome for the merge experience
        const outcome = {
            change_proposal_id: experienceEntry.entry_id,
            task_id: '',
            implemented: true,
            success: true,
            metrics_before: experienceEntry.metrics_before,
            metrics_after: experienceEntry.metrics_after,
        };
        this.tracker.recordOutcome(outcome);
        await this.learningLoop.collectExperience(outcome, experienceEntry.context);
    }

    /**
     * Manually collect experiences from sync status
     *
     * @stub Requires ExperienceSyncManager.getSyncStatuses() to be accessible
     * and return meaningful data. Currently a no-op.
     */
    async collectFromSyncStatus(): Promise<void> {
        console.warn('[ExperienceSyncAdapter] collectFromSyncStatus is a stub', {
            stub_reason: 'ExperienceSyncManager sync status query not implemented'
        });

        // TODO: Implement when ExperienceSyncManager exposes sync statuses
        // const statuses = await this.experienceSyncManager.getSyncStatuses();
        // for (const status of statuses) {
        //     if (status.last_sync) {
        //         await this.collectExperiencesSince(status.instance_id, status.last_sync);
        //     }
        // }
    }

    /**
     * Collect experiences since timestamp
     *
     * @stub Internal method for incremental experience collection
     */
    private async collectExperiencesSince(instanceId: string, since: string): Promise<void> {
        console.warn('[ExperienceSyncAdapter] collectExperiencesSince is a stub', {
            instanceId,
            since,
            stub_reason: 'Experience query by timestamp not implemented'
        });
        // TODO: Query ExperienceSyncManager for experiences after timestamp
    }

    /**
     * Get sync statuses
     *
     * @stub Returns empty array - requires ExperienceSyncManager integration
     */
    async getSyncStatuses(): Promise<SyncStatus[]> {
        console.warn('[ExperienceSyncAdapter] getSyncStatuses returns empty - stub implementation');
        return [];
    }
}
