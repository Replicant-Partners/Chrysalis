/**
 * Agent Instances Component
 * 
 * Manages active and terminated agent instances.
 * 
 * Single Responsibility: Instance lifecycle and health management
 */

import { InstanceMetadata, InstanceStatus, SyncProtocol, AgentImplementationType } from '../UniformSemanticAgentV2';

/**
 * Instances data structure
 */
export interface AgentInstancesData {
  active: InstanceMetadata[];
  terminated: InstanceMetadata[];
}

/**
 * Instance creation options
 */
export interface CreateInstanceOptions {
  type: AgentImplementationType;
  framework: string;
  deployment_context: string;
  sync_protocol?: SyncProtocol;
  endpoint?: string;
}

/**
 * Agent Instances Manager
 */
export class AgentInstances {
  private data: AgentInstancesData;

  constructor(data?: Partial<AgentInstancesData>) {
    this.data = {
      active: data?.active || [],
      terminated: data?.terminated || [],
    };
  }

  /**
   * Create a new instance
   */
  createInstance(options: CreateInstanceOptions): InstanceMetadata {
    const instance: InstanceMetadata = {
      instance_id: `inst-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: options.type,
      framework: options.framework,
      deployment_context: options.deployment_context,
      created: new Date().toISOString(),
      last_sync: new Date().toISOString(),
      status: 'running',
      sync_protocol: options.sync_protocol || 'streaming',
      endpoint: options.endpoint || '',
      health: {
        status: 'healthy',
        last_heartbeat: new Date().toISOString(),
        error_rate: 0,
        sync_lag: 0,
      },
      statistics: {
        total_syncs: 0,
        memories_contributed: 0,
        skills_learned: 0,
        knowledge_acquired: 0,
        conversations_handled: 0,
      },
    };

    this.data.active.push(instance);
    return instance;
  }

  /**
   * Get instance by ID
   */
  getInstance(instanceId: string): InstanceMetadata | undefined {
    return this.data.active.find(i => i.instance_id === instanceId) ||
           this.data.terminated.find(i => i.instance_id === instanceId);
  }

  /**
   * Update instance status
   */
  updateStatus(instanceId: string, status: InstanceStatus): void {
    const instance = this.data.active.find(i => i.instance_id === instanceId);
    if (instance) {
      instance.status = status;
      if (status === 'terminated') {
        this.terminateInstance(instanceId);
      }
    }
  }

  /**
   * Update instance health
   */
  updateHealth(instanceId: string, health: Partial<InstanceMetadata['health']>): void {
    const instance = this.data.active.find(i => i.instance_id === instanceId);
    if (instance) {
      instance.health = { ...instance.health, ...health };
      instance.health.last_heartbeat = new Date().toISOString();
    }
  }

  /**
   * Record sync
   */
  recordSync(instanceId: string, stats: Partial<InstanceMetadata['statistics']>): void {
    const instance = this.data.active.find(i => i.instance_id === instanceId);
    if (instance) {
      instance.last_sync = new Date().toISOString();
      instance.statistics.total_syncs++;
      if (stats.memories_contributed) instance.statistics.memories_contributed += stats.memories_contributed;
      if (stats.skills_learned) instance.statistics.skills_learned += stats.skills_learned;
      if (stats.knowledge_acquired) instance.statistics.knowledge_acquired += stats.knowledge_acquired;
      if (stats.conversations_handled) instance.statistics.conversations_handled += stats.conversations_handled;
    }
  }

  /**
   * Terminate an instance
   */
  terminateInstance(instanceId: string): void {
    const index = this.data.active.findIndex(i => i.instance_id === instanceId);
    if (index !== -1) {
      const instance = this.data.active[index];
      instance.status = 'terminated';
      this.data.terminated.push(instance);
      this.data.active.splice(index, 1);
    }
  }

  /**
   * Get healthy instances
   */
  getHealthyInstances(): InstanceMetadata[] {
    return this.data.active.filter(i => i.health.status === 'healthy');
  }

  /**
   * Get instances by type
   */
  getInstancesByType(type: AgentImplementationType): InstanceMetadata[] {
    return this.data.active.filter(i => i.type === type);
  }

  /**
   * Get aggregate statistics
   */
  getAggregateStatistics(): {
    totalActive: number;
    totalTerminated: number;
    totalSyncs: number;
    totalMemories: number;
    totalSkills: number;
    totalKnowledge: number;
    totalConversations: number;
    healthyCount: number;
    degradedCount: number;
    unhealthyCount: number;
  } {
    const allInstances = [...this.data.active, ...this.data.terminated];
    
    return {
      totalActive: this.data.active.length,
      totalTerminated: this.data.terminated.length,
      totalSyncs: allInstances.reduce((sum, i) => sum + i.statistics.total_syncs, 0),
      totalMemories: allInstances.reduce((sum, i) => sum + i.statistics.memories_contributed, 0),
      totalSkills: allInstances.reduce((sum, i) => sum + i.statistics.skills_learned, 0),
      totalKnowledge: allInstances.reduce((sum, i) => sum + i.statistics.knowledge_acquired, 0),
      totalConversations: allInstances.reduce((sum, i) => sum + i.statistics.conversations_handled, 0),
      healthyCount: this.data.active.filter(i => i.health.status === 'healthy').length,
      degradedCount: this.data.active.filter(i => i.health.status === 'degraded').length,
      unhealthyCount: this.data.active.filter(i => i.health.status === 'unhealthy').length,
    };
  }

  // Getters
  get active(): readonly InstanceMetadata[] { return this.data.active; }
  get terminated(): readonly InstanceMetadata[] { return this.data.terminated; }

  toData(): AgentInstancesData {
    return { ...this.data };
  }
}

export function validateInstances(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Instances must be an object'] };
  }
  const instances = data as Record<string, unknown>;
  if (!Array.isArray(instances.active)) errors.push('Instances must have active array');
  if (!Array.isArray(instances.terminated)) errors.push('Instances must have terminated array');
  return { valid: errors.length === 0, errors };
}
