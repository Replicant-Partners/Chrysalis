#!/usr/bin/env python3
"""
Descriptor Selection Pattern Analyzer

Analyzes the harness_log.jsonl to understand how different descriptor selection
strategies (focused, diverse, hybrid) affect embedding quality and skill generation.

Outputs:
    - Pattern analysis report
    - Strategy effectiveness metrics
    - Optimization recommendations
"""

import json
import statistics
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

PROJECT_ROOT = Path(__file__).parent.parent
HARNESS_LOG = PROJECT_ROOT / "Replicants" / "legends" / "Embeddings" / "harness_log.jsonl"
EMBEDDINGS_DIR = PROJECT_ROOT / "Replicants" / "legends" / "Embeddings"


@dataclass
class RunMetrics:
    """Metrics for a single builder run."""
    run_number: int
    strategy: str
    duration_sec: float
    embedding_dims: int
    skill_count: int
    descriptor_count: int
    descriptors: List[str]
    error: Optional[str] = None


@dataclass
class LegendMetrics:
    """Aggregated metrics for a legend across all runs."""
    name: str
    source_file: str
    strategy: str
    kb_runs: List[RunMetrics] = field(default_factory=list)
    sb_runs: List[RunMetrics] = field(default_factory=list)


@dataclass
class StrategyMetrics:
    """Metrics for a descriptor selection strategy."""
    strategy: str
    total_runs: int = 0
    avg_duration_sec: float = 0.0
    avg_skill_count: float = 0.0
    avg_descriptor_count: float = 0.0
    error_count: int = 0
    descriptor_frequency: Dict[str, int] = field(default_factory=dict)
    durations: List[float] = field(default_factory=list)
    skill_counts: List[int] = field(default_factory=list)


def load_harness_log() -> List[Dict[str, Any]]:
    """Load and parse the harness log."""
    entries = []
    if not HARNESS_LOG.exists():
        print(f"Harness log not found: {HARNESS_LOG}")
        return entries
    
    with open(HARNESS_LOG, "r") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    entries.append(json.loads(line))
                except json.JSONDecodeError as e:
                    print(f"Skipping malformed line: {e}")
    return entries


def extract_run_metrics(run: Dict[str, Any], source: str) -> RunMetrics:
    """Extract metrics from a single run."""
    return RunMetrics(
        run_number=run.get("run_number", 0),
        strategy=run.get("descriptor_strategy", "unknown"),
        duration_sec=run.get("duration_sec", 0.0),
        embedding_dims=run.get("embedding_dimensions", 0),
        skill_count=len(run.get("skill_embeddings", [])) if source == "skill_builder" else 0,
        descriptor_count=len(run.get("descriptors", [])),
        descriptors=run.get("descriptors", []),
        error=run.get("error"),
    )


def analyze_harness_log(entries: List[Dict[str, Any]]) -> Tuple[List[LegendMetrics], Dict[str, StrategyMetrics]]:
    """Analyze harness log entries."""
    legend_metrics = []
    strategy_metrics = {
        "focused": StrategyMetrics(strategy="focused"),
        "diverse": StrategyMetrics(strategy="diverse"),
        "hybrid": StrategyMetrics(strategy="hybrid"),
    }
    
    for entry in entries:
        legend = LegendMetrics(
            name=entry.get("name", "Unknown"),
            source_file=entry.get("source_file", ""),
            strategy=entry.get("strategy", "hybrid"),
        )
        
        # Process KnowledgeBuilder runs
        for run in entry.get("knowledge_builder_runs", []):
            metrics = extract_run_metrics(run, "knowledge_builder")
            legend.kb_runs.append(metrics)
            
            # Aggregate by strategy
            strat = metrics.strategy
            if strat in strategy_metrics:
                sm = strategy_metrics[strat]
                sm.total_runs += 1
                sm.durations.append(metrics.duration_sec)
                if metrics.error:
                    sm.error_count += 1
                for desc in metrics.descriptors:
                    sm.descriptor_frequency[desc] = sm.descriptor_frequency.get(desc, 0) + 1
        
        # Process SkillBuilder runs
        for run in entry.get("skill_builder_runs", []):
            metrics = extract_run_metrics(run, "skill_builder")
            legend.sb_runs.append(metrics)
            
            # Aggregate by strategy
            strat = metrics.strategy
            if strat in strategy_metrics:
                sm = strategy_metrics[strat]
                sm.skill_counts.append(metrics.skill_count)
        
        legend_metrics.append(legend)
    
    # Calculate averages
    for sm in strategy_metrics.values():
        if sm.durations:
            sm.avg_duration_sec = statistics.mean(sm.durations)
        if sm.skill_counts:
            sm.avg_skill_count = statistics.mean(sm.skill_counts)
    
    return legend_metrics, strategy_metrics


