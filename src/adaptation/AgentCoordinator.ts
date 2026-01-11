/**
 * Agent Coordinator - Coordinates multiple AI agents for code evolution
 *
 * Following the complex learner pattern, agent coordination serves as a learning
 * interface that helps the system understand agent interactions and adaptation patterns.
 */

import { EventEmitter } from 'events';

/**
 * Agent task for code evolution
 */
export interface AgentTask {
    task_id: string;
    task_type: 'quality_analysis' | 'refactoring' | 'architecture' | 'documentation';
    priority: number;
    target_path?: string;
    description: string;
    constraints?: string[];
    metadata?: Record<string, any>;
    created_at: string;
    assigned_to?: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
    result?: TaskResult;
}

/**
 * Task result from agent execution
 */
export interface TaskResult {
    task_id: string;
    success: boolean;
    changes_proposed?: ChangeProposal[];
    errors?: string[];
    metrics?: Record<string, number>;
    evidence?: string[];
    confidence: number;
    timestamp: string;
}

/**
 * Change proposal from agent
 */
export interface ChangeProposal {
    proposal_id: string;
    task_id: string;
    change_type: 'add' | 'modify' | 'remove' | 'refactor';
    file_path: string;
    description: string;
    diff?: string;
    confidence: number;
    evidence: string[];
    impact_analysis?: ImpactAnalysis;
    requires_validation: boolean;
    created_at: string;
}

/**
 * Impact analysis for change proposal
 */
export interface ImpactAnalysis {
    files_affected: string[];
    breaking_changes: boolean;
    test_coverage: number;
    performance_impact?: 'positive' | 'negative' | 'neutral';
    security_impact?: 'positive' | 'negative' | 'neutral';
    estimated_risk: 'low' | 'medium' | 'high';
}

/**
 * Agent coordination configuration
 */
export interface AgentCoordinatorConfig {
    max_concurrent_tasks: number;
    task_timeout: number;
    conflict_resolution: 'first_wins' | 'priority' | 'merge' | 'human_review';
    enable_parallel_execution: boolean;
    validation_required: boolean;
}

/**
 * Agent Coordinator
 *
 * Coordinates multiple AI agents for code evolution tasks.
 *
 * Following the complex learner pattern: coordination serves as a learning
 * interface for understanding agent interactions and adaptation patterns.
 */
export class AgentCoordinator extends EventEmitter {
    private config: AgentCoordinatorConfig;
    private tasks: Map<string, AgentTask> = new Map();
    private activeTasks: Set<string> = new Set();
    private agentCapabilities: Map<string, string[]> = new Map();

    constructor(config: Partial<AgentCoordinatorConfig> = {}) {
        super();
        this.config = {
            max_concurrent_tasks: config.max_concurrent_tasks || 5,
            task_timeout: config.task_timeout || 300000, // 5 minutes
            conflict_resolution: config.conflict_resolution || 'human_review',
            enable_parallel_execution: config.enable_parallel_execution ?? true,
            validation_required: config.validation_required ?? true,
        };
    }

    /**
     * Register agent capabilities
     */
    registerAgent(agent_id: string, capabilities: string[]): void {
        this.agentCapabilities.set(agent_id, capabilities);
        this.emit('agent_registered', { agent_id, capabilities });
    }

    /**
     * Submit task for agent execution
     */
    async submitTask(task: Omit<AgentTask, 'task_id' | 'status' | 'created_at'>): Promise<string> {
        const task_id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const fullTask: AgentTask = {
            ...task,
            task_id,
            status: 'pending',
            created_at: new Date().toISOString(),
        };

        this.tasks.set(task_id, fullTask);
        this.emit('task_submitted', { task_id, task: fullTask });

        // Auto-assign if possible
        if (this.config.enable_parallel_execution) {
            await this.attemptAutoAssignment(task_id);
        }

        return task_id;
    }

    /**
     * Attempt to auto-assign task to available agent
     */
    private async attemptAutoAssignment(task_id: string): Promise<void> {
        if (this.activeTasks.size >= this.config.max_concurrent_tasks) {
            return; // Max concurrent tasks reached
        }

        const task = this.tasks.get(task_id);
        if (!task || task.status !== 'pending') {
            return;
        }

        // Find agent with matching capabilities
        const suitableAgent = this.findSuitableAgent(task.task_type);
        if (suitableAgent) {
            await this.assignTask(task_id, suitableAgent);
        }
    }

