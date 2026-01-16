/**
 * Ada Integration Service
 *
 * Connects the UI to the System Agent Middleware, implementing Ada's
 * state machine and providing a bridge between React components and
 * the system agent HTTP API.
 *
 * State Machine (from canvas-architecture.md):
 * idle → observing → assisting → awaiting_approval → executing → observing
 *                  ↓                                    ↓
 *             error_recovery                        cool_down
 *
 * @module components/Ada/AdaIntegrationService
 */

import { EventEmitter } from 'events';

// =============================================================================
// Types
// =============================================================================

/** Ada state machine states */
export type AdaState =
  | 'idle'
  | 'observing'
  | 'assisting'
  | 'awaiting_approval'
  | 'executing'
  | 'error_recovery'
  | 'cool_down';

/** Events that trigger state transitions */
export type AdaEvent =
  | 'user_present'
  | 'help_requested'
  | 'error_detected'
  | 'stall_detected'
  | 'action_proposed'
  | 'approval_granted'
  | 'approval_denied'
  | 'action_complete'
  | 'failure'
  | 'recovered'
  | 'over_notify'
  | 'cooldown_elapsed'
  | 'user_absent';

/** UI context that Ada observes */
export interface AdaUIContext {
  activeCanvas: string;
  selection: string[];
  viewport: { x: number; y: number; zoom: number };
  recentErrors: string[];
  focusedElement?: string;
  userIdleMs: number;
  lastUserAction?: string;
}

/** Action proposal from Ada */
export interface AdaActionProposal {
  id: string;
  type: 'navigate' | 'assist' | 'explain' | 'execute' | 'suggest';
  description: string;
  payload?: unknown;
  requiresApproval: boolean;
  confidence: number;
}

/** Message from Ada */
export interface AdaMessage {
  id: string;
  timestamp: number;
  content: string;
  type: 'greeting' | 'guidance' | 'question' | 'action_request' | 'error' | 'info';
  proposal?: AdaActionProposal;
  confidence?: number;
}

/** Configuration for Ada service */
export interface AdaServiceConfig {
  apiBaseUrl: string;
  agentId?: string;
  cooldownMs: number;
  maxNotificationsPerMinute: number;
  idleThresholdMs: number;
  enableAutoAssist: boolean;
  minConfidenceForAction: number;
}

/** System agent API response */
interface SystemAgentResponse {
  response: string;
  agentId: string;
  metadata?: {
    confidence?: number;
    tokens?: { prompt: number; completion: number };
  };
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: AdaServiceConfig = {
  apiBaseUrl: 'http://localhost:3001/api/system-agents',
  agentId: 'ada',
  cooldownMs: 5000,
  maxNotificationsPerMinute: 6,
  idleThresholdMs: 30000,
  enableAutoAssist: true,
  minConfidenceForAction: 0.7,
};

// =============================================================================
// State Machine Transitions
// =============================================================================

const STATE_TRANSITIONS: Record<AdaState, Partial<Record<AdaEvent, AdaState>>> = {
  idle: {
    user_present: 'observing',
  },
  observing: {
    help_requested: 'assisting',
    error_detected: 'assisting',
    stall_detected: 'assisting',
    over_notify: 'cool_down',
    user_absent: 'idle',
  },
  assisting: {
    action_proposed: 'awaiting_approval',
    failure: 'error_recovery',
  },
  awaiting_approval: {
    approval_granted: 'executing',
    approval_denied: 'cool_down',
  },
  executing: {
    action_complete: 'observing',
    failure: 'error_recovery',
  },
  error_recovery: {
    recovered: 'observing',
  },
  cool_down: {
    cooldown_elapsed: 'observing',
  },
};

// =============================================================================
// Ada Integration Service
// =============================================================================

export class AdaIntegrationService extends EventEmitter {
  private state: AdaState = 'idle';
  private config: AdaServiceConfig;
  private context: AdaUIContext;
  private notificationCount = 0;
  private notificationResetTimer?: NodeJS.Timeout;
  private cooldownTimer?: NodeJS.Timeout;
  private idleTimer?: NodeJS.Timeout;
  private messageHistory: AdaMessage[] = [];
  private pendingProposal?: AdaActionProposal;
  private conversationId?: string;

