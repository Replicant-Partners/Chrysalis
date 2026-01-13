"""
Command-Line Interface for SkillBuilder.

Usage:
    python -m skill_builder create    # Interactive wizard (primary interface)
    python -m skill_builder setup     # Check dependencies
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Sequence
import os
import uuid

from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from skill_builder.pipeline.models import FrontendSpec, Exemplar
from skill_builder.pipeline.runner import run_pipeline
from skill_builder.pipeline.transformer import ModeTransformer, OutputFormat
from skill_builder.pipeline.kilocode import KilocodeManager
from skill_builder.pipeline.telemetry import emit_structured


def main(args: Sequence[str] | None = None) -> int:
    """Main CLI entry point."""
    parser = create_parser()
    parsed = parser.parse_args(args)
    
    if not hasattr(parsed, "func"):
        # Default to create command if no subcommand given
        print("\n🔮 SkillBuilder - Build agent modes from exemplar-driven research")
        print("\nUsage:")
        print("  python -m skill_builder create   # Interactive wizard")
        print("  python -m skill_builder setup    # Check dependencies")
        print("\nRun 'python -m skill_builder create' to get started!\n")
        return 0
    
    return parsed.func(parsed)


def create_parser() -> argparse.ArgumentParser:
    """Create argument parser with subcommands."""
    parser = argparse.ArgumentParser(
        prog="skill_builder",
        description="SkillBuilder: Build agent modes from exemplar-driven research",
    )
    
    subparsers = parser.add_subparsers(title="commands")
    
    # Create command (interactive - primary UX)
    create_parser = subparsers.add_parser(
        "create",
        help="Create a new mode interactively",
    )
    create_parser.add_argument(
        "--enable-hybrid",
        action="store_true",
        help="Enable hybrid sparse+dense search with RRF fusion",
    )
    create_parser.add_argument(
        "--rrf-k",
        type=int,
        default=60,
        help="RRF k parameter (default: 60)",
    )
    create_parser.add_argument(
        "--dense-backend",
        type=str,
        default=None,
        help="Optional dense backend identifier for hybrid search",
    )
    create_parser.set_defaults(func=cmd_create)
    
    # Setup command
    setup_parser = subparsers.add_parser(
        "setup",
        help="Check and guide setup of dependencies",
    )
    setup_parser.set_defaults(func=cmd_setup)

    # Non-interactive run command
    run_parser = subparsers.add_parser(
        "run",
        help="Run SkillBuilder pipeline from a spec file",
    )
    run_parser.add_argument(
        "--spec",
        required=True,
        help="Path to a FrontendSpec YAML file",
    )
    run_parser.add_argument(
        "--iterations",
        type=int,
        default=None,
        help="Override deepening cycles (0-11)",
    )
    run_parser.add_argument(
        "--output-dir",
        type=str,
        default=None,
        help="Override output directory for artifacts",
    )
    run_parser.add_argument(
        "--telemetry",
        action="store_true",
        default=False,
        help="Enable telemetry export (default disabled for CLI runs)",
    )
    run_parser.set_defaults(func=cmd_run)

    # Batch merge command
    merge_parser = subparsers.add_parser(
        "batch-merge",
        help="Cluster and merge existing mode YAMLs",
    )
    merge_parser.add_argument(
        "--mode-batch-merge",
        action="store_true",
        help="Trigger batch merge pipeline (flag for compatibility)",
    )
    merge_parser.add_argument(
        "--mode-folder",
        type=str,
        default="ExistingModes/JTG",
        help="Folder containing mode YAMLs to merge",
    )
    merge_parser.add_argument(
        "--target-mode-count",
        type=int,
        default=125,
        help="Target number of merged modes (clusters)",
    )
    merge_parser.add_argument(
        "--enable-role-tagging",
        action="store_true",
        help="Enable LLM schema.org Occupation tagging per mode before clustering",
    )
    merge_parser.add_argument(
        "--role-tagging-prompt",
        type=str,
        default=None,
        help="Optional override prompt for schema.org Occupation tagging",
    )
    merge_parser.add_argument(
        "--role-map",
        type=str,
        default="config/role-map.yaml",
        help="Schema.org role map YAML (slug -> functional/domain/occupation) for neurosymbolic clustering",
    )
    merge_parser.add_argument(
        "--max-cluster-size",
        type=int,
        default=10,
        help="Maximum size per cluster",
    )
    merge_parser.set_defaults(func=cmd_batch_merge)

    # Offline calibration command
    calibrate_parser = subparsers.add_parser(
        "calibrate",
        help="Train/update offline calibration model from local telemetry runs",
    )
    calibrate_parser.add_argument(
        "--runs-dir",
        type=str,
        default=".roo/runs",
        help="Directory containing per-run telemetry.jsonl files (default: .roo/runs)",
    )
    calibrate_parser.add_argument(
        "--model-path",
        type=str,
        default=".roo/calibration/basic.json",
        help="Path to write the calibration artifact (default: .roo/calibration/basic.json)",
    )
    calibrate_parser.set_defaults(func=cmd_calibrate)
    
    return parser


def prompt(question: str, default: str = "") -> str:
    """Prompt user for input with optional default."""
    if default:
        response = input(f"{question} [{default}]: ").strip()
        return response if response else default
    return input(f"{question}: ").strip()


def prompt_yn(question: str, default: bool = True) -> bool:
    """Prompt user for yes/no with default."""
    hint = "[Y/n]" if default else "[y/N]"
    response = input(f"{question} {hint}: ").strip().lower()
    if not response:
        return default
    return response in ("y", "yes")


def cmd_create(args: argparse.Namespace) -> int:
    """Interactive mode creation wizard."""
    run_id = str(uuid.uuid4())
    print("\n🔮 SkillBuilder - Create a New Mode\n")
    print("=" * 40)
    
    kilocode = KilocodeManager()
    
    # Question 1: Build on existing modes?
    print("\nQuestion 1: Build on existing modes?")
    seed_modes: list[str] = []
    matched_modes: list[dict] = []
    
    seed_prompted_yes = prompt_yn("Do you want to build on mode(s) that already exist?", default=False)
    if seed_prompted_yes:
        # Show available modes as two-column list (Name | Slug)
        available = kilocode.list_available_modes()
        if available:
            print("\n   Available modes (Name | Slug):")
            name_width = max(len(m.get("name", m.get("slug", ""))) for m in available)
            for m in available:
                name = m.get("name", m.get("slug", "unnamed"))
                slug = m.get("slug", "")
                print(f"      • {name.ljust(name_width)} | {slug}")
            print()
        else:
            print("   (No existing modes found in Kilocode config)")
        
        seed_input = prompt("Which mode(s)? (comma-separated names or slugs)")
        if seed_input:
            requested = [s.strip() for s in seed_input.split(",") if s.strip()]
            matched_modes, unmatched = kilocode.load_modes(requested)
            
            if matched_modes:
                print(f"   ✓ Found: {', '.join(m.get('name', m.get('slug')) for m in matched_modes)}")
                seed_modes = [m.get("slug", m.get("name")) for m in matched_modes]
            if unmatched:
                print(f"   ✗ Not found: {', '.join(unmatched)}")
                if not prompt_yn("Continue without these modes?", default=True):
                    return 1

        # Role model intent follow-up when building on seeds
        want_role_model = prompt_yn("Do you also want to build on a role model?", default=True)
    else:
        want_role_model = True
    
    # Question 2: Role model (the seed)
    print("\nQuestion 2: Role model")
    role_model = ""
    if want_role_model:
        role_model = prompt("Who is the role model? (name of a person - real, fictional, or imagined)")
        if not role_model:
            print("Error: A role model is required when role-model support is enabled.", file=sys.stderr)
            return 1
        print(f"   → Role model: {role_model}")
    else:
        role_model = "Composite Mode (no single exemplar)"
        print(f"   → Proceeding without a single role model (composite)")
    
    # Question 3: Defining qualities (the salts)
    print("\nQuestion 3: Describe them")
    description = prompt("What did they do? Defining qualities or accomplishments? (comma-separated)")
    if not description:
        print("Error: Description is required.", file=sys.stderr)
        return 1
    salts = [s.strip() for s in description.split(",") if s.strip()]
    print(f"   → Keywords: {', '.join(salts)}")
    
    # Question 4: Learning/Deepening cycles
    print("\nQuestion 4: Learning/Deepening")
    deepening_cycles = 0
    deepening_strategy = "auto"
    if prompt_yn("Do you want to add extra learning/deepening cycles? (max 11)", default=False):
        try:
            deepening_cycles = int(prompt("How many cycles? (0-11)", default="3"))
        except ValueError:
            deepening_cycles = 0
        deepening_cycles = max(0, min(deepening_cycles, 11))
        if deepening_cycles > 0:
            print("   Strategy selection (per cycle):")
            print("     1) auto (heuristic alternation)")
            print("     2) segmentation (strategy A)")
            print("     3) drilldown (strategy B)")
            print("     4) hybrid (user default with heuristic override)")
            strat_choice = prompt("Choose strategy [auto/segmentation/drilldown/hybrid]", default="auto").strip().lower()
            if strat_choice in {"segmentation", "drilldown", "hybrid"}:
                deepening_strategy = strat_choice
            else:
                deepening_strategy = "auto"
    print(f"   → Deepening cycles: {deepening_cycles} (strategy={deepening_strategy})")

    # Question 5: Save location and name
    print("\nQuestion 5: Output")
    default_name = role_model.lower().replace(" ", "-") if role_model else "composite-mode"
    mode_name = prompt("What should we call this mode?", default=default_name)
    print(f"   → Mode name: {mode_name}")

    # Question 6: Merge strategy
    print("\nQuestion 6: Merge strategy")
    merge_strategy = "merge" if prompt_yn("Do you want to merge the modes at the end? (No = keep separate)", default=True) else "separate"
    print(f"   → Merge strategy: {merge_strategy}")
    
    # Question 7: Auto-upload to Kilocode
    print("\nQuestion 7: Integration")
    auto_load = prompt_yn("Automatically upload to Kilocode (VS Code extension + CLI)?", default=True)
    
    # Build purpose from description
    purpose = f"Expert mode inspired by {role_model}, specializing in {', '.join(salts[:3])}"
    
    # Create spec and run pipeline
    print("\n" + "=" * 40)
    print("🔄 Running pipeline...")
    
    spec = FrontendSpec(
        mode_name=mode_name,
        purpose=purpose,
        skills=tuple(salts),
        exemplars=(
            Exemplar(
                name=role_model,
                url=None,
                is_author=True,
                salts=tuple(salts),
            ),
        ),
        seed_modes=tuple(seed_modes),
        deepening_cycles=deepening_cycles,
        deepening_strategy=deepening_strategy,
        merge_strategy=merge_strategy,
        out_dir=Path("SkillBuilder"),
        enable_hybrid=bool(getattr(args, "enable_hybrid", False)),
        rrf_k=int(getattr(args, "rrf_k", 60)),
        dense_backend=getattr(args, "dense_backend", None),
    )

    emit_structured(
        "cli.run.start",
        data={
            "run_id": run_id,
            "spec_summary": spec.telemetry_summary(),
        },
    )
    
    # Check API keys
    if not spec.has_any_api_key():
        print("\n⚠️  WARNING: No search API keys configured!")
        print("   Search results may be limited.")
        print("   Set TAVILY_API_KEY or BRAVE_API_KEY in your .env file\n")
    else:
        available = spec.get_available_providers()
        print(f"✅ Search providers: {', '.join(available)}")
    
    # Run pipeline
    try:
        result = run_pipeline(spec, telemetry_enabled=True, run_id=run_id)
        
        if result.success:
            print(f"\n✅ Mode created: {result.output_dir}/")
            for f in result.written_files:
                print(f"   - {f.name}")
            
            # Auto-load to Kilocode if requested
            if auto_load:
                try:
                    transformer = ModeTransformer(format=OutputFormat.KILOCODE)
                    generated_mode_path = result.output_dir / "generated-mode.md"
                    if generated_mode_path.exists():
                        # Transform writes .kilocodemodes and .kilocode/rules-{slug}/
                        # AND automatically syncs via KilocodeManager.sync_mode()
                        written = transformer.transform(generated_mode_path, result.output_dir)
                        if written:
                            print(f"✅ Mode files written: {', '.join(f.name for f in written)}")
                    else:
                        print(f"⚠️  generated-mode.md not found at {generated_mode_path}")
                except Exception as e:
                    print(f"⚠️  Could not auto-load to Kilocode: {e}")
            
            print(f"\n🎉 Done! Your new '{mode_name}' mode is ready.")
            emit_structured(
                "cli.run.done",
                data={
                    "run_id": run_id,
                    "artifacts": [f.name for f in result.written_files],
                },
            )
            return 0
        else:
            print(f"\n❌ Pipeline failed: {result.error}", file=sys.stderr)
            emit_structured(
                "cli.run.error",
                data={
                    "run_id": run_id,
                    "stage": "pipeline",
                    "error": result.error,
                },
            )
            return 1
            
    except Exception as e:
        print(f"\n❌ Error: {e}", file=sys.stderr)
        emit_structured(
            "cli.run.error",
            data={
                "run_id": run_id,
                "stage": "cli",
                "error": str(e),
            },
        )
        return 1


def cmd_setup(args: argparse.Namespace) -> int:
    """Execute setup command to check dependencies and provide guidance."""
    print("SkillBuilder Setup Check\n")
    
    try:
        import shutil
        
        kilocode = KilocodeManager()
        
        deps = {
            "go_binary": Path("bin/search-swarm").exists(),
            "any_api_keys": bool(os.environ.get("TAVILY_API_KEY") or os.environ.get("BRAVE_API_KEY")),
        }
        
        print("Core Dependencies:")
        status = "✅" if deps['go_binary'] else "❌"
        print(f"  {status} Go search binary: {'Found' if deps['go_binary'] else 'Missing'}")
        status = "✅" if deps['any_api_keys'] else "❌"
        print(f"  {status} Search API keys: {'Configured' if deps['any_api_keys'] else 'Missing'}")
        
        print("\nKilocode Integration:")
        status = "✅" if kilocode.cli_global_config_path.exists() else "⚪"
        print(f"  {status} CLI config: {'Found' if kilocode.cli_global_config_path.exists() else 'Not found (optional)'}")
        status = "✅" if kilocode.vscode_global_config_path.exists() else "⚪"
        print(f"  {status} VS Code config: {'Found' if kilocode.vscode_global_config_path.exists() else 'Not found (optional)'}")
        
        all_required = deps['go_binary'] and deps['any_api_keys']
        
        if not all_required:
            print("\n🔧 Setup Instructions:")
            
            if not deps['go_binary']:
                print("\n  Build Go search binary:")
                print("     cd cmd/search-swarm && go build -o ../../bin/search-swarm")
            
            if not deps['any_api_keys']:
                print("\n  Configure search API keys (at least one required):")
                print("     # Add to .env file in project root:")
                print("     TAVILY_API_KEY=your_tavily_key")
                print("     BRAVE_API_KEY=your_brave_key")
        else:
            print("\n✅ All required dependencies are configured!")
            print("\nGet started with: python -m skill_builder create")
        
        return 0
        
    except Exception as e:
        print(f"Error checking setup: {e}", file=sys.stderr)
        return 1


def cmd_run(args: argparse.Namespace) -> int:
    """Run SkillBuilder pipeline using a supplied spec YAML."""
    from skill_builder.pipeline.runner import run_pipeline
    from skill_builder.pipeline.models import FrontendSpec

    spec_path = Path(getattr(args, "spec", "")).expanduser()
    if not spec_path.exists():
        print(f"❌ Spec file not found: {spec_path}", file=sys.stderr)
        return 1

    try:
        spec = FrontendSpec.from_yaml(spec_path)
    except Exception as exc:  # noqa: BLE001
        print(f"❌ Failed to load spec: {exc}", file=sys.stderr)
        return 1

    iterations = getattr(args, "iterations", None)
    if iterations is not None:
        bounded = max(0, min(11, int(iterations)))
        spec = spec.with_overrides(deepening_cycles=bounded)

    output_override = getattr(args, "output_dir", None)
    if output_override:
        out_path = Path(output_override).expanduser()
        out_path.mkdir(parents=True, exist_ok=True)
        spec = spec.with_overrides(out_dir=out_path)

    telemetry_enabled = bool(getattr(args, "telemetry", False))

    print(f"--- Running SkillBuilder for spec: {spec.mode_name}")
    print(f"    Source: {spec_path}")
    if iterations is not None:
        print(f"    Deepening cycles override: {spec.deepening_cycles}")
    if output_override:
        print(f"    Output dir: {spec.out_dir / spec.mode_name}")
    print(f"    Telemetry: {'enabled' if telemetry_enabled else 'disabled'}")

    result = run_pipeline(spec, telemetry_enabled=telemetry_enabled)

    if not result.success:
        print(f"❌ Pipeline failed: {result.error}", file=sys.stderr)
        return 1

    print(f"✅ SkillBuilder run completed in {result.duration_ms:.0f} ms")
    print(f"   Output directory: {result.output_dir}")
    if result.written_files:
        for artifact in result.written_files:
            print(f"     - {artifact.name}")
    print(f"   Skills generated: {len(result.skills)}")
    print(f"   Semantic map entries: {len(result.semantic_map)}")

    return 0


def cmd_batch_merge(args: argparse.Namespace) -> int:
    """Execute batch mode merge (semantic clustering + merge)."""
    try:
        from skill_builder.pipeline.runner import run_batch_mode_merge
        from skill_builder.pipeline.mode_merge import ModeBatchMergeSpec
    except Exception as e:
        print(f"❌ Cannot load batch merge components: {e}", file=sys.stderr)
        return 1

    mode_folder = Path(getattr(args, "mode_folder", "")) if getattr(args, "mode_folder", None) else Path("ExistingModes/JTG")
    target_count = int(getattr(args, "target_mode_count", 125))
    role_map_path = getattr(args, "role_map", "config/role-map.yaml")
    enable_role_tagging = bool(getattr(args, "enable_role_tagging", False))
    role_tagging_prompt = getattr(args, "role_tagging_prompt", None)
    max_cluster_size = int(getattr(args, "max_cluster_size", 10))

    spec = ModeBatchMergeSpec(
        mode_folder=mode_folder,
        target_mode_count=target_count,
        role_map_path=Path(role_map_path),
        enable_role_tagging=enable_role_tagging,
        role_tagging_prompt=role_tagging_prompt,
        max_cluster_size=max_cluster_size,
    )

    print(f"🔄 Running batch merge on {mode_folder} → target {target_count} clusters")

    try:
        result = run_batch_mode_merge(spec)
        print("✅ Batch merge complete")
        print(f"   Run ID: {result.get('run_id')}")
        print(f"   Clusters: {result.get('cluster_count')}")
        print(f"   Outputs: {len(result.get('written_files', []))} files under {spec.output_dir}")
        print(f"   Telemetry: {result.get('telemetry_path')}")
        return 0
    except Exception as e:
        print(f"❌ Batch merge failed: {e}", file=sys.stderr)
        return 1


def cmd_calibrate(args: argparse.Namespace) -> int:
    """Train/update offline calibration artifact from prior telemetry runs."""
    from skill_builder.pipeline.telemetry import train_basic_calibration_model

    runs_dir = Path(getattr(args, "runs_dir", ".roo/runs"))
    model_path = Path(getattr(args, "model_path", ".roo/calibration/basic.json"))

    try:
        result = train_basic_calibration_model(runs_dir=runs_dir, model_path=model_path)
        print("✅ Calibration model updated")
        print(f"   Runs dir: {result.get('runs_dir')}")
        print(f"   Model path: {result.get('model_path')}")
        print(f"   Runs seen: {result.get('runs_seen')}")
        return 0
    except Exception as e:
        print(f"❌ Calibration failed: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
