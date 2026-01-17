#!/usr/bin/env python3
"""
Chrysalis Documentation Restructuring - Phase 5 & 6 Automation
Executes systematic cleanup, archiving, and verification based on audit findings.
"""

import os
import shutil
import json
import re
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Set, Tuple

class DocumentationRestructure:
    def __init__(self, root_dir: str = "."):
        self.root = Path(root_dir)
        self.audit_data = self.load_audit()
        self.archive_base = self.root / "docs" / "archive" / "2026-01"
        self.moved_files = []
        self.deleted_files = []
        self.broken_links = []
        
    def load_audit(self) -> Dict:
        """Load audit report for structured data."""
        audit_path = self.root / "docs" / "AUDIT_REPORT_2026-01-17.json"
        if audit_path.exists():
            with open(audit_path) as f:
                return json.load(f)
        return {}
    
    def ensure_archive_dirs(self):
        """Create archive directory structure."""
        dirs = [
            self.archive_base / "sessions",
            self.archive_base / "reports",
            self.archive_base / "handoffs",
            self.archive_base / "superseded"
        ]
        for d in dirs:
            d.mkdir(parents=True, exist_ok=True)
        print(f"✓ Archive directories created: {self.archive_base}")
    
    def archive_document(self, source: Path, target_dir: Path, reason: str) -> bool:
        """Archive a document with header and move to target."""
        try:
            # Read original content
            content = source.read_text(encoding='utf-8')
            
            # Prepare archive header
            header = f"""---
**⚠️ ARCHIVED**: {datetime.now().strftime('%Y-%m-%d')}  
**Historical Context**: {reason}  
**Original Location**: {source}  
**Reason for Archival**: Completed work / Historical reference
---

"""
            # Write to archive with header
            target = target_dir / source.name
            target.write_text(header + content, encoding='utf-8')
            
            # Remove original
            source.unlink()
            
            self.moved_files.append({
                'from': str(source),
                'to': str(target),
                'reason': reason
            })
            
            print(f"  ✓ Archived: {source.name} → {target_dir.name}/")
            return True
        except Exception as e:
            print(f"  ✗ Failed to archive {source}: {e}")
            return False
    
    def archive_session_logs(self):
        """Archive session summaries and working notes."""
        print("\n📦 PHASE 5.1: Archiving Session Logs")
        
        session_patterns = [
            'SESSION_SUMMARY',
            'SESSION_COMPLETE',
            'WORK_COMPLETE_SUMMARY',
            'CANVAS_SESSION_SUMMARY'
        ]
        
        archived_count = 0
        for pattern in session_patterns:
            # Check root
            for file in self.root.glob(f"{pattern}*.md"):
                if self.archive_document(
                    file,
                    self.archive_base / "sessions",
                    f"Session log from {file.stem}"
                ):
                    archived_count += 1
            
            # Check docs
            for file in (self.root / "docs").glob(f"{pattern}*.md"):
                if self.archive_document(
                    file,
                    self.archive_base / "sessions",
                    f"Session log from {file.stem}"
                ):
                    archived_count += 1
        
        print(f"✓ Archived {archived_count} session logs")
    
    def archive_handoffs(self):
        """Archive handoff documents."""
        print("\n📦 PHASE 5.2: Archiving Handoff Documents")
        
        handoff_files = [
            "DOCUMENTATION_REVIEW_HANDOFF.md",
            "FINAL_HANDOFF.md"
        ]
        
        archived_count = 0
        for filename in handoff_files:
            file = self.root / filename
            if file.exists():
                if self.archive_document(
                    file,
                    self.archive_base / "handoffs",
                    f"Project handoff document"
                ):
                    archived_count += 1
        
        print(f"✓ Archived {archived_count} handoff documents")
    
    def archive_reports(self):
        """Archive historical reports."""
        print("\n📦 PHASE 5.3: Archiving Reports")
        
        report_patterns = [
            '*_REPORT_*.md',
            'OLLAMA_INTEGRATION_SUMMARY.md',
            'FRONTEND_STATUS_AND_GAPS.md'
        ]
        
        archived_count = 0
        for pattern in report_patterns:
            for file in self.root.glob(pattern):
                if 'AUDIT_REPORT' not in file.name:  # Keep current audit
                    if self.archive_document(
                        file,
                        self.archive_base / "reports",
                        f"Historical report"
                    ):
                        archived_count += 1
        
        print(f"✓ Archived {archived_count} report documents")
    
    def move_root_guides(self):
        """Move guide files from root to docs/guides/."""
        print("\n📦 PHASE 5.4: Moving Root-Level Guides")
        
        # This would be manual or pattern-based
        # For safety, just log what should be moved
        print("  ℹ️  Manual review recommended for root guides")
    
    def find_broken_links(self):
        """Scan all markdown files for broken internal links."""
        print("\n🔍 PHASE 6.1: Validating Internal Links")
        
        md_files = list(self.root.rglob("*.md"))
        exclude_dirs = {'node_modules', '.venv', '.git'}
        
        md_files = [f for f in md_files if not any(ex in f.parts for ex in exclude_dirs)]
        
        link_pattern = re.compile(r'\[([^\]]+)\]\(([^)]+)\)')
        
        broken_count = 0
        for md_file in md_files:
            try:
                content = md_file.read_text(encoding='utf-8')
                for match in link_pattern.finditer(content):
                    link_text, link_url = match.groups()
                    
                    # Skip external links
                    if link_url.startswith(('http://', 'https://', '#')):
                        continue
                    
                    # Resolve relative path
                    link_path = (md_file.parent / link_url).resolve()
                    
                    if not link_path.exists():
                        self.broken_links.append({
                            'file': str(md_file.relative_to(self.root)),
                            'link_text': link_text,
                            'link_url': link_url,
                            'resolved': str(link_path)
                        })
                        broken_count += 1
            except Exception as e:
                print(f"  ⚠️  Error reading {md_file}: {e}")
        
        print(f"{'✓' if broken_count == 0 else '⚠️ '} Found {broken_count} broken links")
        
        if broken_count > 0 and broken_count <= 20:
            print("\n  Broken links:")
            for link in self.broken_links[:20]:
                print(f"    - {link['file']}: [{link['link_text']}]({link['link_url']})")
    
    def validate_mermaid_diagrams(self):
        """Check Mermaid diagram syntax."""
        print("\n🔍 PHASE 6.2: Validating Mermaid Diagrams")
        
        md_files = list(self.root.rglob("*.md"))
        exclude_dirs = {'node_modules', '.venv', '.git'}
        md_files = [f for f in md_files if not any(ex in f.parts for ex in exclude_dirs)]
        
        mermaid_pattern = re.compile(r'```mermaid\n(.*?)\n```', re.DOTALL)
        
        diagram_count = 0
        invalid_count = 0
        
        for md_file in md_files:
            try:
                content = md_file.read_text(encoding='utf-8')
                diagrams = mermaid_pattern.findall(content)
                diagram_count += len(diagrams)
                
                # Basic syntax validation
                for diagram in diagrams:
                    # Check for common syntax patterns
                    if not any(keyword in diagram for keyword in [
                        'graph', 'flowchart', 'sequenceDiagram', 'classDiagram',
                        'stateDiagram', 'erDiagram', 'journey', 'gantt', 'pie'
                    ]):
                        invalid_count += 1
            except Exception as e:
                print(f"  ⚠️  Error reading {md_file}: {e}")
        
        print(f"{'✓' if invalid_count == 0 else '⚠️ '} Found {diagram_count} diagrams, {invalid_count} potentially invalid")
    
    def generate_report(self):
        """Generate completion report."""
        print("\n📊 PHASE 7: Generating Completion Report")
        
        report = {
            'generated': datetime.now().isoformat(),
            'phase_5_cleanup': {
                'files_moved': len(self.moved_files),
                'files_deleted': len(self.deleted_files),
                'moved_details': self.moved_files
            },
            'phase_6_verification': {
                'broken_links': len(self.broken_links),
                'broken_link_details': self.broken_links[:50]  # Limit size
            }
        }
        
        report_path = self.root / "docs" / "RESTRUCTURE_COMPLETION_REPORT_2026-01-17.json"
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"✓ Report saved: {report_path}")
        
        # Print summary
        print("\n" + "="*70)
        print("RESTRUCTURING SUMMARY")
        print("="*70)
        print(f"Files archived: {len(self.moved_files)}")
        print(f"Files deleted: {len(self.deleted_files)}")
        print(f"Broken links found: {len(self.broken_links)}")
        print()
    
    def execute(self):
        """Execute full restructuring workflow."""
        print("🚀 Chrysalis Documentation Restructuring")
        print("="*70)
        
        self.ensure_archive_dirs()
        self.archive_session_logs()
        self.archive_handoffs()
        self.archive_reports()
        self.move_root_guides()
        self.find_broken_links()
        self.validate_mermaid_diagrams()
        self.generate_report()
        
        print("\n✅ Restructuring Complete")

if __name__ == '__main__':
    restructure = DocumentationRestructure()
    restructure.execute()
