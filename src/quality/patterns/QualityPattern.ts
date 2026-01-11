/**
 * Quality Pattern Types
 *
 * Types and interfaces for quality patterns.
 *
 * Design Pattern: Data Transfer Object (DTO)
 * - Encapsulates pattern data for transfer between layers
 */

/**
 * Quality Pattern
 */
export interface QualityPattern {
    pattern_id: string;
    pattern_type: PatternType;
    name: string;
    description: string;
    severity: 'error' | 'warning' | 'info';
    frequency: number; // How often this pattern occurs
    confidence: number; // 0.0 to 1.0
    conditions: PatternCondition[];
    actions: PatternAction[];
    metadata: PatternMetadata;
    created_at: string;
    updated_at: string;
}

/**
 * Pattern Type
 */
export type PatternType =
    | 'code_smell'
    | 'style_violation'
    | 'type_error'
    | 'security_issue'
    | 'performance_issue'
    | 'maintenance_issue'
    | 'custom';

/**
 * Pattern Condition
 */
export interface PatternCondition {
    field: string; // e.g., 'rule_id', 'file_path', 'message'
    operator: 'equals' | 'contains' | 'matches' | 'starts_with' | 'ends_with' | 'regex';
    value: string | RegExp;
    negate?: boolean;
}

/**
 * Pattern Action
 */
export interface PatternAction {
    type: 'suggest_fix' | 'apply_fix' | 'block' | 'warn' | 'document';
    description: string;
    auto_fixable?: boolean;
    fix_command?: string;
    metadata?: Record<string, any>;
}

/**
 * Pattern Metadata
 */
export interface PatternMetadata {
    source?: string; // Where pattern came from (tool, manual, learned)
    tags?: string[];
    related_patterns?: string[]; // IDs of related patterns
    examples?: string[]; // Example occurrences
    last_seen?: string; // ISO timestamp
    occurrences?: number; // Total occurrences observed
    success_rate?: number; // For fixes: success rate
}

/**
 * Pattern Match Result
 */
export interface PatternMatchResult {
    pattern: QualityPattern;
    match_score: number; // 0.0 to 1.0
    matched_conditions: PatternCondition[];
    matched_issue?: any; // The issue that matched
    suggestions?: string[];
}

/**
 * Pattern Learning Context
 */
export interface PatternLearningContext {
    issues: any[]; // Quality issues to learn from
    fixes_applied?: any[]; // Fixes that were applied
    outcomes?: any[]; // Outcomes of fixes
    metadata?: Record<string, any>;
}

/**
 * Pattern Recognition Configuration
 */
export interface PatternRecognitionConfig {
    min_confidence?: number; // Minimum confidence to accept pattern (default: 0.5)
    min_frequency?: number; // Minimum frequency to create pattern (default: 3)
    enable_learning?: boolean; // Enable pattern learning (default: true)
    enable_auto_fix?: boolean; // Enable auto-fix for patterns (default: false)
    pattern_storage_path?: string; // Path to store patterns
}
