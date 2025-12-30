#!/usr/bin/env python3
"""
CrewAI Project Loader
Loads project specifications and programmatically creates CrewAI agents, tasks, and crews.

Supports:
- Loading from local directory
- Loading from GitHub repository
- Loading from ZIP archive
- Automatic parsing and CrewAI configuration generation
"""

import os
import sys
import json
import yaml
import zipfile
import tempfile
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Any
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
class ProjectConfig:
    """Project configuration for CrewAI setup."""
    project_name: str
    project_root: Path
    spec_files: List[Path]
    github_repo: Optional[str] = None
    api_keys: Dict[str, str] = None
    
    def __post_init__(self):
        if self.api_keys is None:
            self.api_keys = {}


class ProjectLoader:
    """Loads project files from various sources."""
    
    def __init__(self, config: ProjectConfig):
        self.config = config
        self.temp_dir = None
    
    def load_from_local(self, directory: Path) -> Dict[str, str]:
        """Load project files from local directory."""
        files = {}
        
        # Find specification files
        spec_patterns = [
            "**/*spec*.md",
            "**/*spec*.yaml",
            "**/*spec*.yml",
            "**/*spec*.json",
            "**/functional*.md",
            "**/technical*.md",
            "**/architecture*.md",
            "**/requirements*.md",
        ]
        
        for pattern in spec_patterns:
            for file_path in directory.glob(pattern):
                if file_path.is_file():
                    relative_path = file_path.relative_to(directory)
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            files[str(relative_path)] = f.read()
                    except Exception as e:
                        print(f"Warning: Could not read {file_path}: {e}")
        
        return files
    
    def load_from_github(self, repo_url: str, branch: str = "main") -> Dict[str, str]:
        """Load project files from GitHub repository."""
        self.temp_dir = tempfile.mkdtemp(prefix="crewai_github_")
        repo_path = Path(self.temp_dir) / "repo"
        
        try:
            # Clone repository
            print(f"Cloning repository: {repo_url}")
            subprocess.run(
                ["git", "clone", "--depth", "1", "-b", branch, repo_url, str(repo_path)],
                check=True,
                capture_output=True
            )
            
            # Load files
            files = self.load_from_local(repo_path)
            return files
            
        except subprocess.CalledProcessError as e:
            raise Exception(f"Failed to clone repository: {e}")
        except Exception as e:
            raise Exception(f"Error loading from GitHub: {e}")
    
    def load_from_zip(self, zip_path: Path) -> Dict[str, str]:
        """Load project files from ZIP archive."""
        self.temp_dir = tempfile.mkdtemp(prefix="crewai_zip_")
        extract_path = Path(self.temp_dir) / "extracted"
        extract_path.mkdir()
        
        try:
            # Extract ZIP
            print(f"Extracting ZIP: {zip_path}")
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(extract_path)
            
            # Load files
            files = self.load_from_local(extract_path)
            return files
            
        except Exception as e:
            raise Exception(f"Error loading from ZIP: {e}")
    
    def cleanup(self):
        """Clean up temporary directories."""
        if self.temp_dir and Path(self.temp_dir).exists():
            shutil.rmtree(self.temp_dir)


