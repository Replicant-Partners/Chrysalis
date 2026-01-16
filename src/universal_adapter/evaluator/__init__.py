"""
Evaluator Module - Response Categorization and Analysis

Categorizes LLM outputs according to criteria defined in the flow diagram
and triggers corresponding branch or iteration logic.
"""

from .categorizer import (
    ResponseCategorizer,
    CategoryCriteria,
    CategoryMatch,
    EvaluationResult,
)

__all__ = [
    'ResponseCategorizer',
    'CategoryCriteria',
    'CategoryMatch',
    'EvaluationResult',
]