def compute_descriptor_overlap(legend_metrics: List[LegendMetrics]) -> Dict[str, float]:
    """Compute descriptor overlap between focused and diverse runs."""
    overlaps = []
    
    for legend in legend_metrics:
        focused_descriptors = set()
        diverse_descriptors = set()
        
        for run in legend.kb_runs + legend.sb_runs:
            if run.strategy == "focused":
                focused_descriptors.update(run.descriptors)
            elif run.strategy == "diverse":
                diverse_descriptors.update(run.descriptors)
        
        if focused_descriptors and diverse_descriptors:
            intersection = len(focused_descriptors & diverse_descriptors)
            union = len(focused_descriptors | diverse_descriptors)
            if union > 0:
                overlaps.append(intersection / union)
    
    return {
        "avg_jaccard_overlap": statistics.mean(overlaps) if overlaps else 0.0,
        "min_overlap": min(overlaps) if overlaps else 0.0,
        "max_overlap": max(overlaps) if overlaps else 0.0,
        "std_overlap": statistics.stdev(overlaps) if len(overlaps) > 1 else 0.0,
    }


def compute_run_progression(legend_metrics: List[LegendMetrics]) -> Dict[str, Any]:
    """Analyze how metrics change across runs (1→2→3)."""
    kb_durations_by_run = defaultdict(list)
    sb_durations_by_run = defaultdict(list)
    skill_counts_by_run = defaultdict(list)
    
    for legend in legend_metrics:
        for run in legend.kb_runs:
            kb_durations_by_run[run.run_number].append(run.duration_sec)
        for run in legend.sb_runs:
            sb_durations_by_run[run.run_number].append(run.duration_sec)
            skill_counts_by_run[run.run_number].append(run.skill_count)
    
    progression = {}
    for run_num in [1, 2, 3]:
        kb_dur = kb_durations_by_run.get(run_num, [])
        sb_dur = sb_durations_by_run.get(run_num, [])
        skills = skill_counts_by_run.get(run_num, [])
        
        progression[f"run_{run_num}"] = {
            "kb_avg_duration_sec": statistics.mean(kb_dur) if kb_dur else 0.0,
            "sb_avg_duration_sec": statistics.mean(sb_dur) if sb_dur else 0.0,
            "avg_skill_count": statistics.mean(skills) if skills else 0.0,
            "kb_count": len(kb_dur),
            "sb_count": len(sb_dur),
        }
    
    return progression


def identify_top_descriptors(strategy_metrics: Dict[str, StrategyMetrics], top_n: int = 15) -> Dict[str, List[Tuple[str, int]]]:
    """Identify most frequently used descriptors per strategy."""
    top_descriptors = {}
    
    for strat, sm in strategy_metrics.items():
        sorted_desc = sorted(sm.descriptor_frequency.items(), key=lambda x: -x[1])
        top_descriptors[strat] = sorted_desc[:top_n]
    
    return top_descriptors


def generate_optimization_recommendations(
    strategy_metrics: Dict[str, StrategyMetrics],
    overlap_metrics: Dict[str, float],
    progression: Dict[str, Any],
) -> List[str]:
    """Generate actionable optimization recommendations."""
    recommendations = []
    
    # Check strategy balance
    focused = strategy_metrics.get("focused", StrategyMetrics(strategy="focused"))
    diverse = strategy_metrics.get("diverse", StrategyMetrics(strategy="diverse"))
    
    if focused.total_runs > diverse.total_runs * 2:
        recommendations.append(
            "⚠️ Focused strategy is overused. Consider increasing diverse runs for broader semantic coverage."
        )
    
    # Check duration patterns
    if focused.avg_duration_sec > diverse.avg_duration_sec * 1.5:
        recommendations.append(
            f"⏱️ Focused runs take {focused.avg_duration_sec:.2f}s avg vs diverse {diverse.avg_duration_sec:.2f}s. "
            "Consider caching or batching focused descriptor computations."
        )
    
    # Check overlap
    if overlap_metrics.get("avg_jaccard_overlap", 0) > 0.7:
        recommendations.append(
            f"🔄 High descriptor overlap ({overlap_metrics['avg_jaccard_overlap']:.2%}) between strategies. "
            "Consider more distinct bucket sampling to maximize semantic diversity."
        )
    elif overlap_metrics.get("avg_jaccard_overlap", 0) < 0.3:
        recommendations.append(
            f"✅ Good descriptor diversity ({overlap_metrics['avg_jaccard_overlap']:.2%} overlap). "
            "Strategies are producing distinct semantic footprints."
        )
    
    # Check run progression
    run1 = progression.get("run_1", {})
    run3 = progression.get("run_3", {})
    
    if run3.get("avg_skill_count", 0) > run1.get("avg_skill_count", 0) * 1.2:
        recommendations.append(
            "📈 Skills increase across runs - cumulative learning is effective."
        )
    elif run3.get("avg_skill_count", 0) < run1.get("avg_skill_count", 0):
        recommendations.append(
            "📉 Skills decrease across runs. Check if prior context is being used correctly."
        )
    
    # Check error rates
    total_errors = sum(sm.error_count for sm in strategy_metrics.values())
    total_runs = sum(sm.total_runs for sm in strategy_metrics.values())
    if total_runs > 0 and total_errors / total_runs > 0.05:
        recommendations.append(
            f"🚨 High error rate ({total_errors}/{total_runs} = {total_errors/total_runs:.1%}). "
            "Review harness log for specific failures."
        )
    else:
        recommendations.append(
            f"✅ Low error rate ({total_errors}/{total_runs}). Pipeline is stable."
        )
    
    return recommendations


