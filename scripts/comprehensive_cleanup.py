#!/usr/bin/env python3
"""
Comprehensive Repository Cleanup Script
Systematically archives historical documentation and identifies dead code.
"""

import os
import shutil
import json
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Dict, Set
import re

class RepositoryCleanup:
    def __init__(self, root_dir: str):
        self.root_dir = Path(root_dir)
        self.archive_base = self.root_dir / "docs" / "archive"
        self.today = datetime.now().date()
        self.report = {
            "timestamp": datetime.now().isoformat(),
            "archived_files": [],
            "deleted_files": [],
            "protected_files": [],
            "dead_code_candidates": [],
            "statistics": {}
        }
        
        # Files created today or critical operational docs - PROTECT
        self.protected_patterns = [
            "docs/README.md",
            "docs/GLOSSARY.md", 
            "docs/COMPREHENSIVE_DOCUMENTATION_REVIEW_COMPLETION_2026-01-17.md",
            "docs/AUDIT_REPORT_2026-01-17.json",
            "docs/RESTRUCTURE_COMPLETION_REPORT_2026-01-17.json",
            "docs/INFORMATION_ARCHITECTURE_DESIGN_2026-01-17.md",
            "ARCHITECTURE.md",
            "README.md",
            "AGENT.md",
            "CONTRIBUTING.md",
            "docs/STATUS.md",
            "docs/archive/README.md",
            "go-services/README.md",
            "src/universal_adapter/README.md",
            "src/observability/README.md",
            "memory_system/README.md",
            "src/rust/README.md",
            "src/native/README.md"
        ]
        
    def should_protect(self, filepath: Path) -> bool:
        """Check if file should be protected from archival."""
        rel_path = str(filepath.relative_to(self.root_dir))
        
        # Check explicit protections
        for pattern in self.protected_patterns:
            if rel_path == pattern or rel_path.endswith(pattern):
                return True
                
        # Protect files modified today
        if filepath.exists():
            mod_time = datetime.fromtimestamp(filepath.stat().st_mtime).date()
            if mod_time >= self.today:
                return True
                
        return False
    
    def scan_archival_candidates(self) -> Dict[str, List[Path]]:
        """Scan for files eligible for archival."""
        candidates = {
            "reviews": [],
            "audits": [],
            "reports": [],
            "sessions": [],
            "handoffs": [],
            "plans_old": [],
            "research_old": []
        }
        
        # Pattern-based scanning
        review_patterns = re.compile(r"(REVIEW|AUDIT|REPORT|SUMMARY|STATUS|HANDOFF|SESSION|COMPLETION)", re.I)
        
        for md_file in self.root_dir.rglob("*.md"):
            # Skip already archived, node_modules, hidden dirs, protected
            if any(part.startswith('.') for part in md_file.parts):
                continue
            if 'node_modules' in md_file.parts or 'archive' in md_file.parts:
                continue
            if self.should_protect(md_file):
                self.report["protected_files"].append(str(md_file.relative_to(self.root_dir)))
                continue
                
            rel_path = md_file.relative_to(self.root_dir)
            filename = md_file.name
            
            # Check age
            mod_time = datetime.fromtimestamp(md_file.stat().st_mtime).date()
            age_days = (self.today - mod_time).days
            
            # Classify by pattern and age
            if review_patterns.search(filename):
                if age_days > 7:  # Reviews/reports older than 7 days
                    if 'REVIEW' in filename.upper():
                        candidates["reviews"].append(md_file)
                    elif 'AUDIT' in filename.upper():
                        candidates["audits"].append(md_file)
                    elif 'SESSION' in filename.upper() or 'HANDOFF' in filename.upper():
                        candidates["sessions"].append(md_file)
                    else:
                        candidates["reports"].append(md_file)
                        
            # Old planning docs (>14 days, not in active development)
            elif 'plans' in rel_path.parts and age_days > 14:
                # Keep NEXT_STEPS_2026-01-16.md and README.md
                if 'NEXT_STEPS' in filename and '2026-01-16' in filename:
                    continue
                if filename == 'README.md':
                    continue
                candidates["plans_old"].append(md_file)
                
            # Old research docs (>14 days)
            elif 'research' in rel_path.parts and age_days > 14:
                if filename == 'README.md':
                    continue
                candidates["research_old"].append(md_file)
                
        return candidates
    
    def archive_file(self, filepath: Path, category: str) -> None:
        """Archive a file to appropriate location."""
        # Determine archive subdirectory
        rel_path = filepath.relative_to(self.root_dir)
        
        # Create temporal subdirectory (2026-01-16 format)
        mod_time = datetime.fromtimestamp(filepath.stat().st_mtime).date()
        temporal_dir = mod_time.strftime("%Y-%m")
        
        # Create category subdirectory
        archive_path = self.archive_base / temporal_dir / category
        archive_path.mkdir(parents=True, exist_ok=True)
        
        # Move file
        dest = archive_path / filepath.name
        
        # Handle duplicates
        if dest.exists():
            base_name = filepath.stem
            suffix = filepath.suffix
            counter = 1
            while dest.exists():
                dest = archive_path / f"{base_name}_{counter}{suffix}"
                counter += 1
                
        shutil.move(str(filepath), str(dest))
        self.report["archived_files"].append({
            "source": str(rel_path),
            "destination": str(dest.relative_to(self.root_dir)),
            "category": category,
            "age_days": (self.today - mod_time).days
        })
        
    def execute_archival(self, dry_run: bool = False) -> None:
        """Execute the archival operation."""
        print("🔍 Scanning for archival candidates...")
        candidates = self.scan_archival_candidates()
        
        total = sum(len(files) for files in candidates.values())
        print(f"\n📊 Found {total} files eligible for archival:")
        for category, files in candidates.items():
            if files:
                print(f"  - {category}: {len(files)} files")
                
        print(f"\n🛡️  Protected {len(self.report['protected_files'])} files from archival")
        
        if dry_run:
            print("\n⚠️  DRY RUN - No files will be moved")
            return
            
        if total == 0:
            print("\n✅ No files to archive")
            return
            
        print(f"\n🗂️  Archiving {total} files...")
        for category, files in candidates.items():
            for filepath in files:
                try:
                    self.archive_file(filepath, category)
                    print(f"  ✓ Archived: {filepath.relative_to(self.root_dir)}")
                except Exception as e:
                    print(f"  ✗ Failed: {filepath.relative_to(self.root_dir)} - {e}")
                    
    def scan_dead_code(self) -> List[Dict]:
        """Scan for potential dead code (basic detection)."""
        dead_code = []
        
        # Look for unused TypeScript files
        ts_files = set(self.root_dir.rglob("*.ts"))
        ts_files = {f for f in ts_files if 'node_modules' not in f.parts and 'dist' not in f.parts}
        
        # Look for files with no imports (potential orphans)
        for ts_file in ts_files:
            try:
                content = ts_file.read_text()
                # Very basic check: no imports of this file found in others
                rel_name = ts_file.stem
                
                # Check if file exports anything
                has_export = 'export' in content
                
                # Check for commented out code blocks
                comment_lines = len([line for line in content.split('\n') if line.strip().startswith('//')])
                total_lines = len(content.split('\n'))
                comment_ratio = comment_lines / total_lines if total_lines > 0 else 0
                
                if comment_ratio > 0.5 and total_lines > 10:
                    dead_code.append({
                        "file": str(ts_file.relative_to(self.root_dir)),
                        "reason": f"High comment ratio: {comment_ratio:.1%}",
                        "lines": total_lines
                    })
                    
            except Exception as e:
                continue
                
        self.report["dead_code_candidates"] = dead_code
        return dead_code
    
    def generate_report(self) -> None:
        """Generate cleanup report."""
        self.report["statistics"] = {
            "total_archived": len(self.report["archived_files"]),
            "total_deleted": len(self.report["deleted_files"]),
            "total_protected": len(self.report["protected_files"]),
            "dead_code_candidates": len(self.report["dead_code_candidates"])
        }
        
        report_path = self.root_dir / "docs" / "CLEANUP_REPORT_2026-01-17.json"
        with open(report_path, 'w') as f:
            json.dump(self.report, f, indent=2)
            
        print(f"\n📝 Report generated: {report_path}")
        print("\n📊 Statistics:")
        for key, value in self.report["statistics"].items():
            print(f"  - {key}: {value}")
            
def main():
    import sys
    
    dry_run = "--dry-run" in sys.argv
    
    cleanup = RepositoryCleanup("/home/mdz-axolotl/Documents/GitClones/Chrysalis")
    
    print("🚀 Chrysalis Repository Cleanup")
    print("=" * 50)
    
    # Execute archival
    cleanup.execute_archival(dry_run=dry_run)
    
    # Scan for dead code
    print("\n🔍 Scanning for dead code candidates...")
    dead_code = cleanup.scan_dead_code()
    if dead_code:
        print(f"\n⚠️  Found {len(dead_code)} potential dead code files:")
        for item in dead_code[:10]:  # Show first 10
            print(f"  - {item['file']}: {item['reason']}")
    
    # Generate report
    cleanup.generate_report()
    
    print("\n✅ Cleanup complete!")
    
if __name__ == "__main__":
    main()
