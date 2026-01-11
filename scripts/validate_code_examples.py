#!/usr/bin/env python3
"""
Test code examples in documentation.
"""

import os
import re
import sys
import tempfile
import subprocess
from pathlib import Path
from typing import List, Tuple

def find_code_blocks(content: str, language: str) -> List[Tuple[str, int]]:
    """Extract code blocks of specified language."""
    pattern = rf'```{language}\n(.*?)```'
    blocks = []
    for match in re.finditer(pattern, content, re.DOTALL):
        code = match.group(1)
        line_num = content[:match.start()].count('\n') + 1
        blocks.append((code, line_num))
    return blocks

def test_python_code(code: str) -> Tuple[bool, str]:
    """Test Python code block."""
    # Skip examples with placeholders
    if 'your-api-key' in code or 'your_api_key' in code:
        return True, "Skipped (contains placeholder)"
    
    if 'YOUR_API_KEY' in code or '<api-key>' in code:
        return True, "Skipped (contains placeholder)"
    
    # Skip examples that require running services
    if 'localhost:500' in code or 'localhost:800' in code:
        return True, "Skipped (requires running services)"
    
    # Skip examples with imports that may not be available
    if 'import requests' in code and 'pip install' not in code:
        # Check if it's just showing API usage
        if 'response = requests.' in code:
            return True, "Skipped (API usage example)"
    
    try:
        # Write to temp file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(code)
            temp_file = f.name
        
        # Try to compile (syntax check)
        result = subprocess.run(
            ['python', '-m', 'py_compile', temp_file],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        os.unlink(temp_file)
        
        if result.returncode == 0:
            return True, "Valid syntax"
        else:
            return False, result.stderr
    except Exception as e:
        return False, str(e)

def main():
    """Main validation function."""
    print("Validating code examples...")
    
    md_files = list(Path("docs").rglob("*.md"))
    md_files.extend(Path(".").glob("*.md"))
    
    errors = []
    total_examples = 0
    tested_examples = 0
    skipped_examples = 0
    
    for md_file in md_files:
        try:
            content = md_file.read_text(encoding='utf-8')
            
            # Test Python examples
            python_blocks = find_code_blocks(content, 'python')
            for code, line_num in python_blocks:
                total_examples += 1
                valid, message = test_python_code(code)
                if not valid:
                    errors.append(f"{md_file}:{line_num} - {message}")
                elif "Skipped" in message:
                    skipped_examples += 1
                else:
                    tested_examples += 1
        except Exception as e:
            errors.append(f"{md_file} - Error: {e}")
    
    print(f"Found {total_examples} code examples")
    print(f"Tested {tested_examples} examples")
    print(f"Skipped {skipped_examples} examples")
    
    if errors:
        print(f"\n❌ Found {len(errors)} issues:")
        for error in errors:
            print(f"  {error}")
        return 1
    else:
        print("✅ All testable code examples valid")
        return 0

if __name__ == "__main__":
    sys.exit(main())
