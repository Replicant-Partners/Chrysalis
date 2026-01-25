//! Knowledge Graph Module for Complex Learner Agent Configuration
//!
//! Parses YAML-based knowledge graph schemas and integrates them into
//! the Chrysalis reasoning engine for system agent decision-making.
//!
//! Architecture:
//!     YAML Config → KnowledgeGraphLoader → ReasoningEngine → SystemAgents

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

/// A node in the knowledge graph
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeNode {
    pub id: String,
    #[serde(default)]
    pub label: String,
    #[serde(rename = "type", default)]
    pub node_type: String,
    #[serde(default)]
    pub description: String,
}

/// An edge connecting nodes in the knowledge graph
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeEdge {
    pub from: String,
    pub to: String,
    #[serde(default = "default_relation")]
    pub relation: String,
    #[serde(default = "default_weight")]
    pub weight: f64,
}

fn default_relation() -> String {
    "related_to".to_string()
}

fn default_weight() -> f64 {
    1.0
}

/// Raw YAML structure for parsing
#[derive(Debug, Clone, Deserialize)]
struct KnowledgeGraphYaml {
    #[serde(default)]
    source: Option<String>,
    #[serde(default)]
    nodes: Vec<KnowledgeNode>,
    #[serde(default)]
    edges: Vec<KnowledgeEdge>,
}

/// A knowledge graph representing agent reasoning patterns
#[derive(Debug, Clone, Default)]
pub struct KnowledgeGraph {
    pub name: String,
    pub source: Option<String>,
    pub nodes: HashMap<String, KnowledgeNode>,
    pub edges: Vec<KnowledgeEdge>,
}

