#!/usr/bin/env python3
"""
Ada Agent Onboarding Script

Facilitates autonomous configuration and workflow initiation for the Ada agent.
This script handles:
1. Environment verification
2. Model availability checks
3. Memory system initialization
4. Agent configuration loading
5. Initial prompt engineering
6. Workspace setup

Usage:
    python scripts/ada_onboard.py [--model MODEL] [--skip-memory] [--debug]
"""

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# =============================================================================
# Configuration
# =============================================================================

DEFAULT_MODEL = "qwen2.5-coder:7b"
RECOMMENDED_MODELS = [
    "qwen2.5-coder:7b",      # Primary - excellent code generation
    "qwen2.5-coder:14b",     # Fallback - better reasoning
    "deepseek-coder:6.7b",   # Alternative - strong completion
    "codellama:7b",          # Alternative - Meta's model
]

SYSTEM_AGENTS = ["ada", "lea", "phil", "david", "milton"]
AGENTS_DIR = PROJECT_ROOT / "Agents" / "system-agents"
MEMORY_SYSTEM_DIR = PROJECT_ROOT / "memory_system"

# Gateway endpoints
GATEWAY_PORT = int(os.getenv("GATEWAY_PORT", "8080"))
OLLAMA_PORT = int(os.getenv("OLLAMA_PORT", "11434"))

# =============================================================================
# Utility Functions
# =============================================================================

def log(message: str, level: str = "INFO") -> None:
    """Log a message with timestamp."""
    timestamp = time.strftime("%H:%M:%S")
    colors = {
        "INFO": "\033[94m",
        "SUCCESS": "\033[92m",
        "WARNING": "\033[93m",
        "ERROR": "\033[91m",
        "RESET": "\033[0m",
    }
    color = colors.get(level, colors["INFO"])
    print(f"{color}[{timestamp}] {level}: {message}{colors['RESET']}")


def check_command(cmd: str) -> bool:
    """Check if a command is available."""
    try:
        subprocess.run(
            ["which", cmd],
            capture_output=True,
            check=True,
        )
        return True
    except subprocess.CalledProcessError:
        return False


