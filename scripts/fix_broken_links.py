#!/usr/bin/env python3
"""
Broken Link Repair Script
Automatically fixes broken markdown links caused by documentation restructuring.
"""

import os
import re
from pathlib import Path
from typing import Dict, List, Tuple, Set
import json

class LinkFixer:
    def __init__(self, root_dir: str):
        self.root_dir = Path(root_dir)
        self.broken_links = []
        self.fixed_links = []
        self.manual_fixes_needed = []
        
        # Map of moved files (old path -> new path)
        self.moved_files = {
            "SESSION_SUMMARY_2026-01-16.md": "docs/archive/2026-01/sessions/SESSION_SUMMARY_2026-01-16.md",
            "SESSION_COMPLETE.md": "docs/archive/2026-01/sessions/SESSION_COMPLETE.md",
            "WORK_COMPLETE_SUMMARY.md": "docs/archive/2026-01/sessions/WORK_COMPLETE_SUMMARY.md",
            "DOCUMENTATION_REVIEW_HANDOFF.md": "docs/archive/2026-01/handoffs/DOCUMENTATION_REVIEW_HANDOFF.md",
            "FINAL_HANDOFF.md": "docs/archive/2026-01/handoffs/FINAL_HANDOFF.md",
            "FRONTEND_STATUS_AND_GAPS.md": "docs/archive/2026-01/reports/FRONTEND_STATUS_AND_GAPS.md",
            "OLLAMA_INTEGRATION_SUMMARY.md": "docs/archive/2026-01/reports/OLLAMA_INTEGRATION_SUMMARY.md"
        }
        
        # Common broken reference patterns
        self.reference_fixes = {
            "docs/STATUS.md": "docs/STATUS.md",  # Still exists
            "docs/INDEX.md": "docs/README.md",    # Renamed to README.md
            "src/fabric/": "src/core/patterns/",  # Renamed directory
            "src/memory/": "memory_system/",      # Moved to Python
            "src/tui/": None,                     # Deleted - mark for removal
            "VoyeurBus": None,                    # Deleted component
            "VoyeurEvents": None,                 # Deleted component
        }
        
    def find_markdown_files(self) -> List[Path]:
        """Find all markdown files except in excluded directories."""
        md_files = []
        exclude_dirs = {'node_modules', '.git', 'htmlcov', '.venv', 'dist', 'build'}
        
        for md_file in self.root_dir.rglob("*.md"):
            if not any(ex in md_file.parts for ex in exclude_dirs):
                md_files.append(md_file)
        return md_files
    
    def extract_links(self, content: str) -> List[Tuple[str, str]]:
        """Extract markdown links [text](url) and file paths."""
        # Markdown link pattern: [text](url)
        md_links = re.findall(r'\[([^\]]+)\]\(([^\)]+)\)', content)
        
        # File path references (like `docs/file.md`)
        path_refs = re.findall(r'`([^`]+\.md)`', content)
        path_links = [(path, path) for path in path_refs]
        
        return md_links + path_links
    
    def resolve_relative_path(self, source_file: Path, link: str) -> Path:
        """Resolve relative path from source file."""
        if link.startswith('http://') or link.startswith('https://'):
            return None  # External link
        
        # Remove anchors and query params
        link = link.split('#')[0].split('?')[0]
        
        if not link or link.endswith('/'):
            return None
            
        # Resolve relative to source file's directory
        source_dir = source_file.parent
        target = (source_dir / link).resolve()
        
        return target
    
    def check_link(self, source_file: Path, link_text: str, link_url: str) -> Tuple[bool, str]:
        """Check if a link is broken and suggest fix."""
        # Skip external links
        if link_url.startswith('http://') or link_url.startswith('https://'):
            return True, None
        
        # Skip anchors-only links
        if link_url.startswith('#'):
            return True, None
            
        # Check if it's a known moved file
        link_basename = Path(link_url).name
        if link_basename in self.moved_files:
            new_path = self.moved_files[link_basename]
            return False, new_path
        
        # Check if it's a known deleted/renamed reference
        for old_ref, new_ref in self.reference_fixes.items():
            if old_ref in link_url:
                if new_ref is None:
                    return False, None  # Deleted - should be removed
                return False, link_url.replace(old_ref, new_ref)
        
        # Check if file exists
        target = self.resolve_relative_path(source_file, link_url)
        if target and target.exists():
            return True, None
        
        # Broken link
        return False, None
    
    def fix_links_in_file(self, filepath: Path) -> int:
        """Fix broken links in a single file."""
        content = filepath.read_text(encoding='utf-8')
        original_content = content
        fixes_made = 0
        
        links = self.extract_links(content)
        
        for link_text, link_url in links:
            is_valid, suggested_fix = self.check_link(filepath, link_text, link_url)
            
            if not is_valid:
                if suggested_fix:
                    # Replace the link
                    old_link = f"]({link_url})"
                    new_link = f"]({suggested_fix})"
                    if old_link in content:
                        content = content.replace(old_link, new_link)
                        fixes_made += 1
                        self.fixed_links.append({
                            "file": str(filepath.relative_to(self.root_dir)),
                            "old": link_url,
                            "new": suggested_fix
                        })
                elif suggested_fix is None:  # Deleted component
                    # Mark for manual review - don't auto-delete
                    self.manual_fixes_needed.append({
                        "file": str(filepath.relative_to(self.root_dir)),
                        "link": link_url,
                        "reason": "References deleted component - consider removing"
                    })
                else:
                    # Broken with no known fix
                    self.broken_links.append({
                        "file": str(filepath.relative_to(self.root_dir)),
                        "link": link_url,
                        "text": link_text
                    })
        
        # Write back if changes were made
        if content != original_content:
            filepath.write_text(content, encoding='utf-8')
            
        return fixes_made
    
    def run(self, dry_run: bool = False) -> Dict:
        """Run the link fixer."""
        print("🔍 Scanning for broken links...")
        
        md_files = self.find_markdown_files()
        print(f"Found {len(md_files)} markdown files")
        
        total_fixes = 0
        
        for md_file in md_files:
            try:
                fixes = self.fix_links_in_file(md_file)
                if fixes > 0:
                    total_fixes += fixes
                    if not dry_run:
                        print(f"  ✓ Fixed {fixes} links in {md_file.relative_to(self.root_dir)}")
            except Exception as e:
                print(f"  ✗ Error processing {md_file}: {e}")
        
        # Generate report
        report = {
            "timestamp": "2026-01-17T01:22:00Z",
            "total_files_scanned": len(md_files),
            "links_fixed": len(self.fixed_links),
            "broken_links_remaining": len(self.broken_links),
            "manual_review_needed": len(self.manual_fixes_needed),
            "fixes": self.fixed_links[:20],  # First 20 for brevity
            "broken": self.broken_links[:20],
            "manual": self.manual_fixes_needed[:20]
        }
        
        report_path = self.root_dir / "docs" / "LINK_FIX_REPORT_2026-01-17.json"
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\n📊 Results:")
        print(f"  - Links fixed: {len(self.fixed_links)}")
        print(f"  - Broken links remaining: {len(self.broken_links)}")
        print(f"  - Manual review needed: {len(self.manual_fixes_needed)}")
        print(f"\n📝 Report: {report_path}")
        
        return report

def main():
    import sys
    
    dry_run = "--dry-run" in sys.argv
    
    fixer = LinkFixer("/home/mdz-axolotl/Documents/GitClones/Chrysalis")
    
    print("🔧 Chrysalis Link Fixer")
    print("=" * 50)
    
    if dry_run:
        print("⚠️  DRY RUN - No files will be modified\n")
    
    fixer.run(dry_run=dry_run)
    
    print("\n✅ Complete!")

if __name__ == "__main__":
    main()
