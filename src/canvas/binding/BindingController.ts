/**
 * Binding Controller
 *
 * Enforces widget and connection policies on canvases:
 * - Validates widget additions against whitelist/denylist
 * - Validates connections against connection rules
 * - Tracks widget counts for limit enforcement
 * - Emits events for violations and successful bindings
 */

import { EventEmitter } from 'events';
import type { CanvasKind, CanvasNode, CanvasEdge } from '../core/types';
import type { WidgetTypeId } from '../widgets/types';
import { getWidgetRegistry } from '../widgets/WidgetRegistry';
import {
  CanvasWidgetPolicy,
  CanvasConnectionPolicy,
  ConnectionRule,
  BindingEvent,
  BindingEventType,
  BindingValidationResult,
  PolicyViolationPayload,
  DEFAULT_CANVAS_POLICIES,
  DEFAULT_CONNECTION_POLICIES,
} from './types';

// =============================================================================
// Binding Controller
// =============================================================================

export class BindingController {
  private widgetPolicies: Map<CanvasKind, CanvasWidgetPolicy> = new Map();
  private connectionPolicies: Map<CanvasKind, CanvasConnectionPolicy> = new Map();
  private emitter = new EventEmitter();

  // Track current state per canvas
  private canvasWidgetCounts: Map<string, Map<WidgetTypeId, number>> = new Map();
  private canvasConnectionCounts: Map<string, { from: Map<string, number>; to: Map<string, number> }> = new Map();

  constructor() {
    // Load default policies
    Object.values(DEFAULT_CANVAS_POLICIES).forEach(policy => {
      this.widgetPolicies.set(policy.canvasKind, policy);
    });
    Object.values(DEFAULT_CONNECTION_POLICIES).forEach(policy => {
      this.connectionPolicies.set(policy.canvasKind, policy);
    });
  }

  // ===========================================================================
  // Policy Configuration
  // ===========================================================================

  /**
   * Set custom widget policy for a canvas type.
   */
  setWidgetPolicy(policy: CanvasWidgetPolicy): void {
    this.widgetPolicies.set(policy.canvasKind, policy);
  }

  /**
   * Get widget policy for a canvas type.
   */
  getWidgetPolicy(canvasKind: CanvasKind): CanvasWidgetPolicy | undefined {
    return this.widgetPolicies.get(canvasKind);
  }

  /**
   * Set custom connection policy for a canvas type.
   */
  setConnectionPolicy(policy: CanvasConnectionPolicy): void {
    this.connectionPolicies.set(policy.canvasKind, policy);
  }

  /**
   * Get connection policy for a canvas type.
   */
  getConnectionPolicy(canvasKind: CanvasKind): CanvasConnectionPolicy | undefined {
    return this.connectionPolicies.get(canvasKind);
  }

  // ===========================================================================
  // Widget Validation
  // ===========================================================================

