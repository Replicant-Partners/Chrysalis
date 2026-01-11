/**
 * Learning Loop - Collects experience and recognizes patterns for adaptation
 *
 * Following the complex learner pattern and Toyota Kata principles, the learning
 * loop serves as the core mechanism for continuous improvement and adaptation.
 */

import { AdaptationTracker, AdaptationOutcome, AdaptationMetrics } from './AdaptationTracker';
import { ChangeProposal } from './AgentCoordinator';

/**
 * Learning pattern
 */
export interface LearningPattern {
    pattern_id: string;
    pattern_name: string;
    pattern_type: 'success' | 'failure' | 'neutral';
    description: string;
    context: Record<string, any>;
    frequency: number;
    confidence: number;
    last_seen: string;
    outcomes: {
        successful: number;
        failed: number;
        total: number;
    };
}

/**
 * Experience entry
 */
export interface ExperienceEntry {
    entry_id: string;
    timestamp: string;
    event_type: string;
    context: Record<string, any>;
    outcome?: any;
    metrics_before?: Record<string, number>;
    metrics_after?: Record<string, number>;
    feedback?: string;
}

/**
 * Learning Loop
 *
 * Collects experience and recognizes patterns for adaptation.
 *
 * Following the complex learner pattern and Toyota Kata:
 * - Current Condition → Target Condition → Obstacles → Experiments
 * - Learn from outcomes
 * - Recognize patterns
 * - Adapt based on evidence
 */
export class LearningLoop {
    private tracker: AdaptationTracker;
    private experiences: ExperienceEntry[] = [];
    private patterns: Map<string, LearningPattern> = new Map();
    private metricsHistory: AdaptationMetrics[] = [];

    constructor(tracker: AdaptationTracker) {
        this.tracker = tracker;
    }

    /**
     * Collect experience from adaptation outcome
     */
    async collectExperience(outcome: AdaptationOutcome, context?: Record<string, any>): Promise<string> {
        const entry: ExperienceEntry = {
            entry_id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            event_type: outcome.success ? 'successful_adaptation' : 'failed_adaptation',
            context: context || {},
            outcome: {
                change_proposal_id: outcome.change_proposal_id,
                success: outcome.success,
                errors: outcome.errors,
                feedback: outcome.feedback,
            },
            metrics_before: outcome.metrics_before,
            metrics_after: outcome.metrics_after,
            feedback: outcome.feedback,
        };

        this.experiences.push(entry);

        // Update patterns based on new experience
        await this.updatePatterns(entry);

        return entry.entry_id;
    }

    /**
     * Recognize patterns from experience
     */
    async recognizePatterns(): Promise<LearningPattern[]> {
        // Analyze experiences to find patterns
        const patterns: LearningPattern[] = [];

        // Group experiences by context
        const contextGroups = this.groupByContext(this.experiences);

        const entries_list = Array.from(contextGroups.entries());
        for (const [contextKey, entries] of entries_list) {
            const pattern = this.analyzePattern(contextKey, entries);
            if (pattern) {
                patterns.push(pattern);
                this.patterns.set(pattern.pattern_id, pattern);
            }
        }

        return patterns;
    }

    /**
     * Group experiences by context
     */
    private groupByContext(experiences: ExperienceEntry[]): Map<string, ExperienceEntry[]> {
        const groups = new Map<string, ExperienceEntry[]>();

        for (const entry of experiences) {
            const contextKey = this.generateContextKey(entry.context);

            if (!groups.has(contextKey)) {
                groups.set(contextKey, []);
            }
            groups.get(contextKey)!.push(entry);
        }

        return groups;
    }

    /**
     * Generate context key from context object
     */
    private generateContextKey(context: Record<string, any>): string {
        // Create a deterministic key from context
        const keys = Object.keys(context).sort();
        const values = keys.map(k => `${k}:${JSON.stringify(context[k])}`).join('|');
        return values;
    }

    /**
     * Analyze pattern from experience entries
     */
    private analyzePattern(contextKey: string, entries: ExperienceEntry[]): LearningPattern | null {
        if (entries.length < 2) return null; // Need at least 2 occurrences to be a pattern

        const successful = entries.filter(e => e.event_type === 'successful_adaptation').length;
        const failed = entries.filter(e => e.event_type === 'failed_adaptation').length;
        const total = entries.length;

        const successRate = successful / total;
        const patternType = successRate > 0.7 ? 'success' : successRate < 0.3 ? 'failure' : 'neutral';

        const pattern: LearningPattern = {
            pattern_id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            pattern_name: this.generatePatternName(contextKey, patternType),
            pattern_type: patternType,
            description: this.generatePatternDescription(contextKey, entries),
            context: entries[0].context,
            frequency: entries.length,
            confidence: Math.min(1.0, entries.length / 10), // More occurrences = higher confidence
            last_seen: entries[entries.length - 1].timestamp,
            outcomes: {
                successful,
                failed,
                total,
            },
        };

        return pattern;
    }