  constructor(config: Partial<AdaServiceConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.context = {
      activeCanvas: 'board',
      selection: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      recentErrors: [],
      userIdleMs: 0,
    };
    this.startNotificationCounter();
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /** Get current state */
  getState(): AdaState {
    return this.state;
  }

  /** Get current UI context */
  getContext(): AdaUIContext {
    return { ...this.context };
  }

  /** Get message history */
  getMessages(): AdaMessage[] {
    return [...this.messageHistory];
  }

  /** Update UI context */
  updateContext(updates: Partial<AdaUIContext>): void {
    this.context = { ...this.context, ...updates };
    this.emit('context:updated', this.context);

    // Check for signals that might trigger assistance
    if (this.state === 'observing' && this.config.enableAutoAssist) {
      this.evaluateAutoAssist();
    }
  }

  /** User is present (activates Ada) */
  activate(): void {
    this.transition('user_present');
    this.resetIdleTimer();
  }

  /** User is absent (deactivates Ada) */
  deactivate(): void {
    this.transition('user_absent');
    this.clearTimers();
  }

  /** User explicitly requests help */
  async requestHelp(query: string): Promise<AdaMessage> {
    this.transition('help_requested');
    return this.sendMessage(query, 'help_requested');
  }

  /** User sends a chat message to Ada */
  async chat(message: string): Promise<AdaMessage> {
    this.resetIdleTimer();
    return this.sendMessage(message, 'chat');
  }

  /** User approves a proposed action */
  async approveAction(proposalId: string): Promise<void> {
    if (this.pendingProposal?.id !== proposalId) {
      throw new Error('Invalid proposal ID');
    }
    this.transition('approval_granted');
    await this.executeAction(this.pendingProposal);
    this.pendingProposal = undefined;
  }

  /** User denies a proposed action */
  denyAction(proposalId: string): void {
    if (this.pendingProposal?.id === proposalId) {
      this.pendingProposal = undefined;
    }
    this.transition('approval_denied');
  }

  /** Record user activity to reset idle timer */
  recordActivity(): void {
    this.context.userIdleMs = 0;
    this.resetIdleTimer();
  }

  /** Report an error for Ada to assist with */
  reportError(error: string): void {
    this.context.recentErrors = [error, ...this.context.recentErrors.slice(0, 4)];
    if (this.state === 'observing') {
      this.transition('error_detected');
      this.sendMessage(`I noticed an error: "${error}". Would you like help troubleshooting?`, 'error_detected');
    }
  }

  /** Clean up resources */
  dispose(): void {
    this.clearTimers();
    this.removeAllListeners();
  }

  // ===========================================================================
  // State Machine
  // ===========================================================================

  private transition(event: AdaEvent): void {
    const transitions = STATE_TRANSITIONS[this.state];
    const nextState = transitions[event];

    if (nextState) {
      const prevState = this.state;
      this.state = nextState;
      this.emit('state:changed', { from: prevState, to: nextState, event });

      // Handle state entry actions
      this.onStateEnter(nextState, event);
    }
  }

  private onStateEnter(state: AdaState, event: AdaEvent): void {
    switch (state) {
      case 'cool_down':
        this.startCooldown();
        break;
      case 'assisting':
        // Generate assistance based on context
        if (event === 'stall_detected') {
          this.offerStallHelp();
        }
        break;
      case 'error_recovery':
        this.attemptRecovery();
        break;
    }
  }

  // ===========================================================================
  // API Communication
  // ===========================================================================

  private async sendMessage(content: string, trigger: string): Promise<AdaMessage> {
    // Check rate limit
    if (this.notificationCount >= this.config.maxNotificationsPerMinute) {
      this.transition('over_notify');
      throw new Error('Rate limit exceeded');
    }

    try {
      const response = await this.callSystemAgentAPI(content);

      const message: AdaMessage = {
        id: `ada-${Date.now()}`,
        timestamp: Date.now(),
        content: response.response,
        type: this.classifyMessageType(response.response, trigger),
        confidence: response.metadata?.confidence,
      };

      // Check if response contains an action proposal
      const proposal = this.extractProposal(response.response);
      if (proposal) {
        message.proposal = proposal;
        this.pendingProposal = proposal;
        this.transition('action_proposed');
      }

      this.messageHistory.push(message);
      this.notificationCount++;
      this.emit('message:received', message);

      // If we were in assisting state and no proposal, return to observing
      if (this.state === 'assisting' && !proposal) {
        this.state = 'observing';
      }

      return message;
    } catch (error) {
      this.transition('failure');
      throw error;
    }
  }

  private async callSystemAgentAPI(message: string): Promise<SystemAgentResponse> {
    const url = `${this.config.apiBaseUrl}/chat`;

    const body = {
      message,
      agentId: this.config.agentId,
      conversationId: this.conversationId,
      context: {
        uiContext: this.context,
        trigger: 'ada_ui',
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`System agent API error: ${response.status}`);
    }

    const data = await response.json();

    // Store conversation ID for continuity
    if (data.conversationId) {
      this.conversationId = data.conversationId;
    }

    return data;
  }

  // ===========================================================================
  // Auto-Assist Logic
  // ===========================================================================

  private evaluateAutoAssist(): void {
    // Check for stall (user idle for too long with errors)
    if (
      this.context.userIdleMs > this.config.idleThresholdMs &&
      this.context.recentErrors.length > 0
    ) {
      this.transition('stall_detected');
      return;
    }

    // Check for repeated errors
    if (this.context.recentErrors.length >= 3) {
      this.transition('error_detected');
    }
  }

  private async offerStallHelp(): Promise<void> {
    const contextSummary = this.summarizeContext();
    const message = `I noticed you've been working on the ${this.context.activeCanvas} canvas. ${contextSummary} Would you like some guidance?`;

    try {
      await this.sendMessage(message, 'stall_help');
    } catch (error) {
      // Ignore rate limit errors for auto-assist
      console.warn('Ada auto-assist rate limited:', error);
    }
  }

  private summarizeContext(): string {
    const parts: string[] = [];

    if (this.context.recentErrors.length > 0) {
      parts.push(`I see there were some errors recently.`);
    }

    if (this.context.selection.length > 0) {
      parts.push(`You have ${this.context.selection.length} items selected.`);
    }

    return parts.join(' ');
  }

  // ===========================================================================
  // Action Execution
  // ===========================================================================

  private async executeAction(proposal: AdaActionProposal): Promise<void> {
    this.emit('action:executing', proposal);

    try {
      // Execute based on action type
      switch (proposal.type) {
        case 'navigate':
          this.emit('navigate', proposal.payload);
          break;
        case 'explain':
          await this.sendMessage(`Let me explain: ${proposal.description}`, 'explanation');
          break;
        case 'execute':
          this.emit('execute', proposal.payload);
          break;
        case 'suggest':
          this.emit('suggestion', proposal.payload);
          break;
      }

      this.transition('action_complete');
      this.emit('action:complete', proposal);
    } catch (error) {
      this.transition('failure');
      this.emit('action:failed', { proposal, error });
      throw error;
    }
  }

  private extractProposal(response: string): AdaActionProposal | undefined {
    // Look for action markers in response
    // Format: [ACTION:type:description] or structured JSON
    const actionMatch = response.match(/\[ACTION:(\w+):([^\]]+)\]/);

    if (actionMatch) {
      return {
        id: `proposal-${Date.now()}`,
        type: actionMatch[1] as AdaActionProposal['type'],
        description: actionMatch[2],
        requiresApproval: true,
        confidence: 0.8,
      };
    }

    return undefined;
  }

