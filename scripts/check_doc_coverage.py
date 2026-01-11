#!/usr/bin/env python3
"""
Check documentation coverage for APIs and modules.
"""

import os
import sys
from pathlib import Path
from typing import Dict, List

def check_api_documentation() -> Dict[str, bool]:
    """Check if all API endpoints are documented."""
    results = {}
    
    # Check OpenAPI specs exist
    specs = [
        "docs/api/openapi/agentbuilder-openapi.yaml",
        "docs/api/openapi/skillbuilder-openapi.yaml",
        "docs/api/openapi/knowledgebuilder-openapi.yaml"
    ]
    
    for spec in specs:
        service = Path(spec).stem.replace('-openapi', '')
        results[f"OpenAPI spec for {service}"] = Path(spec).exists()
    
    # Check API documentation exists
    docs = [
        "docs/api/services/AGENTBUILDER_COMPLETE_SPEC.md",
        "docs/api/services/SKILLBUILDER_API_SPEC.md",
        "docs/api/services/KNOWLEDGEBUILDER_API_SPEC.md"
    ]
    
    for doc in docs:
        service = Path(doc).stem.replace('_API_SPEC', '').replace('_COMPLETE_SPEC', '')
        results[f"API docs for {service}"] = Path(doc).exists()
    
    return results

def check_module_documentation() -> Dict[str, bool]:
    """Check if all modules have README files."""
    results = {}
    
    # Check key directories have README
    dirs_to_check = [
        "projects/AgentBuilder",
        "projects/SkillBuilder",
        "projects/KnowledgeBuilder",
        "shared/api_core",
        "shared/embedding",
        "memory_system",
        "docs",
        "docs/api",
        "docs/architecture"
    ]
    
    for dir_path in dirs_to_check:
        readme = Path(dir_path) / "README.md"
        results[f"README in {dir_path}"] = readme.exists()
    
    return results

def check_architecture_documentation() -> Dict[str, bool]:
    """Check architecture documentation exists."""
    results = {}
    
    docs = [
        "ARCHITECTURE.md",
        "docs/architecture/C4_ARCHITECTURE_DIAGRAMS.md",
        "docs/DEVELOPER_ONBOARDING.md",
        "docs/DOCUMENTATION_VALIDATION.md"
    ]
    
    for doc in docs:
        results[Path(doc).name] = Path(doc).exists()
    
    return results

def main():
    """Main coverage check function."""
    print("Checking documentation coverage...")
    print("=" * 50)
    
    all_results = {}
    
    # Check API documentation
    print("\n📋 API Documentation:")
    api_results = check_api_documentation()
    all_results.update(api_results)
    for check, passed in api_results.items():
        status = "✅" if passed else "❌"
        print(f"  {status} {check}")
    
    # Check module documentation
    print("\n📦 Module Documentation:")
    module_results = check_module_documentation()
    all_results.update(module_results)
    for check, passed in module_results.items():
        status = "✅" if passed else "❌"
        print(f"  {status} {check}")
    
    # Check architecture documentation
    print("\n🏗️  Architecture Documentation:")
    arch_results = check_architecture_documentation()
    all_results.update(arch_results)
    for check, passed in arch_results.items():
        status = "✅" if passed else "❌"
        print(f"  {status} {check}")
    
    # Calculate coverage
    total = len(all_results)
    passed = sum(1 for v in all_results.values() if v)
    coverage = (passed / total) * 100 if total > 0 else 0
    
    print("\n" + "=" * 50)
    print(f"Documentation Coverage: {coverage:.1f}% ({passed}/{total})")
    
    # Threshold
    threshold = 90.0
    if coverage >= threshold:
        print(f"✅ Coverage above threshold ({threshold}%)")
        return 0
    else:
        print(f"⚠️  Coverage below threshold ({threshold}%)")
        return 1

if __name__ == "__main__":
    sys.exit(main())
