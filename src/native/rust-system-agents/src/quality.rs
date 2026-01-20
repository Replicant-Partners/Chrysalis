//! Quality Tools for System Agents
//!
//! Rust implementation of quality evaluation and code review tools
//! for the system agents. Provides evaluation metrics, scorecards,
//! and recommendation generation.
//!
//! Ported from TypeScript quality tools.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// =============================================================================
// Evaluation Types
// =============================================================================

/// Evaluation dimension with score and details
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DimensionScore {
    pub name: String,
    pub score: f32,
    pub weight: f32,
    pub weighted_score: f32,
    pub reasoning: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub evidence: Option<Vec<String>>,
}

/// Complete evaluation scorecard
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Scorecard {
    pub dimensions: Vec<DimensionScore>,
    pub total_score: f32,
    pub normalized_score: f32, // 0-1 range
    pub confidence: f32,
    pub timestamp: String,
}

impl Scorecard {
    /// Calculate total and normalized scores
    pub fn calculate_totals(&mut self) {
        let total_weight: f32 = self.dimensions.iter().map(|d| d.weight).sum();
        let weighted_sum: f32 = self.dimensions.iter().map(|d| d.weighted_score).sum();

        self.total_score = if total_weight > 0.0 {
            weighted_sum / total_weight * 10.0 // Scale to 0-10
        } else {
            0.0
        };

        self.normalized_score = self.total_score / 10.0;
    }
}

/// Evaluation recommendation
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Recommendation {
    pub id: String,
    pub category: RecommendationCategory,
    pub priority: RecommendationPriority,
    pub title: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub suggested_action: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub affected_dimensions: Option<Vec<String>>,
}

/// Categories of recommendations
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RecommendationCategory {
    Structure,
    Composability,
    Performance,
    Security,
    Maintainability,
    Testing,
    Documentation,
    Patterns,
}

/// Priority levels for recommendations
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
pub enum RecommendationPriority {
    Critical,
    High,
    Medium,
    Low,
    Info,
}

/// Complete evaluation result
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvaluationResult {
    pub id: String,
    pub artifact_type: ArtifactType,
    pub artifact_id: String,
    pub evaluator_id: String,
    pub scorecard: Scorecard,
    pub recommendations: Vec<Recommendation>,
    pub risk_score: f32,
    pub requires_human_review: bool,
    pub summary: String,
    pub timestamp: String,
}

/// Types of artifacts that can be evaluated
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ArtifactType {
    Code,
    Architecture,
    Design,
    Prompt,
    Response,
    Workflow,
    Configuration,
    Documentation,
}

// =============================================================================
// Evaluation Engine
// =============================================================================

/// Configuration for an evaluation dimension
#[derive(Clone, Debug)]
pub struct DimensionConfig {
    pub name: String,
    pub weight: f32,
    pub description: String,
    pub min_threshold: f32,
    pub criteria: Vec<String>,
}

/// The evaluation engine
pub struct EvaluationEngine {
    dimensions: HashMap<String, DimensionConfig>,
    risk_thresholds: RiskThresholds,
}

/// Risk threshold configuration
#[derive(Clone, Debug)]
pub struct RiskThresholds {
    pub auto_approve_max: f32,
    pub supervised_min: f32,
    pub supervised_max: f32,
    pub human_approval_min: f32,
    pub critical_bypass: f32,
}

impl Default for RiskThresholds {
    fn default() -> Self {
        RiskThresholds {
            auto_approve_max: 0.3,
            supervised_min: 0.3,
            supervised_max: 0.7,
            human_approval_min: 0.7,
            critical_bypass: 0.9,
        }
    }
}

