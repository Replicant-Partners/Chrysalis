package llm

import (
	"sort"
	"sync"
	"time"
)

// CostAnalytics tracks historical cost data and provides predictions.
type CostAnalytics struct {
	tracker *CostTracker
	mu      sync.RWMutex
	history []CostSnapshot // Ordered by timestamp (oldest first)

	// Configuration
	maxHistorySize   int           // Max snapshots to keep
	snapshotInterval time.Duration //How often to take snapshots
	lastSnapshot     time.Time
}

// CostSnapshot represents cost data at a specific point in time.
type CostSnapshot struct {
	Timestamp    time.Time `json:"timestamp"`
	DailySpend   float64   `json:"daily_spend"`
	MonthlySpend float64   `json:"monthly_spend"`
	TotalSpend   float64   `json:"total_spend"`
	RequestCount int64     `json:"request_count"`
	TokenCount   int64     `json:"token_count"`
}

// CostAnalyticsConfig configures cost analytics.
type CostAnalyticsConfig struct {
	Tracker          *CostTracker
	MaxHistorySize   int           // Max snapshots to retain (default: 1440 = 24hrs @ 1min intervals)
	SnapshotInterval time.Duration // How often to snapshot (default: 1 minute)
}

// NewCostAnalytics creates a new cost analytics tracker.
func NewCostAnalytics(cfg CostAnalyticsConfig) *CostAnalytics {
	if cfg.MaxHistorySize == 0 {
		cfg.MaxHistorySize = 1440 // 24 hours of 1-minute snapshots
	}
	if cfg.SnapshotInterval == 0 {
		cfg.SnapshotInterval = 1 * time.Minute
	}

	return &CostAnalytics{
		tracker:          cfg.Tracker,
		history:          make([]CostSnapshot, 0, cfg.MaxHistorySize),
		maxHistorySize:   cfg.MaxHistorySize,
		snapshotInterval: cfg.SnapshotInterval,
		lastSnapshot:     time.Now(),
	}
}

// RecordSnapshot takes a snapshot of current cost status.
// Call this periodically (e.g., every minute) to build history.
func (ca *CostAnalytics) RecordSnapshot() {
	ca.mu.Lock()
	defer ca.mu.Unlock()

	now := time.Now()
	if now.Sub(ca.lastSnapshot) < ca.snapshotInterval {
		return // Too soon since last snapshot
	}

	status := ca.tracker.GetStatus()
	snapshot := CostSnapshot{
		Timestamp:    now,
		DailySpend:   status.DailySpend,
		MonthlySpend: status.MonthlySpend,
		TotalSpend:   status.TotalSpend,
		RequestCount: status.RequestCount,
		TokenCount:   status.TokenCount,
	}

	ca.history = append(ca.history, snapshot)
	ca.lastSnapshot = now

	// Trim history if exceeded max size
	if len(ca.history) > ca.maxHistorySize {
		// Keep most recent entries
		ca.history = ca.history[len(ca.history)-ca.maxHistorySize:]
	}
}

// GetHistoricalData returns cost snapshots within the specified time range.
func (ca *CostAnalytics) GetHistoricalData(since time.Time) []CostSnapshot {
	ca.mu.RLock()
	defer ca.mu.RUnlock()

	result := make([]CostSnapshot, 0)
	for _, snapshot := range ca.history {
		if snapshot.Timestamp.After(since) || snapshot.Timestamp.Equal(since) {
			result = append(result, snapshot)
		}
	}
	return result
}

// GetTrends calculates spending trends over different time periods.
func (ca *CostAnalytics) GetTrends() TrendAnalysis {
	ca.mu.RLock()
	defer ca.mu.RUnlock()

	now := time.Now()

	// Get snapshots for different periods
	last1h := ca.filterSince(now.Add(-1 * time.Hour))
	last24h := ca.filterSince(now.Add(-24 * time.Hour))
	last7d := ca.filterSince(now.Add(-7 * 24 * time.Hour))

	return TrendAnalysis{
		Last1Hour:   calculateTrendMetrics(last1h),
		Last24Hours: calculateTrendMetrics(last24h),
		Last7Days:   calculateTrendMetrics(last7d),
	}
}

