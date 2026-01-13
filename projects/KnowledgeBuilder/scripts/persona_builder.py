#!/usr/bin/env python3
"""
Persona Builder - Simple interface for iterative knowledge building and persona creation.

Usage:
    python persona_builder.py --name "Mike" \
        --descriptors "Toyota Kata, Continuous Improvement, Coaching, Scientific Thinking, Michigan" \
        --base-personas "prompt-engineer.md,system-architect.md" \
        --iterations 4 \
        --output "data/mike_persona.json"
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

from src.pipeline.router import SearchOrchestrator
from src.utils.semantic_merge import SemanticMerger


class PersonaBuilder:
    """
    Build agent personas through iterative knowledge collection and semantic merging.
    
    Simple interface:
    - name: persona name
    - descriptors: comma-separated knowledge domains/attributes
    - iterations: number of enrichment passes
    - base_personas: optional list of existing persona files to merge
    """
    
    def __init__(
        self,
        name: str,
        descriptors: List[str],
        iterations: int = 4,
        max_cost_per_iteration: float = 0.50,
        output_dir: str = "data"
    ):
        self.name = name
        self.descriptors = descriptors
        self.iterations = iterations
        self.max_cost = max_cost_per_iteration
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.orchestrator = SearchOrchestrator(max_cost=max_cost_per_iteration)
        self.merger = SemanticMerger(similarity_threshold=0.78)
        
        # Store iteration results
        self.iteration_results: List[Dict[str, Any]] = []
        self.base_persona_content: Dict[str, str] = {}
        
    def load_base_personas(self, persona_paths: List[str]) -> None:
        """Load existing persona markdown files as base knowledge."""
        for path in persona_paths:
            p = Path(path)
            if not p.exists():
                # Try relative to repo root
                p = Path(__file__).parent.parent.parent.parent / path
            if p.exists():
                self.base_persona_content[p.name] = p.read_text()
                print(f"  Loaded base persona: {p.name} ({len(self.base_persona_content[p.name])} chars)")
            else:
                print(f"  Warning: Base persona not found: {path}")
    
    def _build_query_variations(self) -> List[str]:
        """Generate query variations from descriptors for each iteration."""
        base = " ".join(self.descriptors[:3])  # Core descriptors
        variations = [
            f"{self.name} {base}",  # Iteration 1: name + core
        ]
        
        # Add progressive descriptor combinations
        for i in range(1, min(self.iterations, len(self.descriptors))):
            subset = self.descriptors[i:i+3]
            if subset:
                variations.append(f"{self.name} {' '.join(subset)}")
        
        # Ensure we have enough variations for iterations
        while len(variations) < self.iterations:
            variations.append(f"{self.name} {' '.join(self.descriptors)}")
        
        return variations[:self.iterations]
    
    def run_iteration(self, iteration: int, query: str) -> Dict[str, Any]:
        """Run a single knowledge collection iteration."""
        print(f"\n  Iteration {iteration + 1}/{self.iterations}: '{query}'")
        
        result = self.orchestrator.collect(
            identifier=query,
            entity_type="Person",
            compare_without_enrichment=False,
            fallback_tags=self.descriptors
        )
        
        # Save iteration shard
        shard_path = self.output_dir / f"{self.name.lower()}_shard_{iteration + 1}.json"
        with open(shard_path, 'w') as f:
            json.dump(result, f, indent=2)
        
        print(f"    -> Saved shard: {shard_path.name} ({os.path.getsize(shard_path)} bytes)")
        print(f"    -> Cost: ${result.get('cost_spent', 0):.4f}")
        print(f"    -> Merge stats: {result.get('merge_stats', {}).get('output_count', 0)} snippets")
        
        return result
    
    def semantic_consolidate(self) -> Dict[str, Any]:
        """Consolidate all iteration shards via semantic map-reduce."""
        print(f"\n  Consolidating {len(self.iteration_results)} iterations...")
        
        all_snippets = []
        all_attributes = {}
        sources_seen = set()
        
        for i, result in enumerate(self.iteration_results):
            # Collect snippets from merge_stats
            merged = result.get("merge_stats", {}).get("merged", [])
            for snip in merged:
                url = snip.get("url", "")
                if url not in sources_seen:
                    sources_seen.add(url)
                    all_snippets.append(snip)
            
            # Merge attributes (later iterations can update)
            all_attributes.update(result.get("attributes", {}))
        
        # Run semantic merge on consolidated snippets
        final_merge = self.merger.merge(all_snippets, limit=50)
        
        return {
            "merged_snippets": final_merge["merged"],
            "attributes": all_attributes,
            "total_sources": len(sources_seen),
            "iterations_consolidated": len(self.iteration_results),
            "merge_stats": final_merge
        }
    
    def build(self, base_personas: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Run the full persona building pipeline.
        
        1. Load base personas (if provided)
        2. Generate query variations
        3. Run iterations
        4. Consolidate via semantic merge
        5. Create final persona
        """
        print(f"\n=== Building Persona: {self.name} ===")
        print(f"  Descriptors: {', '.join(self.descriptors)}")
        print(f"  Iterations: {self.iterations}")
        
        # Step 1: Load base personas
        if base_personas:
            print(f"\n  Loading base personas...")
            self.load_base_personas(base_personas)
        
        # Step 2: Generate query variations
        queries = self._build_query_variations()
        print(f"\n  Query variations: {queries}")
        
        # Step 3: Run iterations
        print(f"\n--- Running {self.iterations} iterations ---")
        for i, query in enumerate(queries):
            result = self.run_iteration(i, query)
            self.iteration_results.append(result)
        
        # Step 4: Consolidate
        print(f"\n--- Semantic Consolidation ---")
        consolidated = self.semantic_consolidate()
        
        # Step 5: Build final persona
        print(f"\n--- Building Final Persona ---")
        persona = {
            "name": self.name,
            "type": "systems_agent",
            "version": "1.0",
            "descriptors": self.descriptors,
            "base_personas": list(self.base_persona_content.keys()),
            "knowledge": {
                "snippets": consolidated["merged_snippets"],
                "attributes": consolidated["attributes"],
                "sources_count": consolidated["total_sources"]
            },
            "capabilities": self._extract_capabilities(consolidated),
            "responsibilities": self._generate_responsibilities(),
            "metadata": {
                "iterations": self.iterations,
                "consolidation_stats": consolidated["merge_stats"]
            }
        }
        
        # Save final persona
        output_path = self.output_dir / f"{self.name.lower()}_persona.json"
        with open(output_path, 'w') as f:
            json.dump(persona, f, indent=2)
        
        print(f"\n=== Persona Built: {output_path} ===")
        print(f"  Knowledge snippets: {len(persona['knowledge']['snippets'])}")
        print(f"  Sources: {persona['knowledge']['sources_count']}")
        print(f"  Capabilities: {len(persona['capabilities'])}")
        
        return persona
    
    def _extract_capabilities(self, consolidated: Dict) -> List[str]:
        """Extract capabilities from consolidated knowledge."""
        capabilities = []
        
        # Extract from snippets
        for snip in consolidated.get("merged_snippets", [])[:10]:
            snippet_text = snip.get("snippet", "").lower()
            if "kata" in snippet_text:
                capabilities.append("Toyota Kata methodology")
            if "coaching" in snippet_text:
                capabilities.append("Coaching and mentoring")
            if "improvement" in snippet_text:
                capabilities.append("Continuous improvement facilitation")
            if "scientific" in snippet_text:
                capabilities.append("Scientific thinking guidance")
        
        # Add from descriptors
        for desc in self.descriptors:
            if desc.lower() not in [c.lower() for c in capabilities]:
                capabilities.append(f"{desc} expertise")
        
        return list(set(capabilities))[:10]
    
    def _generate_responsibilities(self) -> List[str]:
        """Generate responsibilities based on persona type."""
        return [
            f"Coach users in {self.descriptors[0] if self.descriptors else 'continuous improvement'}",
            "Support iterative experimentation cycles",
            "Guide scientific thinking in problem-solving",
            "Facilitate knowledge transfer and skill development",
            "Enable adaptive process optimization"
        ]


