/**
 * SecureCanvasManager - Manages encrypted canvases
 * 
 * Handles:
 * - Creating and encrypting secure canvases
 * - Decrypting and caching canvas state
 * - Access control and permissions
 * - Saving and loading encrypted canvas data
 * 
 * @module security/SecureCanvasManager
 */

import {
  generateKey,
  generateSalt,
  generateToken,
  encrypt,
  decrypt,
  encryptWithPassword,
  decryptWithPassword,
  hash,
  secureWipe,
  EncryptedData
} from './crypto';

import {
  SecureCanvas,
  SecureCanvasMetadata,
  EncryptedCanvasContent,
  DecryptedSecureCanvas,
  CanvasSecurityLevel,
  CanvasPermission,
  CanvasAccessEntry,
  SecureCanvasResult,
  CreateSecureCanvasOptions,
  OpenCanvas,
  AnyCanvas,
  isSecureCanvas,
  requiresEncryption,
  DEFAULT_PERMISSIONS,
  SECURE_WIDGET_DEFINITIONS
} from '../terminal/protocols/secure-canvas';

import { CanvasState, CanvasNode, CanvasEdge } from '../terminal/protocols/types';
import { ApiKeyWallet, getApiKeyWallet } from './ApiKeyWallet';

/**
 * Canvas unlock request
 */
interface UnlockRequest {
  canvasId: string;
  password?: string;
  masterKey?: Buffer;
}

/**
 * SecureCanvasManager - Manages encrypted canvases
 */
export class SecureCanvasManager {
  private canvases: Map<string, SecureCanvas | OpenCanvas> = new Map();
  private decryptedCache: Map<string, DecryptedSecureCanvas> = new Map();
  private canvasKeys: Map<string, Buffer> = new Map();
  private participantId: string;
  private wallet: ApiKeyWallet;
  
  constructor(participantId: string, wallet?: ApiKeyWallet) {
    this.participantId = participantId;
    this.wallet = wallet ?? getApiKeyWallet();
  }
  
  // ============================================================================
  // Canvas Creation
  // ============================================================================
  
  /**
   * Create a new canvas
   */
  async createCanvas(options: CreateSecureCanvasOptions): Promise<string> {
    const canvasId = generateToken(16);
    const now = Date.now();
    
    // Create initial canvas state
    const state: CanvasState = {
      id: canvasId,
      nodes: options.initialNodes ?? [],
      edges: options.initialEdges ?? [],
      viewport: { x: 0, y: 0, zoom: 1 },
      selectedNodes: [],
      selectedEdges: [],
      metadata: {}
    };
    
    if (options.securityLevel === 'open') {
      // Create open canvas
      const openCanvas: OpenCanvas = {
        type: 'open',
        state,
        metadata: {
          id: canvasId,
          name: options.name,
          createdAt: now,
          updatedAt: now,
          createdBy: this.participantId
        }
      };
      
      this.canvases.set(canvasId, openCanvas);
    } else {
      // Create encrypted canvas
      const secureCanvas = await this.createSecureCanvas(
        canvasId,
        options.name,
        options.securityLevel,
        state,
        options.description,
        options.tags
      );
      
      this.canvases.set(canvasId, secureCanvas);
    }
    
    return canvasId;
  }
  
  /**
   * Create a secure (encrypted) canvas
   */
  private async createSecureCanvas(
    canvasId: string,
    name: string,
    securityLevel: CanvasSecurityLevel,
    state: CanvasState,
    description?: string,
    tags?: string[]
  ): Promise<SecureCanvas> {
    const now = Date.now();
    
    // Generate encryption key for this canvas
    const canvasKey = generateKey();
    const salt = generateSalt();
    
    // Store key temporarily
    this.canvasKeys.set(canvasId, canvasKey);
    
    // Encrypt the canvas state
    const stateJson = JSON.stringify(state);
    const encryptedState = encrypt(stateJson, canvasKey);
    
    // Create content hash for integrity
    const contentHash = hash(stateJson);
    
    // Create metadata
    const metadata: SecureCanvasMetadata = {
      id: canvasId,
      name,
      securityLevel,
      createdAt: now,
      updatedAt: now,
      createdBy: this.participantId,
      accessList: [
        {
          participantId: this.participantId,
          permissions: ['view', 'read', 'write', 'delete', 'admin'],
          grantedAt: now,
          grantedBy: this.participantId
        }
      ],
      encryptionAlgorithm: 'aes-256-gcm',
      encryptionVersion: 1,
      widgetCount: state.nodes.filter(n => n.type === 'widget').length,
      description,
      tags
    };
    
    // Create encrypted content
    const content: EncryptedCanvasContent = {
      encryptedState,
      contentHash,
      salt: salt.toString('base64'),
      nodeCount: state.nodes.length,
      edgeCount: state.edges.length
    };
    
    // Cache decrypted state
    this.decryptedCache.set(canvasId, {
      metadata,
      state,
      isModified: false
    });
    
    return { metadata, content };
  }
  
