#!/usr/bin/env python3
"""
Backup consolidated embedding and skill files before reprocessing.
"""

import shutil
from pathlib import Path
from datetime import datetime

PROJECT_ROOT = Path(__file__).parent.parent
EMBEDDINGS_DIR = PROJECT_ROOT / "Replicants" / "legends" / "Embeddings"
BACKUP_DIR = PROJECT_ROOT / "Replicants" / "legends" / "archive" / "pre_semantic_merge"

FILES_TO_BACKUP = [
    "all_embeddings.json",
    "all_skills.json",
    "all_personas.json",
]


def backup_files():
    """Backup consolidated files with timestamp."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = BACKUP_DIR / timestamp
    backup_path.mkdir(parents=True, exist_ok=True)
    
    backed_up = 0
    for filename in FILES_TO_BACKUP:
        source = EMBEDDINGS_DIR / filename
        if source.exists():
            dest = backup_path / filename
            shutil.copy2(source, dest)
            size_mb = source.stat().st_size / (1024 * 1024)
            print(f"  ✓ Backed up {filename} ({size_mb:.2f} MB)")
            backed_up += 1
        else:
            print(f"  ⚠ Skipped {filename} (not found)")
    
    print(f"\nBackup complete: {backed_up} files saved to:")
    print(f"  {backup_path}")
    
    return backup_path


if __name__ == "__main__":
    print("=" * 60)
    print("BACKING UP CONSOLIDATED FILES")
    print("=" * 60)
    backup_path = backup_files()
    print("\nTo restore from backup:")
    print(f"  cp {backup_path}/* {EMBEDDINGS_DIR}/")