// PredictMonthlyCost predicts end-of-month cost based on current trends.
func (ca *CostAnalytics) PredictMonthlyCost() CostPrediction {
	ca.mu.RLock()
	defer ca.mu.RUnlock()

	now := time.Now()
	status := ca.tracker.GetStatus()

	// Calculate days elapsed and remaining in month
	firstOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	lastOfMonth := firstOfMonth.AddDate(0, 1, 0).Add(-time.Second)
	daysInMonth := float64(lastOfMonth.Day())
	daysElapsed := float64(now.Day()) + (float64(now.Hour()) / 24.0)
	daysRemaining := daysInMonth - daysElapsed

	// Simple linear projection
	dailyAverage := status.MonthlySpend / daysElapsed
	predictedTotal := status.MonthlySpend + (dailyAverage * daysRemaining)

	// Calculate confidence based on data availability
	confidence := calculateConfidence(daysElapsed, len(ca.history))

	// Determine if we'll exceed budget
	willExceedBudget := status.MonthlyBudget > 0 && predictedTotal > status.MonthlyBudget
	percentOfBudget := 0.0
	if status.MonthlyBudget > 0 {
		percentOfBudget = (predictedTotal / status.MonthlyBudget) * 100
	}

	return CostPrediction{
		PredictedMonthlyTotal: predictedTotal,
		CurrentMonthlySpend:   status.MonthlySpend,
		DaysElapsed:           daysElapsed,
		DaysRemaining:         daysRemaining,
		DailyAverage:          dailyAverage,
		Confidence:            confidence,
		WillExceedBudget:      willExceedBudget,
		PercentOfBudget:       percentOfBudget,
		MonthlyBudget:         status.MonthlyBudget,
	}
}

// GetAlerts returns current spending alerts based on thresholds.
func (ca *CostAnalytics) GetAlerts() []CostAlert {
	ca.mu.RLock()
	defer ca.mu.RUnlock()

	status := ca.tracker.GetStatus()
	alerts := make([]CostAlert, 0)

	// Daily budget alerts
	if status.DailyBudget > 0 {
		percent := status.DailyPercent
		if percent >= 100 {
			alerts = append(alerts, CostAlert{
				Level:     "critical",
				Type:      "daily_budget_exceeded",
				Message:   "Daily budget exceeded",
				Percent:   percent,
				Spend:     status.DailySpend,
				Budget:    status.DailyBudget,
				Threshold: 100,
			})
		} else if percent >= 90 {
			alerts = append(alerts, CostAlert{
				Level:     "warning",
				Type:      "daily_budget_90",
				Message:   "Daily budget at 90%",
				Percent:   percent,
				Spend:     status.DailySpend,
				Budget:    status.DailyBudget,
				Threshold: 90,
			})
		} else if percent >= 75 {
			alerts = append(alerts, CostAlert{
				Level:     "info",
				Type:      "daily_budget_75",
				Message:   "Daily budget at 75%",
				Percent:   percent,
				Spend:     status.DailySpend,
				Budget:    status.DailyBudget,
				Threshold: 75,
			})
		}
	}

	// Monthly budget alerts
	if status.MonthlyBudget > 0 {
		percent := status.MonthlyPercent
		if percent >= 100 {
			alerts = append(alerts, CostAlert{
				Level:     "critical",
				Type:      "monthly_budget_exceeded",
				Message:   "Monthly budget exceeded",
				Percent:   percent,
				Spend:     status.MonthlySpend,
				Budget:    status.MonthlyBudget,
				Threshold: 100,
			})
		} else if percent >= 90 {
			alerts = append(alerts, CostAlert{
				Level:     "warning",
				Type:      "monthly_budget_90",
				Message:   "Monthly budget at 90%",
				Percent:   percent,
				Spend:     status.MonthlySpend,
				Budget:    status.MonthlyBudget,
				Threshold: 90,
			})
		} else if percent >= 75 {
			alerts = append(alerts, CostAlert{
				Level:     "info",
				Type:      "monthly_budget_75",
				Message:   "Monthly budget at 75%",
				Percent:   percent,
				Spend:     status.MonthlySpend,
				Budget:    status.MonthlyBudget,
				Threshold: 75,
			})
		} else if percent >= 50 {
			alerts = append(alerts, CostAlert{
				Level:     "info",
				Type:      "monthly_budget_50",
				Message:   "Monthly budget at 50%",
				Percent:   percent,
				Spend:     status.MonthlySpend,
				Budget:    status.MonthlyBudget,
				Threshold: 50,
			})
		}
	}

	// Predicted monthly budget alert
	prediction := ca.predictMonthlyLocked()
	if prediction.WillExceedBudget && status.MonthlyBudget > 0 {
		alerts = append(alerts, CostAlert{
			Level:     "warning",
			Type:      "predicted_budget_exceeded",
			Message:   "Predicted to exceed monthly budget",
			Percent:   prediction.PercentOfBudget,
			Spend:     prediction.PredictedMonthlyTotal,
			Budget:    status.MonthlyBudget,
			Threshold: 100,
		})
	}

	return alerts
}

// Helper functions

func (ca *CostAnalytics) filterSince(since time.Time) []CostSnapshot {
	result := make([]CostSnapshot, 0)
	for _, snapshot := range ca.history {
		if snapshot.Timestamp.After(since) || snapshot.Timestamp.Equal(since) {
			result = append(result, snapshot)
		}
	}
	return result
}

