/**
 * Feedback API Handler
 * 
 * Handles user feedback submissions (bug reports, feature requests, general feedback).
 * Stores feedback and optionally sends notifications.
 * 
 * @module api/feedback/feedback-handler
 */

import { logger } from '../../observability';

// =============================================================================
// Types
// =============================================================================

export type FeedbackType = 'bug' | 'feature' | 'feedback';

export interface FeedbackSubmission {
  type: FeedbackType;
  title: string;
  description: string;
  email?: string;
  screenshot?: string;
  metadata: {
    url: string;
    userAgent: string;
    timestamp: string;
    version: string;
  };
}

export interface FeedbackRecord extends FeedbackSubmission {
  id: string;
  createdAt: Date;
  status: 'new' | 'reviewed' | 'resolved' | 'closed';
  tags: string[];
}

export interface FeedbackHandlerOptions {
  /**
   * Storage backend for feedback
   * Default: in-memory (for development)
   */
  storage?: FeedbackStorage;
  
  /**
   * Email notification settings
   */
  emailNotifications?: {
    enabled: boolean;
    recipients: string[];
    smtpConfig?: {
      host: string;
      port: number;
      user: string;
      pass: string;
    };
  };
  
  /**
   * Webhook URL to notify on new feedback
   */
  webhookUrl?: string;
}

export interface FeedbackStorage {
  save(feedback: FeedbackRecord): Promise<void>;
  getById(id: string): Promise<FeedbackRecord | null>;
  getAll(filters?: FeedbackFilters): Promise<FeedbackRecord[]>;
  update(id: string, updates: Partial<FeedbackRecord>): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface FeedbackFilters {
  type?: FeedbackType;
  status?: FeedbackRecord['status'];
  since?: Date;
  until?: Date;
}

// =============================================================================
// In-Memory Storage (Development)
// =============================================================================

class InMemoryFeedbackStorage implements FeedbackStorage {
  private feedback: Map<string, FeedbackRecord> = new Map();

  async save(feedback: FeedbackRecord): Promise<void> {
    this.feedback.set(feedback.id, feedback);
    logger.info('Feedback saved to in-memory storage', { id: feedback.id });
  }

  async getById(id: string): Promise<FeedbackRecord | null> {
    return this.feedback.get(id) || null;
  }

  async getAll(filters?: FeedbackFilters): Promise<FeedbackRecord[]> {
    let results = Array.from(this.feedback.values());

    if (filters?.type) {
      results = results.filter(f => f.type === filters.type);
    }
    if (filters?.status) {
      results = results.filter(f => f.status === filters.status);
    }
    if (filters?.since) {
      results = results.filter(f => f.createdAt >= filters.since!);
    }
    if (filters?.until) {
      results = results.filter(f => f.createdAt <= filters.until!);
    }

    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async update(id: string, updates: Partial<FeedbackRecord>): Promise<void> {
    const feedback = this.feedback.get(id);
    if (feedback) {
      Object.assign(feedback, updates);
      this.feedback.set(id, feedback);
    }
  }

  async delete(id: string): Promise<void> {
    this.feedback.delete(id);
  }
}

// =============================================================================
// Feedback Handler
// =============================================================================

export class FeedbackHandler {
  private storage: FeedbackStorage;
  private options: FeedbackHandlerOptions;

  constructor(options: FeedbackHandlerOptions = {}) {
    this.options = options;
    this.storage = options.storage || new InMemoryFeedbackStorage();
  }