class SpecificationParser:
    """Parses specification documents to extract requirements."""
    
    def __init__(self, files: Dict[str, str]):
        self.files = files
        self.requirements = {}
        self.architecture = {}
        self.parsed_data = {}
    
    def parse_all(self) -> Dict[str, Any]:
        """Parse all specification files."""
        print("Parsing specification files...")
        
        # Parse functional specifications
        self.requirements = self._parse_functional_specs()
        
        # Parse technical architecture
        self.architecture = self._parse_technical_arch()
        
        # Extract key information
        self.parsed_data = {
            "functional_requirements": self.requirements,
            "technical_architecture": self.architecture,
            "user_personas": self._extract_personas(),
            "technology_stack": self._extract_tech_stack(),
            "features": self._extract_features(),
            "non_functional_requirements": self._extract_nfr(),
        }
        
        return self.parsed_data
    
    def _parse_functional_specs(self) -> Dict[str, Any]:
        """Parse functional specification documents."""
        requirements = {}
        
        for file_path, content in self.files.items():
            if "functional" in file_path.lower() or "spec" in file_path.lower():
                # Extract features, requirements, personas
                # This is a simplified parser - enhance based on your spec format
                requirements[file_path] = {
                    "content": content,
                    "features": self._extract_markdown_sections(content, "##"),
                    "requirements": self._extract_requirements(content),
                }
        
        return requirements
    
    def _parse_technical_arch(self) -> Dict[str, Any]:
        """Parse technical architecture documents."""
        architecture = {}
        
        for file_path, content in self.files.items():
            if "technical" in file_path.lower() or "architecture" in file_path.lower():
                architecture[file_path] = {
                    "content": content,
                    "components": self._extract_components(content),
                    "technology_stack": self._extract_tech_stack_from_content(content),
                }
        
        return architecture
    
    def _extract_markdown_sections(self, content: str, prefix: str) -> List[str]:
        """Extract markdown sections."""
        sections = []
        for line in content.split('\n'):
            if line.startswith(prefix):
                sections.append(line.strip())
        return sections
    
    def _extract_requirements(self, content: str) -> List[str]:
        """Extract requirements from content."""
        requirements = []
        in_requirements = False
        
        for line in content.split('\n'):
            if "requirement" in line.lower() and ("##" in line or "###" in line):
                in_requirements = True
            elif in_requirements and line.strip().startswith('-'):
                requirements.append(line.strip())
            elif in_requirements and line.startswith('##'):
                in_requirements = False
        
        return requirements
    
    def _extract_components(self, content: str) -> List[str]:
        """Extract system components from architecture."""
        components = []
        # Simple extraction - enhance based on your format
        for line in content.split('\n'):
            if "component" in line.lower() or "service" in line.lower():
                if line.strip().startswith('-') or ':' in line:
                    components.append(line.strip())
        return components
    
    def _extract_tech_stack_from_content(self, content: str) -> Dict[str, List[str]]:
        """Extract technology stack from content."""
        tech_stack = {}
        current_section = None
        
        for line in content.split('\n'):
            if line.startswith('###') or line.startswith('##'):
                current_section = line.strip().lower()
            elif current_section and ('-' in line or ':' in line):
                if 'frontend' in current_section:
                    tech_stack.setdefault('frontend', []).append(line.strip())
                elif 'backend' in current_section:
                    tech_stack.setdefault('backend', []).append(line.strip())
                elif 'database' in current_section:
                    tech_stack.setdefault('database', []).append(line.strip())
        
        return tech_stack
    
    def _extract_personas(self) -> List[Dict[str, Any]]:
        """Extract user personas from specifications."""
        personas = []
        # Extract from functional specs
        for file_path, data in self.requirements.items():
            content = data.get('content', '')
            # Simple extraction - enhance based on your format
            if 'persona' in content.lower():
                # Extract persona information
                pass
        return personas
    
    def _extract_tech_stack(self) -> Dict[str, Any]:
        """Extract technology stack."""
        tech_stack = {}
        for file_path, data in self.architecture.items():
            tech_stack.update(data.get('technology_stack', {}))
        return tech_stack
    
    def _extract_features(self) -> List[str]:
        """Extract features from specifications."""
        features = []
        for file_path, data in self.requirements.items():
            features.extend(data.get('features', []))
        return features
    
    def _extract_nfr(self) -> Dict[str, Any]:
        """Extract non-functional requirements."""
        nfr = {}
        # Extract from specs
        return nfr


