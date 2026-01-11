"""
Code Quality Metrics Collection

Following the complex learner pattern, quality metrics serve as learning interfaces
that help the system understand code patterns and quality trends over time.
"""

import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Any
import argparse


class QualityMetricsCollector:
    """
    Collect code quality metrics from various tools.

    Following complex learner pattern: metrics collection serves as learning
    interface for understanding code quality patterns and trends.
    """

    def __init__(self, project_root: Optional[Path] = None):
        """Initialize metrics collector."""
        self.project_root = project_root or Path(__file__).resolve().parents[2]
        self.metrics: Dict[str, Any] = {}

    def collect_flake8_metrics(self) -> Dict[str, Any]:
        """Collect flake8 linting metrics."""
        try:
            result = subprocess.run(
                ["flake8", "--statistics", "--count", str(self.project_root)],
                capture_output=True,
                text=True,
                timeout=300
            )

            # Parse flake8 output
            lines = result.stdout.splitlines()
            total_errors = 0
            error_counts: Dict[str, int] = {}

            for line in lines:
                if ":" in line:
                    parts = line.split(":")
                    if len(parts) >= 2:
                        file_path = parts[0]
                        error_info = ":".join(parts[1:])
                        if error_info.strip().isdigit():
                            count = int(error_info.strip())
                            total_errors += count
                            error_counts[file_path] = count

            return {
                "tool": "flake8",
                "total_errors": total_errors,
                "files_with_errors": len(error_counts),
                "error_counts": error_counts,
                "exit_code": result.returncode,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        except subprocess.TimeoutExpired:
            return {
                "tool": "flake8",
                "error": "Timeout",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        except FileNotFoundError:
            return {
                "tool": "flake8",
                "error": "Tool not found",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        except Exception as e:
            return {
                "tool": "flake8",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

    def collect_black_metrics(self) -> Dict[str, Any]:
        """Collect black formatting metrics."""
        try:
            # Check formatting (dry-run)
            result = subprocess.run(
                ["black", "--check", "--diff", str(self.project_root)],
                capture_output=True,
                text=True,
                timeout=300
            )

            # Count files that would be reformatted
            files_needing_format = 0
            if result.stdout:
                files_needing_format = result.stdout.count("would reformat")

            return {
                "tool": "black",
                "files_needing_format": files_needing_format,
                "is_formatted": result.returncode == 0,
                "exit_code": result.returncode,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        except subprocess.TimeoutExpired:
            return {
                "tool": "black",
                "error": "Timeout",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        except FileNotFoundError:
            return {
                "tool": "black",
                "error": "Tool not found",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        except Exception as e:
            return {
                "tool": "black",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

    def collect_mypy_metrics(self) -> Dict[str, Any]:
        """Collect mypy type checking metrics."""
        try:
            result = subprocess.run(
                ["mypy", str(self.project_root / "shared" / "api_core")],
                capture_output=True,
                text=True,
                timeout=300
            )

            # Parse mypy output
            lines = result.stdout.splitlines()
            error_count = 0
            note_count = 0

            for line in lines:
                if "error:" in line:
                    error_count += 1
                elif "note:" in line:
                    note_count += 1

            return {
                "tool": "mypy",
                "error_count": error_count,
                "note_count": note_count,
                "exit_code": result.returncode,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        except subprocess.TimeoutExpired:
            return {
                "tool": "mypy",
                "error": "Timeout",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        except FileNotFoundError:
            return {
                "tool": "mypy",
                "error": "Tool not found",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        except Exception as e:
            return {
                "tool": "mypy",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

    def collect_bandit_metrics(self) -> Dict[str, Any]:
        """Collect bandit security metrics."""
        try:
            result = subprocess.run(
                ["bandit", "-r", "-f", "json", str(self.project_root / "shared" / "api_core")],
                capture_output=True,
                text=True,
                timeout=300
            )

            # Parse bandit JSON output
            try:
                bandit_data = json.loads(result.stdout)
                metrics = {
                    "tool": "bandit",
                    "high_severity": bandit_data.get("metrics", {}).get("HIGH", {}).get("issues", 0),
                    "medium_severity": bandit_data.get("metrics", {}).get("MEDIUM", {}).get("issues", 0),
                    "low_severity": bandit_data.get("metrics", {}).get("LOW", {}).get("issues", 0),
                    "total_issues": bandit_data.get("metrics", {}).get("_totals", {}).get("issues", 0),
                    "exit_code": result.returncode,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
                return metrics
            except json.JSONDecodeError:
                return {
                    "tool": "bandit",
                    "error": "Failed to parse output",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
        except subprocess.TimeoutExpired:
            return {
                "tool": "bandit",
                "error": "Timeout",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        except FileNotFoundError:
            return {
                "tool": "bandit",
                "error": "Tool not found",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        except Exception as e:
            return {
                "tool": "bandit",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

    def collect_all_metrics(self) -> Dict[str, Any]:
        """Collect all quality metrics."""
        self.metrics = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "project_root": str(self.project_root),
            "tools": {
                "flake8": self.collect_flake8_metrics(),
                "black": self.collect_black_metrics(),
                "mypy": self.collect_mypy_metrics(),
                "bandit": self.collect_bandit_metrics(),
            }
        }
        return self.metrics

    def save_metrics(self, output_path: Path) -> None:
        """Save metrics to JSON file."""
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w') as f:
            json.dump(self.metrics, f, indent=2)
        print(f"Metrics saved to {output_path}")


def main():
    """Main entry point for quality metrics collection."""
    parser = argparse.ArgumentParser(description="Collect code quality metrics")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("quality_metrics.json"),
        help="Output file path (default: quality_metrics.json)"
    )
    parser.add_argument(
        "--project-root",
        type=Path,
        help="Project root directory (default: auto-detect)"
    )

    args = parser.parse_args()

    collector = QualityMetricsCollector(project_root=args.project_root)
    metrics = collector.collect_all_metrics()
    collector.save_metrics(args.output)

    # Print summary
    print("\nQuality Metrics Summary:")
    print("=" * 70)
    for tool_name, tool_metrics in metrics.get("tools", {}).items():
        if "error" in tool_metrics:
            print(f"{tool_name}: ERROR - {tool_metrics['error']}")
        else:
            print(f"{tool_name}: {tool_metrics.get('exit_code', 'unknown')}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