def generate_report(
    legend_metrics: List[LegendMetrics],
    strategy_metrics: Dict[str, StrategyMetrics],
    overlap_metrics: Dict[str, float],
    progression: Dict[str, Any],
    top_descriptors: Dict[str, List[Tuple[str, int]]],
    recommendations: List[str],
) -> str:
    """Generate a comprehensive analysis report."""
    report = []
    report.append("=" * 80)
    report.append("DESCRIPTOR SELECTION PATTERN ANALYSIS REPORT")
    report.append("=" * 80)
    report.append("")
    
    # Summary
    report.append("## SUMMARY")
    report.append(f"Total legends processed: {len(legend_metrics)}")
    total_runs = sum(sm.total_runs for sm in strategy_metrics.values())
    report.append(f"Total builder runs: {total_runs}")
    report.append("")
    
    # Strategy Metrics
    report.append("## STRATEGY METRICS")
    report.append("-" * 60)
    report.append(f"{'Strategy':<12} {'Runs':>8} {'Avg Duration':>14} {'Avg Skills':>12} {'Errors':>8}")
    report.append("-" * 60)
    for strat in ["focused", "diverse", "hybrid"]:
        sm = strategy_metrics.get(strat, StrategyMetrics(strategy=strat))
        report.append(
            f"{sm.strategy:<12} {sm.total_runs:>8} {sm.avg_duration_sec:>12.3f}s {sm.avg_skill_count:>12.1f} {sm.error_count:>8}"
        )
    report.append("")
    
    # Overlap Metrics
    report.append("## DESCRIPTOR OVERLAP (Focused vs Diverse)")
    report.append(f"  Average Jaccard Similarity: {overlap_metrics['avg_jaccard_overlap']:.2%}")
    report.append(f"  Min Overlap: {overlap_metrics['min_overlap']:.2%}")
    report.append(f"  Max Overlap: {overlap_metrics['max_overlap']:.2%}")
    report.append(f"  Std Dev: {overlap_metrics['std_overlap']:.4f}")
    report.append("")
    
    # Run Progression
    report.append("## RUN PROGRESSION (1 → 2 → 3)")
    report.append("-" * 60)
    report.append(f"{'Run':<8} {'KB Avg Dur':>12} {'SB Avg Dur':>12} {'Avg Skills':>12}")
    report.append("-" * 60)
    for run_num in [1, 2, 3]:
        run = progression.get(f"run_{run_num}", {})
        report.append(
            f"Run {run_num:<4} {run.get('kb_avg_duration_sec', 0):>10.3f}s {run.get('sb_avg_duration_sec', 0):>10.3f}s {run.get('avg_skill_count', 0):>12.1f}"
        )
    report.append("")
    
    # Top Descriptors
    report.append("## TOP DESCRIPTORS BY STRATEGY")
    for strat in ["focused", "diverse"]:
        report.append(f"\n### {strat.upper()} Strategy (Top 10)")
        for desc, count in top_descriptors.get(strat, [])[:10]:
            report.append(f"  {count:>4}x  {desc}")
    report.append("")
    
    # Recommendations
    report.append("## OPTIMIZATION RECOMMENDATIONS")
    for rec in recommendations:
        report.append(f"  • {rec}")
    report.append("")
    
    report.append("=" * 80)
    report.append("END OF REPORT")
    report.append("=" * 80)
    
    return "\n".join(report)


def main():
    """Main entry point."""
    print("Loading harness log...")
    entries = load_harness_log()
    
    if not entries:
        print("No entries found in harness log.")
        return 1
    
    print(f"Loaded {len(entries)} legend entries")
    
    print("Analyzing descriptor patterns...")
    legend_metrics, strategy_metrics = analyze_harness_log(entries)
    
    print("Computing descriptor overlap...")
    overlap_metrics = compute_descriptor_overlap(legend_metrics)
    
    print("Analyzing run progression...")
    progression = compute_run_progression(legend_metrics)
    
    print("Identifying top descriptors...")
    top_descriptors = identify_top_descriptors(strategy_metrics)
    
    print("Generating recommendations...")
    recommendations = generate_optimization_recommendations(
        strategy_metrics, overlap_metrics, progression
    )
    
    print("Generating report...")
    report = generate_report(
        legend_metrics, strategy_metrics, overlap_metrics,
        progression, top_descriptors, recommendations
    )
    
    # Output report
    print("\n" + report)
    
    # Save report
    report_path = EMBEDDINGS_DIR / "pattern_analysis_report.txt"
    with open(report_path, "w") as f:
        f.write(report)
    print(f"\nReport saved to: {report_path}")
    
    return 0


if __name__ == "__main__":
    exit(main())