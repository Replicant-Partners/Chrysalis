"""
Research existing entity ontology systems
Using MCP tools to gather information

This script demonstrates how to use MCP tools for research.
In actual use, you would call these through Claude/Cursor.
"""

import os
from pathlib import Path
from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel
from rich.markdown import Markdown

# Load environment
load_dotenv()

console = Console()

def research_schema_org():
    """Research schema.org entity types"""
    
    console.print("\n[bold cyan]Researching schema.org Entity Types[/bold cyan]\n")
    
    # Search queries to run via Claude/MCP
    queries = [
        "schema.org Person properties comprehensive documentation",
        "schema.org Organization properties documentation",
        "schema.org Place properties documentation",
        "schema.org Product properties documentation",
        "schema.org entity types overview",
    ]
    
    console.print("[yellow]Recommended Search Queries:[/yellow]\n")
    for i, query in enumerate(queries, 1):
        console.print(f"{i}. {query}")
    
    console.print("\n[dim]Note: Ask Claude to run these via brave_web_search or exa web_search_exa[/dim]\n")
    
    return queries

def research_wikidata():
    """Research Wikidata entity model"""
    
    console.print("\n[bold cyan]Researching Wikidata Entity Model[/bold cyan]\n")
    
    queries = [
        "Wikidata data model comprehensive guide Q-types",
        "Wikidata P-properties system documentation",
        "Wikidata entity classification structure",
        "Wikidata ontology best practices",
    ]
    
    console.print("[yellow]Recommended Search Queries:[/yellow]\n")
    for i, query in enumerate(queries, 1):
        console.print(f"{i}. {query}")
    
    console.print("\n[dim]Note: Use exa for deep content extraction[/dim]\n")
    
    return queries

def research_dbpedia():
    """Research DBpedia ontology"""
    
    console.print("\n[bold cyan]Researching DBpedia Ontology[/bold cyan]\n")
    
    queries = [
        "DBpedia ontology documentation class hierarchy",
        "DBpedia property definitions comprehensive",
        "DBpedia ontology structure overview",
    ]
    
    console.print("[yellow]Recommended Search Queries:[/yellow]\n")
    for i, query in enumerate(queries, 1):
        console.print(f"{i}. {query}")
    
    return queries

def create_research_template():
    """Create research documentation template"""
    
    template = """# Entity Ontology Research

**Date**: [Current Date]
**Researcher**: [Your Name]
**Status**: In Progress

---

## Objectives

1. Survey existing entity ontology systems
2. Identify entity types relevant to KnowledgeBuilder
3. Extract best practices for entity classification
4. Design KnowledgeBuilder entity taxonomy

---

## Schema.org Research

### Overview
[Notes from schema.org research]

### Key Entity Types
- Person
- Organization
- Place
- Product
- CreativeWork
- Event

### Attributes & Properties
[Document key properties for each type]

### Strengths
- Widely adopted
- Comprehensive coverage
- Active development

### Limitations
[Note any limitations]

---

## Wikidata Research

### Overview
[Notes from Wikidata research]

### Entity Classification (Q-types)
[Document Q-types]

### Property System (P-properties)
[Document P-properties]

---

## DBpedia Research

### Overview
[Notes]

### Class Hierarchy
[Document classes]

---

## Synthesis & Recommendations

### Proposed KnowledgeBuilder Entity Types

[Based on research, propose entity types]

---

## Next Steps

1. [ ] Create JSON schemas for each entity type
2. [ ] Define relationship types
3. [ ] Create disambiguation rules
4. [ ] Develop test cases

---

## References

[List URLs and resources]
"""
    
    # Create docs directory if it doesn't exist
    docs_dir = Path("docs")
    docs_dir.mkdir(exist_ok=True)
    
    # Write template
    template_path = docs_dir / "ontology_research.md"
    with open(template_path, "w") as f:
        f.write(template)
    
    console.print(f"\n[green]✅ Created research template: {template_path}[/green]")

def main():
    """Main research execution"""
    
    console.print(Panel.fit(
        "[bold green]KnowledgeBuilder Ontology Research[/bold green]\n\n"
        "This script guides you through the entity ontology research process.",
        border_style="green"
    ))
    
    # Research tasks
    schema_queries = research_schema_org()
    wikidata_queries = research_wikidata()
    dbpedia_queries = research_dbpedia()
    
    # Create documentation template
    create_research_template()
    
    # Summary
    console.print("\n" + "="*60)
    console.print("\n[bold green]Research Plan Summary[/bold green]\n")
    
    console.print(f"[cyan]Total Queries to Run:[/cyan] {len(schema_queries) + len(wikidata_queries) + len(dbpedia_queries)}")
    console.print(f"[cyan]Estimated Time:[/cyan] 2-3 hours")
    console.print(f"[cyan]Documentation:[/cyan] docs/ontology_research.md")
    
    console.print("\n[bold yellow]How to Execute:[/bold yellow]\n")
    console.print("1. Open Claude/Cursor")
    console.print("2. Ask Claude to run each query using MCP tools:")
    console.print("   Example: 'Use brave_web_search to find: [query]'")
    console.print("3. Document findings in docs/ontology_research.md")
    console.print("4. Synthesize into entity type recommendations")
    
    console.print("\n[bold yellow]MCP Tools to Use:[/bold yellow]")
    console.print("• brave_web_search - Quick overview searches")
    console.print("• exa web_search_exa - Deep content extraction")
    console.print("• exa crawling_exa - Full page content from specific URLs")
    
    console.print("\n[dim]Pro Tip: Ask Claude to run multiple searches in parallel for efficiency![/dim]\n")

if __name__ == "__main__":
    main()
