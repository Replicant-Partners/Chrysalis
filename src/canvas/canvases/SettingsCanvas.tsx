/**
 * Settings Canvas
 * System configuration management interface
 */

import React from 'react';

import { BaseCanvasWithProvider } from '../BaseCanvas';
import { createWidgetRegistry } from '../WidgetRegistry';
import { ConfigWidget } from '../widgets/ConfigWidget';
import { ConnectionWidget } from '../widgets/ConnectionWidget';

import type { BaseCanvasProps } from '../BaseCanvas';
import type { CanvasPolicy, WidgetDefinition } from '../types';
import type { ConfigWidgetData } from '../widgets/ConfigWidget';
import type { ConnectionWidgetData } from '../widgets/ConnectionWidget';

const SETTINGS_POLICY: CanvasPolicy = {
  maxNodes: 50,
  maxEdges: 100,
  rateLimit: { actions: 20, windowMs: 1000 },
  allowedWidgetTypes: ['config', 'connection', 'credential'],
};

const configWidgetDef: WidgetDefinition<ConfigWidgetData> = {
  type: 'config',
  displayName: 'Configuration Setting',
  renderer: ConfigWidget,
  capabilities: ['edit', 'read'],
  defaultData: {
    key: 'new.setting',
    value: 'default-value',
    description: 'Configuration setting description'
  },
  category: 'system',
  icon: '⚙️'
};

const connectionWidgetDef: WidgetDefinition<ConnectionWidgetData> = {
  type: 'connection',
  displayName: 'Service Connection',
  renderer: ConnectionWidget,
  capabilities: ['read', 'test'],
  defaultData: {
    service: 'New Service',
    status: 'disconnected',
    endpoint: 'https://example.com'
  },
  category: 'connectivity',
  icon: '🔌'
};

export interface SettingsCanvasProps extends Omit<BaseCanvasProps, 'canvasKind' | 'registry' | 'policy'> {
  customPolicy?: Partial<CanvasPolicy>;
}

export const SettingsCanvas: React.FC<SettingsCanvasProps> = ({ customPolicy, ...props }) => {
  const registry = React.useMemo(() => {
    const reg = createWidgetRegistry('settings', SETTINGS_POLICY.allowedWidgetTypes);
    reg.register(configWidgetDef);
    reg.register(connectionWidgetDef);
    return reg;
  }, []);

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
