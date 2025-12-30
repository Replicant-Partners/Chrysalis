/**
 * Knowledge Integrator - Integrate knowledge from instances
 * 
 * Verifies, consolidates, and integrates knowledge acquired
 * from deployed instances with confidence tracking.
 */

import type { UniformSemanticAgentV2 } from '../core/UniformSemanticAgentV2';
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
 * Knowledge Integrator
 */
export class KnowledgeIntegrator {
  private verificationThreshold = 0.7;
  
  /**
   * Add single knowledge item
   */
  async addKnowledge(
    agent: UniformSemanticAgentV2,
    knowledgeData: any,
    sourceInstance: string
  ): Promise<void> {
    // Initialize accumulated_knowledge if not exists
    if (!agent.knowledge.accumulated_knowledge) {
      agent.knowledge.accumulated_knowledge = [];
    }
    
    // Check confidence threshold
    if (knowledgeData.confidence < this.verificationThreshold) {
      console.log(`  ⚠ Knowledge confidence too low: ${knowledgeData.confidence}`);
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
      console.log(`  → Knowledge verified: "${duplicate.content.substring(0, 50)}..." (count: ${duplicate.verification_count})`);
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
      
      console.log(`  → Knowledge added: "${knowledge.content.substring(0, 50)}..."`);
    }
  }
  
  /**
   * Integrate knowledge batch
   */
  async integrate(
    agent: UniformSemanticAgentV2,
    knowledgeItems: any[],
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
  private isSimilar(content1: string, content2: string): boolean {
    // Simplified similarity check
    // In production, would use embedding similarity
    
    const normalized1 = content1.toLowerCase().trim();
    const normalized2 = content2.toLowerCase().trim();
    
    if (normalized1 === normalized2) return true;
    
    // Check if one contains the other
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Verify knowledge with multiple sources
   */
  async verifyKnowledge(
    agent: UniformSemanticAgentV2,
    knowledgeId: string,
    additionalSource: string
  ): Promise<void> {
    const knowledge = agent.knowledge.accumulated_knowledge?.find(
      k => k.knowledge_id === knowledgeId
    );
    
    if (knowledge) {
      knowledge.verification_count++;
      knowledge.confidence = Math.min(1.0, knowledge.confidence + 0.1);
      
      console.log(`  → Knowledge verification increased: ${knowledge.verification_count}x`);
    }
  }
}
