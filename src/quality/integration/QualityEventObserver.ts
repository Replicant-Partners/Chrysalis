/**
 * Quality Event Observer
 *
 * Observer pattern implementation for quality events.
 *
 * Design Pattern: Observer Pattern (GoF, p. 293)
 * - Defines observer interface for quality events
 * - Enables decoupled event notification
 *
 * References:
 * - Gamma, E., Helm, R., Johnson, R., & Vlissides, J. (1994). Design Patterns: Elements of Reusable Object-Oriented Software. Addison-Wesley. p. 293-303.
 * - [Observer Pattern - Refactoring Guru](https://refactoring.guru/design-patterns/observer)
 */

import { QualityIssue } from '../tools/QualityToolInterface';
import { AdaptationOutcome } from '../../adaptation/AdaptationTracker';
import { PatternMatchResult } from '../patterns/QualityPattern';

/**
 * Quality Event Types
 */
export type QualityEventType =
    | 'adaptation_outcome'
    | 'quality_check_complete'
    | 'pattern_learned'
    | 'pattern_matched'
    | 'auto_fix_applied'
    | 'quality_improvement';

/**
 * Quality Event
 */
export interface QualityEvent {
    type: QualityEventType;
    timestamp: string;
    data: QualityEventData;
}

/**
 * Quality Event Data
 */
export type QualityEventData =
    | AdaptationOutcomeEventData
    | QualityCheckCompleteEventData
    | PatternLearnedEventData
    | PatternMatchedEventData
    | AutoFixAppliedEventData
    | QualityImprovementEventData;

/**
 * Adaptation Outcome Event Data
 */
export interface AdaptationOutcomeEventData {
    outcome: AdaptationOutcome;
    quality_issues?: QualityIssue[];
}

/**
 * Quality Check Complete Event Data
 */
export interface QualityCheckCompleteEventData {
    total_issues: number;
    errors: number;
    warnings: number;
    files_checked: number;
}

/**
 * Pattern Learned Event Data
 */
export interface PatternLearnedEventData {
    pattern_id: string;
    pattern_name: string;
    confidence: number;
    frequency: number;
}

/**
 * Pattern Matched Event Data
 */
export interface PatternMatchedEventData {
    matches: PatternMatchResult[];
    issues: QualityIssue[];
}

/**
 * Auto Fix Applied Event Data
 */
export interface AutoFixAppliedEventData {
    tools_executed: number;
    files_fixed: number;
    issues_fixed: number;
}

/**
 * Quality Improvement Event Data
 */
export interface QualityImprovementEventData {
    metrics_before: Record<string, number>;
    metrics_after: Record<string, number>;
    improvement_percentage: number;
}

/**
 * Quality Event Observer Interface
 *
 * Design Pattern: Observer Pattern (GoF, p. 293)
 * - Defines interface for observers of quality events
 */
export interface IQualityEventObserver {
    /**
     * Handle quality event
     */
    onQualityEvent(event: QualityEvent): Promise<void>;
}

/**
 * Quality Event Subject
 *
 * Design Pattern: Observer Pattern (GoF, p. 293)
 * - Manages observer list and notifications
 * - Provides methods to attach/detach observers
 */
export class QualityEventSubject {
    private observers: IQualityEventObserver[] = [];

    /**
     * Attach an observer
     */
    attach(observer: IQualityEventObserver): void {
        if (!this.observers.includes(observer)) {
            this.observers.push(observer);
        }
    }

    /**
     * Detach an observer
     */
    detach(observer: IQualityEventObserver): void {
        const index = this.observers.indexOf(observer);
        if (index > -1) {
            this.observers.splice(index, 1);
        }
    }

    /**
     * Notify all observers of an event
     */
    async notify(event: QualityEvent): Promise<void> {
        await Promise.all(
            this.observers.map((observer) => observer.onQualityEvent(event))
        );
    }

    /**
     * Get observer count
     */
    getObserverCount(): number {
        return this.observers.length;
    }

    /**
     * Check if observer is attached
     */
    hasObserver(observer: IQualityEventObserver): boolean {
        return this.observers.includes(observer);
    }
}
