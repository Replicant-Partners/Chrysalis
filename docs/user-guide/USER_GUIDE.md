# Chrysalis User Guide

**Version**: 1.0  
**Last Updated**: 2026-01-11  
**Audience**: End Users, Developers, AI Assistants

---

## Welcome to Chrysalis

Chrysalis is a multi-agent system that helps you create, manage, and deploy intelligent agents with specialized knowledge and skills. This guide will help you understand and use Chrysalis effectively.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Core Concepts](#core-concepts)
3. [Common Workflows](#common-workflows)
4. [Step-by-Step Tutorials](#step-by-step-tutorials)
5. [Best Practices](#best-practices)
6. [Troubleshooting](#troubleshooting)
7. [FAQ](#faq)
8. [Glossary](#glossary)

---

## Getting Started

### What is Chrysalis?

Chrysalis is a platform for building intelligent agents that can:
- **Learn** - Collect and organize knowledge about specific topics
- **Adapt** - Develop skills based on different roles and occupations
- **Collaborate** - Work together with other agents to solve complex problems
- **Evolve** - Improve over time through learning and optimization

### What Can I Do With Chrysalis?

**Create Specialized Agents**:
- Research assistants that gather information on specific topics
- Expert advisors with domain-specific knowledge
- Task automation agents that handle repetitive workflows
- Collaborative agents that work in teams

**Build Knowledge Bases**:
- Collect facts and information about entities (people, places, concepts)
- Organize knowledge with semantic relationships
- Search and retrieve relevant information quickly

**Develop Agent Skills**:
- Generate occupation-specific skill sets
- Define custom capabilities for your agents
- Combine skills to create versatile agents

### Prerequisites

Before you start, you'll need:
1. **API Access** - An API key to authenticate your requests
2. **Basic HTTP Knowledge** - Understanding of REST APIs (or use our SDKs)
3. **JSON Familiarity** - Ability to read and write JSON data

### Your First 5 Minutes

Let's create your first agent in 5 simple steps:

#### Step 1: Get Your API Key

Contact your system administrator or use the bootstrap endpoint to create your first API key:

```bash
curl -X POST http://localhost:5000/api/v1/auth/bootstrap \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My First Key",
    "role": "admin"
  }'
```

**Response**:
```json
{
  "success": true,
  "data": {
    "key_id": "admin-key-001",
    "secret": "a1b2c3d4e5f6g7h8i9j0",
    "full_key": "admin-key-001.a1b2c3d4e5f6g7h8i9j0"
  }
}
```

**Save your API key**: `admin-key-001.a1b2c3d4e5f6g7h8i9j0`

#### Step 2: Create an Agent

```bash
curl -X POST http://localhost:5000/api/v1/agents \
  -H "Authorization: Bearer admin-key-001.a1b2c3d4e5f6g7h8i9j0" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Python Expert",
    "description": "An agent specialized in Python programming",
    "capabilities": ["python_programming", "code_review"]
  }'
```

**Response**:
```json
{
  "success": true,
  "data": {
    "agent_id": "agent-12345",
    "name": "Python Expert",
    "status": "created",
    "created_at": "2026-01-11T04:53:00Z"
  }
}
```

#### Step 3: Add Knowledge to Your Agent

```bash
curl -X POST http://localhost:5002/api/v1/knowledge \
  -H "Authorization: Bearer admin-key-001.a1b2c3d4e5f6g7h8i9j0" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent-12345",
    "entity": "Python",
    "facts": [
      "Python is a high-level programming language",
      "Python emphasizes code readability",
      "Python supports multiple programming paradigms"
    ]
  }'
```

#### Step 4: Generate Skills for Your Agent

```bash
curl -X POST http://localhost:5001/api/v1/skills \
  -H "Authorization: Bearer admin-key-001.a1b2c3d4e5f6g7h8i9j0" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent-12345",
    "occupation": "Software Developer",
    "experience_level": "senior"
  }'
```

#### Step 5: Verify Your Agent

```bash
curl -X GET http://localhost:5000/api/v1/agents/agent-12345 \
  -H "Authorization: Bearer admin-key-001.a1b2c3d4e5f6g7h8i9j0"
```

**Congratulations!** You've created your first Chrysalis agent with knowledge and skills.

---

## Core Concepts

### Agents

**What is an Agent?**

An agent is an intelligent entity that can perform tasks, make decisions, and interact with users or other agents. Think of an agent as a specialized assistant with specific knowledge and capabilities.

**Agent Properties**:
- **Name** - A human-readable identifier
- **Description** - What the agent does
- **Capabilities** - What the agent can do
- **Knowledge** - What the agent knows
- **Skills** - How the agent performs tasks
- **Status** - Current state (created, building, active, inactive)

**Agent Lifecycle**:
```
Created → Building → Active → [Updating] → Inactive → Deleted
```

### Knowledge

**What is Knowledge?**

Knowledge represents facts, information, and relationships about entities (people, places, concepts, things). Knowledge is organized semantically, making it easy to search and retrieve relevant information.

**Knowledge Structure**:
```json
{
  "entity": "Python",
  "entity_type": "programming_language",
  "facts": [
    "Created by Guido van Rossum in 1991",
    "Known for clean, readable syntax",
    "Popular for data science and web development"
  ],
  "relationships": [
    {
      "type": "influenced_by",
      "target": "ABC language"
    }
  ],
  "metadata": {
    "confidence": 0.95,
    "source": "official_documentation"
  }
}
```

**Knowledge Types**:
- **Factual** - Objective, verifiable information
- **Procedural** - How-to knowledge and processes
- **Conceptual** - Abstract ideas and principles
- **Contextual** - Situational and domain-specific knowledge

### Skills

**What are Skills?**

Skills define what an agent can do and how well they can do it. Skills are typically associated with occupations, roles, or specific capabilities.

**Skill Structure**:
```json
{
  "skill_name": "Code Review",
  "proficiency": "expert",
  "description": "Ability to review code for quality, security, and best practices",
  "sub_skills": [
    "Static analysis",
    "Security auditing",
    "Performance optimization",
    "Style consistency"
  ],
  "tools": ["pylint", "black", "mypy"],
  "experience_years": 5
}
```

**Skill Levels**:
- **Novice** (0-1 years) - Basic understanding
- **Intermediate** (1-3 years) - Practical application
- **Advanced** (3-5 years) - Deep expertise
- **Expert** (5+ years) - Mastery and innovation

### Capabilities

**What are Capabilities?**

Capabilities are high-level functions that agents can perform. They combine knowledge and skills to accomplish specific tasks.

**Example Capabilities**:
- `python_programming` - Write and debug Python code
- `data_analysis` - Analyze datasets and generate insights
- `code_review` - Review code for quality and security
- `documentation` - Create technical documentation
- `testing` - Write and execute tests

---

## Common Workflows

### Workflow 1: Creating a Research Agent

**Goal**: Create an agent that researches a specific topic and maintains up-to-date knowledge.

**Steps**:

1. **Create the agent**:
```bash
POST /api/v1/agents
{
  "name": "AI Research Assistant",
  "description": "Researches artificial intelligence topics",
  "capabilities": ["research", "summarization", "fact_checking"]
}
```

2. **Add initial knowledge**:
```bash
POST /api/v1/knowledge
{
  "agent_id": "agent-12345",
  "entity": "Machine Learning",
  "facts": [
    "Machine learning is a subset of artificial intelligence",
    "ML algorithms learn patterns from data",
    "Common types include supervised, unsupervised, and reinforcement learning"
  ]
}
```

3. **Generate research skills**:
```bash
POST /api/v1/skills
{
  "agent_id": "agent-12345",
  "occupation": "Research Scientist",
  "experience_level": "advanced"
}
```

4. **Search existing knowledge**:
```bash
POST /api/v1/knowledge/search
{
  "agent_id": "agent-12345",
  "query": "What is machine learning?",
  "limit": 10
}
```

### Workflow 2: Building a Code Review Agent

**Goal**: Create an agent that reviews code for quality, security, and best practices.

**Steps**:

1. **Create the agent**:
```bash
POST /api/v1/agents
{
  "name": "Code Review Bot",
  "description": "Reviews code for quality and security",
  "capabilities": ["code_review", "security_audit", "style_checking"]
}
```

2. **Add programming language knowledge**:
```bash
POST /api/v1/knowledge
{
  "agent_id": "agent-67890",
  "entity": "Python Best Practices",
  "facts": [
    "Follow PEP 8 style guide",
    "Use type hints for better code clarity",
    "Write docstrings for all public functions",
    "Handle exceptions appropriately"
  ]
}
```

3. **Generate developer skills**:
```bash
POST /api/v1/skills
{
  "agent_id": "agent-67890",
  "occupation": "Senior Software Engineer",
  "experience_level": "expert"
}
```

4. **Build the agent** (combines knowledge and skills):
```bash
POST /api/v1/agents/agent-67890/build
{
  "optimization_level": "high",
  "include_tools": ["pylint", "black", "mypy"]
}
```

### Workflow 3: Creating a Multi-Agent Team

**Goal**: Create multiple agents that collaborate on complex tasks.

**Steps**:

1. **Create coordinator agent**:
```bash
POST /api/v1/agents
{
  "name": "Project Coordinator",
  "description": "Coordinates tasks across multiple agents",
  "capabilities": ["task_management", "coordination", "reporting"]
}
```

2. **Create specialist agents**:
```bash
# Backend Developer Agent
POST /api/v1/agents
{
  "name": "Backend Developer",
  "capabilities": ["api_development", "database_design"]
}

# Frontend Developer Agent
POST /api/v1/agents
{
  "name": "Frontend Developer",
  "capabilities": ["ui_development", "responsive_design"]
}

# QA Engineer Agent
POST /api/v1/agents
{
  "name": "QA Engineer",
  "capabilities": ["testing", "quality_assurance"]
}
```

3. **Add domain knowledge to each agent**:
```bash
# Add backend knowledge
POST /api/v1/knowledge
{
  "agent_id": "backend-agent-id",
  "entity": "REST API Design",
  "facts": [...]
}

# Add frontend knowledge
POST /api/v1/knowledge
{
  "agent_id": "frontend-agent-id",
  "entity": "React Best Practices",
  "facts": [...]
}
```

4. **Generate occupation-specific skills**:
```bash
# Backend skills
POST /api/v1/skills
{
  "agent_id": "backend-agent-id",
  "occupation": "Backend Developer",
  "experience_level": "senior"
}

# Frontend skills
POST /api/v1/skills
{
  "agent_id": "frontend-agent-id",
  "occupation": "Frontend Developer",
  "experience_level": "senior"
}
```

---

## Step-by-Step Tutorials

### Tutorial 1: Building Your First Agent (Detailed)

**Time Required**: 15 minutes  
**Difficulty**: Beginner

#### What You'll Learn
- How to authenticate with the API
- How to create an agent
- How to add knowledge
- How to generate skills
- How to query your agent

#### Prerequisites
- API access to Chrysalis
- curl or Postman installed
- Basic understanding of JSON

#### Step-by-Step Instructions

**Step 1: Set Up Authentication**

First, let's store your API key in an environment variable for convenience:

```bash
export CHRYSALIS_API_KEY="admin-key-001.a1b2c3d4e5f6g7h8i9j0"
```

Test your authentication:

```bash
curl -X GET http://localhost:5000/health \
  -H "Authorization: Bearer $CHRYSALIS_API_KEY"
```

**Expected Response**:
```json
{
  "status": "healthy",
  "service": "AgentBuilder",
  "version": "1.0.0"
}
```

✅ **Checkpoint**: If you see the healthy response, your authentication is working!

**Step 2: Create Your Agent**

Let's create a Python programming expert agent:

```bash
curl -X POST http://localhost:5000/api/v1/agents \
  -H "Authorization: Bearer $CHRYSALIS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Python Expert",
    "description": "An expert in Python programming, best practices, and ecosystem",
    "capabilities": [
      "python_programming",
      "code_review",
      "debugging",
      "performance_optimization"
    ],
    "metadata": {
      "created_by": "tutorial_user",
      "purpose": "learning"
    }
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "agent_id": "agent-abc123",
    "name": "Python Expert",
    "description": "An expert in Python programming, best practices, and ecosystem",
    "capabilities": [
      "python_programming",
      "code_review",
      "debugging",
      "performance_optimization"
    ],
    "status": "created",
    "created_at": "2026-01-11T05:00:00Z"
  },
  "meta": {
    "request_id": "req-xyz789",
    "timestamp": "2026-01-11T05:00:00Z"
  }
}
```

✅ **Checkpoint**: Save the `agent_id` from the response. You'll need it for the next steps!

```bash
export AGENT_ID="agent-abc123"
```

**Step 3: Add Knowledge About Python**

Now let's give our agent knowledge about Python:

```bash
curl -X POST http://localhost:5002/api/v1/knowledge \
  -H "Authorization: Bearer $CHRYSALIS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "'$AGENT_ID'",
    "entity": "Python",
    "entity_type": "programming_language",
    "facts": [
      "Python is a high-level, interpreted programming language",
      "Created by Guido van Rossum and first released in 1991",
      "Python emphasizes code readability with significant whitespace",
      "Supports multiple programming paradigms including procedural, object-oriented, and functional",
      "Has a comprehensive standard library (batteries included philosophy)",
      "Popular for web development, data science, AI/ML, automation, and scripting"
    ],
    "metadata": {
      "confidence": 0.95,
      "source": "official_documentation",
      "last_updated": "2026-01-11"
    }
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "knowledge_id": "knowledge-def456",
    "agent_id": "agent-abc123",
    "entity": "Python",
    "entity_type": "programming_language",
    "fact_count": 6,
    "created_at": "2026-01-11T05:01:00Z"
  }
}
```

✅ **Checkpoint**: Your agent now has knowledge about Python!

**Step 4: Add More Specific Knowledge**

Let's add knowledge about Python best practices:

```bash
curl -X POST http://localhost:5002/api/v1/knowledge \
  -H "Authorization: Bearer $CHRYSALIS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "'$AGENT_ID'",
    "entity": "Python Best Practices",
    "entity_type": "guidelines",
    "facts": [
      "Follow PEP 8 style guide for code formatting",
      "Use meaningful variable and function names",
      "Write docstrings for all public modules, functions, classes, and methods",
      "Use type hints to improve code clarity and catch errors early",
      "Prefer list comprehensions over map/filter for simple transformations",
      "Use context managers (with statements) for resource management",
      "Handle exceptions specifically rather than using bare except clauses",
      "Use virtual environments to isolate project dependencies"
    ],
    "relationships": [
      {
        "type": "applies_to",
        "target": "Python",
        "strength": 1.0
      }
    ],
    "metadata": {
      "confidence": 0.9,
      "source": "pep8_and_community_standards"
    }
  }'
```

**Step 5: Generate Skills for Your Agent**

Now let's give our agent skills based on the "Software Developer" occupation:

```bash
curl -X POST http://localhost:5001/api/v1/skills \
  -H "Authorization: Bearer $CHRYSALIS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "'$AGENT_ID'",
    "occupation": "Software Developer",
    "experience_level": "senior",
    "specializations": [
      "Python",
      "Backend Development",
      "API Design"
    ],
    "focus_areas": [
      "code_quality",
      "performance",
      "security"
    ]
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "skills_id": "skills-ghi789",
    "agent_id": "agent-abc123",
    "occupation": "Software Developer",
    "experience_level": "senior",
    "skills_generated": 12,
    "skills": [
      {
        "name": "Python Programming",
        "proficiency": "expert",
        "years_experience": 7
      },
      {
        "name": "Code Review",
        "proficiency": "advanced",
        "years_experience": 5
      },
      {
        "name": "API Design",
        "proficiency": "expert",
        "years_experience": 6
      }
    ],
    "created_at": "2026-01-11T05:02:00Z"
  }
}
```

✅ **Checkpoint**: Your agent now has professional skills!

**Step 6: Verify Your Agent**

Let's check that everything is set up correctly:

```bash
curl -X GET http://localhost:5000/api/v1/agents/$AGENT_ID \
  -H "Authorization: Bearer $CHRYSALIS_API_KEY"
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "agent_id": "agent-abc123",
    "name": "Python Expert",
    "description": "An expert in Python programming, best practices, and ecosystem",
    "capabilities": [
      "python_programming",
      "code_review",
      "debugging",
      "performance_optimization"
    ],
    "status": "active",
    "knowledge_count": 2,
    "skills_count": 12,
    "created_at": "2026-01-11T05:00:00Z",
    "updated_at": "2026-01-11T05:02:00Z"
  }
}
```

**Step 7: Search Your Agent's Knowledge**

Now let's test searching the knowledge we added:

```bash
curl -X POST http://localhost:5002/api/v1/knowledge/search \
  -H "Authorization: Bearer $CHRYSALIS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "'$AGENT_ID'",
    "query": "What are Python best practices for code quality?",
    "limit": 5
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "knowledge_id": "knowledge-def456",
        "entity": "Python Best Practices",
        "relevant_facts": [
          "Follow PEP 8 style guide for code formatting",
          "Use type hints to improve code clarity and catch errors early",
          "Write docstrings for all public modules, functions, classes, and methods"
        ],
        "relevance_score": 0.92
      }
    ],
    "total_results": 1,
    "search_time_ms": 45
  }
}
```

✅ **Success!** Your agent can now answer questions based on its knowledge!

**Step 8: Get Agent Capabilities**

Finally, let's see what your agent can do:

```bash
curl -X GET http://localhost:5000/api/v1/agents/$AGENT_ID/capabilities \
  -H "Authorization: Bearer $CHRYSALIS_API_KEY"
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "agent_id": "agent-abc123",
    "capabilities": [
      {
        "name": "python_programming",
        "description": "Write, debug, and optimize Python code",
        "proficiency": "expert",
        "enabled": true
      },
      {
        "name": "code_review",
        "description": "Review code for quality, security, and best practices",
        "proficiency": "advanced",
        "enabled": true
      },
      {
        "name": "debugging",
        "description": "Identify and fix bugs in Python code",
        "proficiency": "expert",
        "enabled": true
      },
      {
        "name": "performance_optimization",
        "description": "Optimize Python code for better performance",
        "proficiency": "advanced",
        "enabled": true
      }
    ]
  }
}
```

#### 🎉 Congratulations!

You've successfully created a fully functional Python Expert agent with:
- ✅ Knowledge about Python and best practices
- ✅ Professional skills from a senior software developer
- ✅ Multiple capabilities for programming tasks
- ✅ Searchable knowledge base

#### What's Next?

- Try adding more knowledge about specific Python libraries
- Create additional agents with different specializations
- Experiment with different skill levels and occupations
- Build a team of agents that work together

---

### Tutorial 2: Managing Agent Knowledge

**Time Required**: 10 minutes  
**Difficulty**: Beginner

#### What You'll Learn
- How to add knowledge incrementally
- How to update existing knowledge
- How to search knowledge effectively
- How to organize knowledge with relationships

#### Adding Knowledge Incrementally

You can add knowledge to your agent over time as you discover new information:

```bash
# Add knowledge about a Python library
curl -X POST http://localhost:5002/api/v1/knowledge \
  -H "Authorization: Bearer $CHRYSALIS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "'$AGENT_ID'",
    "entity": "FastAPI",
    "entity_type": "python_framework",
    "facts": [
      "FastAPI is a modern web framework for building APIs with Python",
      "Based on standard Python type hints",
      "Provides automatic API documentation with Swagger UI",
      "High performance, comparable to NodeJS and Go",
      "Built on Starlette and Pydantic"
    ],
    "relationships": [
      {
        "type": "written_in",
        "target": "Python",
        "strength": 1.0
      },
      {
        "type": "used_for",
        "target": "API Development",
        "strength": 0.9
      }
    ]
  }'
```

#### Updating Existing Knowledge

To update knowledge, use the PATCH endpoint:

```bash
curl -X PATCH http://localhost:5002/api/v1/knowledge/knowledge-def456 \
  -H "Authorization: Bearer $CHRYSALIS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "facts": [
      "Python 3.12 introduced improved error messages",
      "Python supports async/await for asynchronous programming"
    ],
    "operation": "append"
  }'
```

#### Searching Knowledge Effectively

**Basic Search**:
```bash
curl -X POST http://localhost:5002/api/v1/knowledge/search \
  -H "Authorization: Bearer $CHRYSALIS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "'$AGENT_ID'",
    "query": "web frameworks",
    "limit": 10
  }'
```

**Advanced Search with Filters**:
```bash
curl -X POST http://localhost:5002/api/v1/knowledge/search \
  -H "Authorization: Bearer $CHRYSALIS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "'$AGENT_ID'",
    "query": "API development",
    "filters": {
      "entity_type": "python_framework",
      "min_confidence": 0.8
    },
    "limit": 5
  }'
```

---

## Best Practices

### Agent Design

**1. Single Responsibility**
- Create agents with focused, specific purposes
- Avoid creating "do everything" agents
- Better: Multiple specialized agents than one generalist

**2. Clear Naming**
- Use descriptive names that indicate the agent's purpose
- Good: "Python Code Reviewer", "Data Analysis Assistant"
- Avoid: "Agent1", "Helper", "Bot"

**3. Appropriate Capabilities**
- Only assign capabilities the agent will actually use
- Match capabilities to the agent's knowledge and skills
- Review and update capabilities as the agent evolves

### Knowledge Management

**1. Quality Over Quantity**
- Add accurate, verified information
- Include confidence scores and sources
- Regularly review and update knowledge

**2. Organize with Relationships**
- Use relationships to connect related entities
- Build a knowledge graph, not just a list of facts
- Leverage semantic connections for better search

**3. Incremental Addition**
- Start with core knowledge
- Add details progressively
- Don't try to add everything at once

### Skill Development

**1. Match Skills to Occupation**
- Use realistic occupation titles
- Set appropriate experience levels
- Include relevant specializations

**2. Balance Breadth and Depth**
- Core skills at high proficiency
- Supporting skills at moderate levels
- Avoid claiming expertise in everything

**3. Update Skills Over Time**
- Reflect learning and growth
- Add new skills as needed
- Adjust proficiency levels based on performance

---

## Troubleshooting

### Common Issues and Solutions

#### Issue: "Authentication Failed" Error

**Symptoms**:
```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_FAILED",
    "message": "Invalid or expired API key"
  }
}
```

**Solutions**:
1. Check that your API key is correct
2. Ensure you're using the Bearer token format: `Bearer <key>`
3. Verify the API key hasn't been revoked
4. Check for extra spaces or newlines in the key

**Example Fix**:
```bash
# Wrong
Authorization: admin-key-001.a1b2c3d4e5f6g7h8i9j0

# Correct
Authorization: Bearer admin-key-001.a1b2c3d4e5f6g7h8i9j0
```

#### Issue: "Agent Not Found" Error

**Symptoms**:
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Agent with ID 'agent-12345' not found"
  }
}
```

**Solutions**:
1. Verify the agent ID is correct
2. Check that the agent wasn't deleted
3. Ensure you have permission to access the agent
4. List all agents to find the correct ID

**Example Fix**:
```bash
# List all agents to find the correct ID
curl -X GET http://localhost:5000/api/v1/agents \
  -H "Authorization: Bearer $CHRYSALIS_API_KEY"
```

#### Issue: "Validation Error" on Agent Creation

**Symptoms**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": [
      {
        "field": "name",
        "message": "Name is required"
      }
    ]
  }
}
```

**Solutions**:
1. Check that all required fields are present
2. Verify data types match the schema
3. Ensure values are within valid ranges
4. Review the API documentation for field requirements

**Example Fix**:
```bash
# Wrong - missing required field
{
  "description": "An agent"
}

# Correct - includes required name field
{
  "name": "My Agent",
  "description": "An agent"
}
```

#### Issue: Slow Knowledge Search

**Symptoms**:
- Search takes more than 2-3 seconds
- Timeout errors on search requests

**Solutions**:
1. Reduce the search limit (try 10-20 results max)
2. Use more specific search queries
3. Add filters to narrow the search space
4. Check system resources and database performance

**Example Fix**:
```bash
# Slow - too broad, too many results
{
  "query": "programming",
  "limit": 1000
}

# Fast - specific query, reasonable limit
{
  "query": "Python async programming best practices",
  "limit": 10,
  "filters": {
    "entity_type": "guidelines"
  }
}
```

#### Issue: Rate Limit Exceeded

**Symptoms**:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later."
  }
}
```

**Solutions**:
1. Implement exponential backoff in your client
2. Reduce request frequency
3. Batch operations when possible
4. Contact support for higher rate limits if needed

**Example Fix**:
```python
import time
import requests

def make_request_with_retry(url, headers, data, max_retries=3):
    for attempt in range(max_retries):
        response = requests.post(url, headers=headers, json=data)
        
        if response.status_code == 429:  # Rate limit
            wait_time