"""
Verifier Module - Goal Verification

Performs final completion validation by comparing process outcomes
against the natural language goal description to confirm target
condition achievement.
"""

from .goal_verifier import GoalVerifier, VerificationResult

__all__ = [
    'GoalVerifier',
    'VerificationResult',
]
