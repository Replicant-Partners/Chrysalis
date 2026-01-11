/**
 * Agent Beliefs Component
 * 
 * Manages the belief system with conviction tracking and evolution.
 * 
 * Single Responsibility: Belief management and conviction tracking
 */

import { Belief } from '../UniformSemanticAgentV2';

/**
 * Belief category (OODA interrogatives)
 */
export type BeliefCategory = 'who' | 'what' | 'why' | 'how' | 'where' | 'when' | 'huh';

/**
 * Beliefs data structure
 */
export interface AgentBeliefsData {
  who: Belief[];
  what: Belief[];
  why: Belief[];
  how: Belief[];
  where?: Belief[];
  when?: Belief[];
  huh?: Belief[];
}

/**
 * Agent Beliefs Manager
 */
export class AgentBeliefs {
  private data: AgentBeliefsData;

  constructor(data?: Partial<AgentBeliefsData>) {
    this.data = {
      who: data?.who || [],
      what: data?.what || [],
      why: data?.why || [],
      how: data?.how || [],
      where: data?.where,
      when: data?.when,
      huh: data?.huh,
    };
  }

  /**
   * Add a belief
   */
  addBelief(category: BeliefCategory, belief: Omit<Belief, 'revision_history'>): void {
    const beliefs = this.getBeliefArray(category);
    
    // Check for existing belief with same content
    const existing = beliefs.find(b => 
      b.content.toLowerCase() === belief.content.toLowerCase()
    );

    if (existing) {
      // Update conviction
      this.updateConviction(category, existing.content, belief.conviction, belief.source);
    } else {
      beliefs.push({
        ...belief,
        revision_history: [],
      });
    }
  }

  /**
   * Update belief conviction
   */
  updateConviction(
    category: BeliefCategory, 
    content: string, 
    newConviction: number,
    source: string
  ): void {
    const beliefs = this.getBeliefArray(category);
    const belief = beliefs.find(b => b.content.toLowerCase() === content.toLowerCase());
    
    if (!belief) return;

    if (!belief.revision_history) {
      belief.revision_history = [];
    }

    belief.revision_history.push({
      timestamp: new Date().toISOString(),
      previous_conviction: belief.conviction,
      reason: `Updated from ${source}`,
      source_instance: source,
    });

    belief.conviction = Math.max(0, Math.min(1, newConviction));
  }

  /**
   * Get beliefs by category
   */
  getBeliefs(category: BeliefCategory): readonly Belief[] {
    return this.getBeliefArray(category);
  }

  /**
   * Get high-conviction beliefs
   */
  getHighConvictionBeliefs(minConviction: number = 0.8): Belief[] {
    const allBeliefs: Belief[] = [];
    
    for (const category of ['who', 'what', 'why', 'how', 'where', 'when', 'huh'] as BeliefCategory[]) {
      const beliefs = this.getBeliefArray(category);
      allBeliefs.push(...beliefs.filter(b => b.conviction >= minConviction));
    }

    return allBeliefs.sort((a, b) => b.conviction - a.conviction);
  }

  /**
   * Get public beliefs only
   */
  getPublicBeliefs(): Belief[] {
    const allBeliefs: Belief[] = [];
    
    for (const category of ['who', 'what', 'why', 'how', 'where', 'when', 'huh'] as BeliefCategory[]) {
      const beliefs = this.getBeliefArray(category);
      allBeliefs.push(...beliefs.filter(b => b.privacy === 'PUBLIC'));
    }

    return allBeliefs;
  }

  /**
   * Deprecate a belief
   */
  deprecateBelief(category: BeliefCategory, content: string, source: string): void {
    const beliefs = this.getBeliefArray(category);
    const belief = beliefs.find(b => b.content.toLowerCase() === content.toLowerCase());
    
    if (belief) {
      this.updateConviction(category, content, belief.conviction * 0.5, source);
    }
  }

  /**
   * Remove low-conviction beliefs
   */
  pruneBeliefs(minConviction: number = 0.1): number {
    let pruned = 0;

    for (const category of ['who', 'what', 'why', 'how', 'where', 'when', 'huh'] as BeliefCategory[]) {
      const beliefs = this.getBeliefArray(category);
      const before = beliefs.length;
      const filtered = beliefs.filter(b => b.conviction >= minConviction);
      this.setBeliefArray(category, filtered);
      pruned += before - filtered.length;
    }

    return pruned;
  }

  /**
   * Get belief statistics
   */
  getStatistics(): {
    totalBeliefs: number;
    byCategory: Record<BeliefCategory, number>;
    averageConviction: number;
    publicCount: number;
    privateCount: number;
  } {
    const stats: Record<BeliefCategory, number> = {
      who: 0, what: 0, why: 0, how: 0, where: 0, when: 0, huh: 0
    };

    let total = 0;
    let convictionSum = 0;
    let publicCount = 0;
    let privateCount = 0;

    for (const category of ['who', 'what', 'why', 'how', 'where', 'when', 'huh'] as BeliefCategory[]) {
      const beliefs = this.getBeliefArray(category);
      stats[category] = beliefs.length;
      total += beliefs.length;
      convictionSum += beliefs.reduce((sum, b) => sum + b.conviction, 0);
      publicCount += beliefs.filter(b => b.privacy === 'PUBLIC').length;
      privateCount += beliefs.filter(b => b.privacy === 'PRIVATE').length;
    }

    return {
      totalBeliefs: total,
      byCategory: stats,
      averageConviction: total > 0 ? convictionSum / total : 0,
      publicCount,
      privateCount,
    };
  }

  private getBeliefArray(category: BeliefCategory): Belief[] {
    switch (category) {
      case 'who': return this.data.who;
      case 'what': return this.data.what;
      case 'why': return this.data.why;
      case 'how': return this.data.how;
      case 'where': return this.data.where || (this.data.where = []);
      case 'when': return this.data.when || (this.data.when = []);
      case 'huh': return this.data.huh || (this.data.huh = []);
    }
  }

  private setBeliefArray(category: BeliefCategory, beliefs: Belief[]): void {
    switch (category) {
      case 'who': this.data.who = beliefs; break;
      case 'what': this.data.what = beliefs; break;
      case 'why': this.data.why = beliefs; break;
      case 'how': this.data.how = beliefs; break;
      case 'where': this.data.where = beliefs; break;
      case 'when': this.data.when = beliefs; break;
      case 'huh': this.data.huh = beliefs; break;
    }
  }

  toData(): AgentBeliefsData {
    return { ...this.data };
  }

  merge(other: AgentBeliefs): void {
    for (const category of ['who', 'what', 'why', 'how', 'where', 'when', 'huh'] as BeliefCategory[]) {
      const otherBeliefs = other.getBeliefs(category);
      otherBeliefs.forEach(b => this.addBelief(category, b));
    }
  }
}

export function validateBeliefs(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Beliefs must be an object'] };
  }
  const beliefs = data as Record<string, unknown>;
  if (!Array.isArray(beliefs.who)) errors.push('Beliefs must have who array');
  if (!Array.isArray(beliefs.what)) errors.push('Beliefs must have what array');
  if (!Array.isArray(beliefs.why)) errors.push('Beliefs must have why array');
  if (!Array.isArray(beliefs.how)) errors.push('Beliefs must have how array');
  return { valid: errors.length === 0, errors };
}
