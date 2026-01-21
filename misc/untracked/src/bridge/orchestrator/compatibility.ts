/**
 * Chrysalis Universal Agent Bridge - Compatibility Tracking
 *
 * Tracks framework-to-framework translation compatibility metrics.
 *
 * @module bridge/orchestrator/compatibility
 */

import { AgentFramework } from '../../adapters/base-adapter';
import { CompatibilityEntry } from './types';

/**
 * Manages compatibility tracking between agent frameworks
 */
export class CompatibilityManager {
  private compatibilityMatrix: Map<string, CompatibilityEntry> = new Map();

  /**
   * Update compatibility score between two frameworks
   */
  updateCompatibility(
    source: AgentFramework,
    target: AgentFramework,
    fidelityScore: number
  ): void {
    const key = `${source}->${target}`;
    const existing = this.compatibilityMatrix.get(key);

    if (existing) {
      const newTotal = existing.avgFidelityScore * existing.sampleSize + fidelityScore;
      existing.sampleSize++;
      existing.avgFidelityScore = newTotal / existing.sampleSize;
      existing.lastTested = new Date();
    } else {
      this.compatibilityMatrix.set(key, {
        sourceFramework: source,
        targetFramework: target,
        avgFidelityScore: fidelityScore,
        sampleSize: 1,
        lastTested: new Date()
      });
    }
  }

  /**
   * Get compatibility matrix as array
   */
  getCompatibilityMatrix(): CompatibilityEntry[] {
    return Array.from(this.compatibilityMatrix.values());
  }

  /**
   * Get compatibility score between two frameworks
   */
  getCompatibility(source: AgentFramework, target: AgentFramework): CompatibilityEntry | null {
    const key = `${source}->${target}`;
    return this.compatibilityMatrix.get(key) || null;
  }

  /**
   * Clear all compatibility data
   */
  clear(): void {
    this.compatibilityMatrix.clear();
  }
}