class CrewAIConfigGenerator:
    """Generates CrewAI configuration from parsed specifications."""
    
    def __init__(self, parsed_data: Dict[str, Any], api_keys: Dict[str, str]):
        self.parsed_data = parsed_data
        self.api_keys = api_keys
        self.llms = self._setup_llms()
        self.tools = self._setup_tools()
    
    def _setup_llms(self) -> Dict[str, Any]:
        """Setup LLM configurations."""
        llms = {}
        
        # Orchestrator LLM
        if self.api_keys.get('ANTHROPIC_API_KEY'):
            llms['orchestrator'] = ChatAnthropic(
                model="claude-3-opus-20240229",
                temperature=0.3,
                max_tokens=4096,
                api_key=self.api_keys['ANTHROPIC_API_KEY']
            )
        elif self.api_keys.get('OPENAI_API_KEY'):
            llms['orchestrator'] = ChatOpenAI(
                model="gpt-4-turbo-preview",
                temperature=0.3,
                max_tokens=4096,
                api_key=self.api_keys['OPENAI_API_KEY']
            )
        
        # Specialist LLM
        if self.api_keys.get('ANTHROPIC_API_KEY'):
            llms['specialist'] = ChatAnthropic(
                model="claude-3-sonnet-20240229",
                temperature=0.5,
                max_tokens=4096,
                api_key=self.api_keys['ANTHROPIC_API_KEY']
            )
        elif self.api_keys.get('OPENAI_API_KEY'):
            llms['specialist'] = ChatOpenAI(
                model="gpt-4",
                temperature=0.5,
                max_tokens=4096,
                api_key=self.api_keys['OPENAI_API_KEY']
            )
        
        # Worker LLM
        if self.api_keys.get('ANTHROPIC_API_KEY'):
            llms['worker'] = ChatAnthropic(
                model="claude-3-haiku-20240307",
                temperature=0.3,
                max_tokens=2048,
                api_key=self.api_keys['ANTHROPIC_API_KEY']
            )
        elif self.api_keys.get('OPENAI_API_KEY'):
            llms['worker'] = ChatOpenAI(
                model="gpt-3.5-turbo",
                temperature=0.3,
                max_tokens=2048,
                api_key=self.api_keys['OPENAI_API_KEY']
            )
        
        return llms
    
    def _setup_tools(self) -> Dict[str, Any]:
        """Setup CrewAI tools."""
        return {
            'file_read': FileReadTool(),
            'file_write': FileWriteTool(),
            'directory_read': DirectoryReadTool(),
            'code_interpreter': CodeInterpreterTool(),
            'git': GitTool(),
        }
    
    def generate_agents(self) -> List[Agent]:
        """Generate agents from specifications."""
        agents = []
        
        # This is a template - customize based on your parsed data
        # Example: Create agents based on identified domains/workstreams
        
        features = self.parsed_data.get('features', [])
        tech_stack = self.parsed_data.get('technology_stack', {})
        
        # Create agents based on domains identified in specs
        # This is simplified - enhance based on your Spec2CrewPlan.md approach
        
        return agents
    
    def generate_tasks(self, agents: List[Agent]) -> List[Task]:
        """Generate tasks from specifications."""
        tasks = []
        
        # Generate tasks based on features and requirements
        # This is simplified - enhance based on your Spec2CrewPlan.md approach
        
        return tasks
    
    def generate_crews(self, agents: List[Agent], tasks: List[Task]) -> List[Crew]:
        """Generate crews from agents and tasks."""
        crews = []
        
        # Group agents into crews based on teams
        # This is simplified - enhance based on your Spec2CrewPlan.md approach
        
        return crews
    
    def generate_complete_config(self) -> Dict[str, Any]:
        """Generate complete CrewAI configuration."""
        agents = self.generate_agents()
        tasks = self.generate_tasks(agents)
        crews = self.generate_crews(agents, tasks)
        
        return {
            'agents': agents,
            'tasks': tasks,
            'crews': crews,
            'llms': self.llms,
            'tools': self.tools,
        }


