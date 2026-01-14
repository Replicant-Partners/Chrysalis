/**
 * ForecastTracker - Brier Score Calibration System
 *
 * Tracks Phil's forecasts and computes Brier scores for calibration.
 * Implements Tetlock's superforecasting principles for probability tracking.
 *
 * @see Tetlock, P.E. & Gardner, D. (2015). Superforecasting: The Art and Science of Prediction
 * @see https://faculty.wharton.upenn.edu/wp-content/uploads/2015/07/2015---superforecasters.pdf
 *
 * @module agents/system/ForecastTracker
 */

/**
 * Represents Phil's forecast tracking for Brier score calibration
 */
export interface ForecastRecord {
  /** Unique identifier for the evaluation */
  id: string;
  /** Probability prediction 0-1 */
  prediction: number;
  /** True if event occurred, undefined if unresolved */
  outcome?: boolean;
  /** (prediction - outcome)^2, lower is better */
  brierScore?: number;
  /** When the forecast was made */
  timestamp: Date;
  /** Description of what was forecasted */
  context: string;
}

/**
 * Calibration statistics for forecast tracking
 */
export interface CalibrationStats {
  /** Rolling Brier score over the window */
  rollingBrierScore: number;
  /** Total forecasts made */
  totalForecasts: number;
  /** Number of resolved forecasts */
  resolvedForecasts: number;
  /** Number still awaiting outcome */
  pendingForecasts: number;
  /** Timestamp of last update */
  lastUpdated: Date;
}

/** Default Brier score when no history (random guess baseline) */
export const DEFAULT_BRIER_SCORE = 0.25;

/**
 * ForecastTracker manages Brier score calibration for Phil's predictions.
 *
 * Brier Score = (prediction - outcome)^2
 * - Perfect score: 0 (prediction matches outcome exactly)
 * - Random baseline: 0.25 (50% prediction on binary outcomes)
 * - Worst score: 1 (always wrong with maximum confidence)
 */
export class ForecastTracker {
  private forecastHistory: ForecastRecord[] = [];
  private readonly windowSize: number;

  /**
   * Create a new ForecastTracker
   * @param windowSize - Rolling window size for calibration (default: 100)
   */
  constructor(windowSize: number = 100) {
    this.windowSize = windowSize;
  }

  /**
   * Record a new forecast.
   *
   * @param id - Unique evaluation ID
   * @param prediction - Probability prediction (0-1)
   * @param context - Description of what's being forecasted
   */
  recordForecast(id: string, prediction: number, context: string): void {
    // Validate prediction is a probability
    if (prediction < 0 || prediction > 1) {
      throw new Error(`Prediction must be between 0 and 1, got ${prediction}`);
    }

    this.forecastHistory.push({
      id,
      prediction,
      timestamp: new Date(),
      context
    });

    // Maintain rolling window
    if (this.forecastHistory.length > this.windowSize * 2) {
      // Remove oldest entries beyond window
      this.forecastHistory = this.forecastHistory.slice(-this.windowSize * 2);
    }
  }

  /**
   * Resolve a forecast outcome and compute Brier score.
   *
   * @param evaluationId - The evaluation ID to resolve
   * @param outcome - Whether the predicted event occurred
   * @returns The computed Brier score, or null if forecast not found
   */
  resolveOutcome(evaluationId: string, outcome: boolean): number | null {
    const forecast = this.forecastHistory.find(f => f.id === evaluationId);
    if (!forecast) {
      return null;
    }

    // Brier score: (forecast - outcome)^2
    // outcome: 1 if true, 0 if false
    const outcomeValue = outcome ? 1 : 0;
    const brierScore = Math.pow(forecast.prediction - outcomeValue, 2);

    forecast.outcome = outcome;
    forecast.brierScore = brierScore;

    return brierScore;
  }

  /**
   * Get rolling Brier score across resolved forecasts.
   *
   * @returns Rolling average Brier score (lower is better)
   */
  getRollingBrierScore(): number {
    const resolved = this.forecastHistory
      .filter(f => f.brierScore !== undefined)
      .slice(-this.windowSize);

    if (resolved.length === 0) {
      return DEFAULT_BRIER_SCORE; // Default to random baseline
    }

    const sum = resolved.reduce((acc, f) => acc + (f.brierScore ?? 0), 0);
    return sum / resolved.length;
  }

  /**
   * Get comprehensive calibration statistics.
   */
  getCalibrationStats(): CalibrationStats {
    const resolved = this.forecastHistory.filter(f => f.brierScore !== undefined);
    const pending = this.forecastHistory.filter(f => f.brierScore === undefined);

    return {
      rollingBrierScore: this.getRollingBrierScore(),
      totalForecasts: this.forecastHistory.length,
      resolvedForecasts: resolved.length,
      pendingForecasts: pending.length,
      lastUpdated: new Date()
    };
  }

  /**
   * Get a forecast record by evaluation ID.
   */
  getForecast(evaluationId: string): ForecastRecord | undefined {
    return this.forecastHistory.find(f => f.id === evaluationId);
  }

  /**
   * Get all forecast records (for debugging/export).
   */
  getAllForecasts(): ForecastRecord[] {
    return [...this.forecastHistory];
  }

  /**
   * Get unresolved forecasts that need outcomes.
   */
  getPendingForecasts(): ForecastRecord[] {
    return this.forecastHistory.filter(f => f.outcome === undefined);
  }

  /**
   * Clear all forecast history.
   */
  reset(): void {
    this.forecastHistory = [];
  }

  /**
   * Check if calibration is drifting (score above threshold).
   * @param threshold - Brier score threshold (default: 0.25 = random baseline)
   */
  isCalibrationDrifting(threshold: number = DEFAULT_BRIER_SCORE): boolean {
    return this.getRollingBrierScore() > threshold;
  }
}

/**
 * Create a ForecastTracker with default settings.
 */
export function createForecastTracker(windowSize?: number): ForecastTracker {
  return new ForecastTracker(windowSize);
}
