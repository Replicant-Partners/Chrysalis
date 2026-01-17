#!/usr/bin/env python3
"""
Process Replicants/Legends through SkillBuilder and KnowledgeBuilder pipelines.

Creates vector embeddings for each Legend agent and saves them to:
    Replicants/legends/Embeddings/

Usage:
    python scripts/process_legends.py [--legend <name>]

Options:
    --legend <name>  Process only the specified legend (e.g., "bob_ross")
    --run-count <n>  Number of iterations per builder (default: 3)
    --strategy <strategy>  Descriptor sampling strategy (default: hybrid alternating focused/diverse)
    --dry-run        Show what would be processed without running
"""

import argparse
import hashlib
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime
from filelock import FileLock

# Add project roots to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "projects" / "KnowledgeBuilder"))
sys.path.insert(0, str(PROJECT_ROOT / "projects" / "SkillBuilder"))
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))

# Import semantic merging utilities
from semantic_embedding_merger import EmbeddingMerger, SkillMerger
# Import rate limiting (Issue #3 integration)
from rate_limiter import get_rate_limiter

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Paths
LEGENDS_DIR = PROJECT_ROOT / "Replicants" / "legends"
EMBEDDINGS_DIR = LEGENDS_DIR / "Embeddings"
SKILLS_DIR = LEGENDS_DIR / "Skills"
HARNESS_LOG = LEGENDS_DIR / "Embeddings" / "harness_log.jsonl"

# Consolidated output files
ALL_EMBEDDINGS = EMBEDDINGS_DIR / "all_embeddings.json"
ALL_SKILLS = EMBEDDINGS_DIR / "all_skills.json"
ALL_PERSONAS = EMBEDDINGS_DIR / "all_personas.json"


def load_dotenv_if_present() -> None:
    """Load .env into process env if present (only sets unset keys)."""
    env_path = PROJECT_ROOT / ".env"
    if not env_path.exists():
        return
    try:
        with open(env_path, "r") as f:
            for line in f:
                stripped = line.strip()
                if not stripped or stripped.startswith("#"):
                    continue
                if "=" not in stripped:
                    continue
                key, val = stripped.split("=", 1)
                key = key.strip()
                val = val.strip().strip('"').strip("'")
                os.environ.setdefault(key, val)
        logger.info(f"Loaded environment from {env_path}")
    except Exception as exc:
        logger.warning(f"Could not load {env_path}: {exc}")


def ensure_runtime(allow_deterministic: bool) -> Dict[str, Any]:
    """Fail fast if required providers/keys/deps are absent."""
    missing: List[str] = []
    voyage_key = os.getenv("VOYAGE_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY") or os.getenv("GPT_API_KEY")
    tavily_key = os.getenv("TAVILY_API_KEY")

    if not allow_deterministic and not (voyage_key or openai_key):
        missing.append("VOYAGE_API_KEY or OPENAI_API_KEY")
    if not tavily_key:
        missing.append("TAVILY_API_KEY")

    try:
        import lancedb  # noqa: F401
    except ImportError:
        missing.append("lancedb (pip install lancedb)")

    if missing:
        raise SystemExit(
            "Missing required runtime inputs: " + ", ".join(missing) + ". Load .env and rerun."
        )

    try:
        from src.utils.embeddings import EmbeddingService as KBEmbeddingService

        kb_provider = KBEmbeddingService().get_provider_info()
    except Exception as exc:
        raise SystemExit(f"Failed to initialize KnowledgeBuilder embedding provider: {exc}")

    try:
        from skill_builder.pipeline.embeddings import EmbeddingService as SBEmbeddingService

        sb_provider = SBEmbeddingService().get_provider_info()
    except Exception as exc:
        raise SystemExit(f"Failed to initialize SkillBuilder embedding provider: {exc}")

    if not allow_deterministic:
        if kb_provider.get("provider") == "deterministic":
            raise SystemExit(
                "KnowledgeBuilder embedding provider resolved to deterministic; load VOYAGE_API_KEY or OPENAI_API_KEY "
                "or pass --allow-deterministic for offline testing."
            )
        if sb_provider.get("provider") == "deterministic":
            raise SystemExit(
                "SkillBuilder embedding provider resolved to deterministic; load VOYAGE_API_KEY or OPENAI_API_KEY "
                "or pass --allow-deterministic for offline testing."
            )

    logger.info(
        "Provider check → KB: %s (%s dims %s), SB: %s (%s dims %s)",
        kb_provider.get("provider"),
        kb_provider.get("model"),
        kb_provider.get("dimensions"),
        sb_provider.get("provider"),
        sb_provider.get("model"),
        sb_provider.get("dimensions"),
    )

    return {"kb": kb_provider, "sb": sb_provider}


def load_legend(legend_path: Path) -> Dict[str, Any]:
    """
    Load a legend JSON file.

    Args:
        legend_path: Path to legend JSON file

    Returns:
        Legend data dictionary

    Raises:
        ValueError: If path is outside LEGENDS_DIR (path traversal attempt)
    """
    # Issue #2 Fix: Validate path is within LEGENDS_DIR (defense-in-depth)
    try:
        legend_path_resolved = legend_path.resolve()
        legends_dir_resolved = LEGENDS_DIR.resolve()

        # Check if path is relative to LEGENDS_DIR
        legend_path_resolved.relative_to(legends_dir_resolved)
    except ValueError:
        raise ValueError(
            f"Path traversal detected: {legend_path} is outside {LEGENDS_DIR}"
        )

    with open(legend_path, "r") as f:
        return json.load(f)