class CrewAILoader:
    """Main class for loading project into CrewAI."""
    
    def __init__(self, config: ProjectConfig):
        self.config = config
        self.loader = ProjectLoader(config)
        self.files = {}
        self.parsed_data = {}
        self.crewai_config = {}
    
    def load_from_source(self, source_type: str, source_path: str) -> Dict[str, str]:
        """Load files from specified source."""
        if source_type == "local":
            return self.loader.load_from_local(Path(source_path))
        elif source_type == "github":
            return self.loader.load_from_github(source_path)
        elif source_type == "zip":
            return self.loader.load_from_zip(Path(source_path))
        else:
            raise ValueError(f"Unknown source type: {source_type}")
    
    def parse_specifications(self) -> Dict[str, Any]:
        """Parse loaded specifications."""
        parser = SpecificationParser(self.files)
        self.parsed_data = parser.parse_all()
        return self.parsed_data
    
    def generate_crewai_config(self) -> Dict[str, Any]:
        """Generate CrewAI configuration."""
        generator = CrewAIConfigGenerator(
            self.parsed_data,
            self.config.api_keys
        )
        self.crewai_config = generator.generate_complete_config()
        return self.crewai_config
    
    def save_config(self, output_path: Path):
        """Save CrewAI configuration to file."""
        # Save as Python module
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        config_code = self._generate_config_code()
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(config_code)
        
        print(f"Configuration saved to: {output_path}")
    
    def _generate_config_code(self) -> str:
        """Generate Python code for CrewAI configuration."""
        # This would generate the actual Python code
        # Simplified version - enhance to generate full config
        return f"""
# Auto-generated CrewAI Configuration
# Generated from project specifications

from crewai import Agent, Task, Crew, Process
from crewai_tools import FileReadTool, FileWriteTool, DirectoryReadTool, CodeInterpreterTool
from langchain_anthropic import ChatAnthropic
import os

# LLM Configurations
orchestrator_llm = ChatAnthropic(
    model="claude-3-opus-20240229",
    temperature=0.3,
    max_tokens=4096,
    api_key=os.getenv("ANTHROPIC_API_KEY")
)

specialist_llm = ChatAnthropic(
    model="claude-3-sonnet-20240229",
    temperature=0.5,
    max_tokens=4096,
    api_key=os.getenv("ANTHROPIC_API_KEY")
)

worker_llm = ChatAnthropic(
    model="claude-3-haiku-20240307",
    temperature=0.3,
    max_tokens=2048,
    api_key=os.getenv("ANTHROPIC_API_KEY")
)

# Tools
file_read_tool = FileReadTool()
file_write_tool = FileWriteTool()
directory_read_tool = DirectoryReadTool()
code_interpreter_tool = CodeInterpreterTool()

# Agents, Tasks, and Crews will be generated here
# Based on parsed specifications
"""
    
    def cleanup(self):
        """Clean up resources."""
        self.loader.cleanup()


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Load project specifications into CrewAI"
    )
    
    parser.add_argument(
        '--source',
        choices=['local', 'github', 'zip'],
        required=True,
        help='Source type: local directory, GitHub repo, or ZIP file'
    )
    
    parser.add_argument(
        '--path',
        required=True,
        help='Path to source (directory path, GitHub URL, or ZIP file path)'
    )
    
    parser.add_argument(
        '--output',
        default='crewai_config.py',
        help='Output file for CrewAI configuration (default: crewai_config.py)'
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
        '--project-name',
        default='Project',
        help='Project name (default: Project)'
    )
    
    args = parser.parse_args()
    
    # Setup API keys
    api_keys = {}
    if args.anthropic_key:
        api_keys['ANTHROPIC_API_KEY'] = args.anthropic_key
    elif os.getenv('ANTHROPIC_API_KEY'):
        api_keys['ANTHROPIC_API_KEY'] = os.getenv('ANTHROPIC_API_KEY')
    
    if args.openai_key:
        api_keys['OPENAI_API_KEY'] = args.openai_key
    elif os.getenv('OPENAI_API_KEY'):
        api_keys['OPENAI_API_KEY'] = os.getenv('OPENAI_API_KEY')
    
    if not api_keys:
        print("Warning: No API keys provided. Set ANTHROPIC_API_KEY or OPENAI_API_KEY")
    
    # Create config
    config = ProjectConfig(
        project_name=args.project_name,
        project_root=Path.cwd(),
        spec_files=[],
        api_keys=api_keys
    )
    
    # Load project
    loader = CrewAILoader(config)
    
    try:
        print(f"Loading project from {args.source}: {args.path}")
        loader.files = loader.load_from_source(args.source, args.path)
        print(f"Loaded {len(loader.files)} files")
        
        print("Parsing specifications...")
        loader.parse_specifications()
        print("Specifications parsed")
        
        print("Generating CrewAI configuration...")
        loader.generate_crewai_config()
        print("Configuration generated")
        
        print(f"Saving configuration to {args.output}...")
        loader.save_config(Path(args.output))
        print("Done!")
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        loader.cleanup()


if __name__ == "__main__":
    main()