  // ============================================================================
  // Canvas Access
  // ============================================================================
  
  /**
   * Get a canvas (requires unlock for secure canvases)
   */
  async getCanvas(canvasId: string): Promise<SecureCanvasResult<CanvasState>> {
    const canvas = this.canvases.get(canvasId);
    
    if (!canvas) {
      return { success: false, error: 'Canvas not found' };
    }
    
    if (!isSecureCanvas(canvas)) {
      // Open canvas - return directly
      return { success: true, data: canvas.state };
    }
    
    // Secure canvas - check if decrypted
    const cached = this.decryptedCache.get(canvasId);
    if (cached) {
      return { success: true, data: cached.state };
    }
    
    // Need to unlock
    return { 
      success: false, 
      error: 'Canvas is locked', 
      requiresAuth: true 
    };
  }
  
  /**
   * Unlock a secure canvas
   */
  async unlock(request: UnlockRequest): Promise<SecureCanvasResult<CanvasState>> {
    const canvas = this.canvases.get(request.canvasId);
    
    if (!canvas) {
      return { success: false, error: 'Canvas not found' };
    }
    
    if (!isSecureCanvas(canvas)) {
      return { success: true, data: (canvas as OpenCanvas).state };
    }
    
    // Check access
    if (!this.hasPermission(canvas, this.participantId, 'read')) {
      return { success: false, error: 'Access denied' };
    }
    
    // Get the encryption key
    let canvasKey = this.canvasKeys.get(request.canvasId);
    
    if (!canvasKey) {
      if (request.masterKey) {
        canvasKey = request.masterKey;
      } else if (request.password) {
        // Derive key from password
        const salt = Buffer.from(canvas.content.salt, 'base64');
        const { deriveKeyFromPassword } = await import('./crypto');
        canvasKey = await deriveKeyFromPassword(request.password, salt);
      } else {
        return { success: false, error: 'No key provided', requiresAuth: true };
      }
      
      this.canvasKeys.set(request.canvasId, canvasKey);
    }
    
    try {
      // Decrypt the state
      const decrypted = decrypt(canvas.content.encryptedState, canvasKey);
      const stateJson = decrypted.toString('utf-8');
      
      // Verify integrity
      if (hash(stateJson) !== canvas.content.contentHash) {
        return { success: false, error: 'Content integrity check failed' };
      }
      
      const state = JSON.parse(stateJson) as CanvasState;
      
      // Cache decrypted state
      this.decryptedCache.set(request.canvasId, {
        metadata: canvas.metadata,
        state,
        isModified: false
      });
      
      // Update last accessed
      canvas.metadata.lastAccessedAt = Date.now();
      
      return { success: true, data: state };
    } catch (error) {
      return { 
        success: false, 
        error: `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }
  
  /**
   * Lock a canvas (clear decrypted cache)
   */
  lock(canvasId: string): void {
    this.decryptedCache.delete(canvasId);
    
    const key = this.canvasKeys.get(canvasId);
    if (key) {
      secureWipe(key);
      this.canvasKeys.delete(canvasId);
    }
  }
  
  /**
   * Lock all canvases
   */
  lockAll(): void {
    for (const canvasId of this.canvases.keys()) {
      this.lock(canvasId);
    }
  }
  
  // ============================================================================
  // Canvas Modification
  // ============================================================================
  
  /**
   * Update canvas state
   */
  async updateCanvas(
    canvasId: string,
    updater: (state: CanvasState) => CanvasState
  ): Promise<SecureCanvasResult<void>> {
    const canvas = this.canvases.get(canvasId);
    
    if (!canvas) {
      return { success: false, error: 'Canvas not found' };
    }
    
    if (isSecureCanvas(canvas)) {
      // Check permission
      if (!this.hasPermission(canvas, this.participantId, 'write')) {
        return { success: false, error: 'Write permission denied' };
      }
      
      // Get decrypted state
      const cached = this.decryptedCache.get(canvasId);
      if (!cached) {
        return { success: false, error: 'Canvas is locked', requiresAuth: true };
      }
      
      // Apply update
      cached.state = updater(cached.state);
      cached.isModified = true;
      
      // Re-encrypt
      await this.saveSecureCanvas(canvasId);
    } else {
      // Open canvas
      const openCanvas = canvas as OpenCanvas;
      openCanvas.state = updater(openCanvas.state);
      openCanvas.metadata.updatedAt = Date.now();
    }
    
    return { success: true };
  }
  
  /**
   * Add a node to canvas
   */
  async addNode(canvasId: string, node: CanvasNode): Promise<SecureCanvasResult<void>> {
    return this.updateCanvas(canvasId, (state) => ({
      ...state,
      nodes: [...state.nodes, node]
    }));
  }
  
  /**
   * Remove a node from canvas
   */
  async removeNode(canvasId: string, nodeId: string): Promise<SecureCanvasResult<void>> {
    const canvas = this.canvases.get(canvasId);
    
    if (isSecureCanvas(canvas!)) {
      if (!this.hasPermission(canvas!, this.participantId, 'delete')) {
        return { success: false, error: 'Delete permission denied' };
      }
    }
    
    return this.updateCanvas(canvasId, (state) => ({
      ...state,
      nodes: state.nodes.filter(n => n.id !== nodeId),
      edges: state.edges.filter(e => e.fromNode !== nodeId && e.toNode !== nodeId)
    }));
  }
  
  /**
   * Save a secure canvas (re-encrypt)
   */
  private async saveSecureCanvas(canvasId: string): Promise<void> {
    const canvas = this.canvases.get(canvasId);
    if (!canvas || !isSecureCanvas(canvas)) return;
    
    const cached = this.decryptedCache.get(canvasId);
    if (!cached) return;
    
    const canvasKey = this.canvasKeys.get(canvasId);
    if (!canvasKey) return;
    
    // Re-encrypt state
    const stateJson = JSON.stringify(cached.state);
    const encryptedState = encrypt(stateJson, canvasKey);
    const contentHash = hash(stateJson);
    
    // Update canvas
    canvas.content.encryptedState = encryptedState;
    canvas.content.contentHash = contentHash;
    canvas.content.nodeCount = cached.state.nodes.length;
    canvas.content.edgeCount = cached.state.edges.length;
    
    canvas.metadata.updatedAt = Date.now();
    canvas.metadata.widgetCount = cached.state.nodes.filter(n => n.type === 'widget').length;
    
    cached.isModified = false;
  }
  
  // ============================================================================
  // Access Control
  // ============================================================================
  
  /**
   * Check if participant has permission
   */
  hasPermission(
    canvas: SecureCanvas,
    participantId: string,
    permission: CanvasPermission
  ): boolean {
    const entry = canvas.metadata.accessList.find(
      e => e.participantId === participantId
    );
    
    if (!entry) {
      return false;
    }
    
    // Check expiry
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      return false;
    }
    
    // Admin has all permissions
    if (entry.permissions.includes('admin')) {
      return true;
    }
    
    return entry.permissions.includes(permission);
  }
  
  /**
   * Grant access to a canvas
   */
  grantAccess(
    canvasId: string,
    targetParticipantId: string,
    permissions: CanvasPermission[],
    expiresAt?: number
  ): SecureCanvasResult<void> {
    const canvas = this.canvases.get(canvasId);
    
    if (!canvas || !isSecureCanvas(canvas)) {
      return { success: false, error: 'Canvas not found or not secure' };
    }
    
    // Check if requester has admin permission
    if (!this.hasPermission(canvas, this.participantId, 'admin')) {
      return { success: false, error: 'Admin permission required' };
    }
    
    // Add or update access entry
    const existing = canvas.metadata.accessList.find(
      e => e.participantId === targetParticipantId
    );
    
    if (existing) {
      existing.permissions = permissions;
      existing.expiresAt = expiresAt;
    } else {
      canvas.metadata.accessList.push({
        participantId: targetParticipantId,
        permissions,
        grantedAt: Date.now(),
        grantedBy: this.participantId,
        expiresAt
      });
    }
    
    canvas.metadata.updatedAt = Date.now();
    
    return { success: true };
  }
  
  /**
   * Revoke access from a canvas
   */
  revokeAccess(
    canvasId: string,
    targetParticipantId: string
  ): SecureCanvasResult<void> {
    const canvas = this.canvases.get(canvasId);
    
    if (!canvas || !isSecureCanvas(canvas)) {
      return { success: false, error: 'Canvas not found or not secure' };
    }
    
    // Check if requester has admin permission
    if (!this.hasPermission(canvas, this.participantId, 'admin')) {
      return { success: false, error: 'Admin permission required' };
    }
    
    // Cannot revoke own access if only admin
    const admins = canvas.metadata.accessList.filter(
      e => e.permissions.includes('admin')
    );
    if (admins.length === 1 && admins[0].participantId === targetParticipantId) {
      return { success: false, error: 'Cannot revoke last admin access' };
    }
    
    canvas.metadata.accessList = canvas.metadata.accessList.filter(
      e => e.participantId !== targetParticipantId
    );
    
    canvas.metadata.updatedAt = Date.now();
    
    return { success: true };
  }
  
  // ============================================================================
  // Canvas Listing
  // ============================================================================
  
  /**
   * List all canvas metadata
   */
  listCanvases(): Array<{
    id: string;
    name: string;
    type: 'open' | 'secure';
    securityLevel?: CanvasSecurityLevel;
    isLocked: boolean;
    nodeCount: number;
  }> {
    const results: Array<{
      id: string;
      name: string;
      type: 'open' | 'secure';
      securityLevel?: CanvasSecurityLevel;
      isLocked: boolean;
      nodeCount: number;
    }> = [];
    
    for (const [id, canvas] of this.canvases) {
      if (isSecureCanvas(canvas)) {
        results.push({
          id,
          name: canvas.metadata.name,
          type: 'secure',
          securityLevel: canvas.metadata.securityLevel,
          isLocked: !this.decryptedCache.has(id),
          nodeCount: canvas.content.nodeCount
        });
      } else {
        results.push({
          id,
          name: canvas.metadata.name,
          type: 'open',
          isLocked: false,
          nodeCount: canvas.state.nodes.length
        });
      }
    }
    
    return results;
  }
  
  /**
   * Get canvas metadata
   */
  getMetadata(canvasId: string): SecureCanvasMetadata | { id: string; name: string } | null {
    const canvas = this.canvases.get(canvasId);
    if (!canvas) return null;
    
    return isSecureCanvas(canvas) ? canvas.metadata : canvas.metadata;
  }
  
  // ============================================================================
  // Import/Export
  // ============================================================================
  
  /**
   * Export canvas to encrypted format
   */
  exportCanvas(canvasId: string): string | null {
    const canvas = this.canvases.get(canvasId);
    if (!canvas) return null;
    
    return JSON.stringify(canvas, null, 2);
  }
  
  /**
   * Import canvas from exported format
   */
  importCanvas(data: string): SecureCanvasResult<string> {
    try {
      const canvas = JSON.parse(data) as AnyCanvas;
      
      // Generate new ID to avoid conflicts
      const newId = generateToken(16);
      
      if (isSecureCanvas(canvas)) {
        canvas.metadata.id = newId;
        this.canvases.set(newId, canvas);
      } else {
        canvas.metadata.id = newId;
        canvas.state.id = newId;
        this.canvases.set(newId, canvas);
      }
      
      return { success: true, data: newId };
    } catch (error) {
      return { 
        success: false, 
        error: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }
  
  // ============================================================================
  // Cleanup
  // ============================================================================
  
  /**
   * Delete a canvas
   */
  deleteCanvas(canvasId: string): SecureCanvasResult<void> {
    const canvas = this.canvases.get(canvasId);
    
    if (!canvas) {
      return { success: false, error: 'Canvas not found' };
    }
    
    if (isSecureCanvas(canvas)) {
      if (!this.hasPermission(canvas, this.participantId, 'admin')) {
        return { success: false, error: 'Admin permission required' };
      }
    }
    
    // Clean up
    this.lock(canvasId);
    this.canvases.delete(canvasId);
    
    return { success: true };
  }
  
  /**
   * Destroy manager and clear all data
   */
  destroy(): void {
    this.lockAll();
    this.canvases.clear();
    this.decryptedCache.clear();
  }
}

/**
 * Create a secure canvas manager
 */
export function createSecureCanvasManager(
  participantId: string,
  wallet?: ApiKeyWallet
): SecureCanvasManager {
  return new SecureCanvasManager(participantId, wallet);
}