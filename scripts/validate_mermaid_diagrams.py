#!/usr/bin/env python3
"""
Validate Mermaid diagrams in documentation.
"""

import re
import sys
from pathlib import Path
from typing import List, Tuple

def find_mermaid_diagrams(content: str) -> List[Tuple[str, int]]:
    """Extract Mermaid diagram blocks."""
    pattern = r'```mermaid\n(.*?)```'
    diagrams = []
    for match in re.finditer(pattern, content, re.DOTALL):
        diagram = match.group(1)
        line_num = content[:match.start()].count('\n') + 1
        diagrams.append((diagram, line_num))
    return diagrams

def validate_mermaid_syntax(diagram: str) -> Tuple[bool, str]:
    """Basic validation of Mermaid diagram syntax."""
    lines = diagram.strip().split('\n')
    
    if not lines:
        return False, "Empty diagram"
    
    # Check for diagram type declaration
    first_line = lines[0].strip()
    valid_types = [
        'graph', 'flowchart', 'sequenceDiagram', 'classDiagram',
        'stateDiagram', 'erDiagram', 'journey', 'gantt', 'pie',
        'gitGraph', 'C4Context', 'C4Container', 'C4Component'
    ]
    
    has_type = any(first_line.startswith(t) for t in valid_types)
    if not has_type:
        return False, f"Unknown diagram type: {first_line}"
    
    # Check for basic syntax errors
    for i, line in enumerate(lines[1:], start=2):
        line = line.strip()
        if not line or line.startswith('%%'):  # Skip empty lines and comments
            continue
        
        # Check for unmatched brackets
        if line.count('[') != line.count(']'):
            return False, f"Unmatched brackets on line {i}"
        if line.count('(') != line.count(')'):
            return False, f"Unmatched parentheses on line {i}"
        if line.count('{') != line.count('}'):
            return False, f"Unmatched braces on line {i}"
    
    return True, "Valid syntax"

def main():
    """Main validation function."""
    print("Validating Mermaid diagrams...")
    
    md_files = list(Path("docs").rglob("*.md"))
    md_files.extend(Path(".").glob("*.md"))
    
    errors = []
    total_diagrams = 0
    
    for md_file in md_files:
        try:
            content = md_file.read_text(encoding='utf-8')
            diagrams = find_mermaid_diagrams(content)
            total_diagrams += len(diagrams)
            
            for diagram, line_num in diagrams:
                valid, message = validate_mermaid_syntax(diagram)
                if not valid:
                    errors.append(f"{md_file}:{line_num} - {message}")
        except Exception as e:
            errors.append(f"{md_file} - Error: {e}")
    
    print(f"Found {total_diagrams} Mermaid diagrams")
    
    if errors:
        print(f"\n❌ Found {len(errors)} invalid diagrams:")
        for error in errors:
            print(f"  {error}")
        return 1
    else:
        print("✅ All Mermaid diagrams valid")
        return 0

if __name__ == "__main__":
    sys.exit(main())
