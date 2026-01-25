//! Benchmark for knowledge graph YAML parsing and reasoning context generation
//!
//! Run with: cargo bench --bench knowledge_graph_bench

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use chrysalis_system_agents::knowledge_graph::{KnowledgeGraph, ReasoningEngine};

const SMALL_YAML: &str = r#"
source: complex_learner
nodes:
  - id: identity
    label: "Agent Identity"
    type: identity
    description: "Operate as complexity scientist"
  - id: discovery
    label: "Discovery"
    type: workflow_stage
    description: "Clarify objectives and context"
  - id: investigation
    label: "Investigation"
    type: workflow_stage
    description: "Gather evidence"
  - id: synthesis
    label: "Synthesis"
    type: workflow_stage
    description: "Distill insights"
  - id: five_whys
    label: "Five Whys Method"
    type: method
    description: "Root cause analysis"
  - id: single_step
    label: "Single-Step Inference"
    type: rigor
    description: "One logical step from evidence"
edges:
  - from: discovery
    to: investigation
    relation: precedes
  - from: investigation
    to: synthesis
    relation: precedes
"#;

const MEDIUM_YAML: &str = r#"
source: complex_learner_full
nodes:
  - id: identity
    label: "Agent Identity"
    type: identity
    description: "Operate as complexity scientist"
  - id: priority_learning
    label: "Learning Priority"
    type: priority
    description: "Learning and discovery first"
  - id: discovery
    label: "Discovery"
    type: workflow_stage
    description: "Clarify objectives and context"
  - id: investigation
    label: "Investigation"
    type: workflow_stage
    description: "Gather evidence through exploration"
  - id: synthesis
    label: "Synthesis"
    type: workflow_stage
    description: "Distill insights and resolve contradictions"
  - id: reporting
    label: "Reporting"
    type: workflow_stage
    description: "Present findings and recommendations"
  - id: five_whys
    label: "Five Whys Method"
    type: method
    description: "Root cause analysis"
  - id: semantic_analysis
    label: "Semantic Analysis"
    type: method
    description: "Prefer semantic over brute-force search"
  - id: progressive_refinement
    label: "Progressive Refinement"
    type: method
    description: "Start broad then narrow systematically"
  - id: single_step
    label: "Single-Step Inference"
    type: rigor
    description: "One logical step from evidence >60% confidence"
  - id: cite_evidence
    label: "Cite Evidence"
    type: rigor
    description: "Always cite supporting evidence"
  - id: evolution_framework
    label: "Evolution Over Time"
    type: framework
    description: "View patterns evolving into complexity"
  - id: pattern_interaction
    label: "Pattern Interaction"
    type: framework
    description: "Simple patterns interact to create emergence"
edges:
  - from: discovery
    to: investigation
    relation: precedes
    weight: 1.0
  - from: investigation
    to: synthesis
    relation: precedes
    weight: 1.0
  - from: synthesis
    to: reporting
    relation: precedes
    weight: 1.0
  - from: investigation
    to: five_whys
    relation: uses
    weight: 0.9
  - from: investigation
    to: semantic_analysis
    relation: uses
    weight: 0.8
  - from: identity
    to: evolution_framework
    relation: applies
    weight: 1.0
"#;

fn bench_yaml_parsing(c: &mut Criterion) {
    let mut group = c.benchmark_group("yaml_parsing");

    group.bench_function("small_yaml_parse", |b| {
        b.iter(|| {
            let graph = KnowledgeGraph::from_yaml(black_box(SMALL_YAML), "small_test");
            black_box(graph)
        })
    });

    group.bench_function("medium_yaml_parse", |b| {
        b.iter(|| {
            let graph = KnowledgeGraph::from_yaml(black_box(MEDIUM_YAML), "medium_test");
            black_box(graph)
        })
    });

    group.finish();
}

fn bench_reasoning_context(c: &mut Criterion) {
    let graph = KnowledgeGraph::from_yaml(MEDIUM_YAML, "test").unwrap();
    
    let mut group = c.benchmark_group("reasoning_context");

    group.bench_function("get_reasoning_context", |b| {
        b.iter(|| {
            let context = graph.get_reasoning_context();
            black_box(context)
        })
    });

    group.bench_function("get_workflow_sequence", |b| {
        b.iter(|| {
            let workflow = graph.get_workflow_sequence();
            black_box(workflow)
        })
    });

    group.finish();
}

fn bench_reasoning_engine(c: &mut Criterion) {
    let mut group = c.benchmark_group("reasoning_engine");

    // Benchmark loading graph into engine
    group.bench_function("load_graph", |b| {
        b.iter(|| {
            let graph = KnowledgeGraph::from_yaml(MEDIUM_YAML, "test").unwrap();
            let mut engine = ReasoningEngine::new();
            engine.load_graph(graph);
            black_box(engine)
        })
    });

    // Benchmark repeated context access (simulates agent requests)
    let graph = KnowledgeGraph::from_yaml(MEDIUM_YAML, "test").unwrap();
    let mut engine = ReasoningEngine::new();
    engine.load_graph(graph);

    group.bench_function("repeated_context_access", |b| {
        b.iter(|| {
            for _ in 0..100 {
                let context = engine.get_reasoning_context();
                black_box(context);
            }
        })
    });

    group.finish();
}

criterion_group!(
    benches,
    bench_yaml_parsing,
    bench_reasoning_context,
    bench_reasoning_engine
);
criterion_main!(benches);
