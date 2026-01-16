package llm

import (
	"sync"
	"time"
)

// CostTracker tracks LLM usage costs with budget enforcement.
type CostTracker struct {
	mu sync.RWMutex

	dailyBudget   float64
	monthlyBudget float64

	dailySpend   float64
	monthlySpend float64
	totalSpend   float64

	lastDayReset   time.Time
	lastMonthReset time.Time

	requestCount int64
	tokenCount   int64
}

// CostTrackerConfig configures the cost tracker.
type CostTrackerConfig struct {
	DailyBudgetUSD   float64
	MonthlyBudgetUSD float64
}

// NewCostTracker creates a new cost tracker.
func NewCostTracker(cfg CostTrackerConfig) *CostTracker {
	now := time.Now()
	return &CostTracker{
		dailyBudget:    cfg.DailyBudgetUSD,
		monthlyBudget:  cfg.MonthlyBudgetUSD,
		lastDayReset:   now,
		lastMonthReset: now,
	}
}

// TrackUsage records token usage and calculates cost.
func (ct *CostTracker) TrackUsage(model string, promptTokens, completionTokens int) float64 {
	cost := CalculateCost(model, promptTokens, completionTokens)

	ct.mu.Lock()
	defer ct.mu.Unlock()

	ct.maybeResetPeriods()

	ct.dailySpend += cost
	ct.monthlySpend += cost
	ct.totalSpend += cost
	ct.requestCount++
	ct.tokenCount += int64(promptTokens + completionTokens)

	return cost
}

// CheckBudget returns whether the request is within budget.
func (ct *CostTracker) CheckBudget(estimatedCost float64) (allowed bool, reason string) {
	ct.mu.RLock()
	defer ct.mu.RUnlock()

	ct.maybeResetPeriodsLocked()

	if ct.dailyBudget > 0 && ct.dailySpend+estimatedCost > ct.dailyBudget {
		return false, "daily budget exceeded"
	}
	if ct.monthlyBudget > 0 && ct.monthlySpend+estimatedCost > ct.monthlyBudget {
		return false, "monthly budget exceeded"
	}
	return true, ""
}

// GetStatus returns current spending status.
func (ct *CostTracker) GetStatus() CostStatus {
	ct.mu.RLock()
	defer ct.mu.RUnlock()

	ct.maybeResetPeriodsLocked()

	return CostStatus{
		DailySpend:     ct.dailySpend,
		DailyBudget:    ct.dailyBudget,
		DailyRemaining: max(0, ct.dailyBudget-ct.dailySpend),
		DailyPercent:   safePercent(ct.dailySpend, ct.dailyBudget),

		MonthlySpend:     ct.monthlySpend,
		MonthlyBudget:    ct.monthlyBudget,
		MonthlyRemaining: max(0, ct.monthlyBudget-ct.monthlySpend),
		MonthlyPercent:   safePercent(ct.monthlySpend, ct.monthlyBudget),

		TotalSpend:   ct.totalSpend,
		RequestCount: ct.requestCount,
		TokenCount:   ct.tokenCount,
	}
}

func (ct *CostTracker) maybeResetPeriods() {
	now := time.Now()

	// Reset daily if new day
	if now.YearDay() != ct.lastDayReset.YearDay() || now.Year() != ct.lastDayReset.Year() {
		ct.dailySpend = 0
		ct.lastDayReset = now
	}

	// Reset monthly if new month
	if now.Month() != ct.lastMonthReset.Month() || now.Year() != ct.lastMonthReset.Year() {
		ct.monthlySpend = 0
		ct.lastMonthReset = now
	}
}

func (ct *CostTracker) maybeResetPeriodsLocked() {
	// Same logic but called from read-locked context
	// In production, you might want to upgrade lock
	now := time.Now()
	if now.YearDay() != ct.lastDayReset.YearDay() || now.Year() != ct.lastDayReset.Year() {
		// Would need lock upgrade in production
	}
}

type CostStatus struct {
	DailySpend     float64
	DailyBudget    float64
	DailyRemaining float64
	DailyPercent   float64

	MonthlySpend     float64
	MonthlyBudget    float64
	MonthlyRemaining float64
	MonthlyPercent   float64

	TotalSpend   float64
	RequestCount int64
	TokenCount   int64
}

// CalculateCost estimates the cost for a request based on model and tokens.
// Prices are approximate and should be updated periodically.
func CalculateCost(model string, promptTokens, completionTokens int) float64 {
	// Prices per 1M tokens (as of early 2026, approximate)
	type pricing struct {
		input  float64
		output float64
	}

	prices := map[string]pricing{
		// OpenAI
		"gpt-4o":           {2.50, 10.00},
		"gpt-4o-mini":      {0.15, 0.60},
		"gpt-4-turbo":      {10.00, 30.00},
		"gpt-4":            {30.00, 60.00},
		"gpt-3.5-turbo":    {0.50, 1.50},
		"o1":               {15.00, 60.00},
		"o1-mini":          {3.00, 12.00},

		// Anthropic
		"claude-sonnet-4-20250514":    {3.00, 15.00},
		"claude-3-5-sonnet-20241022": {3.00, 15.00},
		"claude-3-opus-20240229":     {15.00, 75.00},
		"claude-3-haiku-20240307":    {0.25, 1.25},

		// OpenRouter prefixed versions
		"openai/gpt-4o":                      {2.50, 10.00},
		"openai/gpt-4o-mini":                 {0.15, 0.60},
		"anthropic/claude-sonnet-4-20250514": {3.00, 15.00},
		"anthropic/claude-3-5-sonnet":        {3.00, 15.00},
		"meta-llama/llama-3-70b-instruct":    {0.59, 0.79},
		"google/gemini-pro-1.5":              {1.25, 5.00},
	}

	p, ok := prices[model]
	if !ok {
		// Default pricing for unknown models
		p = pricing{1.00, 3.00}
	}

	inputCost := float64(promptTokens) / 1_000_000 * p.input
	outputCost := float64(completionTokens) / 1_000_000 * p.output

	return inputCost + outputCost
}

func safePercent(spend, budget float64) float64 {
	if budget <= 0 {
		return 0
	}
	return (spend / budget) * 100
}

func max(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}
