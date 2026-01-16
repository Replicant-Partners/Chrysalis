//! Cost Control
//!
//! Token counting, budget tracking, and rate limiting for LLM operations.

use std::sync::{Arc, RwLock};

/// Model pricing information
#[derive(Debug, Clone)]
pub struct ModelPricing {
    pub model: String,
    pub cost_per_1k_tokens: f64,
    pub chars_per_token: f32,
}

/// Budget limits
#[derive(Debug, Clone)]
pub struct BudgetLimits {
    pub daily_limit_usd: Option<f64>,
    pub monthly_limit_usd: Option<f64>,
    pub per_operation_limit_usd: Option<f64>,
}

/// Usage statistics
#[derive(Debug, Clone, Default)]
pub struct UsageStats {
    pub total_tokens: u64,
    pub total_cost_usd: f64,
    pub operation_count: u64,
}

/// Budget tracker
pub struct BudgetTracker {
    limits: BudgetLimits,
    usage: Arc<RwLock<UsageStats>>,
}

impl BudgetTracker {
    pub fn new(limits: BudgetLimits) -> Self {
        Self {
            limits,
            usage: Arc::new(RwLock::new(UsageStats::default())),
        }
    }

    /// Estimate token count for text
    pub fn estimate_tokens(text: &str, model: &ModelPricing) -> u32 {
        // Character-based heuristic (TODO: More sophisticated tokenization)
        (text.len() as f32 / model.chars_per_token).ceil() as u32
    }

    /// Check if operation is within budget
    pub fn check_budget(&self, _estimated_cost: f64) -> Result<(), BudgetError> {
        // TODO: Implement budget checking logic
        Ok(())
    }

    /// Record usage
    pub fn record_usage(&self, tokens: u64, cost: f64) {
        let mut usage = self.usage.write().unwrap();
        usage.total_tokens += tokens;
        usage.total_cost_usd += cost;
        usage.operation_count += 1;
    }

    /// Get current usage statistics
    pub fn get_stats(&self) -> UsageStats {
        self.usage.read().unwrap().clone()
    }
}

/// Budget errors
#[derive(Debug, thiserror::Error)]
pub enum BudgetError {
    #[error("Daily budget exceeded")]
    DailyLimitExceeded,

    #[error("Monthly budget exceeded")]
    MonthlyLimitExceeded,

    #[error("Operation cost exceeds limit: {0} USD")]
    OperationLimitExceeded(f64),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_estimate_tokens() {
        let pricing = ModelPricing {
            model: "gpt-4".to_string(),
            cost_per_1k_tokens: 0.03,
            chars_per_token: 4.0,
        };

        let text = "Hello, world!";
        let tokens = BudgetTracker::estimate_tokens(text, &pricing);
        assert!(tokens > 0);
    }
}
