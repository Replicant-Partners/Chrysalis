package llm

import (
	"testing"
	"time"
)

// TestCostAnalytics_BasicFunctionality tests core cost analytics features
func TestCostAnalytics_BasicFunctionality(t *testing.T) {
	// Create a cost tracker with test budgets
	tracker := NewCostTracker(CostTrackerConfig{
		DailyBudgetUSD:   10.0,
		MonthlyBudgetUSD: 100.0,
	})

	// Create cost analytics
	analytics := NewCostAnalytics(CostAnalyticsConfig{
		Tracker:          tracker,
		MaxHistorySize:   10,
		SnapshotInterval: 100 * time.Millisecond,
	})

	// Track some usage
	tracker.TrackUsage("gpt-4o", 1000, 500)
	tracker.TrackUsage("gpt-4o", 2000, 1000)

	// Record snapshot
	analytics.RecordSnapshot()

	// Wait a bit and record another
	time.Sleep(150 * time.Millisecond)
	tracker.TrackUsage("gpt-4o", 500, 250)
	analytics.RecordSnapshot()

	// Get historical data
	history := analytics.GetHistoricalData(time.Now().Add(-1 * time.Hour))
	if len(history) != 2 {
		t.Errorf("Expected 2 snapshots, got %d", len(history))
	}

	// Verify snapshots have increasing spend
	if len(history) >= 2 && history[1].TotalSpend <= history[0].TotalSpend {
		t.Errorf("Expected increasing spend across snapshots")
	}
}

// TestCostAnalytics_Prediction tests monthly cost prediction
func TestCostAnalytics_Prediction(t *testing.T) {
	tracker := NewCostTracker(CostTrackerConfig{
		MonthlyBudgetUSD: 50.0,
	})

	analytics := NewCostAnalytics(CostAnalyticsConfig{
		Tracker: tracker,
	})

	// Simulate some spending
	tracker.TrackUsage("gpt-4o", 10000, 5000)

	prediction := analytics.PredictMonthlyCost()

	// Verify prediction structure
	if prediction.CurrentMonthlySpend <= 0 {
		t.Errorf("Expected positive current spend, got %.2f", prediction.CurrentMonthlySpend)
	}

	if prediction.PredictedMonthlyTotal <= 0 {
		t.Errorf("Expected positive predicted total, got %.2f", prediction.PredictedMonthlyTotal)
	}

	if prediction.DailyAverage <= 0 {
		t.Errorf("Expected positive daily average, got %.2f", prediction.DailyAverage)
	}

	if prediction.Confidence < 0 || prediction.Confidence > 1.0 {
		t.Errorf("Expected confidence between 0 and 1, got %.2f", prediction.Confidence)
	}
}

// TestCostAnalytics_Alerts tests spending alerts
func TestCostAnalytics_Alerts(t *testing.T) {
	tracker := NewCostTracker(CostTrackerConfig{
		DailyBudgetUSD:   1.0,
		MonthlyBudgetUSD: 30.0,
	})

	analytics := NewCostAnalytics(CostAnalyticsConfig{
		Tracker: tracker,
	})

	// No alerts initially
	alerts := analytics.GetAlerts()
	if len(alerts) != 0 {
		t.Errorf("Expected 0 alerts initially, got %d", len(alerts))
	}

	// Exceed 50% of daily budget
	tracker.TrackUsage("gpt-4o", 50000, 25000) // ~$0.50

	alerts = analytics.GetAlerts()
	// Should have at least monthly_budget_50 alert
	hasAlert := false
	for _, alert := range alerts {
		if alert.Type == "daily_budget_75" || alert.Type == "monthly_budget_50" {
			hasAlert = true
			break
		}
	}
	if !hasAlert {
		t.Errorf("Expected budget alert after significant spend")
	}

	// Exceed daily budget
	tracker.TrackUsage("gpt-4o", 50000, 25000) // Another ~$0.50, total ~$1.00

	alerts = analytics.GetAlerts()
	hasCritical := false
	for _, alert := range alerts {
		if alert.Level == "critical" || alert.Level == "warning" {
			hasCritical = true
			break
		}
	}
	if !hasCritical {
		t.Errorf("Expected critical/warning alert after exceeding budget")
	}
}

// TestCostAnalytics_Trends tests trend calculation
func TestCostAnalytics_Trends(t *testing.T) {
	tracker := NewCostTracker(CostTrackerConfig{})
	analytics := NewCostAnalytics(CostAnalyticsConfig{
		Tracker:          tracker,
		SnapshotInterval: 10 * time.Millisecond,
	})

	// Record multiple snapshots with increasing spend
	for i := 0; i < 5; i++ {
		tracker.TrackUsage("gpt-4o", 1000, 500)
		analytics.RecordSnapshot()
		time.Sleep(15 * time.Millisecond)
	}

	trends := analytics.GetTrends()

	// At least one trend period should have data
	if trends.Last1Hour.SpendChange == 0 && trends.Last24Hours.SpendChange == 0 {
		t.Errorf("Expected some spend change in trends")
	}
}

// TestCostAnalytics_HistoryLimit tests that history respects max size
func TestCostAnalytics_HistoryLimit(t *testing.T) {
	tracker := NewCostTracker(CostTrackerConfig{})
	maxSize := 5

	analytics := NewCostAnalytics(CostAnalyticsConfig{
		Tracker:          tracker,
		MaxHistorySize:   maxSize,
		SnapshotInterval: 10 * time.Millisecond,
	})

	// Record more snapshots than the limit
	for i := 0; i < 10; i++ {
		tracker.TrackUsage("gpt-4o", 100, 50)
		analytics.RecordSnapshot()
		time.Sleep(15 * time.Millisecond)
	}

	history := analytics.GetHistoricalData(time.Time{}) // Get all history

	if len(history) > maxSize {
		t.Errorf("Expected history size <= %d, got %d", maxSize, len(history))
	}
}
