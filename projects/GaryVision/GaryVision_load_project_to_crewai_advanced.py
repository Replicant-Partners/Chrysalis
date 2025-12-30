#!/usr/bin/env python3
"""
Advanced CrewAI Project Loader
Uses LLM-based transformation to convert specifications into CrewAI plans.

Features:
- Loads from local directory, GitHub, or ZIP
- Uses Spec2CrewPlan.md prompt for transformation
- Generates complete CrewAI configuration
- Supports incremental updates
"""

import os
import sys
import json
import yaml
import zipfile
import tempfile
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
import argparse
import subprocess

# CrewAI imports
from crewai import Agent, Task, Crew, Process
from crewai_tools import (
    FileReadTool,
    FileWriteTool,
    DirectoryReadTool,
    GitTool,
    CodeInterpreterTool,
)

# LLM imports
from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI


@dataclass
class LoaderConfig:
    """Configuration for project loader."""
    source_type: str  # 'local', 'github', 'zip'
    source_path: str
    project_name: str
    output_dir: Path
    anthropic_key: Optional[str] = None
    openai_key: Optional[str] = None
    github_branch: str = "main"
    use_llm_transformation: bool = True
    spec2crewplan_prompt_path: Optional[Path] = None


class ProjectFileLoader:
    """Loads project files from various sources."""
    
    def __init__(self, config: LoaderConfig):
        self.config = config
        self.temp_dir = None
        self.project_root = None
    
    def load(self) -> Tuple[Path, Dict[str, str]]:
        """Load project files and return project root and file contents."""
        if self.config.source_type == "local":
            return self._load_from_local()
        elif self.config.source_type == "github":
            return self._load_from_github()
        elif self.config.source_type == "zip":
            return self._load_from_zip()
        else:
            raise ValueError(f"Unknown source type: {self.config.source_type}")
    
    def _load_from_local(self) -> Tuple[Path, Dict[str, str]]:
        """Load from local directory."""
        project_root = Path(self.config.source_path).resolve()
        if not project_root.exists():
            raise FileNotFoundError(f"Directory not found: {project_root}")
        
        self.project_root = project_root
        files = self._collect_spec_files(project_root)
        return project_root, files
    
    def _load_from_github(self) -> Tuple[Path, Dict[str, str]]:
        """Load from GitHub repository."""
        self.temp_dir = tempfile.mkdtemp(prefix="crewai_github_")
        repo_path = Path(self.temp_dir) / "repo"
        
        try:
            print(f"Cloning repository: {self.config.source_path}")
            subprocess.run(
                [
                    "git", "clone",
                    "--depth", "1",
                    "-b", self.config.github_branch,
                    self.config.source_path,
                    str(repo_path)
                ],
                check=True,
                capture_output=True,
                text=True
            )
            
            self.project_root = repo_path
            files = self._collect_spec_files(repo_path)
            return repo_path, files
            
        except subprocess.CalledProcessError as e:
            raise Exception(f"Failed to clone repository: {e.stderr}")
    
    def _load_from_zip(self) -> Tuple[Path, Dict[str, str]]:
        """Load from ZIP archive."""
        self.temp_dir = tempfile.mkdtemp(prefix="crewai_zip_")
        extract_path = Path(self.temp_dir) / "extracted"
        extract_path.mkdir()
        
        zip_path = Path(self.config.source_path)
        if not zip_path.exists():
            raise FileNotFoundError(f"ZIP file not found: {zip_path}")
        
        try:
            print(f"Extracting ZIP: {zip_path}")
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(extract_path)
            
            # Find project root (might be nested)
            self.project_root = self._find_project_root(extract_path)
            files = self._collect_spec_files(self.project_root)
            return self.project_root, files
            
        except Exception as e:
            raise Exception(f"Error loading from ZIP: {e}")
    
    def _find_project_root(self, extract_path: Path) -> Path:
        """Find project root in extracted files."""
        # Look for common project indicators
        indicators = ['README.md', 'pyproject.toml', 'package.json', '.git']
        
        # Check if extract_path itself is the root
        if any((extract_path / ind).exists() for ind in indicators):
            return extract_path
        
        # Check subdirectories
        for item in extract_path.iterdir():
            if item.is_dir() and any((item / ind).exists() for ind in indicators):
                return item
        
        return extract_path
    
    def _collect_spec_files(self, root: Path) -> Dict[str, str]:
        """Collect specification files from project."""
        files = {}
        
        # Specification file patterns
        spec_patterns = [
            "**/*spec*.md",
            "**/*spec*.yaml",
            "**/*spec*.yml",
            "**/*spec*.json",
            "**/functional*.md",
            "**/technical*.md",
            "**/architecture*.md",
            "**/requirements*.md",
            "**/CREWAI*.md",  # Existing CrewAI plans
        ]
        
        # Also include key directories
        key_dirs = ['docs', 'specifications', 'requirements', 'agents']
        
        for pattern in spec_patterns:
            for file_path in root.glob(pattern):
                if file_path.is_file() and not self._should_skip(file_path):
                    relative_path = file_path.relative_to(root)
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            files[str(relative_path)] = f.read()
                    except Exception as e:
                        print(f"Warning: Could not read {file_path}: {e}")
        
        # Also collect from key directories
        for dir_name in key_dirs:
            dir_path = root / dir_name
            if dir_path.exists() and dir_path.is_dir():
                for file_path in dir_path.rglob("*.md"):
                    if not self._should_skip(file_path):
                        relative_path = file_path.relative_to(root)
                        if str(relative_path) not in files:
                            try:
                                with open(file_path, 'r', encoding='utf-8') as f:
                                    files[str(relative_path)] = f.read()
                            except Exception as e:
                                print(f"Warning: Could not read {file_path}: {e}")
        
        return files
    
    def _should_skip(self, file_path: Path) -> bool:
        """Determine if file should be skipped."""
        skip_patterns = [
            'node_modules',
            '.git',
            '__pycache__',
            '.venv',
            'venv',
            'env',
            '.env',
            'dist',
            'build',
            '.pytest_cache',
        ]
        
        path_str = str(file_path)
        return any(pattern in path_str for pattern in skip_patterns)
    
    def cleanup(self):
        """Clean up temporary directories."""
        if self.temp_dir and Path(self.temp_dir).exists():
            shutil.rmtree(self.temp_dir)