  /**
   * Submit new feedback
   */
  async submitFeedback(submission: FeedbackSubmission): Promise<{ id: string; success: boolean }> {
    // Validate submission
    if (!submission.title?.trim()) {
      throw new Error('Feedback title is required');
    }
    if (!submission.description?.trim()) {
      throw new Error('Feedback description is required');
    }

    // Create feedback record
    const record: FeedbackRecord = {
      ...submission,
      id: `feedback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      status: 'new',
      tags: this.generateTags(submission)
    };

    // Save to storage
    await this.storage.save(record);

    logger.info('Feedback submitted', {
      id: record.id,
      type: record.type,
      hasEmail: !!record.email
    });

    // Send notifications (async, don't block response)
    this.sendNotifications(record).catch(err => {
      logger.error('Failed to send feedback notifications', err);
    });

    return {
      id: record.id,
      success: true
    };
  }

  /**
   * Get feedback by ID
   */
  async getFeedback(id: string): Promise<FeedbackRecord | null> {
    return this.storage.getById(id);
  }

  /**
   * List all feedback with optional filters
   */
  async listFeedback(filters?: FeedbackFilters): Promise<FeedbackRecord[]> {
    return this.storage.getAll(filters);
  }

  /**
   * Update feedback status
   */
  async updateFeedbackStatus(id: string, status: FeedbackRecord['status']): Promise<void> {
    await this.storage.update(id, { status });
    logger.info('Feedback status updated', { id, status });
  }

  /**
   * Generate automatic tags from feedback content
   */
  private generateTags(submission: FeedbackSubmission): string[] {
    const tags: string[] = [];

    // Type-based tags
    tags.push(submission.type);

    // Priority detection
    const urgentKeywords = ['crash', 'broken', 'critical', 'urgent', 'blocker'];
    const content = `${submission.title} ${submission.description}`.toLowerCase();
    
    if (urgentKeywords.some(keyword => content.includes(keyword))) {
      tags.push('priority:high');
    }

    // Component detection
    if (content.includes('ui') || content.includes('interface')) {
      tags.push('component:ui');
    }
    if (content.includes('api') || content.includes('backend')) {
      tags.push('component:backend');
    }
    if (content.includes('terminal')) {
      tags.push('component:terminal');
    }

    return tags;
  }

  /**
   * Send notifications about new feedback
   */
  private async sendNotifications(feedback: FeedbackRecord): Promise<void> {
    const notifications: Promise<void>[] = [];

    // Email notification
    if (this.options.emailNotifications?.enabled) {
      notifications.push(this.sendEmailNotification(feedback));
    }

    // Webhook notification
    if (this.options.webhookUrl) {
      notifications.push(this.sendWebhookNotification(feedback));
    }

    await Promise.allSettled(notifications);
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(_feedback: FeedbackRecord): Promise<void> {
    throw new Error('NotImplementedError: Email sending via SMTP or service is not implemented');
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(feedback: FeedbackRecord): Promise<void> {
    try {
      const response = await fetch(this.options.webhookUrl!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          event: 'feedback.created',
          feedback: {
            id: feedback.id,
            type: feedback.type,
            title: feedback.title,
            description: feedback.description,
            email: feedback.email,
            tags: feedback.tags,
            createdAt: feedback.createdAt.toISOString()
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}`);
      }

      logger.info('Webhook notification sent', { id: feedback.id });
    } catch (error) {
      logger.error('Webhook notification failed', error as Error);
      throw error;
    }
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let handlerInstance: FeedbackHandler | null = null;

/**
 * Get or create feedback handler instance
 */
export function getFeedbackHandler(options?: FeedbackHandlerOptions): FeedbackHandler {
  if (!handlerInstance) {
    handlerInstance = new FeedbackHandler(options);
  }
  return handlerInstance;
}

/**
 * Express/HTTP handler for feedback API
 */
export function createFeedbackApiHandler(options?: FeedbackHandlerOptions) {
  const handler = getFeedbackHandler(options);

  return {
    /**
     * POST /api/feedback - Submit new feedback
     */
    async submitFeedback(req: any, res: any): Promise<void> {
      try {
        const submission: FeedbackSubmission = req.body;
        const result = await handler.submitFeedback(submission);
        
        res.status(201).json(result);
      } catch (error) {
        logger.error('Feedback submission failed', error as Error);
        res.status(400).json({
          error: (error as Error).message || 'Failed to submit feedback'
        });
      }
    },

    /**
     * GET /api/feedback - List all feedback
     */
    async listFeedback(req: any, res: any): Promise<void> {
      try {
        const filters: FeedbackFilters = {};
        
        if (req.query.type) filters.type = req.query.type;
        if (req.query.status) filters.status = req.query.status;
        if (req.query.since) filters.since = new Date(req.query.since);
        if (req.query.until) filters.until = new Date(req.query.until);

        const feedback = await handler.listFeedback(filters);
        res.json({ feedback, count: feedback.length });
      } catch (error) {
        logger.error('Failed to list feedback', error as Error);
        res.status(500).json({
          error: 'Failed to retrieve feedback'
        });
      }
    },

    /**
     * GET /api/feedback/:id - Get specific feedback
     */
    async getFeedback(req: any, res: any): Promise<void> {
      try {
        const feedback = await handler.getFeedback(req.params.id);
        
        if (!feedback) {
          res.status(404).json({ error: 'Feedback not found' });
          return;
        }

        res.json(feedback);
      } catch (error) {
        logger.error('Failed to get feedback', error as Error);
        res.status(500).json({
          error: 'Failed to retrieve feedback'
        });
      }
    },

    /**
     * PATCH /api/feedback/:id - Update feedback status
     */
    async updateFeedbackStatus(req: any, res: any): Promise<void> {
      try {
        const { status } = req.body;
        await handler.updateFeedbackStatus(req.params.id, status);
        res.json({ success: true });
      } catch (error) {
        logger.error('Failed to update feedback', error as Error);
        res.status(500).json({
          error: 'Failed to update feedback'
        });
      }
    }
  };
}