"""
Agent Self-Reflection - Enable ElizaOS agents to use Ludwig for meta-cognition.

Allows agents to:
- Maintain their own knowledge graphs
- Run evaluators on their own knowledge
- Identify skill gaps and areas for improvement
- Track learning progress over time
- Learn from other agents' knowledge graphs
"""

from pathlib import Path
from typing import Any, Optional

from ludwig.evaluators import (
    CalibrationEvaluator,
    EvaluationResult,
    EvaluationState,
    EvaluatorContext,
    InteractionMode,
    KataEvaluator,
    ShannonEvaluator,
    TetlockEvaluator,
)
from ludwig.graph.knowledge_graph import KnowledgeGraphDB


class AgentKnowledgeGraph:
    """
    Knowledge graph for an individual agent.

    Separate from user's knowledge graph - tracks agent's own learnings,
    beliefs, predictions, and knowledge development.
    """

    def __init__(self, agent_name: str, base_path: str = ".ludwig/agents"):
        """
        Initialize agent knowledge graph.

        Args:
            agent_name: Name of the agent
            base_path: Base directory for agent graphs
        """
        self.agent_name = agent_name
        self.base_path = Path(base_path)
        self.graph_path = self.base_path / f"{agent_name}_knowledge.db"

        # Create directory
        self.base_path.mkdir(parents=True, exist_ok=True)

        # Initialize graph
        self.graph_db = KnowledgeGraphDB(self.graph_path)

    def add_learning(
        self,
        concept: str,
        concept_type: str,
        source: str,
        confidence: float = 0.5,
        metadata: dict[str, Any] = None,
    ):
        """
        Add a learning to agent's knowledge graph.

        Args:
            concept: What was learned
            concept_type: Type of concept
            source: Where this was learned from
            confidence: Agent's confidence in this learning (0-1)
            metadata: Additional metadata
        """
        with self.graph_db as db:
            cursor = db.conn.cursor()

            # Add entity
            cursor.execute(
                """
                INSERT OR IGNORE INTO entities (name, type, source_file, metadata)
                VALUES (?, ?, ?, ?)
                """,
                (
                    concept,
                    concept_type,
                    source,
                    str(metadata or {"confidence": confidence}),
                ),
            )

    def add_relationship(
        self,
        source: str,
        relation: str,
        target: str,
        source_file: str,
        confidence: float = 0.5,
    ):
        """
        Add a relationship to agent's knowledge.

        Args:
            source: Source concept
            relation: Relationship type
            target: Target concept
            source_file: Where this relationship was learned
            confidence: Agent's confidence (0-1)
        """
        with self.graph_db as db:
            cursor = db.conn.cursor()

            cursor.execute(
                """
                INSERT INTO relationships (source, relation, target, source_file, metadata)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    source,
                    relation,
                    target,
                    source_file,
                    str({"confidence": confidence}),
                ),
            )

    def get_stats(self) -> dict[str, Any]:
        """
        Get statistics about agent's knowledge.

        Returns:
            Knowledge statistics
        """
        with self.graph_db as db:
            cursor = db.conn.cursor()

            # Entity count
            cursor.execute("SELECT COUNT(*) as count FROM entities")
            entity_count = cursor.fetchone()["count"]

            # Relationship count
            cursor.execute("SELECT COUNT(*) as count FROM relationships")
            relationship_count = cursor.fetchone()["count"]

            return {
                "agent_name": self.agent_name,
                "entity_count": entity_count,
                "relationship_count": relationship_count,
                "avg_relationships": (
                    relationship_count / entity_count if entity_count > 0 else 0
                ),
            }


class AgentSelfReflection:
    """
    Enable agents to run Ludwig evaluators on their own knowledge.

    Supports:
    - Kata: Identify skill gaps
    - Calibration: Assess confidence levels
    - Shannon: Analyze information efficiency
    - Tetlock: Track prediction accuracy
    """

    def __init__(self, agent_name: str):
        """
        Initialize agent self-reflection.

        Args:
            agent_name: Name of the agent
        """
        self.agent_name = agent_name
        self.knowledge_graph = AgentKnowledgeGraph(agent_name)
        self.evaluators = {
            "kata": KataEvaluator(),
            "calibration": CalibrationEvaluator(),
            "shannon": ShannonEvaluator(),
            "tetlock": TetlockEvaluator(),
        }

    def self_evaluate(
        self, evaluator_name: str = "kata"
    ) -> EvaluationResult:
        """
        Run evaluator on agent's own knowledge.

        Args:
            evaluator_name: Which evaluator to run

        Returns:
            Evaluation result
        """
        evaluator = self.evaluators.get(evaluator_name)
        if not evaluator:
            raise ValueError(f"Unknown evaluator: {evaluator_name}")

        # Create evaluation context
        context = EvaluatorContext(
            graph_db=self.knowledge_graph.graph_db,
            state=EvaluationState.RETROSPECTIVE,
            mode=InteractionMode.SILENT,
            target_file=None,
        )

        # Run evaluation
        result = evaluator.evaluate(context)

        return result

    def get_skill_gaps(self) -> list[str]:
        """
        Identify concepts that need more development (Kata mode).

        Returns:
            List of shallow concepts
        """
        result = self.self_evaluate("kata")

        # Extract shallow concepts from observations
        shallow_concepts = []
        for obs in result.observations:
            if "Shallow Concepts" in obs.title or "Orphan" in obs.title:
                # Extract concept names from evidence or metadata
                if "metadata" in obs.__dict__ and obs.metadata:
                    concepts = obs.metadata.get("shallow_concepts", [])
                    shallow_concepts.extend([c[0] if isinstance(c, tuple) else c for c in concepts[:5]])

        return shallow_concepts

    def assess_confidence(self) -> dict[str, Any]:
        """
        Assess confidence calibration (Calibration mode).

        Returns:
            Calibration assessment
        """
        result = self.self_evaluate("calibration")

        # Extract calibration score
        for obs in result.observations:
            if "Overall Calibration" in obs.title:
                return {
                    "calibration_score": obs.metadata.get("calibration_score", 0),
                    "level": obs.metadata.get("level", "Unknown"),
                    "description": obs.description,
                }

        return {"calibration_score": 0, "level": "Unknown", "description": "No assessment available"}

    def track_prediction(
        self,
        prediction: str,
        confidence: float,
        outcome: Optional[bool] = None,
        metadata: dict[str, Any] = None,
    ):
        """
        Track a prediction for Tetlock-style accuracy assessment.

        Args:
            prediction: What was predicted
            confidence: Confidence level (0-1)
            outcome: Actual outcome (True/False/None if not yet known)
            metadata: Additional context
        """
        prediction_metadata = {
            "type": "prediction",
            "confidence": confidence,
            "outcome": outcome,
            **(metadata or {}),
        }

        self.knowledge_graph.add_learning(
            concept=prediction,
            concept_type="prediction",
            source="agent_prediction",
            confidence=confidence,
            metadata=prediction_metadata,
        )

    def calculate_brier_score(self) -> Optional[float]:
        """
        Calculate Brier score for resolved predictions.

        Returns:
            Brier score (0 = perfect, 1 = worst) or None if no predictions
        """
        # TODO: Implement Brier score calculation
        # Brier score = average((forecast - outcome)^2)
        # where outcome is 0 or 1, forecast is probability

        return None  # Placeholder

    def learn_from_evaluation(self, result: EvaluationResult) -> list[str]:
        """
        Extract actionable learnings from evaluation result.

        Args:
            result: Evaluation result

        Returns:
            List of learning actions
        """
        learnings = []

        for obs in result.observations:
            if obs.type.value == "gap":
                learnings.append(f"Address gap: {obs.title}")
            elif obs.type.value == "opportunity":
                learnings.append(f"Opportunity: {obs.title}")
            elif obs.type.value == "contradiction":
                learnings.append(f"Resolve: {obs.title}")

        return learnings

    def get_learning_progress(self) -> dict[str, Any]:
        """
        Track learning progress over time.

        Returns:
            Progress metrics
        """
        stats = self.knowledge_graph.get_stats()

        # Run Kata evaluation for progression stage
        kata_result = self.self_evaluate("kata")
        progression_stage = "Unknown"

        for obs in kata_result.observations:
            if "Skill Progression" in obs.title:
                progression_stage = obs.metadata.get("stage", "Unknown")

        return {
            **stats,
            "progression_stage": progression_stage,
            "evaluators_run": list(self.evaluators.keys()),
        }


class CrossAgentLearning:
    """
    Enable agents to learn from each other's knowledge graphs.

    Supports:
    - Knowledge sharing between agents
    - Collective intelligence
    - Agent-to-agent mentoring
    """

    @staticmethod
    def share_knowledge(
        source_agent: str,
        target_agent: str,
        concept: str,
    ):
        """
        Share a concept from one agent to another.

        Args:
            source_agent: Agent sharing knowledge
            target_agent: Agent receiving knowledge
            concept: Concept to share
        """
        source_graph = AgentKnowledgeGraph(source_agent)
        target_graph = AgentKnowledgeGraph(target_agent)

        # Get concept from source
        with source_graph.graph_db as db:
            cursor = db.conn.cursor()
            cursor.execute(
                "SELECT * FROM entities WHERE name = ?",
                (concept,),
            )
            entity = cursor.fetchone()

            if entity:
                # Add to target with attribution
                target_graph.add_learning(
                    concept=entity["name"],
                    concept_type=entity["type"],
                    source=f"learned_from_{source_agent}",
                    metadata={"original_source": source_agent},
                )

    @staticmethod
    def compare_knowledge(
        agent1: str,
        agent2: str,
    ) -> dict[str, Any]:
        """
        Compare knowledge between two agents.

        Args:
            agent1: First agent
            agent2: Second agent

        Returns:
            Comparison results
        """
        graph1 = AgentKnowledgeGraph(agent1)
        graph2 = AgentKnowledgeGraph(agent2)

        stats1 = graph1.get_stats()
        stats2 = graph2.get_stats()

        # Find unique concepts (in one but not the other)
        with graph1.graph_db as db1:
            cursor1 = db1.conn.cursor()
            cursor1.execute("SELECT name FROM entities")
            concepts1 = {row["name"] for row in cursor1.fetchall()}

        with graph2.graph_db as db2:
            cursor2 = db2.conn.cursor()
            cursor2.execute("SELECT name FROM entities")
            concepts2 = {row["name"] for row in cursor2.fetchall()}

        return {
            "agent1": agent1,
            "agent2": agent2,
            "agent1_stats": stats1,
            "agent2_stats": stats2,
            "shared_concepts": len(concepts1 & concepts2),
            "unique_to_agent1": len(concepts1 - concepts2),
            "unique_to_agent2": len(concepts2 - concepts1),
            "knowledge_overlap": (
                len(concepts1 & concepts2) / len(concepts1 | concepts2)
                if len(concepts1 | concepts2) > 0
                else 0
            ),
        }