class LLMTransformer:
    """Uses LLM to transform specifications into CrewAI plans."""
    
    def __init__(self, llm, spec2crewplan_prompt: Optional[str] = None):
        self.llm = llm
        self.spec2crewplan_prompt = spec2crewplan_prompt or self._load_default_prompt()
    
    def _load_default_prompt(self) -> str:
        """Load default Spec2CrewPlan prompt."""
        # Try to load from Spec2CrewPlan.md
        prompt_path = Path(__file__).parent / "Spec2CrewPlan.md"
        if prompt_path.exists():
            with open(prompt_path, 'r', encoding='utf-8') as f:
                return f.read()
        else:
            # Return simplified prompt
            return """
Transform the provided project specifications into a comprehensive CrewAI implementation plan.

Follow these steps:
1. Analyze requirements and architecture
2. Identify work domains
3. Create agent teams
4. Define agents with complete specifications
5. Define tasks with dependencies
6. Configure crews
7. Add quality gates
8. Add automation patterns

Output complete Python code for CrewAI agents, tasks, and crews.
"""
    
    def transform(self, files: Dict[str, str], project_name: str) -> str:
        """Transform specifications into CrewAI plan."""
        # Prepare context
        context = self._prepare_context(files)
        
        # Create transformation prompt
        prompt = f"""
{self.spec2crewplan_prompt}

## Project: {project_name}

## Specification Files:
{self._format_file_list(files)}

## File Contents:
{context}

## Task:
Transform these specifications into a complete CrewAI implementation plan following the Spec2CrewPlan.md methodology.

Generate:
1. Complete agent definitions (all 45+ agents if applicable)
2. Complete task definitions with dependencies
3. Complete crew configurations
4. Quality assurance mechanisms
5. Automation patterns

Output as executable Python code.
"""
        
        # Call LLM
        print("Transforming specifications using LLM...")
        response = self.llm.invoke(prompt)
        
        return response.content
    
    def _prepare_context(self, files: Dict[str, str]) -> str:
        """Prepare context from files."""
        # Limit context size (LLM token limits)
        max_files = 20
        max_chars_per_file = 5000
        
        context_parts = []
        file_count = 0
        
        # Prioritize specification files
        priority_files = [
            'functional', 'technical', 'architecture', 'requirements',
            'CREWAI', 'spec'
        ]
        
        # Sort files by priority
        sorted_files = sorted(
            files.items(),
            key=lambda x: sum(1 for p in priority_files if p.lower() in x[0].lower()),
            reverse=True
        )
        
        for file_path, content in sorted_files:
            if file_count >= max_files:
                break
            
            # Truncate if too long
            if len(content) > max_chars_per_file:
                content = content[:max_chars_per_file] + "\n... [truncated]"
            
            context_parts.append(f"### File: {file_path}\n\n{content}\n")
            file_count += 1
        
        return "\n".join(context_parts)
    
    def _format_file_list(self, files: Dict[str, str]) -> str:
        """Format file list."""
        return "\n".join(f"- {path}" for path in sorted(files.keys()))


