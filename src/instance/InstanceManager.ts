/**
 * Instance Manager - Manage deployed agent instances
 * 
 * Handles lifecycle, tracking, and coordination of agent instances
 * across different implementation types and frameworks.
 */

import type { 
  UniformSemanticAgentV2, 
  InstanceMetadata, 
  AgentImplementationType,
  SyncProtocol,
  ExperienceTransportConfig
} from '../core/UniformSemanticAgentV2';
import * as crypto from 'crypto';

/**
 * Instance deployment result
 */
export interface InstanceDeployment {
  instance_id: string;
  deployed_agent: any;
  framework: string;
  type: AgentImplementationType;
  sync_channel: SyncChannel;
  endpoint: string;
  credentials: Credentials;
}

export interface SyncChannel {
  channel_id: string;
  protocol: SyncProtocol;
  endpoint: string;
  credentials: Credentials;
}

export interface Credentials {
  token: string;
  expires: string;
}

/**
 * Termination report
 */
export interface TerminationReport {
  instance_id: string;
  terminated_at: string;
  final_sync_performed: boolean;
  total_runtime: number;
  statistics: {
    total_syncs: number;
    memories_contributed: number;
    skills_learned: number;
    knowledge_acquired: number;
  };
}

/**
 * Instance Manager
 */
export class InstanceManager {
  private instances: Map<string, InstanceMetadata> = new Map();
  
  /**
   * Create new instance
   */
  async createInstance(
    sourceAgent: UniformSemanticAgentV2,
    targetType: AgentImplementationType,
    framework: string,
    syncProtocol: SyncProtocol,
    transport?: ExperienceTransportConfig
  ): Promise<InstanceDeployment> {
    console.log(`Creating ${targetType} instance for ${sourceAgent.identity.name}...`);
    
    // Generate instance ID
    const instance_id = crypto.randomUUID();
    
    // Create instance metadata
    const metadata: InstanceMetadata = {
      instance_id,
      type: targetType,
      framework,
      deployment_context: this.inferContext(targetType),
      created: new Date().toISOString(),
      last_sync: new Date().toISOString(),
      status: 'running',
      sync_protocol: syncProtocol,
      endpoint: this.generateEndpoint(instance_id, targetType),
      health: {
        status: 'healthy',
        last_heartbeat: new Date().toISOString(),
        error_rate: 0,
        sync_lag: 0
      },
      statistics: {
        total_syncs: 0,
        memories_contributed: 0,
        skills_learned: 0,
        knowledge_acquired: 0,
        conversations_handled: 0
      },
      transport
    };
    
    // Register instance
    this.instances.set(instance_id, metadata);
    
    // Update source agent
    sourceAgent.instances.active.push(metadata);
    
    // Create sync channel
    const sync_channel: SyncChannel = {
      channel_id: crypto.randomUUID(),
      protocol: syncProtocol,
      endpoint: `${metadata.endpoint}/sync`,
      credentials: {
        token: this.generateToken(),
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }
    };
    
    console.log(`✓ Instance ${instance_id} created`);
    console.log(`  Type: ${targetType}`);
    console.log(`  Framework: ${framework}`);
    console.log(`  Sync: ${syncProtocol}`);
    
    return {
      instance_id,
      deployed_agent: null,  // Will be filled by adapter
      framework,
      type: targetType,
      sync_channel,
      endpoint: metadata.endpoint,
      credentials: sync_channel.credentials
    };
  }
  
  /**
   * Register instance after deployment
   */
  async registerInstance(
    instance_id: string,
    endpoint: string,
    capabilities: string[]
  ): Promise<void> {
    const instance = this.instances.get(instance_id);
    if (!instance) {
      throw new Error(`Instance ${instance_id} not found`);
    }
    
    instance.endpoint = endpoint;
    instance.health.last_heartbeat = new Date().toISOString();
    
    console.log(`✓ Instance ${instance_id} registered at ${endpoint}`);
  }
  
  /**
   * Update instance health
   */
  async updateHealth(
    instance_id: string,
    health: Partial<InstanceMetadata['health']>
  ): Promise<void> {
    const instance = this.instances.get(instance_id);
    if (!instance) return;
    
    instance.health = {
      ...instance.health,
      ...health,
      last_heartbeat: new Date().toISOString()
    };
  }
  
  /**
   * Update instance statistics
   */
  async updateStatistics(
    instance_id: string,
    updates: Partial<InstanceMetadata['statistics']>
  ): Promise<void> {
    const instance = this.instances.get(instance_id);
    if (!instance) return;
    
    instance.statistics = {
      ...instance.statistics,
      ...updates
    };
    
    instance.last_sync = new Date().toISOString();
  }
  
  /**
   * Terminate instance
   */
  async terminateInstance(
    instance_id: string,
    reason: string,
    performFinalSync: boolean
  ): Promise<TerminationReport> {
    console.log(`Terminating instance ${instance_id}...`);
    console.log(`  Reason: ${reason}`);
    console.log(`  Final sync: ${performFinalSync}`);
    
    const instance = this.instances.get(instance_id);
    if (!instance) {
      throw new Error(`Instance ${instance_id} not found`);
    }
    
    // Perform final sync if requested
    if (performFinalSync) {
      console.log('  → Performing final sync...');
      // Final sync handled by ExperienceSyncManager
    }
    
    // Mark as terminated
    instance.status = 'terminated';
    
    // Calculate runtime
    const created = new Date(instance.created).getTime();
    const terminated = Date.now();
    const total_runtime = terminated - created;
    
    // Move to terminated list
    this.instances.delete(instance_id);
    
    const report: TerminationReport = {
      instance_id,
      terminated_at: new Date().toISOString(),
      final_sync_performed: performFinalSync,
      total_runtime,
      statistics: instance.statistics
    };
    
    console.log(`✓ Instance ${instance_id} terminated`);
    
    return report;
  }
  
  /**
   * Get all active instances
   */
  getActiveInstances(): InstanceMetadata[] {
    return Array.from(this.instances.values())
      .filter(i => i.status !== 'terminated');
  }
  
  /**
   * Get instances by type
   */
  getInstancesByType(type: AgentImplementationType): InstanceMetadata[] {
    return Array.from(this.instances.values())
      .filter(i => i.type === type && i.status !== 'terminated');
  }
  
  /**
   * Get instances currently syncing
   */
  getInstancesSyncingNow(): InstanceMetadata[] {
    return Array.from(this.instances.values())
      .filter(i => i.status === 'syncing');
  }
  
  /**
   * Get instance metadata
   */
  getInstance(instance_id: string): InstanceMetadata | undefined {
    return this.instances.get(instance_id);
  }
  
  // Helper methods
  
  private inferContext(type: AgentImplementationType): string {
    switch (type) {
      case 'mcp':
        return 'ide';
      case 'multi_agent':
        return 'api';
      case 'orchestrated':
        return 'service';
      default:
        return 'unknown';
    }
  }
  
  private generateEndpoint(instance_id: string, type: AgentImplementationType): string {
    const baseUrl = process.env.BASE_URL || 'https://localhost:8443';
    return `${baseUrl}/instances/${instance_id}`;
  }
  
  private generateToken(): string {
    return crypto.randomBytes(32).toString('base64');
  }
}