def extract_descriptors(legend: Dict[str, Any]) -> Dict[str, List[str]]:
    """Extract descriptor buckets from a legend for strategy selection."""
    personality = legend.get("personality", {}) or {}
    capabilities = legend.get("capabilities", {}) or {}

    descriptors = {
        "core_traits": personality.get("core_traits", []) or [],
        "values": personality.get("values", []) or [],
        "quirks": personality.get("quirks", []) or [],
        "primary_capabilities": capabilities.get("primary", []) or [],
        "secondary_capabilities": capabilities.get("secondary", []) or [],
        "signature_phrases": legend.get("signature_phrases", []) or [],
    }
    return descriptors


def select_descriptors(descriptors: Dict[str, List[str]], strategy: str, run_number: int, prior: List[str]) -> Tuple[List[str], str]:
    """
    Select a descriptor subset using the requested strategy.

    - focused: take the densest/most similar signals (core traits → values → primary caps).
    - diverse: round-robin across buckets to maximize coverage.
    - hybrid: alternate focused on odd runs, diverse on even runs.
    """
    buckets = [
        ("core_traits", descriptors.get("core_traits", [])),
        ("values", descriptors.get("values", [])),
        ("primary_capabilities", descriptors.get("primary_capabilities", [])),
        ("secondary_capabilities", descriptors.get("secondary_capabilities", [])),
        ("quirks", descriptors.get("quirks", [])),
        ("signature_phrases", descriptors.get("signature_phrases", [])),
    ]

    resolved_strategy = strategy
    if strategy == "hybrid":
        resolved_strategy = "focused" if run_number % 2 == 1 else "diverse"

    has_any = any(items for _, items in buckets)

    chosen: List[str] = []
    if resolved_strategy == "focused":
        for _bucket, items in buckets[:4]:
            for item in items[:5]:
                if item not in chosen:
                    chosen.append(item)
        # reinforce with prior high-signal descriptors
        for item in prior[:5]:
            if item not in chosen:
                chosen.append(item)
    else:  # diverse
        if has_any:
            max_len = max(len(items) for _, items in buckets if items)
            for i in range(max_len):
                for _bucket, items in buckets:
                    if i < len(items):
                        item = items[i]
                        if item not in chosen:
                            chosen.append(item)
                    if len(chosen) >= 12:
                        break
                if len(chosen) >= 12:
                    break
        # add one prior descriptor to maintain continuity
        for item in prior[:3]:
            if item not in chosen:
                chosen.append(item)

    if not chosen and prior:
        chosen = prior[:5]

    return chosen[:15], resolved_strategy


def extract_legend_context(legend: Dict[str, Any]) -> str:
    """Extract key context from a legend for embedding."""
    parts = []

    # Name and designation
    name = legend.get("name", "Unknown")
    designation = legend.get("designation", "")
    parts.append(f"Name: {name}")
    if designation:
        parts.append(f"Designation: {designation}")

    # Bio
    bio = legend.get("bio", "")
    if bio:
        parts.append(f"Bio: {bio}")

    # Personality traits
    personality = legend.get("personality", {})
    if isinstance(personality, dict):
        core_traits = personality.get("core_traits", [])
        if core_traits:
            parts.append(f"Core Traits: {', '.join(core_traits)}")

        values = personality.get("values", [])
        if values:
            parts.append(f"Values: {', '.join(values)}")

        quirks = personality.get("quirks", [])
        if quirks and isinstance(quirks, list):
            parts.append(f"Quirks: {', '.join(quirks[:5])}")

    # Capabilities
    capabilities = legend.get("capabilities", {})
    if isinstance(capabilities, dict):
        primary = capabilities.get("primary", [])
        if primary:
            parts.append(f"Primary Capabilities: {', '.join(primary)}")
        secondary = capabilities.get("secondary", [])
        if secondary:
            parts.append(f"Secondary Capabilities: {', '.join(secondary[:5])}")

    # Signature phrases
    phrases = legend.get("signature_phrases", [])
    if phrases:
        parts.append(f"Signature Phrases: {'; '.join(phrases[:3])}")

    # Expertise (for technical legends like Bruce Schneier)
    expertise = legend.get("expertise", {})
    if isinstance(expertise, dict):
        for domain, details in list(expertise.items())[:3]:
            if isinstance(details, dict):
                specialties = details.get("specialties", [])
                if specialties:
                    parts.append(f"Expertise in {domain}: {', '.join(specialties[:3])}")

    return "\n".join(parts)


