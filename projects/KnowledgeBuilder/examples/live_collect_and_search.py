"""
Run a live end-to-end collection using real API keys from .env.

Usage:
  python examples/live_collect_and_search.py "Satya Nadella" Person
"""

import json
import logging
import sys
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from src.pipeline.simple_pipeline import SimplePipeline  # noqa: E402
from src.utils.embeddings import EmbeddingService  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")


def main(identifier: str, entity_type: Optional[str] = None) -> None:
    load_dotenv()
    pipeline = SimplePipeline()
    result = pipeline.collect_and_store(identifier, entity_type)
    print(json.dumps(result["entity"], indent=2))
    print("\nAttributes:")
    print(json.dumps(result["attributes"], indent=2))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python examples/live_collect_and_search.py \"Entity Name\" [EntityType]")
        sys.exit(1)
    ident = sys.argv[1]
    etype = sys.argv[2] if len(sys.argv) > 2 else None
    main(ident, etype)
