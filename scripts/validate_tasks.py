import json
import os
import sys
import glob

# Add src to path to import universal_adapter
sys.path.append(os.path.join(os.getcwd(), 'src'))

try:
    from universal_adapter.flow.parser import MermaidParser
    from universal_adapter.flow.graph import FlowGraph
except ImportError as e:
    print(f"Error importing flow modules: {e}")
    sys.exit(1)

def validate_task(file_path):
    print(f"Validating {file_path}...")
    
    try:
        with open(file_path, 'r') as f:
            task_def = json.load(f)
        
        # Check required fields
        required_fields = ['id', 'name', 'workflow_file']
        for field in required_fields:
            if field not in task_def:
                print(f"  ❌ Missing required field: {field}")
                return False
        
        # Load workflow file
        workflow_path = os.path.join(os.path.dirname(file_path), task_def['workflow_file'])
        if not os.path.exists(workflow_path):
            print(f"  ❌ Workflow file not found: {workflow_path}")
            return False
            
        with open(workflow_path, 'r') as f:
            mermaid_content = f.read()
            
        # Parse Mermaid
        parser = MermaidParser()
        graph = parser.parse(mermaid_content)
        
        # Validate Graph
        is_valid, errors = graph.validate()
        
        if is_valid:
            print(f"  ✅ Valid FlowGraph: {len(graph.nodes)} nodes, {len(graph.edges)} edges")
            return True
        else:
            print(f"  ❌ Invalid FlowGraph:")
            for error in errors:
                print(f"    - {error}")
            return False
            
    except Exception as e:
        print(f"  ❌ Exception: {e}")
        return False

def main():
    task_files = glob.glob('src/tasks/*.json')
    success = True
    
    print(f"Found {len(task_files)} task definitions.")
    
    for task_file in task_files:
        if not validate_task(task_file):
            success = False
            
    if success:
        print("\nAll tasks validated successfully! 🎉")
        sys.exit(0)
    else:
        print("\nSome tasks failed validation. 💥")
        sys.exit(1)

if __name__ == "__main__":
    main()