def process_legend_with_knowledge_builder(
    legend: Dict[str, Any],
    run_number: int,
    selected_descriptors: List[str],
    prior_embeddings: List[Dict[str, Any]],
    allow_deterministic: bool,
) -> Dict[str, Any]:
    """Process a legend through KnowledgeBuilder pipeline."""
    try:
        from src.pipeline.simple_pipeline import SimplePipeline
        from src.utils.embeddings import EmbeddingService

        name = legend.get("name", "Unknown")
        context = extract_legend_context(legend)

        # Issue #3: Apply rate limiting before API calls
        # Determine which provider is being used and apply appropriate rate limit
        provider = os.getenv("EMBEDDING_PROVIDER", "voyage").lower()
        if provider in ["voyage", "openai"] and not allow_deterministic:
            rate_limiter = get_rate_limiter(provider)
            wait_time = rate_limiter.acquire()
            if wait_time > 0:
                logger.info(f"  Rate limited: waited {wait_time:.2f}s for {provider}")
        if selected_descriptors:
            context += "\nSelected descriptors: " + ", ".join(selected_descriptors)
        if prior_embeddings:
            context += "\nPrior runs: " + "; ".join(
                [f"run{p.get('run_number')} dims={p.get('embedding_dimensions',0)}" for p in prior_embeddings]
            )

        logger.info(f"  KnowledgeBuilder run {run_number} for {name}")

        # Create embedding service
        embedder = EmbeddingService()
        provider_info = getattr(embedder, "get_provider_info", lambda: {})()
        if provider_info.get("provider") == "deterministic" and not allow_deterministic:
            raise RuntimeError(
                "KnowledgeBuilder embedding provider is deterministic; load VOYAGE_API_KEY or OPENAI_API_KEY or use --allow-deterministic."
            )

        # Generate embedding from the context
        embedding = embedder.embed(context)

        # Collect additional knowledge (fail if broken to avoid silent pollution)
        pipeline = SimplePipeline()
        result = pipeline.collect_and_store(name, entity_type="Person")
        collected_knowledge = {
            "entity": result.get("entity", {}),
            "attributes": result.get("attributes", {}),
            "resolved": result.get("resolved", {}),
        }

        return {
            "source": "knowledge_builder",
            "run_number": run_number,
            "embedding": embedding,
            "embedding_dimensions": len(embedding),
            "collected_knowledge": collected_knowledge,
            "context_used": context[:500] + "..." if len(context) > 500 else context,
            "descriptors": selected_descriptors,
            "provider": provider_info,
        }
    except ImportError as e:
        logger.error(f"    KnowledgeBuilder import failed: {e}")
        return {"source": "knowledge_builder", "run_number": run_number, "error": str(e)}
    except Exception as e:
        logger.error(f"    KnowledgeBuilder processing failed: {e}")
        return {"source": "knowledge_builder", "run_number": run_number, "error": str(e)}


def process_legend_with_skill_builder(
    legend: Dict[str, Any],
    run_number: int,
    selected_descriptors: List[str],
    prior_embeddings: List[Dict[str, Any]],
    allow_deterministic: bool,
) -> Dict[str, Any]:
    """Process a legend through SkillBuilder pipeline."""
    try:
        from skill_builder.pipeline.models import FrontendSpec, Exemplar
        from skill_builder.pipeline.embeddings import EmbeddingService

        name = legend.get("name", "Unknown")
        designation = legend.get("designation", "")
        bio = legend.get("bio", "")

        salts = selected_descriptors[:]

        logger.info(f"  SkillBuilder run {run_number} for {name}")

        # Issue #3: Apply rate limiting before API calls
        provider = os.getenv("EMBEDDING_PROVIDER", "voyage").lower()
        if provider in ["voyage", "openai"] and not allow_deterministic:
            rate_limiter = get_rate_limiter(provider)
            wait_time = rate_limiter.acquire()
            if wait_time > 0:
                logger.info(f"  Rate limited: waited {wait_time:.2f}s for {provider}")

        # Create embedding service
        embedder = EmbeddingService()
        provider_info = getattr(embedder, "get_provider_info", lambda: {})()
        if provider_info.get("provider") == "deterministic" and not allow_deterministic:
            raise RuntimeError(
                "SkillBuilder embedding provider is deterministic; load VOYAGE_API_KEY or OPENAI_API_KEY or use --allow-deterministic."
            )

        # Build skill context
        skill_context = f"Role Model: {name}\nDesignation: {designation}\n"
        skill_context += f"Purpose: {bio[:200]}...\n" if len(bio) > 200 else f"Purpose: {bio}\n"
        skill_context += f"Skills: {', '.join(salts)}"
        if prior_embeddings:
            skill_context += "\nPrior runs: " + "; ".join(
                [f"run{p.get('run_number')} dims={p.get('embedding_dimensions',0)}" for p in prior_embeddings]
            )

        # Generate embedding
        embedding = embedder.embed(skill_context)

        # Generate skill-specific embeddings
        skill_embeddings = []
        for salt in salts[:5]:
            skill_text = f"Skill: {salt} - as demonstrated by {name}"
            skill_embedding = embedder.embed(skill_text)
            skill_embeddings.append({
                "skill_name": salt,
                "embedding": skill_embedding,
            })

        return {
            "source": "skill_builder",
            "run_number": run_number,
            "embedding": embedding,
            "embedding_dimensions": len(embedding),
            "skill_embeddings": skill_embeddings,
            "salts_used": salts,
            "context_used": skill_context[:500] + "..." if len(skill_context) > 500 else skill_context,
            "descriptors": selected_descriptors,
            "provider": provider_info,
        }
    except ImportError as e:
        logger.error(f"    SkillBuilder import failed: {e}")
        return {"source": "skill_builder", "run_number": run_number, "error": str(e)}
    except Exception as e:
        logger.error(f"    SkillBuilder processing failed: {e}")
        return {"source": "skill_builder", "run_number": run_number, "error": str(e)}


