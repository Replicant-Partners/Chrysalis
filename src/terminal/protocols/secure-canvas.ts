/**
 * SecureCanvas Protocol
 * 
 * Defines the protocol for hardened/encrypted canvases that store
 * sensitive data like API keys and settings.
 * 
 * Two canvas types:
 * - Open Canvas: Standard JSON Canvas, visible to all participants
 * - Secure Canvas: Encrypted content, requires authentication
 * 
 * @module terminal/protocols/secure-canvas
 */

import { CanvasState, CanvasNode, CanvasEdge, WidgetNode } from './types';
import { EncryptedData } from '../../security/crypto';

/**
 * Canvas security level
 */
export type CanvasSecurityLevel = 
  | 'open'      // No encryption, visible to all
  | 'private'   // Encrypted, single-user access
  | 'shared'    // Encrypted, multi-user with key sharing
  | 'hardened'; // Encrypted with additional protections

/**
 * Access control entry
 */
export interface CanvasAccessEntry {
  participantId: string;
  permissions: CanvasPermission[];
  grantedAt: number;
  grantedBy: string;
  expiresAt?: number;
}

/**
 * Canvas permissions
 */
export type CanvasPermission =
  | 'view'      // Can see canvas exists
  | 'read'      // Can decrypt and read content
  | 'write'     // Can add/modify nodes
  | 'delete'    // Can delete nodes
  | 'admin';    // Can manage access

/**
 * Secure canvas metadata
 */
export interface SecureCanvasMetadata {
  id: string;
  name: string;
  securityLevel: CanvasSecurityLevel;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  
  // Access control
  accessList: CanvasAccessEntry[];
  
  // Encryption info (not the key itself)
  encryptionAlgorithm: string;
  encryptionVersion: number;
  
  // For UI display (safe to show)
  widgetCount: number;
  lastAccessedAt?: number;
  description?: string;
  tags?: string[];
}

/**
 * Encrypted canvas content
 */
export interface EncryptedCanvasContent {
  // Encrypted JSON of CanvasState
  encryptedState: EncryptedData;
  
  // Integrity check
  contentHash: string;
  
  // For key derivation
  salt: string;
  
  // Metadata about content (not encrypted)
  nodeCount: number;
  edgeCount: number;
}

/**
 * Full secure canvas (stored format)
 */
export interface SecureCanvas {
  metadata: SecureCanvasMetadata;
  content: EncryptedCanvasContent;
}

/**
 * Decrypted secure canvas (in-memory format)
 */
export interface DecryptedSecureCanvas {
  metadata: SecureCanvasMetadata;
  state: CanvasState;
  isModified: boolean;
}

/**
 * Secure widget base - widgets in secure canvas
 */
export interface SecureWidgetNode extends WidgetNode {
  // Additional security flags
  encryptProps?: boolean;  // Encrypt props separately
  sensitiveFields?: string[]; // Which props are sensitive
}

/**
 * API Key Wallet widget type
 */
export interface ApiKeyWalletWidget extends SecureWidgetNode {
  widgetType: 'api-key-wallet';
  props: {
    // No actual keys stored here, just display info
    providers: Array<{
      provider: string;
      keyCount: number;
      hasDefault: boolean;
    }>;
    isLocked: boolean;
    lastActivity?: number;
  };
}

/**
 * Settings widget type for secure canvas
 */
export interface SettingsWidget extends SecureWidgetNode {
  widgetType: 'settings';
  props: {
    sections: Array<{
      id: string;
      title: string;
      icon?: string;
    }>;
    activeSection: string;
  };
}

/**
 * Provider config widget (inside settings)
 */
export interface ProviderConfigWidget extends SecureWidgetNode {
  widgetType: 'provider-config';
  props: {
    provider: string;
    hasKey: boolean;
    keyPrefix?: string;
    isDefault: boolean;
    model?: string;
    baseUrl?: string;
    // These are stored encrypted in ApiKeyWallet, not here
  };
}

/**
 * Secure canvas events
 */
export type SecureCanvasEventType =
  | 'canvas:locked'
  | 'canvas:unlocked'
  | 'canvas:access:granted'
  | 'canvas:access:revoked'
  | 'canvas:encryption:started'
  | 'canvas:encryption:completed'
  | 'canvas:decryption:started'
  | 'canvas:decryption:completed'
  | 'canvas:integrity:verified'
  | 'canvas:integrity:failed';

/**
 * Secure canvas operation result
 */
export interface SecureCanvasResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  requiresAuth?: boolean;
}

/**
 * Canvas factory options
 */
export interface CreateSecureCanvasOptions {
  name: string;
  securityLevel: CanvasSecurityLevel;
  description?: string;
  tags?: string[];
  initialNodes?: CanvasNode[];
  initialEdges?: CanvasEdge[];
}

/**
 * Open (non-secure) canvas marker type
 */
export interface OpenCanvas {
  type: 'open';
  state: CanvasState;
  metadata: {
    id: string;
    name: string;
    createdAt: number;
    updatedAt: number;
    createdBy: string;
  };
}

/**
 * Union type for all canvas types
 */
export type AnyCanvas = OpenCanvas | SecureCanvas;

/**
 * Type guard for secure canvas
 */
export function isSecureCanvas(canvas: AnyCanvas): canvas is SecureCanvas {
  return 'content' in canvas && 'encryptedState' in (canvas as SecureCanvas).content;
}

/**
 * Type guard for open canvas
 */
export function isOpenCanvas(canvas: AnyCanvas): canvas is OpenCanvas {
  return (canvas as OpenCanvas).type === 'open';
}

/**
 * Check if a security level requires encryption
 */
export function requiresEncryption(level: CanvasSecurityLevel): boolean {
  return level !== 'open';
}

/**
 * Default permissions for different security levels
 */
export const DEFAULT_PERMISSIONS: Record<CanvasSecurityLevel, CanvasPermission[]> = {
  open: ['view', 'read', 'write', 'delete'],
  private: ['view', 'read', 'write', 'delete', 'admin'],
  shared: ['view', 'read'],
  hardened: ['view']
};

/**
 * Secure widget definitions for registration
 */
export const SECURE_WIDGET_DEFINITIONS = {
  'api-key-wallet': {
    type: 'api-key-wallet',
    name: 'API Key Wallet',
    description: 'Secure storage for API keys',
    version: '1.0.0',
    category: 'security',
    defaultWidth: 400,
    defaultHeight: 300,
    props: {
      providers: { type: 'array', required: true },
      isLocked: { type: 'boolean', required: true, default: true },
      lastActivity: { type: 'number', required: false }
    },
    securityLevel: 'hardened' as CanvasSecurityLevel
  },
  'settings': {
    type: 'settings',
    name: 'Settings',
    description: 'Terminal settings and configuration',
    version: '1.0.0',
    category: 'security',
    defaultWidth: 600,
    defaultHeight: 500,
    props: {
      sections: { type: 'array', required: true },
      activeSection: { type: 'string', required: true, default: 'general' }
    },
    securityLevel: 'private' as CanvasSecurityLevel
  },
  'provider-config': {
    type: 'provider-config',
    name: 'Provider Configuration',
    description: 'LLM provider settings',
    version: '1.0.0',
    category: 'security',
    defaultWidth: 350,
    defaultHeight: 250,
    props: {
      provider: { type: 'string', required: true },
      hasKey: { type: 'boolean', required: true },
      isDefault: { type: 'boolean', required: false, default: false },
      model: { type: 'string', required: false },
      baseUrl: { type: 'string', required: false }
    },
    securityLevel: 'private' as CanvasSecurityLevel
  }
};