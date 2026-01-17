#!/usr/bin/env python3
"""
Chrysalis Documentation Audit Tool
Combines artifact discovery with codebase architecture mapping
to establish ground truth for documentation alignment.
"""

import os
import re
import json
from pathlib import Path
from datetime import datetime
from collections import defaultdict
from typing import Dict, List, Set, Tuple

class DocumentationAudit:
    def __init__(self, root_dir: str = "."):
        self.root = Path(root_dir)
        self.exclude_dirs = {
            'node_modules', '.venv', '.git', 'htmlcov', '.pytest_cache',
            '.chrysalis', '.cursor', '.windsurf', '.kilocode', '.clinerules',
            '.claude', '.giga', '.qodo', '.lsp', '.clj-kondo', '.fireproof', '.github'
        }
        
    def find_markdown_files(self) -> List[Path]:
        """Find all markdown files excluding tool directories."""
        md_files = []
        for path in self.root.rglob("*.md"):
            if not any(excluded in path.parts for excluded in self.exclude_dirs):
                md_files.append(path)
        return sorted(md_files)
    
    def classify_document(self, path: Path) -> Dict:
        """Extract metadata and classify document."""
        try:
            content = path.read_text(encoding='utf-8', errors='ignore')
            lines = content.split('\n')
            
            # Extract first non-empty line as title
            title = next((line.strip() for line in lines if line.strip()), "")
            if title.startswith('#'):
                title = title.lstrip('#').strip()
            
            # Classification signals
            has_2026 = '2026' in content
            has_2025 = '2025' in content  
            has_todo = bool(re.search(r'\b(TODO|FIXME|XXX)\b', content, re.IGNORECASE))
            has_status = bool(re.search(r'(status:|✅|⚠️|❌|🔄)', content, re.IGNORECASE))
            has_diagram = bool(re.search(r'```mermaid|```diagram', content, re.IGNORECASE))
            
            # Date extraction
            date_match = re.search(r'\b(January|Jan|February|Feb|March|Mar|April|Apr|May|June|Jun|July|Jul|August|Aug|September|Sep|October|Oct|November|Nov|December|Dec)\s+\d{1,2},?\s+202[56]\b', content, re.IGNORECASE)
            explicit_date = date_match.group(0) if date_match else None
            
            # Audience detection
            audiences = []
            if re.search(r'\b(developer|engineer|contributor)\b', content, re.IGNORECASE):
                audiences.append('developer')
            if re.search(r'\b(operator|deployment|production)\b', content, re.IGNORECASE):
                audiences.append('operator')
            if re.search(r'\b(AI agent|agent integrator|agent system)\b', content, re.IGNORECASE):
                audiences.append('agent-integrator')
            if re.search(r'\b(architecture|design|specification)\b', content, re.IGNORECASE):
                audiences.append('architect')
                
            # Document type classification
            doc_type = self.classify_type(path, content)
            
            # Currency markers
            is_archived = 'archive' in str(path).lower()
            is_current = '/current/' in str(path) or 'STATUS.md' in str(path)
            
            return {
                'path': str(path.relative_to(self.root)),
                'size': path.stat().st_size,
                'modified': datetime.fromtimestamp(path.stat().st_mtime).isoformat(),
                'title': title[:100],
                'explicit_date': explicit_date,
                'has_2026': has_2026,
                'has_2025': has_2025,
                'has_todo': has_todo,
                'has_status': has_status,
                'has_diagram': has_diagram,
                'word_count': len(content.split()),
                'line_count': len(lines),
                'audiences': audiences if audiences else ['general'],
                'doc_type': doc_type,
                'is_archived': is_archived,
                'is_current': is_current
            }
        except Exception as e:
            return {
                'path': str(path.relative_to(self.root)),
                'error': str(e)
            }
    
    def classify_type(self, path: Path, content: str) -> str:
        """Classify document type based on path and content."""
        path_str = str(path).lower()
        
        if 'readme' in path.name.lower():
            return 'README'
        elif '/research/' in path_str:
            return 'research'
        elif '/specs/' in path_str or 'specification' in path_str:
            return 'specification'
        elif '/guides/' in path_str or 'guide' in path.name.lower():
            return 'guide'
        elif '/api/' in path_str:
            return 'api-doc'
        elif '/architecture/' in path_str:
            return 'architecture'
        elif '/plans/' in path_str:
            return 'plan'
        elif 'session' in path.name.lower() or 'summary' in path.name.lower():
            return 'session-log'
        elif 'status' in path.name.lower():
            return 'status'
        elif 'handoff' in path.name.lower():
            return 'handoff'
        elif '/archive/' in path_str:
            return 'archived'
        elif 'test' in path.name.lower():
            return 'test-doc'
        elif 'adr' in path_str or 'decision' in path_str:
            return 'ADR'
        else:
            return 'other'
    
    def find_source_files(self) -> Dict[str, List[Path]]:
        """Map actual source code structure."""
        source_structure = defaultdict(list)
        
        for ext in ['.ts', '.tsx', '.py', '.go']:
            for path in self.root.rglob(f"*{ext}"):
                if not any(excluded in path.parts for excluded in self.exclude_dirs):
                    # Group by top-level directory under src/
                    if 'src' in path.parts:
                        src_idx = path.parts.index('src')
                        if len(path.parts) > src_idx + 1:
                            category = path.parts[src_idx + 1]
                            source_structure[category].append(path)
                    else:
                        source_structure['other'].append(path)
        
        return dict(source_structure)
    
    def generate_report(self):
        """Generate comprehensive audit report."""
        print("🔍 Chrysalis Documentation Audit")
        print("=" * 70)
        print()
        
        # Phase 1: Artifact Discovery
        print("📋 PHASE 1: Artifact Discovery")
        print("-" * 70)
        md_files = self.find_markdown_files()
        print(f"Total markdown files: {len(md_files)}")
        print()
        
        # Classify all documents
        classified = [self.classify_document(f) for f in md_files]
        classified = [c for c in classified if 'error' not in c]  # Filter errors
        
        # Group by location
        by_location = defaultdict(list)
        for doc in classified:
            top_dir = doc['path'].split('/')[0] if '/' in doc['path'] else 'root'
            by_location[top_dir].append(doc)
        
        print("Distribution by location:")
        for loc in sorted(by_location.keys()):
            count = len(by_location[loc])
            print(f"  {loc:20s}: {count:3d} files")
        print()
        
        # Group by type
        by_type = defaultdict(list)
        for doc in classified:
            by_type[doc['doc_type']].append(doc)
        
        print("Distribution by type:")
        for doc_type in sorted(by_type.keys()):
            count = len(by_type[doc_type])
            print(f"  {doc_type:20s}: {count:3d} files")
        print()
        
        # Currency analysis
        current_docs = [d for d in classified if d['is_current']]
        archived_docs = [d for d in classified if d['is_archived']]
        dated_2026 = [d for d in classified if d['has_2026']]
        
        print("Currency analysis:")
        print(f"  Explicitly current: {len(current_docs)}")
        print(f"  Archived: {len(archived_docs)}")
        print(f"  References 2026: {len(dated_2026)}")
        print()
        
        # Phase 2: Codebase Architecture
        print("📋 PHASE 2: Codebase Architecture Mapping")
        print("-" * 70)
        source_map = self.find_source_files()
        print(f"Source code categories: {len(source_map)}")
        print()
        
        for category in sorted(source_map.keys()):
            files = source_map[category]
            ts_count = len([f for f in files if f.suffix in ['.ts', '.tsx']])
            py_count = len([f for f in files if f.suffix == '.py'])
            go_count = len([f for f in files if f.suffix == '.go'])
            
            print(f"  {category:20s}: {len(files):3d} files (TS:{ts_count} PY:{py_count} GO:{go_count})")
        print()
        
        # Save detailed JSON report
        report = {
            'generated': datetime.now().isoformat(),
            'summary': {
                'total_markdown': len(classified),
                'by_location': {k: len(v) for k, v in by_location.items()},
                'by_type': {k: len(v) for k, v in by_type.items()},
                'current': len(current_docs),
                'archived': len(archived_docs),
                'dated_2026': len(dated_2026)
            },
            'documents': classified,
            'source_structure': {k: [str(p.relative_to(self.root)) for p in v] for k, v in source_map.items()}
        }
        
        output_path = self.root / 'docs' / 'AUDIT_REPORT_2026-01-17.json'
        with open(output_path, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"✅ Detailed report saved: {output_path}")
        print()
        
        # Critical findings
        print("🔍 Critical Findings:")
        print("-" * 70)
        
        # Session logs not archived
        session_logs = [d for d in by_type.get('session-log', []) if not d['is_archived']]
        if session_logs:
            print(f"  ⚠️  {len(session_logs)} session logs not archived:")
            for doc in session_logs[:5]:
                print(f"     - {doc['path']}")
            if len(session_logs) > 5:
                print(f"     ... and {len(session_logs) - 5} more")
            print()
        
        # Handoff documents in root
        handoffs = [d for d in by_type.get('handoff', []) if d['path'].count('/') == 0]
        if handoffs:
            print(f"  ⚠️  {len(handoffs)} handoff documents in root:")
            for doc in handoffs:
                print(f"     - {doc['path']}")
            print()
        
        # Documents without 2026 dates
        undated = [d for d in classified if not d['has_2026'] and not d['is_archived'] and d['doc_type'] not in ['README', 'guide']]
        if undated:
            print(f"  ℹ️  {len(undated)} active documents without 2026 dates")
            print()

if __name__ == '__main__':
    audit = DocumentationAudit()
    audit.generate_report()
