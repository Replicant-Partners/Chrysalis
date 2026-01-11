#!/usr/bin/env python3
"""
Enhanced Quality Metrics Collector

Collects quality metrics from multiple tools (Python and TypeScript)
and aggregates them into a unified format.

Design Pattern: Facade Pattern (GoF, p. 185)
- Provides unified interface for collecting quality metrics
- Hides complexity of multiple tool integrations

References:
- Gamma, E., Helm, R., Johnson, R., & Vlissides, J. (1994). Design Patterns: Elements of Reusable Object-Oriented Software. Addison-Wesley. p. 185.
"""

import json
import subprocess
import sys
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
import os


@dataclass
class QualityMetrics:
    """Aggregated quality metrics"""
    timestamp: str
    total_issues: int
    total_errors: int
    total_warnings: int
    total_fixable_issues: int
    files_checked: int
    files_with_issues: int
    tool_metrics: Dict[str, Dict[str, Any]]
    summary: Dict[str, Any]


class PythonQualityCollector:
    """Collects quality metrics from Python tools"""

    def __init__(self, project_root: Path):
        self.project_root = project_root

    def collect_flake8_metrics(self) -> Dict[str, Any]:
        """Collect metrics from flake8"""
        try:
            result = subprocess.run(
                ['flake8', '--format=json', '--statistics', '.'],
                cwd=self.project_root,
                capture_output=True,
                text=True,
                timeout=300
            )

            errors: List[Dict[str, Any]] = []
            if result.stdout:
                try:
                    # flake8 --format=json outputs one JSON object per line
                    lines = result.stdout.strip().split('\n')
                    for line in lines:
                        if line.strip():
                            error_data = json.loads(line)
                            errors.append(error_data)
                except json.JSONDecodeError:
                    # Fallback: parse text output
                    pass

            total_errors = len(errors)
            files_with_errors = len(set(e.get('filename', '') for e in errors))

            return {
                'tool': 'flake8',
                'success': result.returncode == 0 or total_errors == 0,
                'total_issues': total_errors,
                'errors': total_errors,
                'warnings': 0,
                'fixable_issues': 0,  # flake8 doesn't auto-fix
                'files_checked': 0,
                'files_with_issues': files_with_errors,
                'output': result.stdout,
                'error_output': result.stderr,
            }
        except subprocess.TimeoutExpired:
            return {
                'tool': 'flake8',
                'success': False,
                'total_issues': 0,
                'errors': 0,
                'warnings': 0,
                'fixable_issues': 0,
                'files_checked': 0,
                'files_with_issues': 0,
                'error_output': 'flake8 execution timed out',
            }
        except FileNotFoundError:
            return {
                'tool': 'flake8',
                'success': False,
                'total_issues': 0,
                'errors': 0,
                'warnings': 0,
                'fixable_issues': 0,
                'files_checked': 0,
                'files_with_issues': 0,
                'error_output': 'flake8 not found',
            }

    def collect_black_metrics(self) -> Dict[str, Any]:
        """Collect metrics from black (check mode)"""
        try:
            result = subprocess.run(
                ['black', '--check', '--diff', '.'],
                cwd=self.project_root,
                capture_output=True,
                text=True,
                timeout=300
            )

            # Count files that need reformatting
            files_need_formatting = result.stdout.count('would reformat')
            total_changes = result.stdout.count('---') // 2  # Each diff has two --- lines

            return {
                'tool': 'black',
                'success': result.returncode == 0,
                'total_issues': files_need_formatting,
                'errors': 0,
                'warnings': files_need_formatting,
                'fixable_issues': files_need_formatting,  # black can auto-fix
                'files_checked': 0,
                'files_with_issues': files_need_formatting,
                'output': result.stdout,
                'error_output': result.stderr,
            }
        except subprocess.TimeoutExpired:
            return {
                'tool': 'black',
                'success': False,
                'total_issues': 0,
                'errors': 0,
                'warnings': 0,
                'fixable_issues': 0,
                'files_checked': 0,
                'files_with_issues': 0,
                'error_output': 'black execution timed out',
            }
        except FileNotFoundError:
            return {
                'tool': 'black',
                'success': False,
                'total_issues': 0,
                'errors': 0,
                'warnings': 0,
                'fixable_issues': 0,
                'files_checked': 0,
                'files_with_issues': 0,
                'error_output': 'black not found',
            }

    def collect_mypy_metrics(self) -> Dict[str, Any]:
        """Collect metrics from mypy"""
        try:
            result = subprocess.run(
                ['mypy', '--show-error-codes', '--no-error-summary', '.'],
                cwd=self.project_root,
                capture_output=True,
                text=True,
                timeout=300
            )

            # Parse mypy output
            lines = result.stdout.split('\n')
            errors = [line for line in lines if line.strip() and 'error:' in line]
            notes = [line for line in lines if line.strip() and 'note:' in line]

            total_errors = len(errors)
            files_with_errors = len(set(
                line.split(':')[0] for line in errors
                if ':' in line and not line.startswith(' ')
            ))

            return {
                'tool': 'mypy',
                'success': result.returncode == 0 or total_errors == 0,
                'total_issues': total_errors,
                'errors': total_errors,
                'warnings': len(notes),
                'fixable_issues': 0,  # mypy doesn't auto-fix
                'files_checked': 0,
                'files_with_issues': files_with_errors,
                'output': result.stdout,
                'error_output': result.stderr,
            }
        except subprocess.TimeoutExpired:
            return {
                'tool': 'mypy',
                'success': False,
                'total_issues': 0,
                'errors': 0,
                'warnings': 0,
                'fixable_issues': 0,
                'files_checked': 0,
                'files_with_issues': 0,
                'error_output': 'mypy execution timed out',
            }
        except FileNotFoundError:
            return {
                'tool': 'mypy',
                'success': False,
                'total_issues': 0,
                'errors': 0,
                'warnings': 0,
                'fixable_issues': 0,
                'files_checked': 0,
                'files_with_issues': 0,
                'error_output': 'mypy not found',
            }

    def collect_all_metrics(self) -> Dict[str, Dict[str, Any]]:
        """Collect metrics from all Python tools"""
        return {
            'flake8': self.collect_flake8_metrics(),
            'black': self.collect_black_metrics(),
            'mypy': self.collect_mypy_metrics(),
        }