class CrewAIConfigGenerator:
    """Generates CrewAI configuration files."""
    
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def save_transformed_plan(self, transformed_content: str, filename: str = "crewai_plan_generated.md"):
        """Save LLM-transformed plan."""
        output_path = self.output_dir / filename
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(transformed_content)
        print(f"Transformed plan saved to: {output_path}")
        return output_path
    
    def save_file_index(self, files: Dict[str, str], filename: str = "file_index.json"):
        """Save index of loaded files."""
        index = {
            'file_count': len(files),
            'files': list(files.keys()),
            'total_size': sum(len(content) for content in files.values()),
        }
        
        output_path = self.output_dir / filename
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(index, f, indent=2)
        print(f"File index saved to: {output_path}")
        return output_path
    
    def save_parsed_specs(self, parsed_data: Dict[str, Any], filename: str = "parsed_specs.json"):
        """Save parsed specification data."""
        output_path = self.output_dir / filename
        
        # Convert Path objects to strings for JSON serialization
        def convert_paths(obj):
            if isinstance(obj, Path):
                return str(obj)
            elif isinstance(obj, dict):
                return {k: convert_paths(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [convert_paths(item) for item in obj]
            return obj
        
        json_data = convert_paths(parsed_data)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, indent=2, default=str)
        print(f"Parsed specs saved to: {output_path}")
        return output_path


class AdvancedCrewAILoader:
    """Advanced loader with LLM transformation."""
    
    def __init__(self, config: LoaderConfig):
        self.config = config
        self.file_loader = ProjectFileLoader(config)
        self.project_root = None
        self.files = {}
        self.transformed_plan = None
        
        # Setup LLM
        self.llm = self._setup_llm()
        self.transformer = LLMTransformer(
            self.llm,
            self._load_spec2crewplan_prompt()
        )
        
        # Setup generator
        self.generator = CrewAIConfigGenerator(config.output_dir)
    
    def _setup_llm(self):
        """Setup LLM for transformation."""
        if self.config.anthropic_key:
            return ChatAnthropic(
                model="claude-3-opus-20240229",
                temperature=0.3,
                max_tokens=16000,
                api_key=self.config.anthropic_key
            )
        elif self.config.openai_key:
            return ChatOpenAI(
                model="gpt-4-turbo-preview",
                temperature=0.3,
                max_tokens=16000,
                api_key=self.config.openai_key
            )
        else:
            # Try environment variables
            if os.getenv('ANTHROPIC_API_KEY'):
                return ChatAnthropic(
                    model="claude-3-opus-20240229",
                    temperature=0.3,
                    max_tokens=16000,
                    api_key=os.getenv('ANTHROPIC_API_KEY')
                )
            elif os.getenv('OPENAI_API_KEY'):
                return ChatOpenAI(
                    model="gpt-4-turbo-preview",
                    temperature=0.3,
                    max_tokens=16000,
                    api_key=os.getenv('OPENAI_API_KEY')
                )
            else:
                raise ValueError("No LLM API key provided")
    
    def _load_spec2crewplan_prompt(self) -> Optional[str]:
        """Load Spec2CrewPlan.md prompt if available."""
        if self.config.spec2crewplan_prompt_path:
            prompt_path = self.config.spec2crewplan_prompt_path
        else:
            prompt_path = Path(__file__).parent / "Spec2CrewPlan.md"
        
        if prompt_path.exists():
            with open(prompt_path, 'r', encoding='utf-8') as f:
                return f.read()
        return None
    
    def load_and_transform(self) -> Dict[str, Any]:
        """Load project and transform to CrewAI plan."""
        # Step 1: Load files
        print(f"Loading project from {self.config.source_type}...")
        self.project_root, self.files = self.file_loader.load()
        print(f"Loaded {len(self.files)} files from {self.project_root}")
        
        # Step 2: Save file index
        self.generator.save_file_index(self.files)
        
        # Step 3: Transform using LLM (if enabled)
        if self.config.use_llm_transformation:
            print("Transforming specifications to CrewAI plan...")
            self.transformed_plan = self.transformer.transform(
                self.files,
                self.config.project_name
            )
            
            # Step 4: Save transformed plan
            output_path = self.generator.save_transformed_plan(
                self.transformed_plan,
                f"{self.config.project_name}_crewai_plan.md"
            )
            
            return {
                'status': 'success',
                'files_loaded': len(self.files),
                'project_root': str(self.project_root),
                'transformed_plan': str(output_path),
                'output_dir': str(self.config.output_dir),
            }
        else:
            # Just save files without transformation
            return {
                'status': 'success',
                'files_loaded': len(self.files),
                'project_root': str(self.project_root),
                'output_dir': str(self.config.output_dir),
            }
    
    def cleanup(self):
        """Clean up resources."""
        self.file_loader.cleanup()


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Load project specifications into CrewAI with LLM transformation",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Load from local directory
  python load_project_to_crewai_advanced.py --source local --path ./GaryVision --output-dir ./crewai_output

  # Load from GitHub
  python load_project_to_crewai_advanced.py --source github --path https://github.com/user/repo.git --output-dir ./crewai_output

  # Load from ZIP
  python load_project_to_crewai_advanced.py --source zip --path project.zip --output-dir ./crewai_output

  # Use OpenAI instead of Anthropic
  python load_project_to_crewai_advanced.py --source local --path ./GaryVision --openai-key YOUR_KEY --output-dir ./crewai_output
        """
    )
    
    parser.add_argument(
        '--source',
        choices=['local', 'github', 'zip'],
        required=True,
        help='Source type: local directory, GitHub repo URL, or ZIP file path'
    )
    
    parser.add_argument(
        '--path',
        required=True,
        help='Path to source'
    )
    
    parser.add_argument(
        '--output-dir',
        default='./crewai_output',
        help='Output directory for generated files (default: ./crewai_output)'
    )
    
    parser.add_argument(
        '--project-name',
        default='Project',
        help='Project name (default: Project)'
    )
    
    parser.add_argument(
        '--anthropic-key',
        help='Anthropic API key (or set ANTHROPIC_API_KEY env var)'
    )
    
    parser.add_argument(
        '--openai-key',
        help='OpenAI API key (or set OPENAI_API_KEY env var)'
    )
    
    parser.add_argument(
        '--github-branch',
        default='main',
        help='GitHub branch to clone (default: main)'
    )
    
    parser.add_argument(
        '--no-llm-transform',
        action='store_true',
        help='Skip LLM transformation, just load files'
    )
    
    parser.add_argument(
        '--spec2crewplan-prompt',
        type=Path,
        help='Path to Spec2CrewPlan.md prompt file (default: ./Spec2CrewPlan.md)'
    )
    
    args = parser.parse_args()
    
    # Create config
    config = LoaderConfig(
        source_type=args.source,
        source_path=args.path,
        project_name=args.project_name,
        output_dir=Path(args.output_dir),
        anthropic_key=args.anthropic_key or os.getenv('ANTHROPIC_API_KEY'),
        openai_key=args.openai_key or os.getenv('OPENAI_API_KEY'),
        github_branch=args.github_branch,
        use_llm_transformation=not args.no_llm_transform,
        spec2crewplan_prompt_path=args.spec2crewplan_prompt,
    )
    
    # Validate
    if config.use_llm_transformation and not (config.anthropic_key or config.openai_key):
        print("Error: LLM transformation requires API key (--anthropic-key or --openai-key)", file=sys.stderr)
        sys.exit(1)
    
    # Load and transform
    loader = AdvancedCrewAILoader(config)
    
    try:
        result = loader.load_and_transform()
        
        print("\n" + "="*60)
        print("SUCCESS!")
        print("="*60)
        print(f"Files loaded: {result['files_loaded']}")
        print(f"Project root: {result['project_root']}")
        if 'transformed_plan' in result:
            print(f"Transformed plan: {result['transformed_plan']}")
        print(f"Output directory: {result['output_dir']}")
        print("="*60)
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        loader.cleanup()


if __name__ == "__main__":
    main()
