"""
RAGAS-lite evaluator: judge-based context precision/recall, faithfulness, and answer correctness.

This avoids heavy dependencies and lets us swap judge models/prompts.
We rely on an LLM judge to label:
  - Is a context snippet relevant to the question/ground truth? (relevance)
  - Is the answer fully supported by the provided contexts? (faithfulness)
  - Is the answer correct vs. ground truth? (answer correctness)
"""

from dataclasses import dataclass
from typing import Callable, Dict, List, Optional, Tuple


@dataclass
class JudgePrompt:
    """Prompts used for judge decisions."""

    relevance: str
    faithfulness: str
    correctness: str


DEFAULT_PROMPTS = JudgePrompt(
    relevance=(
        "You are judging if a context snippet is relevant.\n"
        "Question: {question}\n"
        "Ground Truth Facts: {ground_truth}\n"
        "Context:\n{context}\n\n"
        "Answer only 'relevant' or 'irrelevant'."
    ),
    faithfulness=(
        "You are judging faithfulness. Decide if the answer is fully supported by the contexts.\n"
        "Question: {question}\n"
        "Contexts:\n{contexts}\n\n"
        "Answer: {answer}\n"
        "Respond with 'supported' or 'unsupported'."
    ),
    correctness=(
        "You are judging answer correctness.\n"
        "Question: {question}\n"
        "Answer: {answer}\n"
        "Ground Truth Facts: {ground_truth}\n"
        "Respond with 'correct', 'partially correct', or 'incorrect'."
    ),
)


def _call_judge(client_fn: Callable[[str], str], prompt: str) -> str:
    return client_fn(prompt).strip().lower()


def evaluate_contexts(
    question: str,
    contexts: List[str],
    ground_truth: List[str],
    judge_fn: Callable[[str], str],
    prompts: JudgePrompt = DEFAULT_PROMPTS,
) -> Tuple[float, float]:
    """
    Compute context precision/recall via LLM judge.
      precision = relevant / total contexts
      recall = relevant / len(ground_truth) (approx; assumes 1:1 fact coverage)
    """
    if not contexts:
        return 0.0, 0.0
    relevant = 0
    for ctx in contexts:
        verdict = _call_judge(
            judge_fn,
            prompts.relevance.format(question=question, ground_truth="\n".join(ground_truth), context=ctx),
        )
        if "relevant" in verdict and "irrelevant" not in verdict:
            relevant += 1
    precision = relevant / len(contexts)
    recall = relevant / max(1, len(ground_truth))
    return precision, recall


def evaluate_faithfulness(
    question: str,
    contexts: List[str],
    answer: str,
    judge_fn: Callable[[str], str],
    prompts: JudgePrompt = DEFAULT_PROMPTS,
) -> float:
    if not contexts or not answer:
        return 0.0
    verdict = _call_judge(
        judge_fn,
        prompts.faithfulness.format(question=question, contexts="\n".join(contexts), answer=answer),
    )
    return 1.0 if "supported" in verdict else 0.0


def evaluate_correctness(
    question: str,
    answer: str,
    ground_truth: List[str],
    judge_fn: Callable[[str], str],
    prompts: JudgePrompt = DEFAULT_PROMPTS,
) -> float:
    if not answer:
        return 0.0
    verdict = _call_judge(
        judge_fn,
        prompts.correctness.format(question=question, answer=answer, ground_truth="\n".join(ground_truth)),
    )
    if "correct" in verdict and "partial" not in verdict and "incorrect" not in verdict:
        return 1.0
    if "partial" in verdict:
        return 0.5
    return 0.0


def evaluate_sample(
    sample: Dict[str, object],
    judge_fn: Callable[[str], str],
    prompts: JudgePrompt = DEFAULT_PROMPTS,
) -> Dict[str, float]:
    """
    Evaluate a single sample:
      sample = {question, contexts, ground_truth, answer (optional)}
    Returns: dict with context_precision, context_recall, faithfulness, answer_correctness
    """
    question = str(sample.get("question", ""))
    contexts = [str(c) for c in sample.get("contexts", [])]
    ground_truth = [str(g) for g in sample.get("ground_truth", [])]
    answer = str(sample.get("answer", "") or "")

    precision, recall = evaluate_contexts(question, contexts, ground_truth, judge_fn, prompts)
    faith = evaluate_faithfulness(question, contexts, answer, judge_fn, prompts) if answer else 0.0
    correctness = evaluate_correctness(question, answer, ground_truth, judge_fn, prompts) if answer else 0.0
    return {
        "context_precision": precision,
        "context_recall": recall,
        "faithfulness": faith,
        "answer_correctness": correctness,
    }


def evaluate_dataset(
    samples: List[Dict[str, object]],
    judge_fn: Callable[[str], str],
    prompts: JudgePrompt = DEFAULT_PROMPTS,
) -> Dict[str, float]:
    """
    Evaluate a list of samples and return average scores.
    """
    if not samples:
        return {}
    agg = {"context_precision": 0.0, "context_recall": 0.0, "faithfulness": 0.0, "answer_correctness": 0.0}
    for s in samples:
        scores = evaluate_sample(s, judge_fn, prompts)
        for k, v in scores.items():
            agg[k] += v
    n = len(samples)
    return {k: v / n for k, v in agg.items()}