  private classifyMessageType(
    content: string,
    trigger: string
  ): AdaMessage['type'] {
    if (trigger === 'error_detected') return 'error';
    if (content.includes('?')) return 'question';
    if (content.includes('[ACTION')) return 'action_request';
    if (trigger === 'help_requested') return 'guidance';
    if (this.messageHistory.length === 0) return 'greeting';
    return 'info';
  }

  // ===========================================================================
  // Recovery
  // ===========================================================================

  private async attemptRecovery(): Promise<void> {
    // Simple recovery: wait a bit and try to return to observing
    setTimeout(() => {
      this.transition('recovered');
      this.emit('recovery:complete');
    }, 2000);
  }

  // ===========================================================================
  // Timers
  // ===========================================================================

  private startNotificationCounter(): void {
    // Reset notification count every minute
    this.notificationResetTimer = setInterval(() => {
      this.notificationCount = 0;
    }, 60000);
  }

  private startCooldown(): void {
    this.clearCooldownTimer();
    this.cooldownTimer = setTimeout(() => {
      this.transition('cooldown_elapsed');
    }, this.config.cooldownMs);
  }

  private resetIdleTimer(): void {
    this.clearIdleTimer();
    this.idleTimer = setInterval(() => {
      this.context.userIdleMs += 1000;
      if (this.state === 'observing' && this.config.enableAutoAssist) {
        this.evaluateAutoAssist();
      }
    }, 1000);
  }

  private clearCooldownTimer(): void {
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
      this.cooldownTimer = undefined;
    }
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearInterval(this.idleTimer);
      this.idleTimer = undefined;
    }
  }

  private clearTimers(): void {
    this.clearCooldownTimer();
    this.clearIdleTimer();
    if (this.notificationResetTimer) {
      clearInterval(this.notificationResetTimer);
      this.notificationResetTimer = undefined;
    }
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let adaInstance: AdaIntegrationService | null = null;

export function getAdaService(config?: Partial<AdaServiceConfig>): AdaIntegrationService {
  if (!adaInstance) {
    adaInstance = new AdaIntegrationService(config);
  }
  return adaInstance;
}

export function resetAdaService(): void {
  if (adaInstance) {
    adaInstance.dispose();
    adaInstance = null;
  }
}