def select_descriptors_for_runs(
    descriptors: Dict[str, List[str]],
    strategy: str,
    run_count: int,
    prior_salts: List[str] = None
) -> List[Tuple[List[str], str]]:
    """
    Select descriptors for each run based on strategy.

    Args:
        descriptors: Dictionary of descriptor buckets
        strategy: Descriptor sampling strategy
        run_count: Number of runs to generate descriptors for
        prior_salts: Previously used salts for continuity

    Returns:
        List of (selected_descriptors, resolved_strategy) tuples for each run
    """
    selections = []
    for run in range(1, run_count + 1):
        selected, resolved_strategy = select_descriptors(
            descriptors,
            strategy,
            run,
            prior_salts or []
        )
        selections.append((selected, resolved_strategy))
        prior_salts = selected  # Use current as prior for next run
    return selections


def run_knowledge_builder_pipeline(
    legend: Dict[str, Any],
    run_number: int,
    selected_descriptors: List[str],
    resolved_strategy: str,
    prior_embeddings: List[Dict[str, Any]],
    allow_deterministic: bool
) -> Dict[str, Any]:
    """
    Run KnowledgeBuilder for a single run.

    Args:
        legend: Legend data
        run_number: Current run number
        selected_descriptors: Descriptors for this run
        resolved_strategy: Resolved descriptor strategy
        prior_embeddings: Previous run embeddings
        allow_deterministic: Whether to allow deterministic embeddings

    Returns:
        KnowledgeBuilder result dictionary
    """
    kb_start = time.perf_counter()
    kb_result = process_legend_with_knowledge_builder(
        legend, run_number, selected_descriptors, prior_embeddings, allow_deterministic
    )
    kb_result["descriptor_strategy"] = resolved_strategy
    kb_result["duration_sec"] = round(time.perf_counter() - kb_start, 3)

    if "error" in kb_result:
        name = legend.get("name", "Unknown")
        raise RuntimeError(f"KnowledgeBuilder failed for {name} run {run_number}: {kb_result['error']}")

    return kb_result


def run_skill_builder_pipeline(
    legend: Dict[str, Any],
    run_number: int,
    selected_descriptors: List[str],
    resolved_strategy: str,
    prior_embeddings: List[Dict[str, Any]],
    allow_deterministic: bool
) -> Dict[str, Any]:
    """
    Run SkillBuilder for a single run.

    Args:
        legend: Legend data
        run_number: Current run number
        selected_descriptors: Descriptors for this run
        resolved_strategy: Resolved descriptor strategy
        prior_embeddings: Previous run embeddings
        allow_deterministic: Whether to allow deterministic embeddings

    Returns:
        SkillBuilder result dictionary
    """
    sb_start = time.perf_counter()
    sb_result = process_legend_with_skill_builder(
        legend, run_number, selected_descriptors, prior_embeddings, allow_deterministic
    )
    sb_result["descriptor_strategy"] = resolved_strategy
    sb_result["duration_sec"] = round(time.perf_counter() - sb_start, 3)

    if "error" in sb_result:
        name = legend.get("name", "Unknown")
        raise RuntimeError(f"SkillBuilder failed for {name} run {run_number}: {sb_result['error']}")

    return sb_result


def process_legend(legend_path: Path, run_count: int, strategy: str, allow_deterministic: bool) -> Dict[str, Any]:
    """
    Process a single legend through both builders with telemetry harness.

    This is the main orchestration function that coordinates descriptor selection,
    KnowledgeBuilder processing, and SkillBuilder processing across multiple runs.

    Args:
        legend_path: Path to legend JSON file
        run_count: Number of iterations per builder
        strategy: Descriptor sampling strategy
        allow_deterministic: Whether to allow deterministic embeddings

    Returns:
        Complete processing results including all runs
    """
    legend = load_legend(legend_path)
    name = legend.get("name", legend_path.stem)
    descriptors = extract_descriptors(legend)

    logger.info(f"Processing legend: {name}")

    # Initialize results structure
    results = {
        "name": name,
        "source_file": str(legend_path.name),
        "processed_at": datetime.now().isoformat(),
        "run_count": run_count,
        "strategy": strategy,
        "knowledge_builder_runs": [],
        "skill_builder_runs": [],
    }

    # Select descriptors for all runs
    descriptor_selections = select_descriptors_for_runs(descriptors, strategy, run_count)

    # Process each run
    prior_kb: List[Dict[str, Any]] = []
    prior_sb: List[Dict[str, Any]] = []

    for run_number, (selected, resolved_strategy) in enumerate(descriptor_selections, start=1):
        # Run KnowledgeBuilder
        kb_result = run_knowledge_builder_pipeline(
            legend, run_number, selected, resolved_strategy, prior_kb, allow_deterministic
        )
        results["knowledge_builder_runs"].append(kb_result)
        if "embedding" in kb_result:
            prior_kb.append(kb_result)

        # Run SkillBuilder
        sb_result = run_skill_builder_pipeline(
            legend, run_number, selected, resolved_strategy, prior_sb, allow_deterministic
        )
        results["skill_builder_runs"].append(sb_result)
        if "embedding" in sb_result:
            prior_sb.append(sb_result)

    return results


