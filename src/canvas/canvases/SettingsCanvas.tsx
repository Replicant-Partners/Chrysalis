/**
 * Settings Canvas
 * System configuration management interface
 */

import React from 'react';
import { BaseCanvasWithProvider, BaseCanvasProps } from '../BaseCanvas';
import { createWidgetRegistry } from '../WidgetRegistry';
import type { CanvasPolicy } from '../types';

const SETTINGS_POLICY: CanvasPolicy = {
  maxNodes: 50,
  maxEdges: 100,
  rateLimit: { actions: 20, windowMs: 1000 },
  allowedWidgetTypes: ['config', 'connection', 'credential'],
};

export interface SettingsCanvasProps extends Omit<BaseCanvasProps, 'canvasKind' | 'registry' | 'policy'> {
  customPolicy?: Partial<CanvasPolicy>;
}

export const SettingsCanvas: React.FC<SettingsCanvasProps> = ({ customPolicy, ...props }) => {
  const registry = React.useMemo(
    () => createWidgetRegistry('settings', SETTINGS_POLICY.allowedWidgetTypes),
    []
  );

  const policy = React.useMemo(
    () => ({ ...SETTINGS_POLICY, ...customPolicy }),
    [customPolicy]
  );

  return (
    <BaseCanvasWithProvider
      {...props}
      canvasKind="settings"
      registry={registry}
      policy={policy}
    />
  );
};

export default SettingsCanvas;
