/**
 * Adaptation API Contracts
 *
 * Defines interface contracts for AI Lead Adaptation System integration.
 *
 * Design Principles:
 * - Interface Segregation Principle (SOLID)
 * - Contract-First Design
 * - Type Safety (TypeScript)
 *
 * References:
 * - Martin, R. C. (2003). Agile Software Development: Principles, Patterns, and Practices. Prentice Hall.
 */

/**
 * API Request Base
 */
export interface APIRequest {
    request_id?: string;
    timestamp?: string;
    metadata?: Record<string, any>;
}

/**
 * API Response Base
 */
export interface APIResponse<T = any> {
    success: boolean;
    data?: T;
    error?: APIError;
    request_id: string;
    timestamp: string;
}

/**
 * API Error
 */
export interface APIError {
    code: string;
    message: string;
    details?: Record<string, any>;
    stack?: string;
}

/**
 * Quality Analysis Request
 */
export interface QualityAnalysisRequest extends APIRequest {
    target_path: string;
    priority?: number;
    quality_thresholds?: {
        complexity?: number;
        maintainability?: number;
        test_coverage?: number;
        duplication?: number;
        technical_debt?: number;
    };
}

/**
 * Quality Analysis Response
 */
export interface QualityAnalysisResponse {
    request_id: string;
    task_id: string;
    metrics: {
        complexity: number;
        maintainability_index: number;
        test_coverage: number;
        code_duplication: number;
        technical_debt: number;
    };
    issues: Array<{
        issue_id: string;
        issue_type: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        file_path: string;
        description: string;
        confidence: number;
    }>;
    proposals: Array<{
        proposal_id: string;
        change_type: string;
        file_path: string;
        description: string;
        confidence: number;
        requires_validation: boolean;
    }>;
}

/**
 * Refactoring Request
 */
export interface RefactoringRequest extends APIRequest {
    target_path: string;
    priority?: number;
    pattern_types?: string[];
}

/**
 * Refactoring Response
 */
export interface RefactoringResponse {
    request_id: string;
    task_id: string;
    patterns_detected: number;
    proposals: Array<{
        proposal_id: string;
        pattern_name: string;
        pattern_type: string;
        file_path: string;
        description: string;
        confidence: number;
        test_requirements: string[];
    }>;
}

/**
 * Kata Cycle Request
 */
export interface KataCycleRequest extends APIRequest {
    target_condition: {
        metrics: Record<string, number>;
        description: string;
        rationale: string;
        deadline?: string;
    };
    current_metrics: Record<string, number>;
}

/**
 * Kata Cycle Response
 */
export interface KataCycleResponse {
    request_id: string;
    cycle_id: string;
    state: string;
    current_condition: {
        metrics: Record<string, number>;
        timestamp: string;
    };
    target_condition: {
        metrics: Record<string, number>;
        description: string;
    };
    obstacles: Array<{
        obstacle_id: string;
        description: string;
        impact: 'low' | 'medium' | 'high';
        blocking: boolean;
    }>;
    next_steps: Array<{
        step_id: string;
        description: string;
        target_metric: string;
        target_value: number;
    }>;
}

/**
 * Validation Request
 */
export interface ValidationRequest extends APIRequest {
    change_proposal: {
        proposal_id: string;
        change_type: string;
        file_path: string;
        description: string;
        confidence: number;
        impact_analysis?: any;
    };
}

/**
 * Validation Response
 */
export interface ValidationResponse {
    request_id: string;
    validation_id: string;
    status: 'pending' | 'approved' | 'rejected' | 'auto_approved';
    feedback?: string;
    timestamp: string;
}

/**
 * Statistics Request
 */
export interface StatisticsRequest extends APIRequest {
    component?: 'coordinator' | 'validation' | 'tracker' | 'learning' | 'kata' | 'all';
}

/**
 * Statistics Response
 */
export interface StatisticsResponse {
    coordinator?: {
        total_tasks: number;
        pending: number;
        in_progress: number;
        completed: number;
        failed: number;
    };
    validation?: {
        pending: number;
        approved: number;
        rejected: number;
        auto_approved: number;
    };
    tracker?: {
        total_proposals: number;
        approved_proposals: number;
        implemented_proposals: number;
        success_rate: number;
    };
    learning?: {
        total_experiences: number;
        patterns_recognized: number;
        success_patterns: number;
        failure_patterns: number;
    };
    kata?: {
        total_cycles: number;
        active_cycles: number;
        completed_experiments: number;
        successful_experiments: number;
    };
}