    /**
     * Find suitable agent for task type
     */
    private findSuitableAgent(task_type: AgentTask['task_type']): string | null {
        const entries = Array.from(this.agentCapabilities.entries());
        for (const [agent_id, capabilities] of entries) {
            if (capabilities.includes(task_type)) {
                // Check if agent is available
                const agentActiveTasks = Array.from(this.activeTasks).filter(
                    tid => this.tasks.get(tid)?.assigned_to === agent_id
                );
                if (agentActiveTasks.length === 0) {
                    return agent_id;
                }
            }
        }
        return null;
    }

    /**
     * Assign task to agent
     */
    async assignTask(task_id: string, agent_id: string): Promise<void> {
        const task = this.tasks.get(task_id);
        if (!task) {
            throw new Error(`Task ${task_id} not found`);
        }

        if (task.status !== 'pending') {
            throw new Error(`Task ${task_id} is not pending`);
        }

        task.assigned_to = agent_id;
        task.status = 'in_progress';
        this.activeTasks.add(task_id);

        this.emit('task_assigned', { task_id, agent_id, task });

        // Set timeout
        setTimeout(() => {
            if (this.tasks.get(task_id)?.status === 'in_progress') {
                this.handleTaskTimeout(task_id);
            }
        }, this.config.task_timeout);
    }

    /**
     * Handle task timeout
     */
    private handleTaskTimeout(task_id: string): void {
        const task = this.tasks.get(task_id);
        if (!task) return;

        task.status = 'failed';
        this.activeTasks.delete(task_id);

        this.emit('task_timeout', { task_id, task });
    }

    /**
     * Complete task with result
     */
    async completeTask(task_id: string, result: TaskResult): Promise<void> {
        const task = this.tasks.get(task_id);
        if (!task) {
            throw new Error(`Task ${task_id} not found`);
        }

        task.status = result.success ? 'completed' : 'failed';
        task.result = result;
        this.activeTasks.delete(task_id);

        this.emit('task_completed', { task_id, task, result });

        // Process change proposals if any
        if (result.changes_proposed && result.changes_proposed.length > 0) {
            for (const proposal of result.changes_proposed) {
                await this.processChangeProposal(proposal);
            }
        }
    }

    /**
     * Process change proposal
     */
    private async processChangeProposal(proposal: ChangeProposal): Promise<void> {
        this.emit('change_proposal', { proposal });

        if (proposal.requires_validation && this.config.validation_required) {
            this.emit('validation_required', { proposal });
        } else {
            // Auto-apply if validation not required
            this.emit('change_approved', { proposal });
        }
    }

    /**
     * Resolve task conflicts
     */
    async resolveConflict(task_ids: string[]): Promise<string[]> {
        const tasks = task_ids.map(id => this.tasks.get(id)).filter(Boolean) as AgentTask[];

        if (tasks.length === 0) {
            return [];
        }

        switch (this.config.conflict_resolution) {
            case 'priority':
                // Sort by priority, keep highest
                tasks.sort((a, b) => b.priority - a.priority);
                return [tasks[0].task_id];

            case 'first_wins':
                tasks.sort((a, b) =>
                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                );
                return [tasks[0].task_id];

            case 'merge':
                // Return all - let merge logic handle it
                return task_ids;

            case 'human_review':
                this.emit('conflict_resolution_required', { task_ids, tasks });
                return []; // Pending human review

            default:
                return task_ids;
        }
    }

    /**
     * Get task status
     */
    getTask(task_id: string): AgentTask | undefined {
        return this.tasks.get(task_id);
    }

    /**
     * List all tasks
     */
    listTasks(status?: AgentTask['status']): AgentTask[] {
        const tasks = Array.from(this.tasks.values());
        if (status) {
            return tasks.filter(t => t.status === status);
        }
        return tasks;
    }

    /**
     * Get coordinator statistics
     */
    getStats(): {
        total_tasks: number;
        pending: number;
        in_progress: number;
        completed: number;
        failed: number;
        active_agents: number;
    } {
        const tasks = Array.from(this.tasks.values());
        return {
            total_tasks: tasks.length,
            pending: tasks.filter(t => t.status === 'pending').length,
            in_progress: tasks.filter(t => t.status === 'in_progress').length,
            completed: tasks.filter(t => t.status === 'completed').length,
            failed: tasks.filter(t => t.status === 'failed').length,
            active_agents: new Set(tasks.filter(t => t.status === 'in_progress').map(t => t.assigned_to)).size,
        };
    }
}
