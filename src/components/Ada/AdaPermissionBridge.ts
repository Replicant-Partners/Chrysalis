/**
 * Ada Permission Bridge
 * 
 * Connects AdaIntegrationService to the Chrysalis permission system.
 * Translates Ada's AdaActionProposal into ChatMessage with PermissionRequest.
 * 
 * @module components/Ada/AdaPermissionBridge
 */

import { AdaIntegrationService, AdaActionProposal, AdaMessage } from './AdaIntegrationService';
import { ChatMessage, PermissionRequest } from '../ChrysalisWorkspace/types';

// =============================================================================
// Types
// =============================================================================

export interface AdaPermissionBridgeConfig {
  adaService: AdaIntegrationService;
  agentId: string;
  agentName: string;
  onPermissionMessage: (message: ChatMessage) => void;
}

// =============================================================================
// Permission Bridge
// =============================================================================

/**
 * Bridges Ada's action proposals to the permission system
 */
export class AdaPermissionBridge {
  private config: AdaPermissionBridgeConfig;
  private proposalToRequestMap: Map<string, string> = new Map();

  constructor(config: AdaPermissionBridgeConfig) {
    this.config = config;
    this.setupEventListeners();
  }

  // ===========================================================================
  // Event Listeners
  // ===========================================================================

  private setupEventListeners(): void {
    // Listen for Ada messages that contain action proposals
    this.config.adaService.on('message:received', (adaMessage: AdaMessage) => {
      if (adaMessage.proposal && adaMessage.proposal.requiresApproval) {
        this.createPermissionRequest(adaMessage);
      }
    });

    // Listen for approval state changes
    this.config.adaService.on('state:changed', ({ to, from }: any) => {
      console.log(`[AdaPermissionBridge] State transition: ${from} → ${to}`);
    });
  }

  // ===========================================================================
  // Permission Request Creation
  // ===========================================================================

  /**
   * Convert Ada's action proposal into a permission request message
   */
  private createPermissionRequest(adaMessage: AdaMessage): void {
    if (!adaMessage.proposal) return;

    const proposal = adaMessage.proposal;
    const requestId = `perm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Map proposal ID to request ID for later lookup
    this.proposalToRequestMap.set(requestId, proposal.id);

    // Assess risk based on action type
    const riskLevel = this.assessRiskLevel(proposal.type);

    // Create permission request
    const permissionRequest: PermissionRequest = {
      requestId,
      agentId: this.config.agentId,
      agentName: this.config.agentName,
      trust: 'ada',
      action: proposal.type,
      summary: proposal.description,
      scopePreview: proposal.payload ? JSON.stringify(proposal.payload).slice(0, 100) : undefined,
      riskLevel,
      status: 'pending',
    };

    // Create chat message with permission request
    const chatMessage: ChatMessage = {
      id: adaMessage.id,
      timestamp: adaMessage.timestamp,
      senderId: this.config.agentId,
      senderName: this.config.agentName,
      senderType: 'agent',
      content: adaMessage.content,
      permissionRequest,
    };

    // Emit to workspace
    this.config.onPermissionMessage(chatMessage);
  }

  /**
   * Assess risk level based on action type
   */
  private assessRiskLevel(actionType: AdaActionProposal['type']): 'low' | 'med' | 'high' {
    switch (actionType) {
      case 'navigate':
      case 'suggest':
        return 'low';
      case 'explain':
        return 'low';
      case 'assist':
        return 'med';
      case 'execute':
        return 'high';
      default:
        return 'med';
    }
  }

  // ===========================================================================
  // Permission Callbacks
  // ===========================================================================

  /**
   * Handle permission approval from UI
   */
  async handleApproval(requestId: string): Promise<void> {
    const proposalId = this.proposalToRequestMap.get(requestId);
    
    if (!proposalId) {
      console.error('[AdaPermissionBridge] No proposal found for request:', requestId);
      return;
    }

    try {
      await this.config.adaService.approveAction(proposalId);
      console.log('[AdaPermissionBridge] Action approved and executing:', proposalId);
      
      // Clean up mapping
      this.proposalToRequestMap.delete(requestId);
    } catch (error) {
      console.error('[AdaPermissionBridge] Error approving action:', error);
    }
  }

  /**
   * Handle permission denial from UI
   */
  handleDenial(requestId: string): void {
    const proposalId = this.proposalToRequestMap.get(requestId);
    
    if (!proposalId) {
      console.error('[AdaPermissionBridge] No proposal found for request:', requestId);
      return;
    }

    this.config.adaService.denyAction(proposalId);
    console.log('[AdaPermissionBridge] Action denied:', proposalId);
    
    // Clean up mapping
    this.proposalToRequestMap.delete(requestId);
  }

  /**
   * Generate risk explanation for a permission request
   */
  generateExplanation(requestId: string): string {
    const proposalId = this.proposalToRequestMap.get(requestId);
    
    if (!proposalId) {
      return 'Unable to find details for this permission request.';
    }

    // Find the original Ada message
    const messages = this.config.adaService.getMessages();
    const adaMessage = messages.find(m => m.proposal?.id === proposalId);

    if (!adaMessage?.proposal) {
      return 'Permission request details not available.';
    }

    const proposal = adaMessage.proposal;
    const riskLevel = this.assessRiskLevel(proposal.type);

    let explanation = `## Permission Request Details\n\n`;
    explanation += `**Action Type**: ${proposal.type}\n`;
    explanation += `**Description**: ${proposal.description}\n`;
    explanation += `**Risk Level**: ${riskLevel}\n`;
    explanation += `**Confidence**: ${Math.round(proposal.confidence * 100)}%\n\n`;

    // Add risk-specific guidance
    switch (riskLevel) {
      case 'low':
        explanation += `This is a **low-risk** action that won't modify your system or data.`;
        break;
      case 'med':
        explanation += `This is a **medium-risk** action that may modify files or consume resources.`;
        break;
      case 'high':
        explanation += `This is a **high-risk** action that will make system changes or execute commands.`;
        break;
    }

    if (proposal.payload) {
      explanation += `\n\n**Payload Preview**:\n\`\`\`json\n${JSON.stringify(proposal.payload, null, 2).slice(0, 200)}\n\`\`\``;
    }

    return explanation;
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  dispose(): void {
    this.proposalToRequestMap.clear();
    this.config.adaService.removeAllListeners('message:received');
    this.config.adaService.removeAllListeners('state:changed');
  }
}