    /**
     * Generate pattern name
     */
    private generatePatternName(contextKey: string, type: LearningPattern['pattern_type']): string {
        const prefix = type === 'success' ? 'Successful' : type === 'failure' ? 'Failed' : 'Neutral';
        return `${prefix} Pattern: ${contextKey.substring(0, 50)}`;
    }

    /**
     * Generate pattern description
     */
    private generatePatternDescription(contextKey: string, entries: ExperienceEntry[]): string {
        const successful = entries.filter(e => e.event_type === 'successful_adaptation').length;
        const total = entries.length;
        const successRate = (successful / total * 100).toFixed(1);

        return `Observed ${total} times with ${successRate}% success rate. Context: ${contextKey.substring(0, 100)}`;
    }

    /**
     * Update patterns based on new experience
     */
    private async updatePatterns(entry: ExperienceEntry): Promise<void> {
        const contextKey = this.generateContextKey(entry.context);

        // Find matching pattern
        let matchingPattern: LearningPattern | null = null;
        const patterns_list = Array.from(this.patterns.values());
        for (const pattern of patterns_list) {
            const patternKey = this.generateContextKey(pattern.context);
            if (patternKey === contextKey) {
                matchingPattern = pattern;
                break;
            }
        }

        if (matchingPattern) {
            // Update existing pattern
            matchingPattern.frequency += 1;
            matchingPattern.last_seen = entry.timestamp;
            matchingPattern.confidence = Math.min(1.0, matchingPattern.frequency / 10);

            if (entry.event_type === 'successful_adaptation') {
                matchingPattern.outcomes.successful += 1;
            } else {
                matchingPattern.outcomes.failed += 1;
            }
            matchingPattern.outcomes.total += 1;

            // Update pattern type based on new outcomes
            const successRate = matchingPattern.outcomes.successful / matchingPattern.outcomes.total;
            matchingPattern.pattern_type = successRate > 0.7 ? 'success' : successRate < 0.3 ? 'failure' : 'neutral';

            this.patterns.set(matchingPattern.pattern_id, matchingPattern);
        } else {
            // Recognize new pattern
            await this.recognizePatterns();
        }
    }

    /**
     * Get patterns for context
     */
    getPatternsForContext(context: Record<string, any>): LearningPattern[] {
        const contextKey = this.generateContextKey(context);
        const matching: LearningPattern[] = [];
        const patterns_list = Array.from(this.patterns.values());

        for (const pattern of patterns_list) {
            const patternKey = this.generateContextKey(pattern.context);
            if (patternKey === contextKey || this.isContextSimilar(patternKey, contextKey)) {
                matching.push(pattern);
            }
        }

        return matching;
    }

    /**
     * Check if contexts are similar
     */
    private isContextSimilar(key1: string, key2: string): boolean {
        // Simple similarity check (would use more sophisticated matching in production)
        const tokens1 = key1.split('|');
        const tokens2 = key2.split('|');

        const commonTokens = tokens1.filter(t => tokens2.includes(t));
        const similarity = commonTokens.length / Math.max(tokens1.length, tokens2.length);

        return similarity > 0.7; // 70% similarity threshold
    }

    /**
     * Get learning statistics
     */
    getStats(): {
        total_experiences: number;
        patterns_recognized: number;
        success_patterns: number;
        failure_patterns: number;
        average_confidence: number;
    } {
        const patterns = Array.from(this.patterns.values());

        return {
            total_experiences: this.experiences.length,
            patterns_recognized: patterns.length,
            success_patterns: patterns.filter(p => p.pattern_type === 'success').length,
            failure_patterns: patterns.filter(p => p.pattern_type === 'failure').length,
            average_confidence: patterns.length > 0
                ? patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length
                : 0,
        };
    }

    /**
     * Get recent experiences
     */
    getRecentExperiences(limit: number = 50): ExperienceEntry[] {
        return this.experiences.slice(-limit);
    }

    /**
     * Get all patterns
     */
    getAllPatterns(): LearningPattern[] {
        return Array.from(this.patterns.values());
    }
}