impl KnowledgeGraph {
    /// Create a new empty knowledge graph
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            source: None,
            nodes: HashMap::new(),
            edges: Vec::new(),
        }
    }

    /// Load from YAML string
    pub fn from_yaml(yaml_content: &str, name: impl Into<String>) -> Result<Self, String> {
        let parsed: KnowledgeGraphYaml = serde_yaml::from_str(yaml_content)
            .map_err(|e| format!("YAML parse error: {}", e))?;

        let mut graph = Self::new(name);
        graph.source = parsed.source;

        for node in parsed.nodes {
            graph.nodes.insert(node.id.clone(), node);
        }

        graph.edges = parsed.edges;

        // Validate
        let errors = graph.validate();
        if !errors.is_empty() {
            return Err(format!("Validation errors: {:?}", errors));
        }

        Ok(graph)
    }

    /// Load from YAML file
    pub fn from_yaml_file(path: &Path) -> Result<Self, String> {
        let content = std::fs::read_to_string(path)
            .map_err(|e| format!("Failed to read file: {}", e))?;

        let name = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("unnamed");

        Self::from_yaml(&content, name)
    }

    /// Validate the knowledge graph structure
    pub fn validate(&self) -> Vec<String> {
        let mut errors = Vec::new();

        // Check for orphan edges
        for (i, edge) in self.edges.iter().enumerate() {
            if !self.nodes.contains_key(&edge.from) {
                errors.push(format!(
                    "Edge {}: from_node '{}' not found in nodes",
                    i, edge.from
                ));
            }
            if !self.nodes.contains_key(&edge.to) {
                errors.push(format!(
                    "Edge {}: to_node '{}' not found in nodes",
                    i, edge.to
                ));
            }
        }

        errors
    }

    /// Get a node by ID
    pub fn get_node(&self, node_id: &str) -> Option<&KnowledgeNode> {
        self.nodes.get(node_id)
    }

    /// Get all nodes of a specific type
    pub fn get_nodes_by_type(&self, node_type: &str) -> Vec<&KnowledgeNode> {
        self.nodes
            .values()
            .filter(|n| n.node_type == node_type)
            .collect()
    }

    /// Get edges originating from a node
    pub fn get_edges_from(&self, node_id: &str) -> Vec<&KnowledgeEdge> {
        self.edges.iter().filter(|e| e.from == node_id).collect()
    }

    /// Get edges pointing to a node
    pub fn get_edges_to(&self, node_id: &str) -> Vec<&KnowledgeEdge> {
        self.edges.iter().filter(|e| e.to == node_id).collect()
    }

    /// Get workflow stages in order based on 'precedes' relations
    pub fn get_workflow_sequence(&self) -> Vec<&KnowledgeNode> {
        let workflow_nodes: Vec<_> = self.get_nodes_by_type("workflow_stage");
        if workflow_nodes.is_empty() {
            return Vec::new();
        }

        // Build precedence map
        let mut precedes: HashMap<&str, &str> = HashMap::new();
        for edge in &self.edges {
            if edge.relation == "precedes" {
                precedes.insert(&edge.from, &edge.to);
            }
        }

        // Find the start (node with no predecessor)
        let all_targets: std::collections::HashSet<_> = precedes.values().copied().collect();
        let starts: Vec<_> = workflow_nodes
            .iter()
            .filter(|n| !all_targets.contains(n.id.as_str()))
            .collect();

        if starts.is_empty() {
            return workflow_nodes;
        }

        // Build sequence
        let mut sequence = Vec::new();
        let mut current: Option<&str> = Some(&starts[0].id);
        let mut visited = std::collections::HashSet::new();

        while let Some(curr) = current {
            if visited.contains(curr) {
                break;
            }
            visited.insert(curr);

            if let Some(node) = self.nodes.get(curr) {
                sequence.push(node);
            }
            current = precedes.get(curr).copied();
        }

        sequence
    }

    /// Get methods from the graph
    pub fn get_methods(&self) -> Vec<&KnowledgeNode> {
        self.get_nodes_by_type("method")
    }

    /// Get rigor constraints from the graph
    pub fn get_rigor_constraints(&self) -> Vec<&KnowledgeNode> {
        self.get_nodes_by_type("rigor")
    }

    /// Get priorities from the graph
    pub fn get_priorities(&self) -> Vec<&KnowledgeNode> {
        self.get_nodes_by_type("priority")
    }

    /// Get frameworks from the graph
    pub fn get_frameworks(&self) -> Vec<&KnowledgeNode> {
        self.get_nodes_by_type("framework")
    }

    /// Get the reasoning context for agent decision-making
    pub fn get_reasoning_context(&self) -> ReasoningContext {
        ReasoningContext {
            graph_name: self.name.clone(),
            source: self.source.clone(),
            workflow: self
                .get_workflow_sequence()
                .into_iter()
                .map(|n| n.clone())
                .collect(),
            methods: self
                .get_methods()
                .into_iter()
                .map(|n| n.clone())
                .collect(),
            rigor_constraints: self
                .get_rigor_constraints()
                .into_iter()
                .map(|n| n.clone())
                .collect(),
            priorities: self
                .get_priorities()
                .into_iter()
                .map(|n| n.clone())
                .collect(),
            frameworks: self
                .get_frameworks()
                .into_iter()
                .map(|n| n.clone())
                .collect(),
            total_nodes: self.nodes.len(),
            total_edges: self.edges.len(),
        }
    }
}

/// Reasoning context extracted from a knowledge graph
#[derive(Debug, Clone, Serialize)]
pub struct ReasoningContext {
    pub graph_name: String,
    pub source: Option<String>,
    pub workflow: Vec<KnowledgeNode>,
    pub methods: Vec<KnowledgeNode>,
    pub rigor_constraints: Vec<KnowledgeNode>,
    pub priorities: Vec<KnowledgeNode>,
    pub frameworks: Vec<KnowledgeNode>,
    pub total_nodes: usize,
    pub total_edges: usize,
}

/// Reasoning engine that uses knowledge graphs for agent decision-making
#[derive(Debug, Default)]
pub struct ReasoningEngine {
    graphs: HashMap<String, KnowledgeGraph>,
    active_graph: Option<String>,
}

impl ReasoningEngine {
    /// Create a new reasoning engine
    pub fn new() -> Self {
        Self::default()
    }

    /// Load a knowledge graph into the engine
    pub fn load_graph(&mut self, graph: KnowledgeGraph) {
        let name = graph.name.clone();
        if self.active_graph.is_none() {
            self.active_graph = Some(name.clone());
        }
        self.graphs.insert(name, graph);
    }