class TypeScriptQualityCollector:
    """Collects quality metrics from TypeScript tools"""

    def __init__(self, project_root: Path):
        self.project_root = project_root

    def collect_eslint_metrics(self) -> Dict[str, Any]:
        """Collect metrics from ESLint"""
        try:
            # Try npm run lint first, then direct eslint
            package_json_path = self.project_root / 'package.json'
            use_npm = False

            if package_json_path.exists():
                try:
                    with open(package_json_path, 'r') as f:
                        package_json = json.load(f)
                        if 'scripts' in package_json and 'lint' in package_json['scripts']:
                            use_npm = True
                except (json.JSONDecodeError, KeyError):
                    pass

            if use_npm:
                result = subprocess.run(
                    ['npm', 'run', 'lint', '--', '--format', 'json'],
                    cwd=self.project_root,
                    capture_output=True,
                    text=True,
                    timeout=300
                )
            else:
                result = subprocess.run(
                    ['eslint', '--format', 'json', '.'],
                    cwd=self.project_root,
                    capture_output=True,
                    text=True,
                    timeout=300
                )

            errors: List[Dict[str, Any]] = []
            warnings: List[Dict[str, Any]] = []
            total_issues = 0
            fixable_issues = 0
            files_with_issues = 0

            if result.stdout:
                try:
                    eslint_results = json.loads(result.stdout)
                    if isinstance(eslint_results, list):
                        for file_result in eslint_results:
                            if 'messages' in file_result:
                                files_with_issues += 1
                                for message in file_result['messages']:
                                    total_issues += 1
                                    if message['severity'] == 2:
                                        errors.append(message)
                                    else:
                                        warnings.append(message)
                                    if 'fix' in message and message['fix']:
                                        fixable_issues += 1
                except json.JSONDecodeError:
                    # Fallback: count lines
                    total_issues = len([l for l in result.stdout.split('\n') if l.strip()])

            return {
                'tool': 'eslint',
                'success': result.returncode == 0 or total_issues == 0,
                'total_issues': total_issues,
                'errors': len(errors),
                'warnings': len(warnings),
                'fixable_issues': fixable_issues,
                'files_checked': 0,
                'files_with_issues': files_with_issues,
                'output': result.stdout,
                'error_output': result.stderr,
            }
        except subprocess.TimeoutExpired:
            return {
                'tool': 'eslint',
                'success': False,
                'total_issues': 0,
                'errors': 0,
                'warnings': 0,
                'fixable_issues': 0,
                'files_checked': 0,
                'files_with_issues': 0,
                'error_output': 'eslint execution timed out',
            }
        except FileNotFoundError:
            return {
                'tool': 'eslint',
                'success': False,
                'total_issues': 0,
                'errors': 0,
                'warnings': 0,
                'fixable_issues': 0,
                'files_checked': 0,
                'files_with_issues': 0,
                'error_output': 'eslint not found',
            }

    def collect_tsc_metrics(self) -> Dict[str, Any]:
        """Collect metrics from TypeScript compiler"""
        try:
            # Try npm run typecheck first, then direct tsc
            package_json_path = self.project_root / 'package.json'
            use_npm = False

            if package_json_path.exists():
                try:
                    with open(package_json_path, 'r') as f:
                        package_json = json.load(f)
                        if 'scripts' in package_json:
                            if 'typecheck' in package_json['scripts']:
                                use_npm = True
                            elif 'build:check' in package_json['scripts']:
                                use_npm = True
                except (json.JSONDecodeError, KeyError):
                    pass

            if use_npm:
                script_name = 'typecheck' if 'typecheck' in package_json.get('scripts', {}) else 'build:check'
                result = subprocess.run(
                    ['npm', 'run', script_name],
                    cwd=self.project_root,
                    capture_output=True,
                    text=True,
                    timeout=300
                )
            else:
                result = subprocess.run(
                    ['tsc', '--noEmit'],
                    cwd=self.project_root,
                    capture_output=True,
                    text=True,
                    timeout=300
                )

            # Parse TypeScript output
            output = result.stdout + result.stderr
            lines = output.split('\n')
            errors = [line for line in lines if 'error TS' in line]
            warnings = [line for line in lines if 'warning TS' in line]

            total_errors = len(errors)
            total_warnings = len(warnings)
            files_with_errors = len(set(
                line.split('(')[0].strip() for line in errors
                if '(' in line and not line.startswith(' ')
            ))

            return {
                'tool': 'tsc',
                'success': result.returncode == 0 or (total_errors == 0 and total_warnings == 0),
                'total_issues': total_errors + total_warnings,
                'errors': total_errors,
                'warnings': total_warnings,
                'fixable_issues': 0,  # tsc doesn't auto-fix
                'files_checked': 0,
                'files_with_issues': files_with_errors,
                'output': result.stdout,
                'error_output': result.stderr,
            }
        except subprocess.TimeoutExpired:
            return {
                'tool': 'tsc',
                'success': False,
                'total_issues': 0,
                'errors': 0,
                'warnings': 0,
                'fixable_issues': 0,
                'files_checked': 0,
                'files_with_issues': 0,
                'error_output': 'tsc execution timed out',
            }
        except FileNotFoundError:
            return {
                'tool': 'tsc',
                'success': False,
                'total_issues': 0,
                'errors': 0,
                'warnings': 0,
                'fixable_issues': 0,
                'files_checked': 0,
                'files_with_issues': 0,
                'error_output': 'tsc not found',
            }

    def collect_all_metrics(self) -> Dict[str, Dict[str, Any]]:
        """Collect metrics from all TypeScript tools"""
        return {
            'eslint': self.collect_eslint_metrics(),
            'tsc': self.collect_tsc_metrics(),
        }