def compute_skill_signature(legend_name: str, skill_name: str, embedding: List[float]) -> str:
    """Compute unique signature for deduplication."""
    sig_data = f"{legend_name}:{skill_name}:{json.dumps(embedding[:10] if embedding else [])}"
    return hashlib.md5(sig_data.encode()).hexdigest()


def load_consolidated_skills() -> Dict[str, Any]:
    """Load existing consolidated skills file or create new structure."""
    if ALL_SKILLS.exists():
        try:
            with open(ALL_SKILLS, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    return {
        "version": "1.0.0",
        "consolidated_at": datetime.now().isoformat(),
        "total_skills": 0,
        "total_legends": 0,
        "skills_by_legend": {},
        "_signatures": {},  # For deduplication
    }


def save_skill_artifacts(legend_name: str, sb_runs: List[Dict[str, Any]]) -> None:
    """Semantic merge of skill artifacts into consolidated all_skills.json."""
    EMBEDDINGS_DIR.mkdir(parents=True, exist_ok=True)
    # Issue #1 Fix: Add timeout to prevent indefinite hangs
    lock = FileLock(str(ALL_SKILLS) + ".lock", timeout=300)  # 5 minutes

    skill_merger = SkillMerger(similarity_threshold=0.90)

    with lock:
        data = load_consolidated_skills()

        # Get existing skills for this legend
        existing_skills = data["skills_by_legend"].get(legend_name, [])

        # Collect new skills from all runs
        new_skills = []
        for run in sb_runs:
            for skill_emb in run.get("skill_embeddings", []):
                skill_entry = {
                    "legend_name": legend_name,
                    "skill_name": skill_emb.get("skill_name", ""),
                    "embedding": skill_emb.get("embedding", []),
                    "run_number": run.get("run_number"),
                    "descriptor_strategy": run.get("descriptor_strategy"),
                    "salts_used": run.get("salts_used", []),
                }
                new_skills.append(skill_entry)

        # Semantically merge skills
        merge_result = skill_merger.merge_skills(existing_skills, new_skills)

        logger.info(f"  Skill merge for {legend_name}: "
                   f"added {merge_result['added_count']}, "
                   f"merged {merge_result['merged_count']}, "
                   f"skipped {merge_result['skipped_count']}")

        # Update data
        data["skills_by_legend"][legend_name] = merge_result["merged_skills"]
        data["total_legends"] = len(data["skills_by_legend"])
        data["total_skills"] = sum(len(skills) for skills in data["skills_by_legend"].values())
        data["consolidated_at"] = datetime.now().isoformat()

        # Remove old _signatures field (no longer needed with semantic merging)
        if "_signatures" in data:
            del data["_signatures"]

        with open(ALL_SKILLS, "w") as f:
            json.dump(data, f, indent=2)

    logger.info(f"  Saved merged skills for {legend_name} to {ALL_SKILLS}")


def append_harness_log(entry: Dict[str, Any]) -> None:
    HARNESS_LOG.parent.mkdir(parents=True, exist_ok=True)
    with open(HARNESS_LOG, "a") as f:
        f.write(json.dumps(entry) + "\n")


def _embedding_summary(embedding: List[float]) -> Dict[str, Any]:
    """Return a lightweight summary of an embedding without storing the vector."""
    if not embedding:
        return {"dimensions": 0, "checksum": None}
    checksum = hashlib.sha256(",".join(f"{v:.6f}" for v in embedding).encode()).hexdigest()[:12]
    return {"dimensions": len(embedding), "checksum": checksum}


def _summarize_kb_run(run: Dict[str, Any]) -> Dict[str, Any]:
    """Strip large payloads from a KnowledgeBuilder run before logging."""
    knowledge = run.get("collected_knowledge") or {}
    return {
        "source": run.get("source"),
        "run_number": run.get("run_number"),
        "descriptor_strategy": run.get("descriptor_strategy"),
        "descriptors": run.get("descriptors", []),
        "provider": run.get("provider", {}),
        "duration_sec": run.get("duration_sec"),
        "embedding_summary": _embedding_summary(run.get("embedding", [])),
        "collected_knowledge_stats": {
            "has_entity": bool(knowledge.get("entity")),
            "attributes": len(knowledge.get("attributes", {})),
            "resolved": len(knowledge.get("resolved", {})),
        },
        "context_used": run.get("context_used"),
        "error": run.get("error"),
    }


def _summarize_sb_run(run: Dict[str, Any]) -> Dict[str, Any]:
    """Strip large payloads from a SkillBuilder run before logging."""
    def summarize_skill_embedding(item: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "skill_name": item.get("skill_name"),
            "dimensions": len(item.get("embedding", []) or []),
            "checksum": _embedding_summary(item.get("embedding", [])).get("checksum"),
            "descriptor_strategy": item.get("descriptor_strategy"),
            "descriptors": item.get("descriptors", []),
        }

    return {
        "source": run.get("source"),
        "run_number": run.get("run_number"),
        "descriptor_strategy": run.get("descriptor_strategy"),
        "descriptors": run.get("descriptors", []),
        "provider": run.get("provider", {}),
        "duration_sec": run.get("duration_sec"),
        "salts_used": run.get("salts_used", []),
        "context_used": run.get("context_used"),
        "embedding_summary": _embedding_summary(run.get("embedding", [])),
        "skill_embeddings": [summarize_skill_embedding(e) for e in run.get("skill_embeddings", [])],
        "error": run.get("error"),
    }


def sanitize_for_log(results: Dict[str, Any]) -> Dict[str, Any]:
    """Prepare a harness log entry that omits raw embeddings and other bulky data."""
    return {
        "name": results.get("name"),
        "source_file": results.get("source_file"),
        "run_count": results.get("run_count"),
        "strategy": results.get("strategy"),
        "processed_at": results.get("processed_at"),
        "knowledge_builder_runs": [_summarize_kb_run(r) for r in results.get("knowledge_builder_runs", [])],
        "skill_builder_runs": [_summarize_sb_run(r) for r in results.get("skill_builder_runs", [])],
        "timestamp": datetime.now().isoformat(),
    }


def load_consolidated_embeddings() -> Dict[str, Any]:
    """Load existing consolidated embeddings file or create new structure."""
    if ALL_EMBEDDINGS.exists():
        try:
            with open(ALL_EMBEDDINGS, "r") as f:
                data = json.load(f)

            # Migrate from old list format to new dict format
            if isinstance(data.get("legends"), list):
                logger.info("  Migrating embeddings from list to dict format...")
                old_legends = data["legends"]
                new_legends = {}
                for legend in old_legends:
                    name = legend.get("name", "Unknown")
                    new_legends[name] = legend
                data["legends"] = new_legends
                logger.info(f"  Migrated {len(new_legends)} legends to dict format")

            return data
        except (json.JSONDecodeError, IOError):
            pass

    return {
        "version": "1.0.0",
        "consolidated_at": datetime.now().isoformat(),
        "total_legends": 0,
        "legends": {},
    }


def create_kb_embedding_dict(run_result: Dict[str, Any], processed_at: str) -> Dict[str, Any]:
    """
    Create embedding dictionary from KnowledgeBuilder run result.

    Args:
        run_result: KnowledgeBuilder run result
        processed_at: Processing timestamp

    Returns:
        Embedding dictionary for storage
    """
    return {
        "run": run_result["run_number"],
        "dimensions": run_result.get("embedding_dimensions", 0),
        "embedding": run_result.get("embedding", []),
        "has_collected_knowledge": bool(run_result.get("collected_knowledge")),
        "collected_knowledge": run_result.get("collected_knowledge", {}),
        "descriptor_strategy": run_result.get("descriptor_strategy"),
        "descriptors": run_result.get("descriptors", []),
        "duration_sec": run_result.get("duration_sec"),
        "processed_at": processed_at,
        "error": run_result.get("error"),
    }


def create_sb_embedding_dict(run_result: Dict[str, Any], processed_at: str) -> Dict[str, Any]:
    """
    Create embedding dictionary from SkillBuilder run result.

    Args:
        run_result: SkillBuilder run result
        processed_at: Processing timestamp

    Returns:
        Embedding dictionary for storage
    """
    return {
        "run": run_result["run_number"],
        "dimensions": run_result.get("embedding_dimensions", 0),
        "embedding": run_result.get("embedding", []),
        "skill_count": len(run_result.get("skill_embeddings", [])),
        "salts_used": run_result.get("salts_used", []),
        "descriptor_strategy": run_result.get("descriptor_strategy"),
        "descriptors": run_result.get("descriptors", []),
        "duration_sec": run_result.get("duration_sec"),
        "processed_at": processed_at,
        "error": run_result.get("error"),
    }


def merge_embedding_list(
    existing_embeddings: List[Dict[str, Any]],
    new_embeddings: List[Dict[str, Any]],
    merger: EmbeddingMerger
) -> Tuple[List[Dict[str, Any]], int, int]:
    """
    Merge new embeddings with existing embeddings using semantic similarity.

    This is a common function used by both KnowledgeBuilder and SkillBuilder
    to eliminate duplicate merge logic (Issue #6).

    Args:
        existing_embeddings: List of existing embedding dictionaries
        new_embeddings: List of new embedding dictionaries to merge
        merger: EmbeddingMerger instance for semantic comparison

    Returns:
        Tuple of (merged_embeddings, merged_count, added_count)
    """
    merged_embs = existing_embeddings.copy()
    merged_count = 0
    added_count = 0

    for new_emb in new_embeddings:
        updated, was_merged = merger.merge_similar_embeddings(merged_embs, new_emb)
        merged_embs = updated
        if was_merged:
            merged_count += 1
        else:
            added_count += 1

    return merged_embs, merged_count, added_count


def create_new_legend_entry(results: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create a new legend entry for first-time processing.

    Args:
        results: Processing results from process_legend()

    Returns:
        Legend entry dictionary
    """
    return {
        "name": results["name"],
        "source_file": results["source_file"],
        "processed_at": results["processed_at"],
        "run_count": results.get("run_count"),
        "strategy": results.get("strategy"),
        "knowledge_builder": {
            "runs": len(results["knowledge_builder_runs"]),
            "embeddings": [
                {
                    **create_kb_embedding_dict(r, results["processed_at"]),
                    "merged_count": 1,
                }
                for r in results["knowledge_builder_runs"]
            ],
        },
        "skill_builder": {
            "runs": len(results["skill_builder_runs"]),
            "embeddings": [
                {
                    **create_sb_embedding_dict(r, results["processed_at"]),
                    "merged_count": 1,
                }
                for r in results["skill_builder_runs"]
            ],
        },
    }


def merge_with_existing_embeddings(
    existing_entry: Dict[str, Any],
    results: Dict[str, Any],
    merger: EmbeddingMerger
) -> Dict[str, Any]:
    """
    Merge new processing results with existing legend entry.

    Args:
        existing_entry: Existing legend entry from consolidated file
        results: New processing results from process_legend()
        merger: EmbeddingMerger instance for semantic comparison

    Returns:
        Updated legend entry with merged embeddings
    """
    # Prepare new embeddings
    new_kb_embs = [
        create_kb_embedding_dict(r, results["processed_at"])
        for r in results["knowledge_builder_runs"]
    ]

    new_sb_embs = [
        create_sb_embedding_dict(r, results["processed_at"])
        for r in results["skill_builder_runs"]
    ]

    # Merge KnowledgeBuilder embeddings
    existing_kb_embs = existing_entry.get("knowledge_builder", {}).get("embeddings", [])
    merged_kb_embs, kb_merged_count, kb_added_count = merge_embedding_list(
        existing_kb_embs, new_kb_embs, merger
    )

    # Merge SkillBuilder embeddings
    existing_sb_embs = existing_entry.get("skill_builder", {}).get("embeddings", [])
    merged_sb_embs, sb_merged_count, sb_added_count = merge_embedding_list(
        existing_sb_embs, new_sb_embs, merger
    )

    logger.info(f"    KB: merged {kb_merged_count}, added {kb_added_count}")
    logger.info(f"    SB: merged {sb_merged_count}, added {sb_added_count}")

    # Create updated entry
    return {
        "name": results["name"],
        "source_file": results["source_file"],
        "processed_at": results["processed_at"],
        "run_count": existing_entry.get("run_count", 0) + results.get("run_count", 0),
        "strategy": results.get("strategy"),
        "knowledge_builder": {
            "runs": len(merged_kb_embs),
            "embeddings": merged_kb_embs,
        },
        "skill_builder": {
            "runs": len(merged_sb_embs),
            "embeddings": merged_sb_embs,
        },
    }


def save_embeddings(legend_name: str, results: Dict[str, Any]) -> Path:
    """
    Semantic merge of embeddings into consolidated all_embeddings.json.

    This function orchestrates the merging process by:
    1. Loading existing consolidated data
    2. Determining if this is a new or existing legend
    3. Merging embeddings semantically if existing
    4. Saving the updated consolidated data

    Args:
        legend_name: Name of the legend being processed
        results: Processing results from process_legend()

    Returns:
        Path to the consolidated embeddings file
    """
    EMBEDDINGS_DIR.mkdir(parents=True, exist_ok=True)
    # Issue #1 Fix: Add timeout to prevent indefinite hangs
    lock = FileLock(str(ALL_EMBEDDINGS) + ".lock", timeout=300)  # 5 minutes

    embedding_merger = EmbeddingMerger(similarity_threshold=0.85)

    with lock:
        data = load_consolidated_embeddings()
        existing_entry = data["legends"].get(legend_name)

        if existing_entry:
            # SEMANTIC MERGE: Combine new embeddings with existing ones
            logger.info(f"  Semantically merging embeddings for {legend_name}")
            legend_entry = merge_with_existing_embeddings(existing_entry, results, embedding_merger)
        else:
            # First time processing this legend
            logger.info(f"  First time processing {legend_name}")
            legend_entry = create_new_legend_entry(results)

        # Save merged data
        data["legends"][legend_name] = legend_entry
        data["total_legends"] = len(data["legends"])
        data["consolidated_at"] = datetime.now().isoformat()

        with open(ALL_EMBEDDINGS, "w") as f:
            json.dump(data, f, indent=2)

    logger.info(f"  Saved merged embeddings for {legend_name} to {ALL_EMBEDDINGS}")
    return ALL_EMBEDDINGS


def load_consolidated_personas() -> Dict[str, Any]:
    """Load existing consolidated personas file or create new structure."""
    if ALL_PERSONAS.exists():
        try:
            with open(ALL_PERSONAS, "r") as f:
                data = json.load(f)

            # Migrate from old list format to new dict format
            if isinstance(data.get("personas"), list):
                logger.info("  Migrating personas from list to dict format...")
                old_personas = data["personas"]
                new_personas = {}
                for persona in old_personas:
                    name = persona.get("name", "Unknown")
                    new_personas[name] = persona
                data["personas"] = new_personas
                logger.info(f"  Migrated {len(new_personas)} personas to dict format")

            return data
        except (json.JSONDecodeError, IOError):
            pass
    return {
        "version": "1.0.0",
        "consolidated_at": datetime.now().isoformat(),
        "total_personas": 0,
        "personas": {},
    }


def save_persona(legend_path: Path, legend: Dict[str, Any]) -> None:
    """Semantic merge of persona into consolidated all_personas.json."""
    EMBEDDINGS_DIR.mkdir(parents=True, exist_ok=True)
    # Issue #1 Fix: Add timeout to prevent indefinite hangs
    lock = FileLock(str(ALL_PERSONAS) + ".lock", timeout=300)  # 5 minutes

    name = legend.get("name", legend_path.stem)

    with lock:
        data = load_consolidated_personas()

        persona_entry = {
            "name": name,
            "designation": legend.get("designation", ""),
            "bio": legend.get("bio", ""),
            "personality": legend.get("personality", {}),
            "capabilities": legend.get("capabilities", {}),
            "signature_phrases": legend.get("signature_phrases", []),
            "communication_style": legend.get("communication_style", {}),
            "beliefs": legend.get("beliefs", {}),
            "source_file": legend_path.name,
        }

        # Merge into consolidated file
        data["personas"][name] = persona_entry
        data["total_personas"] = len(data["personas"])
        data["consolidated_at"] = datetime.now().isoformat()

        with open(ALL_PERSONAS, "w") as f:
            json.dump(data, f, indent=2)

    logger.info(f"  Merged persona for {name} into {ALL_PERSONAS}")


def main():
    parser = argparse.ArgumentParser(description="Process Legends through Builder pipelines")
    parser.add_argument("--legend", type=str, help="Process only the specified legend")
    parser.add_argument("--run-count", type=int, default=3, help="Number of iterations per builder (default: 3)")
    parser.add_argument(
        "--strategy",
        choices=["focused", "diverse", "hybrid"],
        default="hybrid",
        help="Descriptor sampling strategy (default: hybrid alternating focused/diverse)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Show what would be processed")
    parser.add_argument(
        "--allow-deterministic",
        action="store_true",
        help="Permit deterministic embeddings (for offline/tests). Default: fail fast if providers are missing.",
    )
    args = parser.parse_args()

    # Find all legend files
    legend_files = sorted(LEGENDS_DIR.glob("*.json"))

    if args.legend:
        # Filter to specific legend
        legend_files = [f for f in legend_files if args.legend.lower() in f.stem.lower()]
        if not legend_files:
            logger.error(f"No legend found matching: {args.legend}")
            return 1

    logger.info(f"Found {len(legend_files)} legend files to process")

    if args.dry_run:
        logger.info("DRY RUN - Would process:")
        for f in legend_files:
            logger.info(f"  - {f.name}")
        return 0

    # Create embeddings directory
    EMBEDDINGS_DIR.mkdir(parents=True, exist_ok=True)
    logger.info(f"Embeddings will be saved to: {EMBEDDINGS_DIR}")

    # Preflight: ensure providers/keys/deps present
    load_dotenv_if_present()
    ensure_runtime(args.allow_deterministic)

    # Process each legend
    processed = 0
    errors = 0

    for legend_file in legend_files:
        if legend_file.name == "README.md":
            continue

        try:
            legend = load_legend(legend_file)
            results = process_legend(legend_file, run_count=args.run_count, strategy=args.strategy, allow_deterministic=args.allow_deterministic)
            save_embeddings(results["name"], results)
            save_skill_artifacts(results["name"], results.get("skill_builder_runs", []))
            save_persona(legend_file, legend)
            append_harness_log(sanitize_for_log(results))
            processed += 1
        except Exception as e:
            logger.error(f"Failed to process {legend_file.name}: {e}")
            errors += 1

    # Summary and rate limiter statistics
    logger.info("=" * 60)
    logger.info(f"Processing complete!")
    logger.info(f"  Processed: {processed} legends")
    logger.info(f"  Errors: {errors}")
    logger.info(f"  Output: {EMBEDDINGS_DIR}")

    # Log rate limiter statistics if used
    try:
        from rate_limiter import VOYAGE_RATE_LIMITER, OPENAI_RATE_LIMITER

        voyage_stats = VOYAGE_RATE_LIMITER.get_stats()
        if voyage_stats["total_calls"] > 0:
            logger.info(f"\nVoyage API Rate Limiter Stats:")
            logger.info(f"  Total calls: {voyage_stats['total_calls']}")
            logger.info(f"  Total waits: {voyage_stats['total_waits']}")
            logger.info(f"  Total wait time: {voyage_stats['total_wait_time']:.2f}s")
            if voyage_stats['total_waits'] > 0:
                logger.info(f"  Average wait: {voyage_stats['average_wait']:.2f}s")

        openai_stats = OPENAI_RATE_LIMITER.get_stats()
        if openai_stats["total_calls"] > 0:
            logger.info(f"\nOpenAI API Rate Limiter Stats:")
            logger.info(f"  Total calls: {openai_stats['total_calls']}")
            logger.info(f"  Total waits: {openai_stats['total_waits']}")
            logger.info(f"  Total wait time: {openai_stats['total_wait_time']:.2f}s")
            if openai_stats['total_waits'] > 0:
                logger.info(f"  Average wait: {openai_stats['average_wait']:.2f}s")
    except Exception as e:
        logger.debug(f"Could not log rate limiter stats: {e}")

    return 0 if errors == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