def main():
    parser = argparse.ArgumentParser(
        description="Build agent personas through iterative knowledge collection"
    )
    parser.add_argument("--name", required=True, help="Persona name")
    parser.add_argument(
        "--descriptors", 
        required=True,
        help="Comma-separated descriptors (e.g., 'Toyota Kata,Coaching,Michigan')"
    )
    parser.add_argument(
        "--base-personas",
        default="",
        help="Comma-separated base persona files to merge"
    )
    parser.add_argument("--iterations", type=int, default=4, help="Number of iterations")
    parser.add_argument("--max-cost", type=float, default=0.50, help="Max cost per iteration")
    parser.add_argument("--output-dir", default="data", help="Output directory")
    
    args = parser.parse_args()
    
    descriptors = [d.strip() for d in args.descriptors.split(",")]
    base_personas = [p.strip() for p in args.base_personas.split(",") if p.strip()]
    
    builder = PersonaBuilder(
        name=args.name,
        descriptors=descriptors,
        iterations=args.iterations,
        max_cost_per_iteration=args.max_cost,
        output_dir=args.output_dir
    )
    
    persona = builder.build(base_personas=base_personas if base_personas else None)
    
    print(f"\nDone! Persona saved to {args.output_dir}/{args.name.lower()}_persona.json")


if __name__ == "__main__":
    main()
