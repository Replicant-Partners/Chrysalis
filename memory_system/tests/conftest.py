import sys
from pathlib import Path

# Add project root to sys.path so `import memory_system` works when running tests from repo root
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))