    /// Set the active knowledge graph
    pub fn set_active_graph(&mut self, name: &str) -> Result<(), String> {
        if !self.graphs.contains_key(name) {
            return Err(format!("Unknown graph: {}", name));
        }
        self.active_graph = Some(name.to_string());
        Ok(())
    }

    /// Get the active knowledge graph
    pub fn get_active_graph(&self) -> Option<&KnowledgeGraph> {
        self.active_graph
            .as_ref()
            .and_then(|name| self.graphs.get(name))
    }

    /// Get reasoning context from the active graph
    pub fn get_reasoning_context(&self) -> Option<ReasoningContext> {
        self.get_active_graph().map(|g| g.get_reasoning_context())
    }

    /// Suggest next action based on current workflow stage
    pub fn suggest_next_action(&self, current_stage: Option<&str>) -> NextActionSuggestion {
        let graph = match self.get_active_graph() {
            Some(g) => g,
            None => {
                return NextActionSuggestion {
                    current_stage: current_stage.map(String::from),
                    next_stage: None,
                    methods: Vec::new(),
                    constraints: Vec::new(),
                    workflow_complete: false,
                    error: Some("No active knowledge graph".to_string()),
                }
            }
        };

        let workflow = graph.get_workflow_sequence();
        if workflow.is_empty() {
            return NextActionSuggestion {
                current_stage: current_stage.map(String::from),
                next_stage: None,
                methods: Vec::new(),
                constraints: Vec::new(),
                workflow_complete: false,
                error: Some("No workflow defined".to_string()),
            };
        }

        // Find current position
        let current_idx = current_stage
            .and_then(|cs| workflow.iter().position(|s| s.id == cs))
            .map(|i| i as i32)
            .unwrap_or(-1);

        // Get next stage
        let next_stage = if current_idx >= 0 && (current_idx as usize) < workflow.len() - 1 {
            Some(workflow[(current_idx + 1) as usize].clone())
        } else {
            None
        };

        let workflow_complete = next_stage.is_none() && current_idx >= 0;

        NextActionSuggestion {
            current_stage: current_stage.map(String::from),
            next_stage,
            methods: graph.get_methods().into_iter().cloned().collect(),
            constraints: graph.get_rigor_constraints().into_iter().cloned().collect(),
            workflow_complete,
            error: None,
        }
    }
}

/// Suggestion for next action in workflow
#[derive(Debug, Clone, Serialize)]
pub struct NextActionSuggestion {
    pub current_stage: Option<String>,
    pub next_stage: Option<KnowledgeNode>,
    pub methods: Vec<KnowledgeNode>,
    pub constraints: Vec<KnowledgeNode>,
    pub workflow_complete: bool,
    pub error: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_YAML: &str = r#"
source: test
nodes:
  - id: agent
    label: "Test Agent"
    type: agent
    description: "A test agent"
  - id: stage1
    label: "Stage 1"
    type: workflow_stage
    description: "First stage"
  - id: stage2
    label: "Stage 2"
    type: workflow_stage
    description: "Second stage"
  - id: method1
    label: "Method 1"
    type: method
    description: "A method"
edges:
  - from: agent
    to: stage1
    relation: sequences
  - from: stage1
    to: stage2
    relation: precedes
"#;

    #[test]
    fn test_parse_yaml() {
        let graph = KnowledgeGraph::from_yaml(TEST_YAML, "test").unwrap();
        assert_eq!(graph.nodes.len(), 4);
        assert_eq!(graph.edges.len(), 2);
    }

    #[test]
    fn test_workflow_sequence() {
        let graph = KnowledgeGraph::from_yaml(TEST_YAML, "test").unwrap();
        let workflow = graph.get_workflow_sequence();
        assert_eq!(workflow.len(), 2);
        assert_eq!(workflow[0].id, "stage1");
        assert_eq!(workflow[1].id, "stage2");
    }

    #[test]
    fn test_reasoning_engine() {
        let graph = KnowledgeGraph::from_yaml(TEST_YAML, "test").unwrap();
        let mut engine = ReasoningEngine::new();
        engine.load_graph(graph);

        let context = engine.get_reasoning_context().unwrap();
        assert_eq!(context.graph_name, "test");
        assert_eq!(context.workflow.len(), 2);
        assert_eq!(context.methods.len(), 1);
    }
}