impl EvaluationEngine {
    /// Create a new evaluation engine
    pub fn new() -> Self {
        let mut dimensions = HashMap::new();

        // Default dimensions (Ada-style)
        dimensions.insert(
            "structural_elegance".to_string(),
            DimensionConfig {
                name: "Structural Elegance".to_string(),
                weight: 0.25,
                description: "Measures architectural clarity and mathematical beauty".to_string(),
                min_threshold: 5.0,
                criteria: vec![
                    "Clear separation of concerns".to_string(),
                    "Consistent patterns".to_string(),
                    "Minimal complexity".to_string(),
                ],
            },
        );

        dimensions.insert(
            "composability".to_string(),
            DimensionConfig {
                name: "Composability".to_string(),
                weight: 0.25,
                description: "Evaluates how well components combine and interact".to_string(),
                min_threshold: 5.0,
                criteria: vec![
                    "Interface cohesion".to_string(),
                    "Loose coupling".to_string(),
                    "Reusability".to_string(),
                ],
            },
        );

        dimensions.insert(
            "reasoning_efficiency".to_string(),
            DimensionConfig {
                name: "Reasoning Chain Efficiency".to_string(),
                weight: 0.20,
                description: "Assesses logical flow and computational efficiency".to_string(),
                min_threshold: 4.0,
                criteria: vec![
                    "Clear logic flow".to_string(),
                    "Minimal redundancy".to_string(),
                    "Efficient algorithms".to_string(),
                ],
            },
        );

        dimensions.insert(
            "pattern_novelty".to_string(),
            DimensionConfig {
                name: "Pattern Novelty".to_string(),
                weight: 0.15,
                description: "Identifies innovative approaches".to_string(),
                min_threshold: 3.0,
                criteria: vec![
                    "Novel solutions".to_string(),
                    "Cross-domain application".to_string(),
                ],
            },
        );

        dimensions.insert(
            "cross_domain_potential".to_string(),
            DimensionConfig {
                name: "Cross-Domain Potential".to_string(),
                weight: 0.15,
                description: "Evaluates applicability beyond immediate context".to_string(),
                min_threshold: 3.0,
                criteria: vec![
                    "Generalizability".to_string(),
                    "Abstraction level".to_string(),
                ],
            },
        );

        EvaluationEngine {
            dimensions,
            risk_thresholds: RiskThresholds::default(),
        }
    }

    /// Create with custom dimensions
    pub fn with_dimensions(dimensions: HashMap<String, DimensionConfig>) -> Self {
        EvaluationEngine {
            dimensions,
            risk_thresholds: RiskThresholds::default(),
        }
    }

    /// Set risk thresholds
    pub fn set_risk_thresholds(&mut self, thresholds: RiskThresholds) {
        self.risk_thresholds = thresholds;
    }

    /// Create a scorecard with dimension scores
    pub fn create_scorecard(&self, scores: HashMap<String, (f32, String)>) -> Scorecard {
        let mut dimension_scores = Vec::new();

        for (name, config) in &self.dimensions {
            if let Some((score, reasoning)) = scores.get(name) {
                let weighted_score = score * config.weight;
                dimension_scores.push(DimensionScore {
                    name: config.name.clone(),
                    score: *score,
                    weight: config.weight,
                    weighted_score,
                    reasoning: reasoning.clone(),
                    evidence: None,
                });
            }
        }

        let mut scorecard = Scorecard {
            dimensions: dimension_scores,
            total_score: 0.0,
            normalized_score: 0.0,
            confidence: 0.8, // Default confidence
            timestamp: chrono::Utc::now().to_rfc3339(),
        };

        scorecard.calculate_totals();
        scorecard
    }

    /// Calculate risk score from scorecard
    pub fn calculate_risk_score(&self, scorecard: &Scorecard) -> f32 {
        // Risk is inverse of normalized score with some adjustments
        let base_risk = 1.0 - scorecard.normalized_score;

        // Check for any dimensions below threshold
        let mut threshold_violations = 0;
        for dim in &scorecard.dimensions {
            if let Some(config) = self.dimensions.get(&dim.name.to_lowercase().replace(' ', "_")) {
                if dim.score < config.min_threshold {
                    threshold_violations += 1;
                }
            }
        }

        // Increase risk for threshold violations
        let violation_penalty = threshold_violations as f32 * 0.1;

        (base_risk + violation_penalty).min(1.0)
    }

    /// Determine if human review is required
    pub fn requires_human_review(&self, risk_score: f32) -> bool {
        risk_score >= self.risk_thresholds.human_approval_min
    }

