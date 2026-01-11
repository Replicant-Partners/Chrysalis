#!/usr/bin/env python3
"""
Validate all links in Markdown documentation.
"""

import os
import re
import sys
from pathlib import Path
from typing import List, Tuple
from urllib.parse import urlparse

def find_markdown_files(root_dir: str = "docs") -> List[Path]:
    """Find all Markdown files."""
    root = Path(root_dir)
    md_files = list(root.rglob("*.md"))
    # Also check root directory
    md_files.extend(Path(".").glob("*.md"))
    return md_files

def extract_links(content: str) -> List[Tuple[str, int]]:
    """Extract all links from Markdown content."""
    # Match [text](link) and [text](link#anchor)
    pattern = r'\[([^\]]+)\]\(([^)]+)\)'
    links = []
    for match in re.finditer(pattern, content):
        link = match.group(2)
        line_num = content[:match.start()].count('\n') + 1
        links.append((link, line_num))
    return links

def validate_internal_link(link: str, source_file: Path) -> Tuple[bool, str]:
    """Validate internal link."""
    # Remove anchor
    if '#' in link:
        path, anchor = link.split('#', 1)
    else:
        path, anchor = link, None
    
    # Skip external links
    if path.startswith('http://') or path.startswith('https://'):
        return True, ""
    
    # Skip mailto and other protocols
    if ':' in path and not path.startswith('./') and not path.startswith('../'):
        return True, ""
    
    # Resolve relative path
    if path:
        target = (source_file.parent / path).resolve()
        if not target.exists():
            return False, f"File not found: {path}"
    
    # TODO: Validate anchor exists in target file
    # This would require parsing the target file for headers
    
    return True, ""

def main():
    """Main validation function."""
    print("Validating documentation links...")
    
    md_files = find_markdown_files()
    print(f"Found {len(md_files)} Markdown files")
    
    errors = []
    total_links = 0
    
    for md_file in md_files:
        try:
            content = md_file.read_text(encoding='utf-8')
            links = extract_links(content)
            total_links += len(links)
            
            for link, line_num in links:
                valid, error = validate_internal_link(link, md_file)
                if not valid:
                    errors.append(f"{md_file}:{line_num} - {error}")
        except Exception as e:
            errors.append(f"{md_file} - Error reading file: {e}")
    
    print(f"Checked {total_links} links")
    
    if errors:
        print(f"\n❌ Found {len(errors)} broken links:")
        for error in errors:
            print(f"  {error}")
        return 1
    else:
        print("✅ All links valid")
        return 0

if __name__ == "__main__":
    sys.exit(main())
