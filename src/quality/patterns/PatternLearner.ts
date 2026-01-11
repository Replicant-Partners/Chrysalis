/**
 * Pattern Learner
 *
 * Learns quality patterns from issues and outcomes.
 *
 * Design Pattern: Template Method Pattern (GoF, p. 325)
 * - Defines algorithm structure for pattern learning
 * - Allows subclasses to implement specific learning strategies
 *
 * References:
 * - Gamma, E., Helm, R., Johnson, R., & Vlissides, J. (1994). Design Patterns: Elements of Reusable Object-Oriented Software. Addison-Wesley. p. 325.
 */

import {
    QualityPattern,
    PatternType,
    PatternLearningContext,
    PatternCondition,
    PatternAction,
    PatternMetadata,
} from './QualityPattern';
import { QualityIssue } from '../tools/QualityToolInterface';
import { QualityPatternDatabase } from './QualityPatternDatabase';

/**
 * Pattern Learner
 *
 * Learns quality patterns from historical issues and outcomes.
 */
export class PatternLearner {
    private database: QualityPatternDatabase;
    private minFrequency: number;
    private minConfidence: number;

    constructor(
        database: QualityPatternDatabase,
        minFrequency: number = 3,
        minConfidence: number = 0.5
    ) {
        this.database = database;
        this.minFrequency = minFrequency;
        this.minConfidence = minConfidence;
    }

    /**
     * Learn patterns from context
     */
    async learnPatterns(context: PatternLearningContext): Promise<QualityPattern[]> {
        const patterns: QualityPattern[] = [];

        // Group issues by common characteristics
        const groupedIssues = this.groupIssuesByCharacteristics(context.issues);

        // Create patterns from groups that meet frequency threshold
        for (const [key, issues] of Object.entries(groupedIssues)) {
            if (issues.length >= this.minFrequency) {
                const pattern = await this.createPatternFromIssues(
                    issues,
                    context
                );

                if (pattern && pattern.confidence >= this.minConfidence) {
                    patterns.push(pattern);
                    await this.database.addPattern(pattern);
                }
            }
        }

        return patterns;
    }

    /**
     * Group issues by common characteristics
     */
    private groupIssuesByCharacteristics(
        issues: QualityIssue[]
    ): Record<string, QualityIssue[]> {
        const groups: Record<string, QualityIssue[]> = {};

        for (const issue of issues) {
            // Create grouping key based on rule_id and message pattern
            const key = this.createGroupingKey(issue);

            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(issue);
        }

        return groups;
    }

    /**
     * Create grouping key from issue
     */
    private createGroupingKey(issue: QualityIssue): string {
        // Group by rule_id if available, otherwise by message pattern
        if (issue.rule_id) {
            return `rule:${issue.rule_id}`;
        }

        // Extract pattern from message (first few words)
        const messageWords = issue.message
            .toLowerCase()
            .split(/\s+/)
            .slice(0, 3)
            .join('_');
        return `message:${messageWords}`;
    }