    /// Generate recommendations based on scorecard
    pub fn generate_recommendations(&self, scorecard: &Scorecard) -> Vec<Recommendation> {
        let mut recommendations = Vec::new();

        for dim in &scorecard.dimensions {
            let dim_key = dim.name.to_lowercase().replace(' ', "_");

            if let Some(config) = self.dimensions.get(&dim_key) {
                if dim.score < config.min_threshold {
                    let priority = if dim.score < config.min_threshold * 0.5 {
                        RecommendationPriority::High
                    } else {
                        RecommendationPriority::Medium
                    };

                    recommendations.push(Recommendation {
                        id: uuid::Uuid::new_v4().to_string(),
                        category: self.dimension_to_category(&dim_key),
                        priority,
                        title: format!("Improve {}", dim.name),
                        description: format!(
                            "{} scored {:.1}/10, below the threshold of {:.1}. {}",
                            dim.name, dim.score, config.min_threshold, dim.reasoning
                        ),
                        suggested_action: Some(format!("Review criteria: {:?}", config.criteria)),
                        affected_dimensions: Some(vec![dim.name.clone()]),
                    });
                }
            }
        }

        // Sort by priority
        recommendations.sort_by(|a, b| a.priority.cmp(&b.priority));
        recommendations
    }

    /// Map dimension to recommendation category
    fn dimension_to_category(&self, dimension: &str) -> RecommendationCategory {
        match dimension {
            "structural_elegance" => RecommendationCategory::Structure,
            "composability" => RecommendationCategory::Composability,
            "reasoning_efficiency" => RecommendationCategory::Performance,
            "pattern_novelty" => RecommendationCategory::Patterns,
            "cross_domain_potential" => RecommendationCategory::Patterns,
            _ => RecommendationCategory::Structure,
        }
    }

    /// Perform a complete evaluation
    pub fn evaluate(
        &self,
        artifact_type: ArtifactType,
        artifact_id: &str,
        evaluator_id: &str,
        scores: HashMap<String, (f32, String)>,
    ) -> EvaluationResult {
        let scorecard = self.create_scorecard(scores);
        let risk_score = self.calculate_risk_score(&scorecard);
        let requires_review = self.requires_human_review(risk_score);
        let recommendations = self.generate_recommendations(&scorecard);

        let summary = format!(
            "Evaluation complete. Score: {:.1}/10, Risk: {:.1}%, {} recommendations. {}",
            scorecard.total_score,
            risk_score * 100.0,
            recommendations.len(),
            if requires_review { "Human review required." } else { "Auto-approve eligible." }
        );

        EvaluationResult {
            id: uuid::Uuid::new_v4().to_string(),
            artifact_type,
            artifact_id: artifact_id.to_string(),
            evaluator_id: evaluator_id.to_string(),
            scorecard,
            recommendations,
            risk_score,
            requires_human_review: requires_review,
            summary,
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    }
}

impl Default for EvaluationEngine {
    fn default() -> Self {
        Self::new()
    }
}

// =============================================================================
// Code Review Tools
// =============================================================================

/// Code review issue
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeReviewIssue {
    pub id: String,
    pub severity: IssueSeverity,
    pub category: IssueCategory,
    pub file_path: Option<String>,
    pub line_number: Option<u32>,
    pub message: String,
    pub suggestion: Option<String>,
}

/// Issue severity
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
pub enum IssueSeverity {
    Error,
    Warning,
    Info,
    Hint,
}

/// Issue category
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum IssueCategory {
    Bug,
    Security,
    Performance,
    Style,
    Complexity,
    Duplication,
    TypeSafety,
    ErrorHandling,
    Documentation,
}

/// Code review result
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeReviewResult {
    pub id: String,
    pub file_path: String,
    pub issues: Vec<CodeReviewIssue>,
    pub summary: ReviewSummary,
    pub approved: bool,
    pub reviewer_id: String,
    pub timestamp: String,
}

/// Review summary
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewSummary {
    pub total_issues: usize,
    pub errors: usize,
    pub warnings: usize,
    pub info: usize,
    pub hints: usize,
    pub overall_quality: String,
}

/// Code reviewer
pub struct CodeReviewer {
    reviewer_id: String,
    auto_approve_threshold: usize, // Max issues for auto-approve
}

impl CodeReviewer {
    pub fn new(reviewer_id: String) -> Self {
        CodeReviewer {
            reviewer_id,
            auto_approve_threshold: 0, // No errors for auto-approve
        }
    }

