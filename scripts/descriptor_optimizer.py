#!/usr/bin/env python3
"""
Descriptor Selection Optimizer

Extends the existing ML scaffold with adaptive tuning mechanisms for
descriptor selection strategies based on observed effectiveness.

Features:
    - OODA loop-based optimization (Observe → Orient → Decide → Act)
    - Multi-armed bandit exploration/exploitation
    - Parameter history tracking
    - Predictive model for strategy selection
"""

import json
import math
import random
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

PROJECT_ROOT = Path(__file__).parent.parent
HARNESS_LOG = PROJECT_ROOT / "Replicants" / "legends" / "Embeddings" / "harness_log.jsonl"
OPTIMIZER_DB = PROJECT_ROOT / "Replicants" / "legends" / "Embeddings" / "optimizer_state.db"


@dataclass
class StrategyArm:
    """Multi-armed bandit arm for a descriptor selection strategy."""
    name: str
    successes: int = 0
    failures: int = 0
    total_reward: float = 0.0
    pull_count: int = 0
    avg_embedding_quality: float = 0.5
    avg_skill_count: float = 5.0
    avg_duration_sec: float = 1.0

    @property
    def estimated_value(self) -> float:
        """Thompson sampling estimate."""
        if self.pull_count == 0:
            return 0.5
        # Beta distribution parameters
        alpha = self.successes + 1
        beta = self.failures + 1
        return random.betavariate(alpha, beta)

    def ucb_value(self, total_pulls: int, c: float = 2.0) -> float:
        """Upper Confidence Bound value."""
        if self.pull_count == 0:
            return float("inf")
        exploitation = self.total_reward / self.pull_count
        exploration = c * math.sqrt(math.log(total_pulls) / self.pull_count)
        return exploitation + exploration

    def update(self, reward: float, skill_count: int, duration_sec: float):
        """Update arm statistics after a pull."""
        self.pull_count += 1
        self.total_reward += reward
        if reward > 0.5:
            self.successes += 1
        else:
            self.failures += 1
        # Exponential moving average
        alpha = 0.1
        self.avg_skill_count = alpha * skill_count + (1 - alpha) * self.avg_skill_count
        self.avg_duration_sec = alpha * duration_sec + (1 - alpha) * self.avg_duration_sec


@dataclass
class ParameterAdjustment:
    """Record of a parameter adjustment."""
    timestamp: str
    parameter: str
    old_value: Any
    new_value: Any
    reason: str
    predicted_impact: float
    actual_impact: Optional[float] = None


@dataclass 
class OptimizerState:
    """Complete optimizer state for persistence."""
    strategy_arms: Dict[str, StrategyArm]
    bucket_weights: Dict[str, float]
    adjustment_history: List[ParameterAdjustment]
    exploration_rate: float = 0.2
    total_iterations: int = 0


