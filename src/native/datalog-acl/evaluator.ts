/**
 * Chrysalis Access Control Evaluator
 *
 * TypeScript implementation of the Datalog access control rules.
 * This provides a runtime-compatible evaluator without requiring
 * an external Datalog engine like Soufflé.
 */

// ============================================================================
// Types
// ============================================================================

export type AgentId = string;
export type ResourceId = string;
export type Action = string;
export type Role = string;
export type Capability = string;
export type Context = string;
export type Level = number;

export interface Agent {
  id: AgentId;
  roles: Role[];
  capabilities: Capability[];
  trustLevel: Level;
}

export interface Resource {
  id: ResourceId;
  type: string;
  owner?: AgentId;
  sensitivity: Level;
}

export interface Delegation {
  delegator: AgentId;
  delegatee: AgentId;
  resource: ResourceId;
  action: Action;
}

export interface AccessRequest {
  agent: AgentId;
  resource: ResourceId;
  action: Action;
}

export interface AccessResult {
  granted: boolean;
  reason: string;
  via: 'direct' | 'delegated' | 'ownership' | 'denied';
  matchedRule?: string;
}

// ============================================================================
// Role Hierarchy
// ============================================================================

const ROLE_HIERARCHY: Map<Role, Role[]> = new Map([
  ['system', ['admin']],
  ['admin', ['moderator']],
  ['orchestrator', ['moderator']],
  ['moderator', ['agent']],
  ['agent', ['guest']],
  ['guest', []],
]);

function getInheritedRoles(role: Role): Set<Role> {
  const inherited = new Set<Role>([role]);
  const queue = [role];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = ROLE_HIERARCHY.get(current) || [];

    for (const child of children) {
      if (!inherited.has(child)) {
        inherited.add(child);
        queue.push(child);
      }
    }
  }

  return inherited;
}

function getAllInheritedRoles(roles: Role[]): Set<Role> {
  const all = new Set<Role>();
  for (const role of roles) {
    for (const inherited of getInheritedRoles(role)) {
      all.add(inherited);
    }
  }
  return all;
}

// ============================================================================
// Permission Tables
// ============================================================================

interface Permission {
  resourceType: string;
  action: Action;
}

const ROLE_PERMISSIONS: Map<Role, Permission[]> = new Map([
  [
    'system',
    [
      { resourceType: 'any', action: 'read' },
      { resourceType: 'any', action: 'write' },
      { resourceType: 'any', action: 'delete' },
      { resourceType: 'any', action: 'execute' },
      { resourceType: 'any', action: 'admin' },
    ],
  ],
  [
    'admin',
    [
      { resourceType: 'agent_config', action: 'read' },
      { resourceType: 'agent_config', action: 'write' },
      { resourceType: 'agent_config', action: 'delete' },
      { resourceType: 'memory', action: 'read' },
      { resourceType: 'memory', action: 'write' },
      { resourceType: 'memory', action: 'purge' },
    ],
  ],
  [
    'orchestrator',
    [
      { resourceType: 'agent', action: 'spawn' },
      { resourceType: 'agent', action: 'terminate' },
      { resourceType: 'agent', action: 'route' },
      { resourceType: 'conversation', action: 'arbitrate' },
    ],
  ],
  [
    'moderator',
    [
      { resourceType: 'conversation', action: 'read' },
      { resourceType: 'conversation', action: 'moderate' },
      { resourceType: 'agent', action: 'mute' },
      { resourceType: 'agent', action: 'unmute' },
    ],
  ],
  [
    'agent',
    [
      { resourceType: 'conversation', action: 'read' },
      { resourceType: 'conversation', action: 'write' },
      { resourceType: 'own_memory', action: 'read' },
      { resourceType: 'own_memory', action: 'write' },
      { resourceType: 'tool', action: 'execute' },
    ],
  ],
  [
    'guest',
    [
      { resourceType: 'conversation', action: 'read' },
      { resourceType: 'public_resource', action: 'read' },
    ],
  ],
]);

const CAPABILITY_PERMISSIONS: Map<Capability, Permission[]> = new Map([
  ['memory_read', [{ resourceType: 'memory', action: 'read' }]],
  ['memory_write', [{ resourceType: 'memory', action: 'write' }]],
  ['memory_admin', [{ resourceType: 'memory', action: 'purge' }]],
  ['tool_execute', [{ resourceType: 'tool', action: 'execute' }]],
  ['tool_admin', [{ resourceType: 'tool', action: 'configure' }]],
  ['external_api', [{ resourceType: 'external', action: 'call' }]],
  ['web_fetch', [{ resourceType: 'web', action: 'fetch' }]],
  ['llm_basic', [{ resourceType: 'llm', action: 'query' }]],
  ['llm_advanced', [{ resourceType: 'llm', action: 'stream' }]],
  ['llm_admin', [{ resourceType: 'llm', action: 'configure' }]],
]);

