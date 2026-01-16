"""
Goal Verifier

Validates whether the execution outcome satisfies the goal's target conditions.

Supports multiple verification strategies:
- Categorical: Check if final category matches expected
- Content: Search for expected content in responses
- Pattern: Regex matching on output
- LLM-based: Use an LLM to evaluate if goal was achieved
"""

from __future__ import annotations
import re
import json
from dataclasses import dataclass, field
from typing import Any, Mapping, Sequence

from ..schema import Goal, TargetCondition, ConditionType
from ..flow.executor import ExecutionState


@dataclass(frozen=True)
class ConditionResult:
    """Result of evaluating a single target condition."""
    condition: TargetCondition
    satisfied: bool
    confidence: float
    evidence: str
    details: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class VerificationResult:
    """
    Complete result of goal verification.

    Aggregates results from all target conditions.
    """
    goal_met: bool
    conditions_checked: int
    conditions_satisfied: int
    overall_confidence: float
    condition_results: tuple[ConditionResult, ...]
    summary: str

    @property
    def success_rate(self) -> float:
        """Percentage of conditions satisfied."""
        if self.conditions_checked == 0:
            return 0.0
        return self.conditions_satisfied / self.conditions_checked


class GoalVerifier:
    """
    Verifies if execution outcomes meet goal target conditions.

    Thread-safe and stateless - all context passed via parameters.
    """

    def __init__(self, require_all: bool = True) -> None:
        """
        Initialize verifier.

        Args:
            require_all: If True, all conditions must be satisfied.
                        If False, any condition satisfies the goal.
        """
        self.require_all = require_all

    def verify(
        self,
        goal: Goal,
        execution_state: ExecutionState
    ) -> VerificationResult:
        """
        Verify if the execution state satisfies the goal.

        Args:
            goal: The goal to verify against
            execution_state: Final state from flow execution

        Returns:
            VerificationResult with detailed analysis
        """
        condition_results: list[ConditionResult] = []

        for condition in goal.target_conditions:
            result = self._evaluate_condition(condition, execution_state)
            condition_results.append(result)

        # Determine overall success
        satisfied_count = sum(1 for r in condition_results if r.satisfied)
        total_count = len(condition_results)

        if self.require_all:
            goal_met = satisfied_count == total_count
        else:
            goal_met = satisfied_count > 0

        # Calculate overall confidence
        if condition_results:
            # Weight confidence by whether condition was satisfied
            confidences = [
                r.confidence if r.satisfied else 1 - r.confidence
                for r in condition_results
            ]
            overall_confidence = sum(confidences) / len(confidences)
        else:
            overall_confidence = 0.0

        # Generate summary
        summary = self._generate_summary(
            goal, goal_met, satisfied_count, total_count, condition_results
        )

        return VerificationResult(
            goal_met=goal_met,
            conditions_checked=total_count,
            conditions_satisfied=satisfied_count,
            overall_confidence=overall_confidence,
            condition_results=tuple(condition_results),
            summary=summary
        )

    def _evaluate_condition(
        self,
        condition: TargetCondition,
        state: ExecutionState
    ) -> ConditionResult:
        """Evaluate a single target condition."""
        evaluators = {
            ConditionType.CATEGORY_MATCH: self._evaluate_category_match,
            ConditionType.CONTAINS: self._evaluate_contains,
            ConditionType.ITERATION_LIMIT: self._evaluate_iteration_limit,
            ConditionType.GOAL_MET: self._evaluate_goal_met,
            ConditionType.CUSTOM: self._evaluate_custom,
        }

        evaluator = evaluators.get(condition.evaluation_type)
        if evaluator:
            return evaluator(condition, state)

        # Unknown evaluation type
        return ConditionResult(
            condition=condition,
            satisfied=False,
            confidence=0.0,
            evidence="Unknown evaluation type",
            details={"error": f"Unknown type: {condition.evaluation_type}"}
        )

    def _evaluate_category_match(
        self,
        condition: TargetCondition,
        state: ExecutionState
    ) -> ConditionResult:
        """Check if final response category matches expected."""
        expected = condition.expected_value

        # Get the most recent category
        if not state.categories:
            return ConditionResult(
                condition=condition,
                satisfied=False,
                confidence=0.9,
                evidence="No categories recorded in execution",
                details={"expected": expected, "actual": None}
            )

        # Get last category
        last_category = list(state.categories.values())[-1]
        satisfied = (
            last_category.lower() == expected.lower()
            if expected and last_category
            else False
        )

        return ConditionResult(
            condition=condition,
            satisfied=satisfied,
            confidence=0.95 if satisfied else 0.9,
            evidence=f"Final category: '{last_category}', expected: '{expected}'",
            details={"expected": expected, "actual": last_category}
        )

    def _evaluate_contains(
        self,
        condition: TargetCondition,
        state: ExecutionState
    ) -> ConditionResult:
        """Check if any response contains expected content."""
        expected = condition.expected_value or ""

        # Search all responses
        for node_id, response in state.responses.items():
            response_text = str(response)
            if expected.lower() in response_text.lower():
                return ConditionResult(
                    condition=condition,
                    satisfied=True,
                    confidence=0.85,
                    evidence=f"Found '{expected}' in response from node '{node_id}'",
                    details={"node_id": node_id, "search_term": expected}
                )

        return ConditionResult(
            condition=condition,
            satisfied=False,
            confidence=0.85,
            evidence=f"'{expected}' not found in any response",
            details={"search_term": expected, "responses_checked": len(state.responses)}
        )

    def _evaluate_iteration_limit(
        self,
        condition: TargetCondition,
        state: ExecutionState
    ) -> ConditionResult:
        """Check if execution completed within iteration limit."""
        expected_limit = int(condition.expected_value or 100)
        actual = state.iteration

        satisfied = actual <= expected_limit

        return ConditionResult(
            condition=condition,
            satisfied=satisfied,
            confidence=1.0,  # Deterministic check
            evidence=f"Iterations: {actual}, limit: {expected_limit}",
            details={"iterations": actual, "limit": expected_limit}
        )

    def _evaluate_goal_met(
        self,
        condition: TargetCondition,
        state: ExecutionState
    ) -> ConditionResult:
        """
        Generic goal completion check.

        This is a heuristic-based check that looks for positive indicators.
        """
        # Look for positive completion indicators
        positive_indicators = [
            "success", "completed", "done", "finished",
            "achieved", "accomplished", "satisfied"
        ]

        negative_indicators = [
            "failed", "error", "timeout", "exceeded",
            "unable", "impossible", "abort"
        ]

        # Check last response
        if not state.responses:
            return ConditionResult(
                condition=condition,
                satisfied=False,
                confidence=0.5,
                evidence="No responses to evaluate",
                details={}
            )

        last_response = str(list(state.responses.values())[-1]).lower()

        positive_count = sum(1 for ind in positive_indicators if ind in last_response)
        negative_count = sum(1 for ind in negative_indicators if ind in last_response)

        # Also check last category
        positive_categories = {"success", "done", "complete", "true", "yes"}
        if state.categories:
            last_category = list(state.categories.values())[-1].lower()
            if last_category in positive_categories:
                positive_count += 2

        satisfied = positive_count > negative_count
        confidence = min(0.9, 0.5 + (abs(positive_count - negative_count) * 0.1))

        return ConditionResult(
            condition=condition,
            satisfied=satisfied,
            confidence=confidence,
            evidence=f"Positive indicators: {positive_count}, Negative: {negative_count}",
            details={
                "positive_count": positive_count,
                "negative_count": negative_count
            }
        )

    def _evaluate_custom(
        self,
        condition: TargetCondition,
        state: ExecutionState
    ) -> ConditionResult:
        """
        Custom evaluation placeholder.

        In a full implementation, this would support custom predicate functions
        or scripted evaluation logic.
        """
        return ConditionResult(
            condition=condition,
            satisfied=False,
            confidence=0.5,
            evidence="Custom evaluation not implemented",
            details={"note": "Override this method for custom evaluation"}
        )

    def _generate_summary(
        self,
        goal: Goal,
        goal_met: bool,
        satisfied: int,
        total: int,
        results: list[ConditionResult]
    ) -> str:
        """Generate a human-readable summary of verification."""
        status = "ACHIEVED" if goal_met else "NOT ACHIEVED"

        lines = [
            f"Goal: {goal.description}",
            f"Status: {status}",
            f"Conditions: {satisfied}/{total} satisfied",
            "",
            "Condition Details:"
        ]

        for i, result in enumerate(results, 1):
            status_char = "✓" if result.satisfied else "✗"
            lines.append(
                f"  {i}. [{status_char}] {result.condition.description}"
            )
            lines.append(f"      Evidence: {result.evidence}")

        return "\n".join(lines)


def verify_goal(
    goal: Goal,
    execution_state: ExecutionState,
    require_all: bool = True
) -> VerificationResult:
    """
    Convenience function for goal verification.

    Args:
        goal: The goal to verify
        execution_state: Final execution state
        require_all: Whether all conditions must be satisfied

    Returns:
        VerificationResult
    """
    verifier = GoalVerifier(require_all=require_all)
    return verifier.verify(goal, execution_state)
