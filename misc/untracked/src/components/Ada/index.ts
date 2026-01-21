/**
 * Ada System Agent Integration
 * 
 * Components and services for integrating Ada (the system agent)
 * into the Chrysalis workspace.
 * 
 * @module components/Ada
 */

export { AdaIntegrationService, getAdaService, resetAdaService } from './AdaIntegrationService';
export { AdaPermissionBridge } from './AdaPermissionBridge';

export type {
  AdaState,
  AdaEvent,
  AdaUIContext,
  AdaActionProposal,
  AdaMessage,
  AdaServiceConfig,
} from './AdaIntegrationService';

export type {
  AdaPermissionBridgeConfig,
} from './AdaPermissionBridge';