class EnhancedQualityMetricsCollector:
    """Enhanced quality metrics collector"""

    def __init__(self, project_root: Optional[Path] = None):
        self.project_root = Path(project_root) if project_root else Path.cwd()
        self.python_collector = PythonQualityCollector(self.project_root)
        self.typescript_collector = TypeScriptQualityCollector(self.project_root)

    def collect_all_metrics(self) -> QualityMetrics:
        """Collect metrics from all tools"""
        python_metrics = self.python_collector.collect_all_metrics()
        typescript_metrics = self.typescript_collector.collect_all_metrics()

        # Aggregate metrics
        tool_metrics = {**python_metrics, **typescript_metrics}

        total_issues = sum(m.get('total_issues', 0) for m in tool_metrics.values())
        total_errors = sum(m.get('errors', 0) for m in tool_metrics.values())
        total_warnings = sum(m.get('warnings', 0) for m in tool_metrics.values())
        total_fixable = sum(m.get('fixable_issues', 0) for m in tool_metrics.values())

        # Estimate files checked (sum of files_with_issues as proxy)
        files_with_issues = sum(m.get('files_with_issues', 0) for m in tool_metrics.values())

        # Calculate success rate
        tools_succeeded = sum(1 for m in tool_metrics.values() if m.get('success', False))
        tools_total = len(tool_metrics)
        success_rate = (tools_succeeded / tools_total * 100) if tools_total > 0 else 0

        summary = {
            'tools_executed': tools_total,
            'tools_succeeded': tools_succeeded,
            'tools_failed': tools_total - tools_succeeded,
            'success_rate': success_rate,
            'has_errors': total_errors > 0,
            'has_warnings': total_warnings > 0,
            'has_fixable_issues': total_fixable > 0,
        }

        return QualityMetrics(
            timestamp=datetime.utcnow().isoformat(),
            total_issues=total_issues,
            total_errors=total_errors,
            total_warnings=total_warnings,
            total_fixable_issues=total_fixable,
            files_checked=0,  # Would need more sophisticated counting
            files_with_issues=files_with_issues,
            tool_metrics=tool_metrics,
            summary=summary,
        )

    def collect_metrics_json(self) -> str:
        """Collect metrics and return as JSON string"""
        metrics = self.collect_all_metrics()
        return json.dumps(asdict(metrics), indent=2)

    def save_metrics(self, output_path: Path) -> None:
        """Collect metrics and save to file"""
        metrics = self.collect_all_metrics()
        with open(output_path, 'w') as f:
            json.dump(asdict(metrics), f, indent=2)


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(
        description='Collect quality metrics from multiple tools'
    )
    parser.add_argument(
        '--project-root',
        type=Path,
        default=Path.cwd(),
        help='Project root directory (default: current directory)'
    )
    parser.add_argument(
        '--output',
        type=Path,
        help='Output file path (default: print to stdout)'
    )
    parser.add_argument(
        '--format',
        choices=['json', 'summary'],
        default='json',
        help='Output format (default: json)'
    )

    args = parser.parse_args()

    collector = EnhancedQualityMetricsCollector(args.project_root)

    if args.output:
        collector.save_metrics(args.output)
        print(f'Metrics saved to {args.output}', file=sys.stderr)
    else:
        if args.format == 'json':
            print(collector.collect_metrics_json())
        else:
            metrics = collector.collect_all_metrics()
            print(f'Quality Metrics Summary ({metrics.timestamp})')
            print(f'  Total Issues: {metrics.total_issues}')
            print(f'  Total Errors: {metrics.total_errors}')
            print(f'  Total Warnings: {metrics.total_warnings}')
            print(f'  Fixable Issues: {metrics.total_fixable_issues}')
            print(f'  Files with Issues: {metrics.files_with_issues}')
            print(f'  Tools Executed: {metrics.summary["tools_executed"]}')
            print(f'  Tools Succeeded: {metrics.summary["tools_succeeded"]}')
            print(f'  Success Rate: {metrics.summary["success_rate"]:.1f}%')


if __name__ == '__main__':
    main()