  /**
   * Check if a widget type can be added to a canvas.
   */
  canAddWidget(
    canvasId: string,
    canvasKind: CanvasKind,
    widgetType: WidgetTypeId
  ): BindingValidationResult {
    const policy = this.widgetPolicies.get(canvasKind);
    if (!policy) {
      return { valid: true }; // No policy = allow all
    }

    // Check if widget type is in registry and allowed on this canvas
    const registry = getWidgetRegistry();
    if (!registry.isAllowedOnCanvas(widgetType, canvasKind)) {
      return {
        valid: false,
        reason: `Widget '${widgetType}' is not registered for canvas type '${canvasKind}'`,
        suggestions: registry.getForCanvas(canvasKind).map(w => w.typeId),
      };
    }

    // Check allowlist/denylist
    const isInList = policy.widgetTypes.includes(widgetType);
    if (policy.mode === 'allowlist' && !isInList) {
      return {
        valid: false,
        reason: `Widget '${widgetType}' is not in the allowlist for ${canvasKind}`,
        suggestions: policy.widgetTypes,
      };
    }
    if (policy.mode === 'denylist' && isInList) {
      return {
        valid: false,
        reason: `Widget '${widgetType}' is in the denylist for ${canvasKind}`,
      };
    }

    // Check total limit
    if (policy.maxTotal !== undefined) {
      const totalCount = this.getTotalWidgetCount(canvasId);
      if (totalCount >= policy.maxTotal) {
        return {
          valid: false,
          reason: `Canvas has reached maximum widget limit (${policy.maxTotal})`,
        };
      }
    }

    // Check per-type limit
    if (policy.maxPerType && policy.maxPerType[widgetType] !== undefined) {
      const typeCount = this.getWidgetTypeCount(canvasId, widgetType);
      if (typeCount >= policy.maxPerType[widgetType]) {
        return {
          valid: false,
          reason: `Maximum ${widgetType} widgets (${policy.maxPerType[widgetType]}) already on canvas`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Record that a widget was added to a canvas.
   */
  recordWidgetAdded(canvasId: string, widgetType: WidgetTypeId): void {
    if (!this.canvasWidgetCounts.has(canvasId)) {
      this.canvasWidgetCounts.set(canvasId, new Map());
    }
    const counts = this.canvasWidgetCounts.get(canvasId)!;
    counts.set(widgetType, (counts.get(widgetType) ?? 0) + 1);

    this.emit('widget:attached', canvasId, { nodeId: canvasId, widgetType });
  }

  /**
   * Record that a widget was removed from a canvas.
   */
  recordWidgetRemoved(canvasId: string, widgetType: WidgetTypeId): void {
    const counts = this.canvasWidgetCounts.get(canvasId);
    if (counts && counts.has(widgetType)) {
      const current = counts.get(widgetType)!;
      if (current > 1) {
        counts.set(widgetType, current - 1);
      } else {
        counts.delete(widgetType);
      }
    }

    this.emit('widget:detached', canvasId, { widgetType });
  }

  // ===========================================================================
  // Connection Validation
  // ===========================================================================

  /**
   * Check if a connection can be created between two nodes.
   */
  canConnect(
    canvasId: string,
    canvasKind: CanvasKind,
    sourceNode: CanvasNode,
    targetNode: CanvasNode
  ): BindingValidationResult {
    const policy = this.connectionPolicies.get(canvasKind);
    if (!policy) {
      return { valid: true }; // No policy = allow all
    }

    const sourceType = sourceNode.data.widgetType;
    const targetType = targetNode.data.widgetType;

    // Find applicable rule
    const rule = this.findConnectionRule(policy, sourceType, targetType);

    if (rule) {
      if (!rule.allowed) {
        return {
          valid: false,
          reason: `Connections from '${sourceType}' to '${targetType}' are not allowed`,
        };
      }

      // Check source connection limit
      if (rule.maxFromSource !== undefined) {
        const fromCount = this.getConnectionsFromNode(canvasId, sourceNode.id);
        if (fromCount >= rule.maxFromSource) {
          return {
            valid: false,
            reason: `Source node has reached maximum outgoing connections (${rule.maxFromSource})`,
          };
        }
      }

      // Check target connection limit
      if (rule.maxToTarget !== undefined) {
        const toCount = this.getConnectionsToNode(canvasId, targetNode.id);
        if (toCount >= rule.maxToTarget) {
          return {
            valid: false,
            reason: `Target node has reached maximum incoming connections (${rule.maxToTarget})`,
          };
        }
      }

      return { valid: true };
    }

    // No specific rule - use default
    if (!policy.defaultAllow) {
      return {
        valid: false,
        reason: `Connections are not allowed by default on ${canvasKind} canvas`,
      };
    }

    return { valid: true };
  }

  /**
   * Record that a connection was created.
   */
  recordConnectionCreated(canvasId: string, edge: CanvasEdge): void {
    if (!this.canvasConnectionCounts.has(canvasId)) {
      this.canvasConnectionCounts.set(canvasId, { from: new Map(), to: new Map() });
    }
    const counts = this.canvasConnectionCounts.get(canvasId)!;
    counts.from.set(edge.source, (counts.from.get(edge.source) ?? 0) + 1);
    counts.to.set(edge.target, (counts.to.get(edge.target) ?? 0) + 1);

    this.emit('connection:created', canvasId, { edge });
  }

  /**
   * Record that a connection was removed.
   */
  recordConnectionRemoved(canvasId: string, edge: CanvasEdge): void {
    const counts = this.canvasConnectionCounts.get(canvasId);
    if (counts) {
      const fromCount = counts.from.get(edge.source);
      if (fromCount && fromCount > 0) {
        counts.from.set(edge.source, fromCount - 1);
      }
      const toCount = counts.to.get(edge.target);
      if (toCount && toCount > 0) {
        counts.to.set(edge.target, toCount - 1);
      }
    }

    this.emit('connection:removed', canvasId, { edge });
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  private findConnectionRule(
    policy: CanvasConnectionPolicy,
    sourceType: string,
    targetType: string
  ): ConnectionRule | undefined {
    // Look for exact match first
    let rule = policy.rules.find(
      r => r.sourceType === sourceType && r.targetType === targetType
    );
    if (rule) return rule;

    // Check bidirectional rules
    rule = policy.rules.find(
      r => r.bidirectional && r.sourceType === targetType && r.targetType === sourceType
    );
    if (rule) return rule;

    // Check wildcard source
    rule = policy.rules.find(
      r => r.sourceType === '*' && r.targetType === targetType
    );
    if (rule) return rule;

    // Check wildcard target
    rule = policy.rules.find(
      r => r.sourceType === sourceType && r.targetType === '*'
    );
    if (rule) return rule;

    // Check double wildcard
    rule = policy.rules.find(
      r => r.sourceType === '*' && r.targetType === '*'
    );
    return rule;
  }

  private getTotalWidgetCount(canvasId: string): number {
    const counts = this.canvasWidgetCounts.get(canvasId);
    if (!counts) return 0;
    let total = 0;
    counts.forEach(count => total += count);
    return total;
  }

  private getWidgetTypeCount(canvasId: string, widgetType: WidgetTypeId): number {
    return this.canvasWidgetCounts.get(canvasId)?.get(widgetType) ?? 0;
  }

  private getConnectionsFromNode(canvasId: string, nodeId: string): number {
    return this.canvasConnectionCounts.get(canvasId)?.from.get(nodeId) ?? 0;
  }

  private getConnectionsToNode(canvasId: string, nodeId: string): number {
    return this.canvasConnectionCounts.get(canvasId)?.to.get(nodeId) ?? 0;
  }

  // ===========================================================================
  // Event Emitter
  // ===========================================================================

  on(event: BindingEventType, handler: (e: BindingEvent) => void): void {
    this.emitter.on(event, handler);
  }

  off(event: BindingEventType, handler: (e: BindingEvent) => void): void {
    this.emitter.off(event, handler);
  }

  private emit<T>(type: BindingEventType, canvasId: string, payload: T): void {
    const event: BindingEvent<T> = {
      type,
      canvasId,
      timestamp: Date.now(),
      payload,
    };
    this.emitter.emit(type, event);
  }

  // ===========================================================================
  // Canvas Lifecycle
  // ===========================================================================

  /**
   * Initialize tracking for a new canvas.
   */
  initCanvas(canvasId: string): void {
    this.canvasWidgetCounts.set(canvasId, new Map());
    this.canvasConnectionCounts.set(canvasId, { from: new Map(), to: new Map() });
  }

  /**
   * Clean up tracking for a destroyed canvas.
   */
  destroyCanvas(canvasId: string): void {
    this.canvasWidgetCounts.delete(canvasId);
    this.canvasConnectionCounts.delete(canvasId);
  }

  /**
   * Get allowed widget types for a canvas.
   */
  getAllowedWidgets(canvasKind: CanvasKind): WidgetTypeId[] {
    const policy = this.widgetPolicies.get(canvasKind);
    if (!policy) return [];

    const registry = getWidgetRegistry();
    const registryWidgets = registry.getForCanvas(canvasKind);

    if (policy.mode === 'allowlist') {
      // Return intersection of policy allowlist and registry
      return policy.widgetTypes.filter(wt =>
        registryWidgets.some(rw => rw.typeId === wt)
      );
    } else {
      // Return registry widgets minus denylist
      return registryWidgets
        .map(w => w.typeId)
        .filter(wt => !policy.widgetTypes.includes(wt));
    }
  }
}

// =============================================================================
// Singleton
// =============================================================================

let globalController: BindingController | null = null;

export function getBindingController(): BindingController {
  if (!globalController) {
    globalController = new BindingController();
  }
  return globalController;
}

export function resetBindingController(): void {
  globalController = null;
}
