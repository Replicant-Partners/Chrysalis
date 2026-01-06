"""Evaluation modules for RAGAS-lite judge-based scoring."""

from src.eval.judge import (
    JudgePrompt,
    DEFAULT_PROMPTS,
    evaluate_contexts,
    evaluate_faithfulness,
    evaluate_correctness,
    evaluate_sample,
    evaluate_dataset,
)

__all__ = [
    "JudgePrompt",
    "DEFAULT_PROMPTS",
    "evaluate_contexts",
    "evaluate_faithfulness",
    "evaluate_correctness",
    "evaluate_sample",
    "evaluate_dataset",
]
