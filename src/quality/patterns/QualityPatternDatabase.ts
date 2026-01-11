/**
 * Quality Pattern Database
 *
 * Stores and manages quality patterns.
 *
 * Design Pattern: Repository Pattern (Fowler, "Patterns of Enterprise Application Architecture")
 * - Abstracts data access logic from business logic
 * - Provides a collection-like interface for domain objects
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
    QualityPattern,
    PatternType,
    PatternMatchResult,
} from './QualityPattern';

/**
 * Quality Pattern Database
 *
 * Manages storage and retrieval of quality patterns.
 */
export class QualityPatternDatabase {
    private patterns: Map<string, QualityPattern> = new Map();
    private storagePath?: string;

    constructor(storagePath?: string) {
        this.storagePath = storagePath;
    }

    /**
     * Load patterns from storage
     */
    async load(): Promise<void> {
        if (!this.storagePath) {
            return;
        }

        try {
            const data = await fs.readFile(this.storagePath, 'utf-8');
            const patternsData: QualityPattern[] = JSON.parse(data);

            this.patterns.clear();
            for (const pattern of patternsData) {
                this.patterns.set(pattern.pattern_id, pattern);
            }
        } catch (error: any) {
            // File doesn't exist yet, start with empty database
            if (error.code !== 'ENOENT') {
                console.error('Error loading patterns:', error.message);
            }
        }
    }

    /**
     * Save patterns to storage
     */
    async save(): Promise<void> {
        if (!this.storagePath) {
            return;
        }

        try {
            const patternsArray = Array.from(this.patterns.values());
            const data = JSON.stringify(patternsArray, null, 2);

            // Ensure directory exists
            const dir = path.dirname(this.storagePath);
            await fs.mkdir(dir, { recursive: true });

            await fs.writeFile(this.storagePath, data, 'utf-8');
        } catch (error: any) {
            console.error('Error saving patterns:', error.message);
            throw error;
        }
    }

    /**
     * Add or update a pattern
     */
    async addPattern(pattern: QualityPattern): Promise<void> {
        pattern.updated_at = new Date().toISOString();
        this.patterns.set(pattern.pattern_id, pattern);
        await this.save();
    }

    /**
     * Get a pattern by ID
     */
    getPattern(patternId: string): QualityPattern | undefined {
        return this.patterns.get(patternId);
    }

    /**
     * Get all patterns
     */
    getAllPatterns(): QualityPattern[] {
        return Array.from(this.patterns.values());
    }

    /**
     * Get patterns by type
     */
    getPatternsByType(type: PatternType): QualityPattern[] {
        return Array.from(this.patterns.values()).filter(
            (p) => p.pattern_type === type
        );
    }

    /**
     * Get patterns by severity
     */
    getPatternsBySeverity(severity: 'error' | 'warning' | 'info'): QualityPattern[] {
        return Array.from(this.patterns.values()).filter(
            (p) => p.severity === severity
        );
    }

    /**
     * Search patterns by name or description
     */
    searchPatterns(query: string): QualityPattern[] {
        const lowerQuery = query.toLowerCase();
        return Array.from(this.patterns.values()).filter(
            (p) =>
                p.name.toLowerCase().includes(lowerQuery) ||
                p.description.toLowerCase().includes(lowerQuery)
        );
    }

    /**
     * Delete a pattern
     */
    async deletePattern(patternId: string): Promise<boolean> {
        const deleted = this.patterns.delete(patternId);
        if (deleted) {
            await this.save();
        }
        return deleted;
    }

    /**
     * Update pattern frequency
     */
    async incrementPatternFrequency(patternId: string): Promise<void> {
        const pattern = this.patterns.get(patternId);
        if (pattern) {
            pattern.frequency += 1;
            pattern.metadata.occurrences = (pattern.metadata.occurrences || 0) + 1;
            pattern.metadata.last_seen = new Date().toISOString();
            await this.save();
        }
    }

    /**
     * Update pattern confidence
     */
    async updatePatternConfidence(
        patternId: string,
        confidence: number
    ): Promise<void> {
        const pattern = this.patterns.get(patternId);
        if (pattern) {
            pattern.confidence = Math.max(0, Math.min(1, confidence));
            await this.save();
        }
    }

    /**
     * Get pattern statistics
     */
    getStatistics(): {
        total_patterns: number;
        by_type: Record<PatternType, number>;
        by_severity: Record<string, number>;
        average_confidence: number;
        average_frequency: number;
    } {
        const patterns = Array.from(this.patterns.values());
        const byType: Record<string, number> = {};
        const bySeverity: Record<string, number> = {};

        let totalConfidence = 0;
        let totalFrequency = 0;

        for (const pattern of patterns) {
            byType[pattern.pattern_type] = (byType[pattern.pattern_type] || 0) + 1;
            bySeverity[pattern.severity] = (bySeverity[pattern.severity] || 0) + 1;
            totalConfidence += pattern.confidence;
            totalFrequency += pattern.frequency;
        }

        return {
            total_patterns: patterns.length,
            by_type: byType as Record<PatternType, number>,
            by_severity: bySeverity,
            average_confidence: patterns.length > 0 ? totalConfidence / patterns.length : 0,
            average_frequency: patterns.length > 0 ? totalFrequency / patterns.length : 0,
        };
    }
}
