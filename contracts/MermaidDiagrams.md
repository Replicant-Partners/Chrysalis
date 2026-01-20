# Mermaid Diagrams for Chrysalis Architecture

## Overview

This document provides links to the Mermaid diagrams that have been created to visualize the Chrysalis system architecture and workflows. These diagrams help stakeholders understand the system structure, component relationships, and key workflows.

## Created Diagrams

1. **System Architecture Overview**
   - [View Diagram](../diagrams/SystemArchitectureOverview.md)
   - High-level view of all major components
   - Layered architecture representation
   - Key integration points

2. **Agent System Architecture**
   - [View Diagram](../diagrams/AgentSystemArchitecture.md)
   - AgentArbiter and related components
   - Agent lifecycle and coordination
   - Behavior management

3. **Memory System Architecture**
   - [View Diagram](../diagrams/MemorySystemArchitecture.md)
   - Three-tier memory system
   - Data flow between layers
   - CRDT consistency mechanisms

4. **UI System Architecture**
   - [View Diagram](../diagrams/UISystemArchitecture.md)
   - Canvas-based interface structure
   - Widget hierarchy and relationships
   - Interaction patterns

5. **Protocol Integration Framework**
   - [View Diagram](../diagrams/ProtocolIntegrationFramework.md)
   - Universal Adapter pattern
   - Protocol registry and discovery
   - Adapter relationships

6. **Adapter Architecture**
   - [View Diagram](../diagrams/AdapterArchitecture.md)
   - Memory, Crypto/Web3, and IDE adapters
   - Common interface patterns
   - Integration points

7. **Key Workflows**
   - [View Diagram](../diagrams/KeyWorkflows.md)
   - Agent initialization and coordination
   - Memory operations and consistency
   - UI interactions and updates
   - Protocol translation and integration

8. **Knowledge Graph Structure**
   - [View Diagram](../diagrams/KnowledgeGraphStructure.md)
   - Entity types and relationships
   - Semantic categories and mappings
   - Cross-domain connections

## Diagram Specifications

### 1. System Architecture Overview
- **Type**: Component diagram
- **Purpose**: Show high-level system structure
- **Key Elements**: 
  - Agent System
  - Memory System
  - UI System
  - Protocol Framework
  - External Integrations

### 2. Agent System Architecture
- **Type**: Component diagram
- **Purpose**: Detail agent system components
- **Key Elements**:
  - AgentArbiter
  - SystemAgentLoader
  - BehaviorLoader
  - TerminalAgentConnector
  - EvaluationCoordinator

### 3. Memory System Architecture
- **Type**: Component diagram
- **Purpose**: Show memory system structure
- **Key Elements**:
  - Rust Core (CRDT)
  - Python Layer (Business Logic)
  - TypeScript Layer (API)
  - Storage Backends
  - AgentMemoryAdapter

### 4. UI System Architecture
- **Type**: Component diagram
- **Purpose**: Detail UI system components
- **Key Elements**:
  - Canvases (Agent, Research, Scrapbook, etc.)
  - Widgets (Note, CodeEditor, Terminal, etc.)
  - Widget Registry
  - Interaction Patterns

### 5. Protocol Integration Framework
- **Type**: Component diagram
- **Purpose**: Show protocol integration structure
- **Key Elements**:
  - UniversalAdapter
  - ProtocolRegistry
  - SemanticCategories
  - ProtocolHints
  - ProtocolTranslators

### 6. Adapter Architecture
- **Type**: Component diagram
- **Purpose**: Detail adapter implementations
- **Key Elements**:
  - MemoryAdapter
  - CryptoWeb3Adapter
  - IDEAdapter
  - Common Adapter Interface
  - External System Interfaces

### 7. Key Workflows
- **Type**: Sequence diagrams
- **Purpose**: Show important system workflows
- **Key Workflows**:
  - Agent Initialization
  - Memory Operation
  - UI Interaction
  - Protocol Translation

### 8. Knowledge Graph Structure
- **Type**: Graph diagram
- **Purpose**: Visualize knowledge graph structure
- **Key Elements**:
  - Entity Types
  - Relationship Types
  - Semantic Categories
  - Cross-Domain Connections