func (ca *CostAnalytics) predictMonthlyLocked() CostPrediction {
	// Same logic as PredictMonthlyCost but without lock (caller already holds lock)
	now := time.Now()
	status := ca.tracker.GetStatus()

	firstOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	lastOfMonth := firstOfMonth.AddDate(0, 1, 0).Add(-time.Second)
	daysInMonth := float64(lastOfMonth.Day())
	daysElapsed := float64(now.Day()) + (float64(now.Hour()) / 24.0)
	daysRemaining := daysInMonth - daysElapsed

	dailyAverage := status.MonthlySpend / daysElapsed
	predictedTotal := status.MonthlySpend + (dailyAverage * daysRemaining)

	confidence := calculateConfidence(daysElapsed, len(ca.history))

	willExceedbudget := status.MonthlyBudget > 0 && predictedTotal > status.MonthlyBudget
	percentOfBudget := 0.0
	if status.MonthlyBudget > 0 {
		percentOfBudget = (predictedTotal / status.MonthlyBudget) * 100
	}

	return CostPrediction{
		PredictedMonthlyTotal: predictedTotal,
		CurrentMonthlySpend:   status.MonthlySpend,
		DaysElapsed:           daysElapsed,
		DaysRemaining:         daysRemaining,
		DailyAverage:          dailyAverage,
		Confidence:            confidence,
		WillExceedBudget:      willExceedbudget,
		PercentOfBudget:       percentOfBudget,
		MonthlyBudget:         status.MonthlyBudget,
	}
}

func calculateTrendMetrics(snapshots []CostSnapshot) TrendMetrics {
	if len(snapshots) == 0 {
		return TrendMetrics{}
	}

	// Sort by timestamp
	sorted := make([]CostSnapshot, len(snapshots))
	copy(sorted, snapshots)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Timestamp.Before(sorted[j].Timestamp)
	})

	first := sorted[0]
	last := sorted[len(sorted)-1]

	spendChange := last.TotalSpend - first.TotalSpend
	requestChange := last.RequestCount - first.RequestCount
	tokenChange := last.TokenCount - first.TokenCount

	duration := last.Timestamp.Sub(first.Timestamp).Hours()

	return TrendMetrics{
		SpendChange:        spendChange,
		RequestChange:      requestChange,
		TokenChange:        tokenChange,
		Duration:           duration,
		AvgSpendPerHour:    spendChange / duration,
		AvgRequestsPerHour: float64(requestChange) / duration,
	}
}

func calculateConfidence(daysElapsed float64, historySize int) float64 {
	// Confidence based on data availability
	// More days = more confidence, but capped
	dayConfidence := daysElapsed / 7.0 // 7 days = 100%
	if dayConfidence > 1.0 {
		dayConfidence = 1.0
	}

	// More history = more confidence
	historyConfidence := float64(historySize) / 1440.0 // 1440 snapshots (24hrs) = 100%
	if historyConfidence > 1.0 {
		historyConfidence = 1.0
	}

	// Combined confidence (weighted average)
	return (dayConfidence * 0.7) + (historyConfidence * 0.3)
}

// Data structures

// TrendAnalysis contains trend metrics for different time periods.
type TrendAnalysis struct {
	Last1Hour   TrendMetrics `json:"last_1_hour"`
	Last24Hours TrendMetrics `json:"last_24_hours"`
	Last7Days   TrendMetrics `json:"last_7_days"`
}

// TrendMetrics contains metrics for a time period.
type TrendMetrics struct {
	SpendChange        float64 `json:"spend_change"`
	RequestChange      int64   `json:"request_change"`
	TokenChange        int64   `json:"token_change"`
	Duration           float64 `json:"duration_hours"`
	AvgSpendPerHour    float64 `json:"avg_spend_per_hour"`
	AvgRequestsPerHour float64 `json:"avg_requests_per_hour"`
}

// CostPrediction provides cost forecasting.
type CostPrediction struct {
	PredictedMonthlyTotal float64 `json:"predicted_monthly_total"`
	CurrentMonthlySpend   float64 `json:"current_monthly_spend"`
	DaysElapsed           float64 `json:"days_elapsed"`
	DaysRemaining         float64 `json:"days_remaining"`
	DailyAverage          float64 `json:"daily_average"`
	Confidence            float64 `json:"confidence"` // 0.0 to 1.0
	WillExceedBudget      bool    `json:"will_exceed_budget"`
	PercentOfBudget       float64 `json:"percent_of_budget"`
	MonthlyBudget         float64 `json:"monthly_budget"`
}

// CostAlert represents a spending alert.
type CostAlert struct {
	Level     string  `json:"level"`     // info, warning, critical
	Type      string  `json:"type"`      // daily_budget_50, monthly_budget_90, etc.
	Message   string  `json:"message"`   // Human-readable message
	Percent   float64 `json:"percent"`   // Percentage of budget used
	Spend     float64 `json:"spend"`     // Current spend
	Budget    float64 `json:"budget"`    // Budget limit
	Threshold float64 `json:"threshold"` // Threshold that triggered alert
}