    /**
     * Create pattern from issues
     */
    private async createPatternFromIssues(
        issues: QualityIssue[],
        context: PatternLearningContext
    ): Promise<QualityPattern | null> {
        if (issues.length === 0) {
            return null;
        }

        // Use first issue as template
        const template = issues[0];

        // Infer pattern type
        const patternType = this.inferPatternType(issues);

        // Create conditions
        const conditions = this.createConditionsFromIssues(issues);

        // Create actions (if fixes were applied)
        const actions = this.createActionsFromContext(context, issues);

        // Calculate confidence based on consistency
        const confidence = this.calculateConfidence(issues, conditions);

        // Create pattern ID
        const patternId = this.generatePatternId(template, patternType);

        // Check if pattern already exists
        const existing = this.database.getPattern(patternId);
        if (existing) {
                // Update existing pattern
                existing.frequency += issues.length;
                existing.metadata.occurrences = (existing.metadata.occurrences || 0) + issues.length;
                existing.confidence = Math.max(existing.confidence, confidence);
                existing.metadata.last_seen = new Date().toISOString();
                await this.database.addPattern(existing);
                return existing;
        }

        // Create new pattern
        const pattern: QualityPattern = {
            pattern_id: patternId,
            pattern_type: patternType,
            name: this.generatePatternName(template, issues),
            description: this.generatePatternDescription(issues),
            severity: template.severity,
            frequency: issues.length,
            confidence,
            conditions,
            actions,
            metadata: {
                source: 'learned',
                tags: this.generateTags(issues),
                examples: issues.slice(0, 5).map((i) => i.message),
                last_seen: new Date().toISOString(),
                occurrences: issues.length,
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        return pattern;
    }

    /**
     * Infer pattern type from issues
     */
    private inferPatternType(issues: QualityIssue[]): PatternType {
        const firstIssue = issues[0];

        // Infer from rule_id patterns
        if (firstIssue.rule_id) {
            if (firstIssue.rule_id.startsWith('E') || firstIssue.rule_id.startsWith('F')) {
                return 'code_smell';
            }
            if (firstIssue.rule_id.startsWith('W')) {
                return 'style_violation';
            }
            if (firstIssue.rule_id.startsWith('TS')) {
                return 'type_error';
            }
        }

        // Infer from message content
        const message = firstIssue.message.toLowerCase();
        if (message.includes('security') || message.includes('vulnerability')) {
            return 'security_issue';
        }
        if (message.includes('performance') || message.includes('slow')) {
            return 'performance_issue';
        }

        return 'code_smell'; // Default
    }

    /**
     * Create conditions from issues
     */
    private createConditionsFromIssues(
        issues: QualityIssue[]
    ): PatternCondition[] {
        const conditions: PatternCondition[] = [];
        const template = issues[0];

        // Rule ID condition (if consistent)
        if (template.rule_id) {
            const allSameRule = issues.every((i) => i.rule_id === template.rule_id);
            if (allSameRule) {
                conditions.push({
                    field: 'rule_id',
                    operator: 'equals',
                    value: template.rule_id,
                });
            }
        }

        // Message pattern condition (extract common pattern)
        if (template.message) {
            const commonPattern = this.extractCommonPattern(
                issues.map((i) => i.message)
            );
            if (commonPattern) {
                conditions.push({
                    field: 'message',
                    operator: 'contains',
                    value: commonPattern,
                });
            }
        }

        // Severity condition (if consistent)
        const allSameSeverity = issues.every((i) => i.severity === template.severity);
        if (allSameSeverity) {
            conditions.push({
                field: 'severity',
                operator: 'equals',
                value: template.severity,
            });
        }

        return conditions;
    }

    /**
     * Extract common pattern from messages
     */
    private extractCommonPattern(messages: string[]): string | null {
        if (messages.length === 0) {
            return null;
        }

        // Find common words (appearing in >50% of messages)
        const words = messages.map((m) => m.toLowerCase().split(/\s+/));
        const wordCounts: Record<string, number> = {};

        for (const messageWords of words) {
            const uniqueWords = new Set(messageWords);
            for (const word of Array.from(uniqueWords)) {
                wordCounts[word] = (wordCounts[word] || 0) + 1;
            }
        }

        const threshold = Math.ceil(messages.length * 0.5);
        const commonWords = Object.entries(wordCounts)
            .filter(([, count]) => count >= threshold)
            .map(([word]) => word)
            .slice(0, 3); // Top 3 common words

        return commonWords.length > 0 ? commonWords.join(' ') : null;
    }

    /**
     * Create actions from context
     */
    private createActionsFromContext(
        context: PatternLearningContext,
        issues: QualityIssue[]
    ): PatternAction[] {
        const actions: PatternAction[] = [];

        // If fixes were applied, create suggest_fix action
        if (context.fixes_applied && context.fixes_applied.length > 0) {
            const fixRate = context.fixes_applied.length / issues.length;
            if (fixRate > 0.5) {
                // >50% of issues were fixed
                actions.push({
                    type: 'suggest_fix',
                    description: 'Auto-fix available for this pattern',
                    auto_fixable: true,
                    metadata: {
                        fix_rate: fixRate,
                    },
                });
            }
        }

        // Default action: warn
        if (actions.length === 0) {
            actions.push({
                type: 'warn',
                description: 'Review and fix manually',
            });
        }

        return actions;
    }

    /**
     * Calculate confidence from issues and conditions
     */
    private calculateConfidence(
        issues: QualityIssue[],
        conditions: PatternCondition[]
    ): number {
        if (conditions.length === 0) {
            return 0.3; // Low confidence without conditions
        }

        // Confidence increases with:
        // 1. More issues matching the pattern
        // 2. More conditions that are consistently matched
        // 3. Consistency of issue characteristics

        let consistencyScore = 0;
        for (const condition of conditions) {
            const matchingCount = issues.filter((issue) => {
                const fieldValue = this.getFieldValue(issue, condition.field);
                return fieldValue && String(fieldValue) === String(condition.value);
            }).length;

            consistencyScore += matchingCount / issues.length;
        }

        const averageConsistency = consistencyScore / conditions.length;
        const frequencyScore = Math.min(1, issues.length / 10); // Cap at 10 issues

        return (averageConsistency * 0.7 + frequencyScore * 0.3);
    }

    /**
     * Get field value from issue
     */
    private getFieldValue(issue: QualityIssue, field: string): string | number | undefined {
        switch (field) {
            case 'rule_id':
                return issue.rule_id;
            case 'severity':
                return issue.severity;
            case 'message':
                return issue.message;
            default:
                return (issue as any)[field];
        }
    }

    /**
     * Generate pattern ID
     */
    private generatePatternId(issue: QualityIssue, type: PatternType): string {
        const timestamp = Date.now().toString(36);
        const ruleId = issue.rule_id || 'unknown';
        return `pattern_${type}_${ruleId}_${timestamp}`;
    }

    /**
     * Generate pattern name
     */
    private generatePatternName(issue: QualityIssue, issues: QualityIssue[]): string {
        if (issue.rule_id) {
            return `${issue.rule_id}: ${issue.message.substring(0, 50)}`;
        }
        return `Pattern: ${issue.message.substring(0, 50)}`;
    }

    /**
     * Generate pattern description
     */
    private generatePatternDescription(issues: QualityIssue[]): string {
        const count = issues.length;
        const example = issues[0].message;
        return `Occurs ${count} times. Example: ${example}`;
    }

    /**
     * Generate tags
     */
    private generateTags(issues: QualityIssue[]): string[] {
        const tags: string[] = [];
        const firstIssue = issues[0];

        tags.push(firstIssue.severity);

        if (firstIssue.rule_id) {
            tags.push(firstIssue.rule_id);
        }

        // Extract keywords from messages
        const commonWords = this.extractCommonPattern(issues.map((i) => i.message));
        if (commonWords) {
                    tags.push(...Array.from(new Set(commonWords.split(' '))).slice(0, 3));
        }

        return tags;
    }
}