// ============================================================================
// Trust Requirements
// ============================================================================

const TRUST_REQUIREMENTS: Map<string, Level> = new Map([
  ['sensitive', 7],
  ['confidential', 8],
  ['restricted', 9],
  ['top_secret', 10],
]);

// ============================================================================
// Context Requirements
// ============================================================================

const CONTEXT_REQUIREMENTS: Map<Action, Context> = new Map([
  ['execute_external', 'production_approved'],
  ['purge', 'maintenance_window'],
  ['admin', 'admin_session'],
]);

// ============================================================================
// Access Control Evaluator
// ============================================================================

export class AccessControlEvaluator {
  private agents: Map<AgentId, Agent> = new Map();
  private resources: Map<ResourceId, Resource> = new Map();
  private delegations: Delegation[] = [];
  private activeContexts: Set<Context> = new Set();

  // -------------------------------------------------------------------------
  // Configuration Methods
  // -------------------------------------------------------------------------

  addAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
  }

  addResource(resource: Resource): void {
    this.resources.set(resource.id, resource);
  }

  addDelegation(delegation: Delegation): void {
    this.delegations.push(delegation);
  }

  setActiveContext(context: Context, active: boolean): void {
    if (active) {
      this.activeContexts.add(context);
    } else {
      this.activeContexts.delete(context);
    }
  }

  // -------------------------------------------------------------------------
  // Access Check Methods
  // -------------------------------------------------------------------------

  checkAccess(request: AccessRequest): AccessResult {
    const agent = this.agents.get(request.agent);
    const resource = this.resources.get(request.resource);

    if (!agent) {
      return {
        granted: false,
        reason: `Unknown agent: ${request.agent}`,
        via: 'denied',
      };
    }

    if (!resource) {
      return {
        granted: false,
        reason: `Unknown resource: ${request.resource}`,
        via: 'denied',
      };
    }

    // Check ownership first
    if (resource.owner === agent.id) {
      if (['read', 'write', 'delete'].includes(request.action)) {
        return {
          granted: true,
          reason: 'Resource owner',
          via: 'ownership',
          matchedRule: 'ownership_access',
        };
      }
    }

    // Check role-based permissions
    const roleResult = this.checkRoleAccess(agent, resource, request.action);
    if (roleResult.granted) {
      // Check trust level
      if (!this.checkTrustLevel(agent, resource)) {
        return {
          granted: false,
          reason: `Insufficient trust level: ${agent.trustLevel} < ${resource.sensitivity}`,
          via: 'denied',
        };
      }

      // Check context requirements
      if (!this.checkContextRequirements(request.action)) {
        return {
          granted: false,
          reason: `Required context not active for action: ${request.action}`,
          via: 'denied',
        };
      }

      return roleResult;
    }

    // Check capability-based permissions
    const capResult = this.checkCapabilityAccess(
      agent,
      resource,
      request.action
    );
    if (capResult.granted) {
      if (!this.checkTrustLevel(agent, resource)) {
        return {
          granted: false,
          reason: `Insufficient trust level: ${agent.trustLevel} < ${resource.sensitivity}`,
          via: 'denied',
        };
      }

      if (!this.checkContextRequirements(request.action)) {
        return {
          granted: false,
          reason: `Required context not active for action: ${request.action}`,
          via: 'denied',
        };
      }

      return capResult;
    }

    // Check delegations
    const delegationResult = this.checkDelegatedAccess(
      agent,
      resource,
      request.action
    );
    if (delegationResult.granted) {
      return delegationResult;
    }

    return {
      granted: false,
      reason: 'No matching permission found',
      via: 'denied',
    };
  }

  private checkRoleAccess(
    agent: Agent,
    resource: Resource,
    action: Action
  ): AccessResult {
    const allRoles = getAllInheritedRoles(agent.roles);

    for (const role of allRoles) {
      const permissions = ROLE_PERMISSIONS.get(role) || [];

      for (const perm of permissions) {
        if (
          (perm.resourceType === resource.type ||
            perm.resourceType === 'any') &&
          perm.action === action
        ) {
          return {
            granted: true,
            reason: `Role permission: ${role}`,
            via: 'direct',
            matchedRule: `role_permission(${role}, ${perm.resourceType}, ${action})`,
          };
        }
      }
    }

    return { granted: false, reason: 'No role permission', via: 'denied' };
  }

  private checkCapabilityAccess(
    agent: Agent,
    resource: Resource,
    action: Action
  ): AccessResult {
    for (const cap of agent.capabilities) {
      const permissions = CAPABILITY_PERMISSIONS.get(cap) || [];

      for (const perm of permissions) {
        if (perm.resourceType === resource.type && perm.action === action) {
          return {
            granted: true,
            reason: `Capability: ${cap}`,
            via: 'direct',
            matchedRule: `capability_permission(${cap}, ${perm.resourceType}, ${action})`,
          };
        }
      }
    }

    return {
      granted: false,
      reason: 'No capability permission',
      via: 'denied',
    };
  }

  private checkDelegatedAccess(
    agent: Agent,
    resource: Resource,
    action: Action
  ): AccessResult {
    for (const delegation of this.delegations) {
      if (
        delegation.delegatee === agent.id &&
        delegation.resource === resource.id &&
        delegation.action === action
      ) {
        // Verify delegator still has permission
        const delegator = this.agents.get(delegation.delegator);
        if (delegator) {
          const delegatorResult = this.checkAccess({
            agent: delegator.id,
            resource: resource.id,
            action: action,
          });

          if (delegatorResult.granted) {
            return {
              granted: true,
              reason: `Delegated from ${delegation.delegator}`,
              via: 'delegated',
              matchedRule: `delegation(${delegation.delegator}, ${delegation.delegatee}, ${resource.id}, ${action})`,
            };
          }
        }
      }
    }

    return { granted: false, reason: 'No delegation found', via: 'denied' };
  }

  private checkTrustLevel(agent: Agent, resource: Resource): boolean {
    return agent.trustLevel >= resource.sensitivity;
  }

  private checkContextRequirements(action: Action): boolean {
    const requiredContext = CONTEXT_REQUIREMENTS.get(action);
    if (!requiredContext) {
      return true; // No context requirement
    }
    return this.activeContexts.has(requiredContext);
  }

  // -------------------------------------------------------------------------
  // Batch Operations
  // -------------------------------------------------------------------------

  checkBatch(requests: AccessRequest[]): Map<string, AccessResult> {
    const results = new Map<string, AccessResult>();

    for (const request of requests) {
      const key = `${request.agent}:${request.resource}:${request.action}`;
      results.set(key, this.checkAccess(request));
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Query Methods
  // -------------------------------------------------------------------------

  getAgentPermissions(agentId: AgentId): Permission[] {
    const agent = this.agents.get(agentId);
    if (!agent) return [];

    const permissions: Permission[] = [];
    const allRoles = getAllInheritedRoles(agent.roles);

    // Collect role permissions
    for (const role of allRoles) {
      const rolePerms = ROLE_PERMISSIONS.get(role) || [];
      permissions.push(...rolePerms);
    }

    // Collect capability permissions
    for (const cap of agent.capabilities) {
      const capPerms = CAPABILITY_PERMISSIONS.get(cap) || [];
      permissions.push(...capPerms);
    }

    return permissions;
  }

  getResourceAccessors(
    resourceId: ResourceId,
    action: Action
  ): { agentId: AgentId; via: string }[] {
    const resource = this.resources.get(resourceId);
    if (!resource) return [];

    const accessors: { agentId: AgentId; via: string }[] = [];

    for (const [agentId] of this.agents) {
      const result = this.checkAccess({ agent: agentId, resource: resourceId, action });
      if (result.granted) {
        accessors.push({ agentId, via: result.via });
      }
    }

    return accessors;
  }

  // -------------------------------------------------------------------------
  // Audit Methods
  // -------------------------------------------------------------------------

  generateAuditLog(request: AccessRequest): {
    request: AccessRequest;
    result: AccessResult;
    timestamp: number;
    agentInfo: Agent | undefined;
    resourceInfo: Resource | undefined;
  } {
    return {
      request,
      result: this.checkAccess(request),
      timestamp: Date.now(),
      agentInfo: this.agents.get(request.agent),
      resourceInfo: this.resources.get(request.resource),
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createEvaluatorFromConfig(config: {
  agents: Agent[];
  resources: Resource[];
  delegations?: Delegation[];
  activeContexts?: Context[];
}): AccessControlEvaluator {
  const evaluator = new AccessControlEvaluator();

  for (const agent of config.agents) {
    evaluator.addAgent(agent);
  }

  for (const resource of config.resources) {
    evaluator.addResource(resource);
  }

  for (const delegation of config.delegations || []) {
    evaluator.addDelegation(delegation);
  }

  for (const ctx of config.activeContexts || []) {
    evaluator.setActiveContext(ctx, true);
  }

  return evaluator;
}

export default AccessControlEvaluator;