def run_command(cmd: List[str], check: bool = True) -> Tuple[int, str, str]:
    """Run a command and return exit code, stdout, stderr."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=check,
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.CalledProcessError as e:
        return e.returncode, e.stdout or "", e.stderr or ""


def check_service(url: str, timeout: int = 5) -> bool:
    """Check if a service is reachable."""
    try:
        import urllib.request
        urllib.request.urlopen(url, timeout=timeout)
        return True
    except Exception:
        return False


# =============================================================================
# Environment Verification
# =============================================================================

class EnvironmentVerifier:
    """Verifies that all required dependencies are available."""

    def __init__(self):
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def verify_all(self) -> bool:
        """Run all verification checks."""
        log("Verifying environment...", "INFO")

        checks = [
            ("Python version", self._check_python),
            ("Node.js", self._check_node),
            ("Go", self._check_go),
            ("Ollama", self._check_ollama),
            ("Project structure", self._check_project_structure),
        ]

        all_passed = True
        for name, check_fn in checks:
            try:
                if check_fn():
                    log(f"✓ {name}", "SUCCESS")
                else:
                    all_passed = False
            except Exception as e:
                log(f"✗ {name}: {e}", "ERROR")
                all_passed = False

        return all_passed

    def _check_python(self) -> bool:
        version = sys.version_info
        if version.major < 3 or (version.major == 3 and version.minor < 10):
            self.errors.append("Python 3.10+ required")
            return False
        return True

    def _check_node(self) -> bool:
        if not check_command("node"):
            self.errors.append("Node.js not found")
            return False

        code, stdout, _ = run_command(["node", "-v"], check=False)
        if code != 0:
            return False

        version = stdout.strip().lstrip("v")
        major = int(version.split(".")[0])
        if major < 18:
            self.errors.append(f"Node.js 18+ required (found {version})")
            return False
        return True

    def _check_go(self) -> bool:
        if not check_command("go"):
            self.errors.append("Go not found")
            return False
        return True

    def _check_ollama(self) -> bool:
        if not check_command("ollama"):
            self.warnings.append("Ollama not found - install with: curl -fsSL https://ollama.com/install.sh | sh")
            return False
        return True

    def _check_project_structure(self) -> bool:
        required_dirs = [
            PROJECT_ROOT / "src",
            PROJECT_ROOT / "go-services",
            MEMORY_SYSTEM_DIR,
            AGENTS_DIR,
        ]

        for dir_path in required_dirs:
            if not dir_path.exists():
                self.errors.append(f"Missing directory: {dir_path}")
                return False
        return True


# =============================================================================
# Model Management
# =============================================================================

class ModelManager:
    """Manages Ollama models for Ada."""

    def __init__(self, default_model: str = DEFAULT_MODEL):
        self.default_model = default_model
        self.available_models: List[str] = []

    def check_ollama_running(self) -> bool:
        """Check if Ollama service is running."""
        return check_service(f"http://localhost:{OLLAMA_PORT}/api/tags")

    def start_ollama(self) -> bool:
        """Start Ollama service."""
        log("Starting Ollama service...", "INFO")
        try:
            subprocess.Popen(
                ["ollama", "serve"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            # Wait for startup
            for _ in range(30):
                if self.check_ollama_running():
                    return True
                time.sleep(1)
            return False
        except Exception as e:
            log(f"Failed to start Ollama: {e}", "ERROR")
            return False

    def list_models(self) -> List[str]:
        """List available Ollama models."""
        code, stdout, _ = run_command(["ollama", "list"], check=False)
        if code != 0:
            return []

        models = []
        for line in stdout.strip().split("\n")[1:]:  # Skip header
            if line.strip():
                model_name = line.split()[0]
                models.append(model_name)

        self.available_models = models
        return models

    def is_model_available(self, model: str) -> bool:
        """Check if a model is available."""
        if not self.available_models:
            self.list_models()
        return model in self.available_models

    def pull_model(self, model: str) -> bool:
        """Pull a model from Ollama."""
        log(f"Pulling model: {model} (this may take a while)...", "INFO")
        code, _, stderr = run_command(["ollama", "pull", model], check=False)
        if code != 0:
            log(f"Failed to pull model: {stderr}", "ERROR")
            return False
        return True

    def test_model(self, model: str) -> bool:
        """Test that a model responds."""
        log(f"Testing model: {model}...", "INFO")
        try:
            code, stdout, _ = run_command(
                ["ollama", "run", model, "Return only the word 'ready'"],
                check=False,
            )
            return code == 0 and stdout.strip()
        except Exception:
            return False

    def ensure_model(self, model: str) -> bool:
        """Ensure a model is available and working."""
        if not self.check_ollama_running():
            if not self.start_ollama():
                return False

        if not self.is_model_available(model):
            if not self.pull_model(model):
                return False

        return self.test_model(model)


# =============================================================================
# Agent Configuration
# =============================================================================

class AgentConfigLoader:
    """Loads and validates system agent configurations."""

    def __init__(self, agents_dir: Path = AGENTS_DIR):
        self.agents_dir = agents_dir
        self.configs: Dict[str, Dict[str, Any]] = {}

    def load_config(self, agent_id: str) -> Optional[Dict[str, Any]]:
        """Load a single agent configuration."""
        possible_files = [
            f"{agent_id}_config.json",
            f"{agent_id.lower()}_config.json",
            f"{agent_id.capitalize()}_config.json",
        ]

        for filename in possible_files:
            config_path = self.agents_dir / filename
            if config_path.exists():
                try:
                    with open(config_path) as f:
                        config = json.load(f)
                    self.configs[agent_id] = config
                    return config
                except json.JSONDecodeError as e:
                    log(f"Invalid JSON in {filename}: {e}", "ERROR")
                    return None

        log(f"Config not found for agent: {agent_id}", "WARNING")
        return None

    def load_all_configs(self) -> Dict[str, Dict[str, Any]]:
        """Load all system agent configurations."""
        for agent_id in SYSTEM_AGENTS:
            self.load_config(agent_id)
        return self.configs

    def get_model_for_agent(self, agent_id: str) -> Optional[str]:
        """Get the configured model for an agent."""
        config = self.configs.get(agent_id)
        if not config:
            return None

        model_config = config.get("modelConfig", {})
        local_model = model_config.get("localModel", {})
        return local_model.get("model")

    def validate_config(self, agent_id: str) -> List[str]:
        """Validate an agent configuration."""
        errors = []
        config = self.configs.get(agent_id)

        if not config:
            errors.append(f"No configuration loaded for {agent_id}")
            return errors

        required_fields = ["id", "name", "role", "modelConfig"]
        for field in required_fields:
            if field not in config:
                errors.append(f"Missing required field: {field}")

        return errors


# =============================================================================
# Memory System Initialization
# =============================================================================

class MemoryInitializer:
    """Initializes the memory system for Ada."""

    def __init__(self, memory_dir: Path = MEMORY_SYSTEM_DIR):
        self.memory_dir = memory_dir

    def check_memory_system(self) -> bool:
        """Check if memory system is properly set up."""
        required_files = [
            self.memory_dir / "__init__.py",
            self.memory_dir / "fireproof" / "__init__.py",
        ]

        for file_path in required_files:
            if not file_path.exists():
                return False
        return True

    def initialize_ada_memory(self, agent_id: str = "ada") -> bool:
        """Initialize memory database for Ada."""
        try:
            # Import memory system
            from memory_system.fireproof.service import FireproofService

            # Create Ada's memory database
            db_name = f"chrysalis_{agent_id}"
            service = FireproofService(db_name=db_name)

            log(f"Initialized memory database: {db_name}", "SUCCESS")
            return True

        except ImportError as e:
            log(f"Memory system not available: {e}", "WARNING")
            return False
        except Exception as e:
            log(f"Failed to initialize memory: {e}", "ERROR")
            return False

    def seed_initial_knowledge(self, agent_id: str = "ada") -> bool:
        """Seed Ada with initial system knowledge."""
        try:
            from memory_system.fireproof.service import FireproofService

            db_name = f"chrysalis_{agent_id}"
            service = FireproofService(db_name=db_name)

            # Seed with system knowledge
            initial_facts = [
                {
                    "content": "Chrysalis is a Uniform Semantic Agent transformation system enabling AI agents to morph between framework implementations.",
                    "type": "semantic",
                    "tags": ["system", "architecture"],
                },
                {
                    "content": "Ada specializes in algorithmic architecture, evaluating structural elegance, composability, and pattern quality.",
                    "type": "semantic",
                    "tags": ["identity", "role"],
                },
                {
                    "content": "The Go LLM Gateway at localhost:8080 provides unified access to Ollama and other LLM providers.",
                    "type": "semantic",
                    "tags": ["infrastructure", "llm"],
                },
            ]

            for fact in initial_facts:
                service.put(fact)

            log(f"Seeded {len(initial_facts)} initial facts for {agent_id}", "SUCCESS")
            return True

        except Exception as e:
            log(f"Failed to seed knowledge: {e}", "WARNING")
            return False


# =============================================================================
# Onboarding Orchestrator
# =============================================================================

class AdaOnboarder:
    """Orchestrates the complete Ada onboarding process."""

    def __init__(
        self,
        model: str = DEFAULT_MODEL,
        skip_memory: bool = False,
        debug: bool = False,
    ):
        self.model = model
        self.skip_memory = skip_memory
        self.debug = debug

        self.env_verifier = EnvironmentVerifier()
        self.model_manager = ModelManager(model)
        self.config_loader = AgentConfigLoader()
        self.memory_initializer = MemoryInitializer()

    def run(self) -> bool:
        """Execute the complete onboarding process."""
        log("=" * 60, "INFO")
        log("Ada Agent Onboarding", "INFO")
        log("=" * 60, "INFO")
        log(f"Model: {self.model}", "INFO")
        log(f"Project: {PROJECT_ROOT}", "INFO")
        log("")

        # Step 1: Verify environment
        log("Step 1: Environment Verification", "INFO")
        if not self.env_verifier.verify_all():
            log("Environment verification failed", "ERROR")
            for error in self.env_verifier.errors:
                log(f"  - {error}", "ERROR")
            return False
        log("")

        # Step 2: Ensure model is available
        log("Step 2: Model Setup", "INFO")
        if not self.model_manager.ensure_model(self.model):
            log(f"Failed to set up model: {self.model}", "ERROR")
            return False
        log(f"✓ Model ready: {self.model}", "SUCCESS")
        log("")

        # Step 3: Load agent configurations
        log("Step 3: Agent Configuration", "INFO")
        configs = self.config_loader.load_all_configs()
        log(f"✓ Loaded {len(configs)} agent configurations", "SUCCESS")

        # Validate Ada config
        errors = self.config_loader.validate_config("ada")
        if errors:
            log("Ada configuration errors:", "WARNING")
            for error in errors:
                log(f"  - {error}", "WARNING")
        log("")

        # Step 4: Initialize memory (optional)
        if not self.skip_memory:
            log("Step 4: Memory Initialization", "INFO")
            if self.memory_initializer.check_memory_system():
                if self.memory_initializer.initialize_ada_memory():
                    self.memory_initializer.seed_initial_knowledge()
            else:
                log("Memory system not available - skipping", "WARNING")
        else:
            log("Step 4: Memory Initialization (skipped)", "INFO")
        log("")

        # Step 5: Generate startup summary
        log("Step 5: Startup Summary", "INFO")
        self._print_summary()

        return True

    def _print_summary(self) -> None:
        """Print onboarding summary."""
        print("")
        print("=" * 60)
        print("Ada Onboarding Complete")
        print("=" * 60)
        print("")
        print("Configuration:")
        print(f"  Model:          {self.model}")
        print(f"  Gateway Port:   {GATEWAY_PORT}")
        print(f"  Ollama Port:    {OLLAMA_PORT}")
        print("")
        print("Loaded Agents:")
        for agent_id, config in self.config_loader.configs.items():
            model = self.config_loader.get_model_for_agent(agent_id) or "unknown"
            print(f"  - {config.get('name', agent_id)}: {model}")
        print("")
        print("Next Steps:")
        print("  1. Start the Go gateway:   ./scripts/ada-bootstrap.sh --headless")
        print("  2. Or run the full stack:  ./scripts/ada-bootstrap.sh")
        print("")


# =============================================================================
# Main Entry Point
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Ada Agent Onboarding Script",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/ada_onboard.py
  python scripts/ada_onboard.py --model qwen2.5-coder:14b
  python scripts/ada_onboard.py --skip-memory --debug

Recommended Models:
  qwen2.5-coder:7b   - Excellent code generation (default)
  qwen2.5-coder:14b  - Better reasoning, more VRAM
  deepseek-coder:6.7b - Strong code completion
  codellama:7b       - Meta's code model
        """
    )

    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help=f"Ollama model to use (default: {DEFAULT_MODEL})",
    )
    parser.add_argument(
        "--skip-memory",
        action="store_true",
        help="Skip memory system initialization",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug output",
    )

    args = parser.parse_args()

    onboarder = AdaOnboarder(
        model=args.model,
        skip_memory=args.skip_memory,
        debug=args.debug,
    )

    success = onboarder.run()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
