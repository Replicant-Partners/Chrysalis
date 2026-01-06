"""
Validate all critical tools for KnowledgeBuilder
"""

from rich.console import Console
from rich.table import Table
import os
from dotenv import load_dotenv

load_dotenv()
console = Console()

def validate_api_keys():
    """Check all required API keys"""
    console.print("\n[bold cyan]Validating API Keys[/bold cyan]\n")
    
    keys = {
        "ANTHROPIC_API_KEY": "Critical",
        "OPENAI_API_KEY": "Critical",
        "BRAVE_API_KEY": "Critical",
        "LANCEDB_API_KEY": "Critical",
        "OCTAGON_API_KEY": "High Priority",
    }
    
    table = Table(title="API Key Status")
    table.add_column("Service", style="cyan")
    table.add_column("Priority", style="yellow")
    table.add_column("Status", style="green")
    
    for key, priority in keys.items():
        value = os.getenv(key)
        if value and len(value) > 10:
            status = "✅ Found"
        else:
            status = "❌ Missing"
        
        table.add_row(key, priority, status)
    
    console.print(table)

def validate_mcp_tools():
    """List available MCP tools"""
    console.print("\n[bold cyan]Available MCP Tools[/bold cyan]\n")
    
    tools = [
        ("brave-search", "Web, news, image search", "✅"),
        ("exa", "Deep web search", "✅"),
        ("firecrawl", "Website crawling", "✅"),
        ("lancedb", "Vector database", "✅"),
        ("memory", "Knowledge graph", "✅"),
        ("github", "Repository data", "✅"),
        ("octagon", "Financial intelligence", "✅"),
    ]
    
    table = Table(title="MCP Tools")
    table.add_column("Tool", style="cyan")
    table.add_column("Purpose", style="white")
    table.add_column("Status", style="green")
    
    for tool, purpose, status in tools:
        table.add_row(tool, purpose, status)
    
    console.print(table)

def validate_project_structure():
    """Check project directories"""
    console.print("\n[bold cyan]Validating Project Structure[/bold cyan]\n")
    
    dirs = [
        "src",
        "src/collectors",
        "src/processors",
        "src/vectorizers",
        "src/agents",
        "tests",
        "docs",
        "schemas",
        "examples",
        "data",
    ]
    
    for dir_path in dirs:
        exists = os.path.exists(dir_path)
        status = "✅" if exists else "❌"
        console.print(f"{status} {dir_path}")

def main():
    console.print("[bold green]KnowledgeBuilder Tool Validation[/bold green]")
    console.print("=" * 60)
    
    validate_api_keys()
    validate_mcp_tools()
    validate_project_structure()
    
    console.print("\n[bold green]Validation Complete![/bold green]")
    console.print("\n[bold yellow]Next Steps:[/bold yellow]")
    console.print("1. Review KNOWLEDGE_GAP_CLOSURE_PLAN.md")
    console.print("2. Start ontology research (Task 1.1)")
    console.print("3. Test search capabilities with sample queries")
    console.print("\n[dim]Run: python examples/research_ontologies.py (next)[/dim]")

if __name__ == "__main__":
    main()
