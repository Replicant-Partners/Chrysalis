/**
 * Settings Canvas
 * 
 * Secure canvas for configuration management.
 * Whitelist: KeyEditor, ApiEnvelope, FeatureFlag, BudgetControl
 * Security: Secret masking, no logging, HTTPS only
 * 
 * @module canvas/canvases/SettingsCanvas
 */

import React from 'react';
import { BaseCanvas, BaseCanvasProps } from '../BaseCanvas';
import { createWidgetRegistry } from '../WidgetRegistry';
import type { CanvasPolicy, CanvasLogger } from '../types';
import { createLogger } from '../../shared/logger';

// =============================================================================
// Settings Widget Types
// =============================================================================

export type SettingsWidgetType = 
  | 'key_editor'
  | 'api_envelope'
  | 'feature_flag'
  | 'budget_control'
  | 'audit_log';

// =============================================================================
// Settings Canvas Configuration
// =============================================================================

const SETTINGS_POLICY: CanvasPolicy = {
  allowlist: ['key_editor', 'api_envelope', 'feature_flag', 'budget_control', 'audit_log'],
  denylist: [],
  maxNodes: 50,
  maxEdges: 100,
  rateLimit: {
    maxActionsPerMinute: 30,
    maxCreationsPerMinute: 10,
  },
};

/**
 * Create settings canvas widget registry
 */
function createSettingsRegistry(logger: CanvasLogger) {
  const registry = createWidgetRegistry<SettingsWidgetType>(
    'settings',
    ['key_editor', 'api_envelope', 'feature_flag', 'budget_control', 'audit_log'],
    logger,
    {
      capabilities: ['settings:read', 'settings:write', 'settings:secrets'],
    }
  );
  
  // Register widgets
  // TODO: Implement widget renderers with secret masking
  
  return registry;
}

// =============================================================================
// Settings Canvas Component
// =============================================================================

export interface SettingsCanvasProps extends Omit<BaseCanvasProps<SettingsWidgetType>, 'canvasKind' | 'registry' | 'policy'> {
  policy?: Partial<CanvasPolicy>;
  /** Enable secret masking (default: true) */
  maskSecrets?: boolean;
}

export function SettingsCanvas(props: SettingsCanvasProps) {
  const logger = props.logger || createLogger('canvas-settings');
  const registry = React.useMemo(() => createSettingsRegistry(logger), [logger]);
  
  const mergedPolicy: CanvasPolicy = {
    ...SETTINGS_POLICY,
    ...props.policy,
    allowlist: props.policy?.allowlist || SETTINGS_POLICY.allowlist,
  };
  
  return (
    <BaseCanvas
      canvasKind="settings"
      registry={registry}
      policy={mergedPolicy}
      {...props}
    />
  );
}

export default SettingsCanvas;