    /// Review code and generate issues
    pub fn review(&self, file_path: &str, issues: Vec<CodeReviewIssue>) -> CodeReviewResult {
        let errors = issues.iter().filter(|i| i.severity == IssueSeverity::Error).count();
        let warnings = issues.iter().filter(|i| i.severity == IssueSeverity::Warning).count();
        let info = issues.iter().filter(|i| i.severity == IssueSeverity::Info).count();
        let hints = issues.iter().filter(|i| i.severity == IssueSeverity::Hint).count();

        let overall_quality = if errors == 0 && warnings == 0 {
            "Excellent"
        } else if errors == 0 {
            "Good"
        } else if errors <= 2 {
            "Needs Improvement"
        } else {
            "Poor"
        };

        let summary = ReviewSummary {
            total_issues: issues.len(),
            errors,
            warnings,
            info,
            hints,
            overall_quality: overall_quality.to_string(),
        };

        let approved = errors <= self.auto_approve_threshold;

        CodeReviewResult {
            id: uuid::Uuid::new_v4().to_string(),
            file_path: file_path.to_string(),
            issues,
            summary,
            approved,
            reviewer_id: self.reviewer_id.clone(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_evaluation_engine_create_scorecard() {
        let engine = EvaluationEngine::new();

        let mut scores = HashMap::new();
        scores.insert("structural_elegance".to_string(), (8.0, "Clean architecture".to_string()));
        scores.insert("composability".to_string(), (7.5, "Good interfaces".to_string()));
        scores.insert("reasoning_efficiency".to_string(), (9.0, "Efficient logic".to_string()));

        let scorecard = engine.create_scorecard(scores);

        assert!(!scorecard.dimensions.is_empty());
        assert!(scorecard.total_score > 0.0);
        assert!(scorecard.normalized_score >= 0.0 && scorecard.normalized_score <= 1.0);
    }

    #[test]
    fn test_risk_calculation() {
        let engine = EvaluationEngine::new();

        // High scores = low risk
        let mut high_scores = HashMap::new();
        high_scores.insert("structural_elegance".to_string(), (9.0, "Excellent".to_string()));
        high_scores.insert("composability".to_string(), (9.0, "Excellent".to_string()));

        let high_scorecard = engine.create_scorecard(high_scores);
        let low_risk = engine.calculate_risk_score(&high_scorecard);

        // Low scores = high risk
        let mut low_scores = HashMap::new();
        low_scores.insert("structural_elegance".to_string(), (2.0, "Poor".to_string()));
        low_scores.insert("composability".to_string(), (2.0, "Poor".to_string()));

        let low_scorecard = engine.create_scorecard(low_scores);
        let high_risk = engine.calculate_risk_score(&low_scorecard);

        assert!(low_risk < high_risk);
    }

    #[test]
    fn test_recommendations_generation() {
        let engine = EvaluationEngine::new();

        // Scores below threshold
        let mut scores = HashMap::new();
        scores.insert("structural_elegance".to_string(), (3.0, "Needs work".to_string()));
        scores.insert("composability".to_string(), (4.0, "Below threshold".to_string()));

        let scorecard = engine.create_scorecard(scores);
        let recommendations = engine.generate_recommendations(&scorecard);

        assert!(!recommendations.is_empty());
    }

    #[test]
    fn test_code_reviewer() {
        let reviewer = CodeReviewer::new("lea".to_string());

        let issues = vec![
            CodeReviewIssue {
                id: "1".to_string(),
                severity: IssueSeverity::Warning,
                category: IssueCategory::Style,
                file_path: Some("src/main.rs".to_string()),
                line_number: Some(10),
                message: "Consider using more descriptive variable names".to_string(),
                suggestion: Some("Rename 'x' to 'count'".to_string()),
            },
        ];

        let result = reviewer.review("src/main.rs", issues);

        assert_eq!(result.summary.warnings, 1);
        assert_eq!(result.summary.errors, 0);
        assert!(result.approved); // No errors, so approved
    }
}
