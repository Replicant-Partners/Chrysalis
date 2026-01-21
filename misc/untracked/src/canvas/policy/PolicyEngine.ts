/**
 * Policy Engine
 * Advanced policy enforcement beyond basic limits
 */

import type { CanvasPolicy, ValidationResult, WidgetNodeData } from '../types';
import type { Node, Edge } from 'reactflow';

export interface PolicyContext {
  userId?: string;
  canvasId: string;
  capabilities: string[];
}

export class PolicyEngine {
  constructor(
    private policy: CanvasPolicy,
    private context: PolicyContext
  ) {}

  public validateNodeCreation(node: Node<WidgetNodeData>): ValidationResult {
    const errors: string[] = [];

    // Widget type check
    if (!this.policy.allowedWidgetTypes.includes(node.data.type)) {
      errors.push(`Widget type '${node.data.type}' not permitted`);
    }

    // Capability check
    // TODO: Cross-reference with widget capabilities from registry

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  public validateResourceUsage(nodes: Node[], edges: Edge[], operation: string): ValidationResult {
    const errors: string[] = [];

    if (operation === 'node:add' && nodes.length >= this.policy.maxNodes) {
      errors.push(`Node limit reached: ${this.policy.maxNodes}`);
    }

    if (operation === 'edge:add' && edges.length >= this.policy.maxEdges) {
      errors.push(`Edge limit reached: ${this.policy.maxEdges}`);
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  public checkCapability(required: string): boolean {
    return this.context.capabilities.includes(required);
  }

  public updatePolicy(policy: Partial<CanvasPolicy>): void {
    this.policy = { ...this.policy, ...policy };
  }

  public getPolicy(): Readonly<CanvasPolicy> {
    return this.policy;
  }
}