class DescriptorOptimizer:
    """
    Adaptive optimizer for descriptor selection strategies.
    
    Uses multi-armed bandit algorithms and OODA loop patterns to
    continuously improve descriptor selection effectiveness.
    """

    DESCRIPTOR_BUCKETS = [
        "core_traits",
        "values",
        "primary_capabilities",
        "secondary_capabilities",
        "quirks",
        "signature_phrases",
    ]

    DEFAULT_BUCKET_WEIGHTS = {
        "core_traits": 1.0,
        "values": 0.9,
        "primary_capabilities": 0.85,
        "secondary_capabilities": 0.7,
        "quirks": 0.5,
        "signature_phrases": 0.6,
    }

    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or OPTIMIZER_DB
        self.state = self._load_or_init_state()
        self._init_db()

    def _load_or_init_state(self) -> OptimizerState:
        """Load state from disk or initialize new state."""
        state_file = self.db_path.parent / "optimizer_state.json"
        if state_file.exists():
            try:
                with open(state_file) as f:
                    data = json.load(f)
                return OptimizerState(
                    strategy_arms={
                        k: StrategyArm(**v) for k, v in data.get("strategy_arms", {}).items()
                    },
                    bucket_weights=data.get("bucket_weights", self.DEFAULT_BUCKET_WEIGHTS.copy()),
                    adjustment_history=[
                        ParameterAdjustment(**adj) for adj in data.get("adjustment_history", [])
                    ],
                    exploration_rate=data.get("exploration_rate", 0.2),
                    total_iterations=data.get("total_iterations", 0),
                )
            except Exception as e:
                print(f"Warning: Could not load state: {e}")
        
        return OptimizerState(
            strategy_arms={
                "focused": StrategyArm(name="focused"),
                "diverse": StrategyArm(name="diverse"),
                "hybrid": StrategyArm(name="hybrid"),
            },
            bucket_weights=self.DEFAULT_BUCKET_WEIGHTS.copy(),
            adjustment_history=[],
        )

    def _save_state(self):
        """Persist state to disk."""
        state_file = self.db_path.parent / "optimizer_state.json"
        data = {
            "strategy_arms": {
                k: {
                    "name": v.name,
                    "successes": v.successes,
                    "failures": v.failures,
                    "total_reward": v.total_reward,
                    "pull_count": v.pull_count,
                    "avg_embedding_quality": v.avg_embedding_quality,
                    "avg_skill_count": v.avg_skill_count,
                    "avg_duration_sec": v.avg_duration_sec,
                }
                for k, v in self.state.strategy_arms.items()
            },
            "bucket_weights": self.state.bucket_weights,
            "adjustment_history": [
                {
                    "timestamp": adj.timestamp,
                    "parameter": adj.parameter,
                    "old_value": adj.old_value,
                    "new_value": adj.new_value,
                    "reason": adj.reason,
                    "predicted_impact": adj.predicted_impact,
                    "actual_impact": adj.actual_impact,
                }
                for adj in self.state.adjustment_history[-100:]  # Keep last 100
            ],
            "exploration_rate": self.state.exploration_rate,
            "total_iterations": self.state.total_iterations,
        }
        with open(state_file, "w") as f:
            json.dump(data, f, indent=2)

    def _init_db(self):
        """Initialize SQLite database for telemetry."""
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS optimization_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                event_type TEXT NOT NULL,
                strategy TEXT,
                legend_name TEXT,
                reward REAL,
                skill_count INTEGER,
                duration_sec REAL,
                meta TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS parameter_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                parameter TEXT NOT NULL,
                old_value TEXT,
                new_value TEXT,
                reason TEXT,
                predicted_impact REAL,
                actual_impact REAL
            )
        """)
        conn.commit()
        conn.close()

    # ===== OODA Loop Methods =====

    def observe(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Observe: Collect current system state and recent performance.
        
        Returns observations about:
        - Strategy arm statistics
        - Recent run metrics
        - Bucket weight effectiveness
        """
        observations = {
            "timestamp": datetime.now().isoformat(),
            "total_iterations": self.state.total_iterations,
            "exploration_rate": self.state.exploration_rate,
            "strategy_stats": {},
            "bucket_stats": {},
            "recent_performance": [],
        }

        # Gather strategy arm statistics
        for name, arm in self.state.strategy_arms.items():
            observations["strategy_stats"][name] = {
                "pull_count": arm.pull_count,
                "successes": arm.successes,
                "failures": arm.failures,
                "avg_reward": arm.total_reward / max(arm.pull_count, 1),
                "avg_skill_count": arm.avg_skill_count,
                "avg_duration_sec": arm.avg_duration_sec,
                "ucb_value": arm.ucb_value(self.state.total_iterations) if self.state.total_iterations > 0 else 0.5,
            }

        # Gather bucket weight stats
        observations["bucket_stats"] = self.state.bucket_weights.copy()

        # Load recent performance from harness log
        if HARNESS_LOG.exists():
            with open(HARNESS_LOG) as f:
                lines = f.readlines()[-10:]  # Last 10 entries
                for line in lines:
                    try:
                        entry = json.loads(line)
                        observations["recent_performance"].append({
                            "name": entry.get("name"),
                            "strategy": entry.get("strategy"),
                            "kb_runs": len(entry.get("knowledge_builder_runs", [])),
                            "sb_runs": len(entry.get("skill_builder_runs", [])),
                        })
                    except json.JSONDecodeError:
                        pass

        return observations

    def orient(self, observations: Dict[str, Any]) -> Dict[str, Any]:
        """
        Orient: Analyze observations and identify optimization opportunities.
        
        Returns analysis including:
        - Strategy recommendations
        - Bucket weight adjustments
        - Exploration/exploitation balance
        """
        analysis = {
            "timestamp": datetime.now().isoformat(),
            "recommendations": [],
            "bucket_adjustments": {},
            "strategy_recommendation": None,
        }

        strategy_stats = observations.get("strategy_stats", {})

        # Identify best-performing strategy
        best_strategy = None
        best_avg_reward = -1
        for name, stats in strategy_stats.items():
            avg_reward = stats.get("avg_reward", 0)
            if stats.get("pull_count", 0) >= 5 and avg_reward > best_avg_reward:
                best_avg_reward = avg_reward
                best_strategy = name

        if best_strategy:
            analysis["strategy_recommendation"] = {
                "strategy": best_strategy,
                "confidence": min(1.0, strategy_stats[best_strategy]["pull_count"] / 20),
                "avg_reward": best_avg_reward,
            }
            analysis["recommendations"].append(
                f"Best performing strategy: {best_strategy} (avg reward: {best_avg_reward:.3f})"
            )

        # Check for underexplored strategies
        for name, stats in strategy_stats.items():
            if stats.get("pull_count", 0) < 5:
                analysis["recommendations"].append(
                    f"Strategy '{name}' is underexplored ({stats.get('pull_count', 0)} pulls). Consider more exploration."
                )

        # Analyze bucket weights
        bucket_stats = observations.get("bucket_stats", {})
        if bucket_stats:
            avg_weight = sum(bucket_stats.values()) / len(bucket_stats)
            for bucket, weight in bucket_stats.items():
                if weight < avg_weight * 0.5:
                    analysis["bucket_adjustments"][bucket] = {
                        "current": weight,
                        "suggested": avg_weight * 0.7,
                        "reason": "underweighted",
                    }

        # Exploration rate adjustment
        if self.state.total_iterations > 50 and self.state.exploration_rate > 0.1:
            analysis["recommendations"].append(
                f"Consider reducing exploration rate from {self.state.exploration_rate:.2f} to {self.state.exploration_rate * 0.9:.2f}"
            )

        return analysis

    def decide(self, analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Decide: Generate specific actions based on analysis.
        
        Returns a list of actions to execute.
        """
        actions = []

        # Strategy selection action
        if random.random() < self.state.exploration_rate:
            # Exploration: random strategy
            strategy = random.choice(list(self.state.strategy_arms.keys()))
            actions.append({
                "type": "select_strategy",
                "strategy": strategy,
                "reason": "exploration",
            })
        else:
            # Exploitation: use UCB or best-known
            total_pulls = sum(arm.pull_count for arm in self.state.strategy_arms.values())
            best_strategy = max(
                self.state.strategy_arms.items(),
                key=lambda x: x[1].ucb_value(max(total_pulls, 1))
            )[0]
            actions.append({
                "type": "select_strategy",
                "strategy": best_strategy,
                "reason": "exploitation_ucb",
            })

        # Bucket weight adjustment actions
        for bucket, adjustment in analysis.get("bucket_adjustments", {}).items():
            actions.append({
                "type": "adjust_bucket_weight",
                "bucket": bucket,
                "old_value": adjustment["current"],
                "new_value": adjustment["suggested"],
                "reason": adjustment["reason"],
            })

        # Exploration rate decay
        if self.state.total_iterations > 50 and self.state.exploration_rate > 0.05:
            new_rate = self.state.exploration_rate * 0.95
            actions.append({
                "type": "adjust_exploration_rate",
                "old_value": self.state.exploration_rate,
                "new_value": new_rate,
                "reason": "scheduled_decay",
            })

        return actions

    def act(self, actions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Act: Execute decided actions and record results.
        
        Returns execution results.
        """
        results = {
            "timestamp": datetime.now().isoformat(),
            "actions_executed": [],
            "selected_strategy": None,
        }

        for action in actions:
            action_type = action.get("type")

            if action_type == "select_strategy":
                results["selected_strategy"] = action["strategy"]
                results["actions_executed"].append({
                    "type": action_type,
                    "strategy": action["strategy"],
                    "reason": action["reason"],
                })

            elif action_type == "adjust_bucket_weight":
                bucket = action["bucket"]
                old_val = self.state.bucket_weights.get(bucket, 0.5)
                new_val = action["new_value"]
                self.state.bucket_weights[bucket] = new_val
                
                adjustment = ParameterAdjustment(
                    timestamp=datetime.now().isoformat(),
                    parameter=f"bucket_weight.{bucket}",
                    old_value=old_val,
                    new_value=new_val,
                    reason=action["reason"],
                    predicted_impact=0.05,
                )
                self.state.adjustment_history.append(adjustment)
                results["actions_executed"].append({
                    "type": action_type,
                    "bucket": bucket,
                    "old_value": old_val,
                    "new_value": new_val,
                })

            elif action_type == "adjust_exploration_rate":
                old_rate = self.state.exploration_rate
                new_rate = action["new_value"]
                self.state.exploration_rate = new_rate
                
                adjustment = ParameterAdjustment(
                    timestamp=datetime.now().isoformat(),
                    parameter="exploration_rate",
                    old_value=old_rate,
                    new_value=new_rate,
                    reason=action["reason"],
                    predicted_impact=0.02,
                )
                self.state.adjustment_history.append(adjustment)
                results["actions_executed"].append({
                    "type": action_type,
                    "old_value": old_rate,
                    "new_value": new_rate,
                })

        self._save_state()
        return results

    # ===== Main Interface =====

    def recommend_strategy(self, legend_name: str = "") -> Tuple[str, str]:
        """
        Run OODA loop and recommend a strategy for the next run.
        
        Returns (strategy_name, reason).
        """
        observations = self.observe({"legend_name": legend_name})
        analysis = self.orient(observations)
        actions = self.decide(analysis)
        results = self.act(actions)

        return results.get("selected_strategy", "hybrid"), actions[0].get("reason", "default")

    def record_outcome(
        self,
        strategy: str,
        legend_name: str,
        skill_count: int,
        duration_sec: float,
        embedding_quality: float = 0.5,
        error: bool = False,
    ):
        """
        Record the outcome of a builder run for learning.
        """
        if strategy not in self.state.strategy_arms:
            self.state.strategy_arms[strategy] = StrategyArm(name=strategy)

        arm = self.state.strategy_arms[strategy]
        
        # Calculate reward (0-1 scale)
        if error:
            reward = 0.0
        else:
            # Reward based on skill count and duration
            skill_reward = min(1.0, skill_count / 10)  # Max at 10 skills
            duration_penalty = max(0, 1 - duration_sec / 5)  # Penalty for >5s
            reward = 0.6 * skill_reward + 0.2 * duration_penalty + 0.2 * embedding_quality

        arm.update(reward, skill_count, duration_sec)
        self.state.total_iterations += 1
        
        # Persist to DB
        conn = sqlite3.connect(self.db_path)
        conn.execute(
            """
            INSERT INTO optimization_events 
            (timestamp, event_type, strategy, legend_name, reward, skill_count, duration_sec, meta)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                datetime.now().isoformat(),
                "run_outcome",
                strategy,
                legend_name,
                reward,
                skill_count,
                duration_sec,
                json.dumps({"error": error, "embedding_quality": embedding_quality}),
            ),
        )
        conn.commit()
        conn.close()

        self._save_state()

    def get_weighted_descriptors(
        self,
        descriptors: Dict[str, List[str]],
        max_count: int = 15,
    ) -> List[str]:
        """
        Select descriptors using current bucket weights.
        """
        weighted_items: List[Tuple[str, float]] = []
        
        for bucket, items in descriptors.items():
            weight = self.state.bucket_weights.get(bucket, 0.5)
            for item in items:
                weighted_items.append((item, weight))

        # Sort by weight (with some randomness) and select top N
        random.shuffle(weighted_items)  # Shuffle first for tie-breaking
        weighted_items.sort(key=lambda x: -x[1])
        
        selected = []
        seen = set()
        for item, _ in weighted_items:
            if item not in seen:
                selected.append(item)
                seen.add(item)
            if len(selected) >= max_count:
                break

        return selected

    def generate_report(self) -> str:
        """Generate an optimization status report."""
        report = []
        report.append("=" * 60)
        report.append("DESCRIPTOR OPTIMIZER STATUS REPORT")
        report.append("=" * 60)
        report.append(f"Total Iterations: {self.state.total_iterations}")
        report.append(f"Exploration Rate: {self.state.exploration_rate:.2%}")
        report.append("")
        
        report.append("## STRATEGY ARM STATISTICS")
        report.append("-" * 50)
        for name, arm in self.state.strategy_arms.items():
            report.append(f"\n{name.upper()}")
            report.append(f"  Pulls: {arm.pull_count}")
            report.append(f"  Successes: {arm.successes}")
            report.append(f"  Failures: {arm.failures}")
            report.append(f"  Avg Reward: {arm.total_reward / max(arm.pull_count, 1):.3f}")
            report.append(f"  Avg Skills: {arm.avg_skill_count:.1f}")
            report.append(f"  Avg Duration: {arm.avg_duration_sec:.2f}s")
        report.append("")
        
        report.append("## BUCKET WEIGHTS")
        report.append("-" * 50)
        for bucket, weight in sorted(self.state.bucket_weights.items(), key=lambda x: -x[1]):
            report.append(f"  {bucket:<25} {weight:.2f}")
        report.append("")
        
        report.append("## RECENT ADJUSTMENTS (Last 10)")
        report.append("-" * 50)
        for adj in self.state.adjustment_history[-10:]:
            report.append(f"  {adj.timestamp[:19]} | {adj.parameter}: {adj.old_value} → {adj.new_value} ({adj.reason})")
        report.append("")
        
        report.append("=" * 60)
        return "\n".join(report)


def main():
    """Demo and test the optimizer."""
    optimizer = DescriptorOptimizer()
    
    # Run OODA loop
    print("Running OODA loop...")
    strategy, reason = optimizer.recommend_strategy("test_legend")
    print(f"Recommended strategy: {strategy} (reason: {reason})")
    
    # Simulate some outcomes
    print("\nSimulating outcomes...")
    test_outcomes = [
        ("focused", "ada_lovelace", 5, 0.8, 0.7, False),
        ("diverse", "bob_ross", 7, 1.2, 0.6, False),
        ("hybrid", "bruce_schneier", 4, 0.9, 0.8, False),
        ("focused", "frida_kahlo", 6, 0.7, 0.75, False),
        ("diverse", "ludwig_wittgenstein", 3, 1.5, 0.5, False),
    ]
    
    for strat, name, skills, dur, qual, err in test_outcomes:
        optimizer.record_outcome(strat, name, skills, dur, qual, err)
        print(f"  Recorded: {strat} for {name} - {skills} skills, {dur:.1f}s")
    
    # Generate report
    print("\n" + optimizer.generate_report())


if __name__ == "__main__":
    main()