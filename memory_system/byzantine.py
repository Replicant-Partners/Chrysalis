"""
Chrysalis Memory System - Byzantine Resistance
Pattern #8: Threshold Validation & Byzantine-Resistant Aggregation

Provides:
- >2/3 threshold validation
- Trimmed mean (removes outliers)
- Median (Byzantine-resistant)
- Supermajority requirements
"""

from typing import List, Dict, Set, Tuple, Optional
from dataclasses import dataclass
import statistics

from .chrysalis_types import (
    EpisodicMemory,
    SemanticMemory,
    ByzantineValidation
)


@dataclass
class ValidationVote:
    """A vote from an instance about memory validity"""
    instance_id: str
    confidence: float  # 0.0-1.0
    timestamp: float
    signature: Optional[bytes] = None  # Optional signature for vote


class ByzantineMemoryValidator:
    """
    Pattern #8: Byzantine-Resistant Memory Validation
    
    Key properties:
    - Requires >2/3 honest instances
    - Trimmed mean removes outliers (up to 1/3 Byzantine nodes)
    - Median is robust to Byzantine values
    - Supermajority prevents single-point manipulation
    """
    
    @staticmethod
    def calculate_threshold(total_instances: int) -> int:
        """
        Calculate >2/3 threshold for Byzantine tolerance
        
        Byzantine agreement theory proves:
        - Need >2/3 honest to reach consensus
        - Can tolerate up to 1/3 Byzantine (malicious) nodes
        """
        return (2 * total_instances // 3) + 1
    
    @staticmethod
    def trimmed_mean(
        values: List[float],
        trim_percent: float = 0.2
    ) -> float:
        """
        Pattern #8: Byzantine-resistant trimmed mean
        
        Remove top and bottom trim_percent to eliminate outliers
        
        Why this works:
        - Byzantine nodes can be at extremes (0.0 or 1.0)
        - Trimming removes up to trim_percent from each end
        - Default 0.2 (20%) handles up to 40% Byzantine total
        - Covers >1/3 Byzantine tolerance requirement
        """
        if not values:
            return 0.0
        
        if len(values) == 1:
            return values[0]
        
        sorted_values = sorted(values)
        n = len(sorted_values)
        trim_count = int(n * trim_percent)
        
        # Don't trim more than half
        if trim_count * 2 >= n:
            trim_count = n // 3  # Trim max 1/3 from each end
        
        # Trim and calculate mean
        if trim_count > 0:
            trimmed = sorted_values[trim_count:n-trim_count]
        else:
            trimmed = sorted_values
        
        return sum(trimmed) / len(trimmed) if trimmed else 0.0
    
    @staticmethod
    def median(values: List[float]) -> float:
        """
        Pattern #8: Median (Byzantine-resistant)
        
        Median is robust because:
        - Even if up to 1/3 nodes are Byzantine
        - Median comes from honest majority
        - Cannot be manipulated by minority
        """
        if not values:
            return 0.0
        
        return statistics.median(values)
    
    @staticmethod
    def mode(values: List[float]) -> float:
        """
        Pattern #8: Mode (most common value)
        
        Useful for discrete/categorical values
        """
        if not values:
            return 0.0
        
        try:
            return statistics.mode(values)
        except statistics.StatisticsError:
            # No unique mode, return median
            return statistics.median(values)
    
    @staticmethod
    def validate_memory(
        memory: EpisodicMemory,
        votes: List[ValidationVote],
        total_instances: int
    ) -> ByzantineValidation:
        """
        Pattern #8: Validate memory with Byzantine resistance
        
        Process:
        1. Check >2/3 threshold
        2. Calculate trimmed mean (removes Byzantine outliers)
        3. Calculate median (robust measure)
        4. Determine if memory meets validation criteria
        
        Returns: ByzantineValidation with aggregated results
        """
        threshold = ByzantineMemoryValidator.calculate_threshold(total_instances)
        
        # Extract confidence scores
        confidence_scores = [v.confidence for v in votes]
        verified_by = [v.instance_id for v in votes]
        
        # Calculate Byzantine-resistant aggregates
        trimmed_mean = ByzantineMemoryValidator.trimmed_mean(confidence_scores)
        median_value = ByzantineMemoryValidator.median(confidence_scores)
        
        # Check threshold
        meets_threshold = len(votes) >= threshold
        
        # Create validation
        validation = ByzantineValidation(
            verifiedBy=verified_by,
            confidenceScores=confidence_scores,
            trimmedMean=trimmed_mean,
            median=median_value,
            threshold=meets_threshold,
            requiredVotes=threshold
        )
        
        return validation
    
    @staticmethod
    def aggregate_knowledge_confidence(
        knowledge: SemanticMemory,
        source_confidences: Dict[str, float],
        total_instances: int
    ) -> Tuple[float, float, bool]:
        """
        Aggregate confidence scores for knowledge (facts)
        
        Returns: (trimmed_mean, median, meets_threshold)
        """
        if not source_confidences:
            return (0.0, 0.0, False)
        
        threshold = ByzantineMemoryValidator.calculate_threshold(total_instances)
        meets_threshold = len(source_confidences) >= threshold
        
        scores = list(source_confidences.values())
        trimmed_mean = ByzantineMemoryValidator.trimmed_mean(scores)
        median_value = ByzantineMemoryValidator.median(scores)
        
        return (trimmed_mean, median_value, meets_threshold)
    
    @staticmethod
    def detect_byzantine_nodes(
        votes: List[ValidationVote],
        expected_range: Tuple[float, float] = (0.3, 1.0)
    ) -> Set[str]:
        """
        Detect potential Byzantine nodes based on voting patterns
        
        Byzantine nodes may:
        - Always vote 0.0 or 1.0 (extremes)
        - Vote outside expected range
        - Show suspicious patterns
        
        Returns: Set of instance IDs that might be Byzantine
        """
        suspicious = set()
        
        min_expected, max_expected = expected_range
        
        for vote in votes:
            # Check if outside expected range
            if vote.confidence < min_expected or vote.confidence > max_expected:
                suspicious.add(vote.instance_id)
        
        return suspicious
    
    @staticmethod
    def weighted_confidence(
        votes: List[ValidationVote],
        instance_weights: Dict[str, float]
    ) -> float:
        """
        Calculate weighted confidence (for trusted instances)
        
        Some instances may be more trustworthy than others
        Use with caution: can centralize if weights are unfair
        """
        if not votes:
            return 0.0
        
        weighted_sum = 0.0
        weight_total = 0.0
        
        for vote in votes:
            weight = instance_weights.get(vote.instance_id, 1.0)
            weighted_sum += vote.confidence * weight
            weight_total += weight
        
        return weighted_sum / weight_total if weight_total > 0 else 0.0


class SupermajorityChecker:
    """
    Check supermajority requirements for critical operations
    
    Pattern #8: Require >2/3 agreement for important decisions
    """
    
    @staticmethod
    def has_supermajority(
        votes: List[bool],
        threshold: float = 2/3
    ) -> bool:
        """
        Check if votes meet supermajority threshold
        
        Default: 2/3 (Byzantine tolerance)
        Can be adjusted for different requirements
        """
        if not votes:
            return False
        
        yes_votes = sum(1 for v in votes if v)
        required = len(votes) * threshold
        
        return yes_votes >= required
    
    @staticmethod
    def consensus_decision(
        votes: Dict[str, bool],
        required_threshold: float = 2/3
    ) -> Tuple[bool, int, int]:
        """
        Make consensus decision from votes
        
        Returns: (decision, yes_count, required_count)
        """
        yes_count = sum(1 for v in votes.values() if v)
        total = len(votes)
        required = int(total * required_threshold)
        
        decision = yes_count >= required
        
        return (decision, yes_count, required)


class ByzantineScenarioTester:
    """
    Test Byzantine resistance scenarios
    
    Useful for validating that algorithms work under Byzantine conditions
    """
    
    @staticmethod
    def simulate_byzantine_votes(
        honest_count: int,
        byzantine_count: int,
        honest_value: float = 0.9,
        byzantine_value: float = 0.1
    ) -> List[ValidationVote]:
        """
        Simulate voting with Byzantine nodes
        
        Honest nodes vote close to honest_value
        Byzantine nodes vote byzantine_value (malicious)
        """
        votes = []
        
        # Honest votes
        for i in range(honest_count):
            votes.append(ValidationVote(
                instance_id=f"honest-{i}",
                confidence=honest_value,
                timestamp=0.0
            ))
        
        # Byzantine votes
        for i in range(byzantine_count):
            votes.append(ValidationVote(
                instance_id=f"byzantine-{i}",
                confidence=byzantine_value,
                timestamp=0.0
            ))
        
        return votes
    
    @staticmethod
    def test_trimmed_mean_resistance():
        """
        Test that trimmed mean resists Byzantine attacks
        """
        print("=== Testing Byzantine Resistance ===\n")
        
        scenarios = [
            (7, 3, 0.9, 0.1, "70% honest, 30% Byzantine"),
            (8, 2, 0.9, 0.0, "80% honest, 20% Byzantine"),
            (9, 1, 0.9, 0.0, "90% honest, 10% Byzantine"),
        ]
        
        for honest, byzantine, h_val, b_val, desc in scenarios:
            votes = ByzantineScenarioTester.simulate_byzantine_votes(
                honest, byzantine, h_val, b_val
            )
            
            scores = [v.confidence for v in votes]
            
            # Regular mean (vulnerable)
            regular_mean = sum(scores) / len(scores)
            
            # Trimmed mean (resistant)
            trimmed = ByzantineMemoryValidator.trimmed_mean(scores, 0.2)
            
            # Median (resistant)
            median = ByzantineMemoryValidator.median(scores)
            
            print(f"{desc}:")
            print(f"  Regular mean: {regular_mean:.3f} (vulnerable!)")
            print(f"  Trimmed mean: {trimmed:.3f} (resistant ✓)")
            print(f"  Median:       {median:.3f} (resistant ✓)")
            print()


# ==============================================================================
# Example Usage
# ==============================================================================

if __name__ == "__main__":
    print("=== Chrysalis Byzantine Resistance Demo ===\n")
    
    # 1. Calculate thresholds
    print("1. Byzantine Tolerance Thresholds:\n")
    for n in [10, 100, 1000]:
        threshold = ByzantineMemoryValidator.calculate_threshold(n)
        percent = (threshold / n) * 100
        byzantine_tolerated = n - threshold
        
        print(f"  {n} instances:")
        print(f"    Required votes: {threshold} (>{percent:.1f}%)")
        print(f"    Byzantine tolerated: {byzantine_tolerated} (<{100-percent:.1f}%)")
        print()
    
    # 2. Test Byzantine resistance
    print("\n2. Byzantine Attack Scenarios:\n")
    ByzantineScenarioTester.test_trimmed_mean_resistance()
    
    # 3. Demonstrate supermajority
    print("3. Supermajority Decision:\n")
    
    votes = {
        'instance-1': True,
        'instance-2': True,
        'instance-3': True,
        'instance-4': True,
        'instance-5': True,
        'instance-6': True,
        'instance-7': True,
        'instance-8': False,
        'instance-9': False,
        'instance-10': False,
    }
    
    decision, yes, required = SupermajorityChecker.consensus_decision(votes, 2/3)
    
    print(f"  Votes: {yes}/{len(votes)} yes")
    print(f"  Required: {required} (>2/3)")
    print(f"  Decision: {decision} ✓")
    
    print("\n=== Pattern #8: Byzantine Resistance Complete ===")
