/**
 * Skill Accumulator - Aggregate skills from instances
 * 
 * Tracks skill learning across instances with proficiency
 * aggregation, synergy detection, and learning curves.
 */

import type { SemanticAgent, Skill } from './core/SemanticAgent';
import { logger } from '../observability';
import * as crypto from 'crypto';

/**
 * Skill accumulation result
 */
export interface SkillAccumulationResult {
  added: number;
  updated: number;
  synergies_detected: number;
}

/**
 * Skill Accumulator
 */
export class SkillAccumulator {
  /**
   * Update skill from instance
   */
  async updateSkill(
    agent: SemanticAgent,
    skillData: any,
    sourceInstance: string
  ): Promise<void> {
    // Initialize learned_skills if not exists
    if (!agent.capabilities.learned_skills) {
      agent.capabilities.learned_skills = [];
    }
    
    // Find existing skill
    const existing = agent.capabilities.learned_skills.find(
      s => s.name === skillData.name
    );
    
    if (existing) {
      // Update existing skill
      await this.updateExistingSkill(existing, skillData, sourceInstance);
    } else {
      // Add new skill
      await this.addNewSkill(agent, skillData, sourceInstance);
    }
  }
  
  /**
   * Accumulate skills from batch
   */
  async accumulateSkills(
    agent: SemanticAgent,
    skills: Skill[],
    sourceInstance: string
  ): Promise<SkillAccumulationResult> {
    const result: SkillAccumulationResult = {
      added: 0,
      updated: 0,
      synergies_detected: 0
    };
    
    for (const skill of skills) {
      const existingIndex = agent.capabilities.learned_skills?.findIndex(
        s => s.name === skill.name
      );
      
      if (existingIndex !== undefined && existingIndex >= 0) {
        await this.updateExistingSkill(
          agent.capabilities.learned_skills![existingIndex],
          skill,
          sourceInstance
        );
        result.updated++;
      } else {
        await this.addNewSkill(agent, skill, sourceInstance);
        result.added++;
      }
    }
    
    // Detect synergies
    const synergies = await this.detectSynergies(agent.capabilities.learned_skills || []);
    result.synergies_detected = synergies.length;
    
    return result;
  }
  
  /**
   * Add new skill
   */
  private async addNewSkill(
    agent: SemanticAgent,
    skillData: any,
    sourceInstance: string
  ): Promise<void> {
    const skill: Skill = {
      skill_id: skillData.skill_id || crypto.randomUUID(),
      name: skillData.name,
      category: skillData.category || 'general',
      proficiency: skillData.proficiency || 0.5,
      acquired: new Date().toISOString(),
      source_instances: [sourceInstance],
      learning_curve: [
        {
          timestamp: new Date().toISOString(),
          proficiency: skillData.proficiency || 0.5,
          event: `Acquired from ${sourceInstance}`
        }
      ],
      usage: {
        total_invocations: skillData.usage?.total_invocations || 0,
        success_rate: skillData.usage?.success_rate || 0,
        contexts: skillData.usage?.contexts || [],
        last_used: new Date().toISOString()
      },
      prerequisites: skillData.prerequisites || [],
      enables: skillData.enables || [],
      synergies: []
    };
    
    agent.capabilities.learned_skills!.push(skill);
    
    logger.debug('Skill added', { 
      skill_id: skill.skill_id,
      name: skill.name, 
      proficiency: skill.proficiency,
      source: sourceInstance
    });
  }
  
  /**
   * Update existing skill
   */
  private async updateExistingSkill(
    existing: Skill,
    newData: any,
    sourceInstance: string
  ): Promise<void> {
    // Aggregate proficiency using max strategy
    const oldProficiency = existing.proficiency;
    existing.proficiency = Math.max(existing.proficiency, newData.proficiency || 0);
    
    // Add to learning curve
    if (existing.proficiency !== oldProficiency) {
      existing.learning_curve.push({
        timestamp: new Date().toISOString(),
        proficiency: existing.proficiency,
        event: `Updated from ${sourceInstance}`
      });
    }
    
    // Update usage statistics
    existing.usage.total_invocations += newData.usage?.total_invocations || 0;
    
    if (newData.usage?.success_rate !== undefined) {
      // Weighted average of success rates
      const weight = 0.6;  // Weight new data higher
      existing.usage.success_rate = 
        existing.usage.success_rate * (1 - weight) + 
        newData.usage.success_rate * weight;
    }
    
    existing.usage.last_used = new Date().toISOString();
    
    // Add source instance
    if (!existing.source_instances.includes(sourceInstance)) {
      existing.source_instances.push(sourceInstance);
    }
    
    logger.debug('Skill updated', { 
      skill_id: existing.skill_id,
      name: existing.name, 
      proficiency: existing.proficiency,
      source: sourceInstance,
      source_count: existing.source_instances.length
    });
  }
  
  /**
   * Detect skill synergies
   */
  private async detectSynergies(skills: Skill[]): Promise<Array<{
    skills: string[];
    strength: number;
  }>> {
    const synergies: Array<{ skills: string[]; strength: number }> = [];
    
    // Simple synergy detection: skills with shared prerequisites
    for (let i = 0; i < skills.length; i++) {
      for (let j = i + 1; j < skills.length; j++) {
        const skill1 = skills[i];
        const skill2 = skills[j];
        
        const sharedPrereqs = skill1.prerequisites.filter(
          p => skill2.prerequisites.includes(p)
        );
        
        if (sharedPrereqs.length > 0) {
          synergies.push({
            skills: [skill1.name, skill2.name],
            strength: sharedPrereqs.length / Math.max(
              skill1.prerequisites.length,
              skill2.prerequisites.length
            )
          });
        }
      }
    }
    
    return synergies;
  }
  
  /**
   * Calculate overall capability score
   */
  calculateCapabilityScore(skills: Skill[]): number {
    if (skills.length === 0) return 0;
    
    // Average proficiency weighted by usage
    const totalUsage = skills.reduce((sum, s) => sum + s.usage.total_invocations, 0);
    
    if (totalUsage === 0) {
      return skills.reduce((sum, s) => sum + s.proficiency, 0) / skills.length;
    }
    
    const weightedSum = skills.reduce(
      (sum, s) => sum + s.proficiency * s.usage.total_invocations,
      0
    );
    
    return weightedSum / totalUsage;
  }
}
