/**
 * Knowledge Integrator - Integrate knowledge from instances
 * 
 * Verifies, consolidates, and integrates knowledge acquired
 * from deployed instances with confidence tracking.
 */

import type { SemanticAgent } from './core/SemanticAgent';
import { logger } from '../observability';
import * as crypto from 'crypto';

/**
 * Knowledge integration result
 */
export interface KnowledgeIntegrationResult {
  added: number;
  verified: number;
  rejected: number;
}

/**
 * Knowledge entry
 */
export interface KnowledgeEntry {
  knowledge_id: string;
  content: string;
  confidence: number;
  source_instance: string;
  acquired: string;
  verification_count: number;
  sources: string[];
}

/**
 * Input data for knowledge integration (relaxed typing for external data)
 */
export interface KnowledgeInput {
  content: string;
  confidence: number;
  source?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Knowledge Integrator
 */
export class KnowledgeIntegrator {
  private verificationThreshold = 0.7;
  
  /**
   * Add single knowledge item
   */
  async addKnowledge(
    agent: SemanticAgent,
    knowledgeData: KnowledgeInput,
    sourceInstance: string
  ): Promise<void> {
    // Initialize accumulated_knowledge if not exists
    if (!agent.knowledge.accumulated_knowledge) {
      agent.knowledge.accumulated_knowledge = [];
    }
    
    // Check confidence threshold
    if (knowledgeData.confidence < this.verificationThreshold) {
      logger.debug('Knowledge rejected: confidence too low', { 
        confidence: knowledgeData.confidence, 
        threshold: this.verificationThreshold,
        source: sourceInstance
      });
      return;
    }
    
    // Check for duplicate
    const duplicate = agent.knowledge.accumulated_knowledge.find(
      k => this.isSimilar(k.content, knowledgeData.content)
    );
    
    if (duplicate) {
      // Increase verification count
      duplicate.verification_count++;
      duplicate.confidence = Math.min(
        1.0,
        duplicate.confidence + 0.1
      );
      logger.debug('Knowledge verified', { 
        knowledge_id: duplicate.knowledge_id,
        content_preview: duplicate.content.substring(0, 50),
        verification_count: duplicate.verification_count,
        confidence: duplicate.confidence
      });
    } else {
      // Add new knowledge
      const knowledge: KnowledgeEntry = {
        knowledge_id: crypto.randomUUID(),
        content: knowledgeData.content,
        confidence: knowledgeData.confidence,
        source_instance: sourceInstance,
        acquired: new Date().toISOString(),
        verification_count: 1,
        sources: [sourceInstance]
      };
      
      agent.knowledge.accumulated_knowledge.push(knowledge);
      
      logger.debug('Knowledge added', { 
        knowledge_id: knowledge.knowledge_id,
        content_preview: knowledge.content.substring(0, 50),
        confidence: knowledge.confidence,
        source: sourceInstance
      });
    }
  }
  
  /**
   * Integrate knowledge batch
   */
  async integrate(
    agent: SemanticAgent,
    knowledgeItems: KnowledgeInput[],
    sourceInstance: string
  ): Promise<KnowledgeIntegrationResult> {
    const result: KnowledgeIntegrationResult = {
      added: 0,
      verified: 0,
      rejected: 0
    };
    
    for (const item of knowledgeItems) {
      if (item.confidence < this.verificationThreshold) {
        result.rejected++;
        continue;
      }
      
      const duplicate = agent.knowledge.accumulated_knowledge?.find(
        k => this.isSimilar(k.content, item.content)
      );
      
      if (duplicate) {
        duplicate.verification_count++;
        result.verified++;
      } else {
        await this.addKnowledge(agent, item, sourceInstance);
        result.added++;
      }
    }
    
    return result;
  }
  
  /**
   * Check if two knowledge items are similar
   */
  private isSimilar(_content1: string, _content2: string): boolean {
    throw new Error('NotImplementedError: isSimilar requires embedding similarity implementation');
  }
  
  /**
   * Verify knowledge with multiple sources
   */
  async verifyKnowledge(
    agent: SemanticAgent,
    knowledgeId: string,
    additionalSource: string
  ): Promise<void> {
    const knowledge = agent.knowledge.accumulated_knowledge?.find(
      k => k.knowledge_id === knowledgeId
    );
    
    if (knowledge) {
      knowledge.verification_count++;
      knowledge.confidence = Math.min(1.0, knowledge.confidence + 0.1);
      
      logger.debug('Knowledge verification increased', { 
        knowledge_id: knowledgeId,
        verification_count: knowledge.verification_count,
        confidence: knowledge.confidence,
        source: additionalSource
      });
    }
  }
}
