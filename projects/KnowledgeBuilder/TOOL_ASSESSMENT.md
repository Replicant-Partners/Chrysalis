# KnowledgeBuilder: Tool & Resource Assessment

**Evaluation of available APIs and MCP servers for entity data collection**

**Last Updated**: 2025-12-29  
**Version**: 1.0.0

---

## Assessment Methodology

Each tool evaluated on:
- **Availability**: API key status and access level
- **Relevance**: Fit for KnowledgeBuilder use cases (0-10 score)
- **Priority**: P0 (critical), P1 (high), P2 (medium), P3 (low)
- **Integration**: Timeline and dependencies

**Scoring basis**: Production RAG system requirements[^1] and semantic search best practices[^2]

---

## MCP Servers

### 🔍 Search & Discovery

#### brave-search
- **Status**: ✅ Available (API key in .env)
- **Relevance Score**: 10/10
- **Priority**: P0 - CRITICAL

**Capabilities**:
- Web search
- News search
- Image search
- Video search
- Local/place search

**KnowledgeBuilder Use Cases**:
1. **Primary Entity Discovery**: Finding initial information about entities
2. **News Collection**: Recent articles and mentions
3. **Image Collection**: Visual information about people, places, products
4. **Verification**: Cross-referencing facts across web sources
5. **Freshness**: Latest information and recent developments

**Example Usage**:
```python
# Person entity
brave_web_search("Satya Nadella biography career history")
brave_news_search("Satya Nadella", freshness="pw")  # Past week
brave_image_search("Satya Nadella official photo")

# Place entity
brave_local_search("Eiffel Tower Paris")
brave_web_search("Eiffel Tower history construction facts")

# Organization entity
brave_web_search("Microsoft Corporation headquarters history")
brave_news_search("Microsoft earnings Q4 2024")
```

**Limitations**:
- Rate limits (check API docs)
- May miss specialized/academic sources
- Quality varies by query

**Integration Priority**: Implement FIRST - Week 3

---

#### exa (via MCP)
- **Status**: ✅ Available via MCP
- **Relevance Score**: 9/10
- **Priority**: P0 - CRITICAL

**Capabilities**:
- Deep web search with content extraction
- Neural search (semantic understanding)
- Full page content retrieval
- Domain filtering
- Similarity search

**KnowledgeBuilder Use Cases**:
1. **Deep Content Extraction**: Get full article/page content
2. **Semantic Search**: Find conceptually related content
3. **Quality Content**: Better than generic web scraping
4. **Research Papers**: Academic and technical content
5. **Similar Entity Discovery**: Find related entities

**Example Usage**:
```python
# Deep search for comprehensive information
exa.web_search_exa(
    query="comprehensive analysis of SpaceX achievements",
    numResults=10,
    type="deep"
)

# Get full content from specific URLs
exa.crawling_exa(
    url="https://www.spacex.com/vehicles/starship/",
    maxCharacters=5000
)

# Find similar entities
exa.web_search_exa(
    query="space exploration companies similar to SpaceX",
    type="deep"
)
```

**Limitations**:
- API costs (per search/crawl)
- May have rate limits

**Integration Priority**: Implement FIRST - Week 3

---

#### firecrawl (via MCP)
- **Status**: ✅ Available via MCP (API key commented in .env)
- **Relevance Score**: 8/10
- **Priority**: P1 - HIGH

**Capabilities**:
- Website crawling (entire sites)
- Page scraping (single pages)
- Site mapping
- Dynamic content handling (JavaScript)
- Markdown conversion

**KnowledgeBuilder Use Cases**:
1. **Official Website Crawling**: Company sites, personal websites
2. **Documentation Extraction**: About pages, history pages
3. **Structured Content**: Product catalogs, team pages
4. **Media Sites**: News websites, blogs

**Example Usage**:
```python
# Map entire website
firecrawl.firecrawl_map(url="https://www.anthropic.com")

# Scrape specific page
firecrawl.firecrawl_scrape(
    url="https://www.anthropic.com/company",
    formats=["markdown"]
)

# Crawl with depth limit
firecrawl.firecrawl_crawl(
    url="https://www.anthropic.com/*",
    maxDiscoveryDepth=3,
    limit=50
)
```

**Limitations**:
- Expensive for large sites
- Rate limits
- Some sites block crawlers

**Integration Priority**: Implement in Week 4-5 (after MVP)

---

#### microsoft-learn (via MCP)
- **Status**: ✅ Available via MCP
- **Relevance Score**: 6/10 (specialized use case)
- **Priority**: P2 - MEDIUM

**Capabilities**:
- Search Microsoft documentation
- Fetch full documentation pages
- Code sample search

**KnowledgeBuilder Use Cases**:
1. **Technical Entity Information**: Microsoft products, technologies
2. **Example Collection**: When entity is a Microsoft technology
3. **Code-based Entities**: Programming languages, frameworks

**Example Usage**:
```python
# Research a technology entity
microsoft_docs_search(query="Azure Kubernetes Service overview")

# Get full documentation
microsoft_docs_fetch(
    url="https://learn.microsoft.com/en-us/azure/aks/"
)
```

**Limitations**:
- Only Microsoft documentation
- Limited to technical topics

**Integration Priority**: Optional - Week 8+

---

### 💾 Data Storage & Memory

#### lancedb (via MCP)
- **Status**: ✅ Available (API key in .env, cloud hosted)
- **Relevance Score**: 10/10
- **Priority**: P0 - CRITICAL

**Capabilities**:
- Vector storage and search
- SQL-like querying
- Hybrid search (vector + metadata)
- Incremental updates
- Cloud-hosted at `db://peripheral-json1d`

**KnowledgeBuilder Use Cases**:
1. **Primary Vector Storage**: All entity embeddings
2. **Semantic Search**: Query by meaning
3. **Metadata Filtering**: Filter by entity type, date, source
4. **Relationship Queries**: Find related entities
5. **Production Storage**: Scalable, cloud-based

**Example Usage**:
```python
# Ingest entity documents
lancedb.ingest_docs(docs=[
    "Satya Nadella is the CEO of Microsoft...",
    "He joined Microsoft in 1992...",
    "Previously worked at Sun Microsystems..."
])

# Query
lancedb.query_table(
    query="Who is the CEO of Microsoft?",
    top_k=5,
    query_type="vector"
)

# Get table details
lancedb.table_details()
```

**Limitations**:
- Storage costs
- Need to manage embeddings separately (OpenAI/Anthropic)

**Integration Priority**: Implement FIRST - Week 3

---

#### memory (via MCP)
- **Status**: ✅ Available via MCP
- **Relevance Score**: 9/10
- **Priority**: P0 - CRITICAL

**Capabilities**:
- Knowledge graph storage
- Entity relationship management
- Graph traversal
- Observation tracking

**KnowledgeBuilder Use Cases**:
1. **Relationship Storage**: Explicit entity connections
2. **Provenance Tracking**: Source chains and derivations
3. **Entity Context**: Related entities for enriched retrieval
4. **Semantic Network**: Understanding entity ecosystem
5. **Disambiguation**: Entity identification via relationships

**Example Usage**:
```python
# Create entities
memory.create_entities([
    {
        "name": "Satya_Nadella",
        "entityType": "Person",
        "observations": [
            "CEO of Microsoft",
            "Born in Hyderabad, India",
            "Joined Microsoft in 1992"
        ]
    },
    {
        "name": "Microsoft",
        "entityType": "Organization",
        "observations": [
            "Technology company",
            "Founded 1975",
            "Headquarters in Redmond, WA"
        ]
    }
])

# Create relationships
memory.create_relations([
    {
        "from": "Satya_Nadella",
        "to": "Microsoft",
        "relationType": "is_CEO_of"
    },
    {
        "from": "Satya_Nadella",
        "to": "Microsoft",
        "relationType": "works_for"
    }
])

# Query relationships
memory.open_nodes(["Satya_Nadella"])
```

**Limitations**:
- Need to design entity naming convention
- Graph size limits?

**Integration Priority**: Implement FIRST - Week 3

---

### 🌐 Browser Automation (optional)

> Update: Browserbase was removed from the pipeline; use Playwright only if dynamic rendering is unavoidable.

#### playwright (via MCP)
- **Status**: ✅ Available via MCP
- **Relevance Score**: 7/10
- **Priority**: P2 - MEDIUM

**Capabilities**:
- Browser automation
- Multiple browser support
- Network interception
- Mobile emulation
- PDF generation

**KnowledgeBuilder Use Cases**:
1. **Dynamic Sites**: JS-heavy pages when Firecrawl is insufficient
2. **PDF Generation**: Create documents from entities
3. **Mobile View**: Mobile-specific content
4. **Testing**: Verify data collection accuracy

**Limitations**:
- Requires more setup than API-first collectors
- Resource intensive

**Integration Priority**: Optional - Week 6+

---

### 🤖 Development & Analysis

#### github (via MCP)
- **Status**: ✅ Available via MCP (API key commented in .env)
- **Relevance Score**: 8/10 (for certain entity types)
- **Priority**: P2 - MEDIUM

**Capabilities**:
- Repository information
- User profiles
- Organization details
- Code search
- Issue/PR data

**KnowledgeBuilder Use Cases**:
1. **Developer Profiles**: Collecting data on software developers
2. **Organization Data**: Tech companies, open source projects
3. **Product Information**: Software products hosted on GitHub
4. **Project History**: Evolution of projects over time
5. **Contribution Analysis**: Developer activity patterns

**Example Usage**:
```python
# Get user profile (for Person entity)
github.search_users(q="satyanadella")

# Get organization info (for Organization entity)
github.search_repositories(q="org:microsoft")

# Get repository details (for Product entity)
github.get_file_contents(
    owner="microsoft",
    repo="vscode",
    path="README.md"
)
```

**Limitations**:
- Only for entities with GitHub presence
- Rate limits

**Integration Priority**: Week 5-6 (for tech-focused entities)

---

#### semgrep (via MCP)
- **Status**: ✅ Available via MCP
- **Relevance Score**: 3/10 (not directly relevant)
- **Priority**: P3 - LOW

**Capabilities**:
- Code security scanning
- Pattern matching in code

**KnowledgeBuilder Use Cases**:
1. **Code Quality**: If collecting code examples
2. **Security**: Ensuring collected code is safe

**Integration Priority**: Optional - only if processing code

---

### 🎨 UI & Design

#### 21st-dev-magic (via MCP)
- **Status**: ✅ Available via MCP
- **Relevance Score**: 2/10 (not relevant for current phase)
- **Priority**: P4 - VERY LOW

**Use Cases**: UI development (future web interface)

**Integration Priority**: Not applicable for research/MVP phase

---

### 🧠 AI & Intelligence

#### octagon (via MCP)
- **Status**: ✅ Available (API key in .env)
- **Relevance Score**: 9/10 (for financial entities)
- **Priority**: P1 - HIGH (for specific entity types)

**Capabilities**:
- Financial market intelligence
- Public company data
- Private company research
- Funding history
- M&A transactions
- Investor intelligence

**KnowledgeBuilder Use Cases**:
1. **Company Entities**: Public/private company information
2. **Financial Products**: Investment vehicles, funds
3. **Investor Profiles**: VCs, institutional investors
4. **Market Analysis**: Industry trends and competition
5. **Valuation Data**: Company metrics and financials

**Example Usage**:
```python
# Research a company
octagon.octagon_agent(
    prompt="Retrieve comprehensive financial data for Microsoft Corporation"
)

# Get funding history
octagon.octagon_agent(
    prompt="Retrieve the funding history for Anthropic, including all rounds and investors"
)

# Market intelligence
octagon.octagon_agent(
    prompt="Analyze the competitive landscape in the AI infrastructure sector"
)
```

**Limitations**:
- Specialized to financial/business entities
- API costs
- May require specific query formatting

**Integration Priority**: Week 4-5 (after basic MVP, for business entities)

---

#### crewai-docs (via MCP)
- **Status**: ✅ Available via MCP
- **Relevance Score**: 5/10 (for development reference)
- **Priority**: P2 - MEDIUM

**Capabilities**:
- Search CrewAI documentation
- Get agent templates
- List available tools
- Concept guides

**KnowledgeBuilder Use Cases**:
1. **Agent Development**: Reference for building agents
2. **Best Practices**: CrewAI patterns and approaches
3. **Tool Integration**: How to use CrewAI tools

**Integration Priority**: Week 3 (during agent development)

---

#### design-patterns (via MCP)
- **Status**: ✅ Available via MCP
- **Relevance Score**: 5/10 (for architecture)
- **Priority**: P2 - MEDIUM

**Capabilities**:
- Search design patterns
- Pattern recommendations
- Pattern details

**KnowledgeBuilder Use Cases**:
1. **Architecture Design**: Finding appropriate patterns
2. **Problem Solving**: Pattern-based solutions
3. **Code Quality**: Implementing well-known patterns

**Integration Priority**: Week 2-3 (during design phase)

---

## API Services (Direct)

### 🤖 LLM Providers

#### Anthropic Claude
- **Status**: ✅ Available (API key in .env)
- **Relevance Score**: 10/10
- **Priority**: P0 - CRITICAL

**Model**: Claude 3.5 Sonnet

**KnowledgeBuilder Use Cases**:
1. **Entity Classification**: Determine entity type from query
2. **Content Analysis**: Extract structured information from text
3. **Semantic Understanding**: Identify relationships and context
4. **Quality Assessment**: Evaluate completeness and accuracy
5. **Conflict Resolution**: Decide between contradictory sources
6. **Summarization**: Create entity summaries
7. **Disambiguation**: Identify correct entity from candidates

**Cost Considerations**:
- Input: $3 / 1M tokens
- Output: $15 / 1M tokens
- Long context: 200K tokens
- Budget: ~$1/entity target → ~30K tokens total per entity

**Integration Priority**: Implement FIRST - Week 3

---

#### OpenAI
- **Status**: ✅ Available (API key in .env)
- **Relevance Score**: 9/10
- **Priority**: P1 - HIGH

**Models**:
- GPT-4o: General purpose
- text-embedding-3-large: Embeddings (3072 dimensions)

**KnowledgeBuilder Use Cases**:
1. **Embeddings**: Primary use - generate vector embeddings
2. **Backup LLM**: If Claude unavailable
3. **Specialized Tasks**: Vision (image understanding), transcription

**Cost Considerations**:
- Embeddings: $0.13 / 1M tokens (very cheap)
- GPT-4o: $2.50 / 1M input, $10 / 1M output

**Integration Priority**: Implement FIRST - Week 3 (for embeddings)

---

## Tool Usage Matrix

### By Development Phase

| Phase | Week | Critical Tools | Optional Tools |
|-------|------|----------------|----------------|
| Research | 1-2 | brave-search, exa, design-patterns | microsoft-learn |
| MVP Dev | 3-4 | brave-search, exa, lancedb, memory, Claude, OpenAI | firecrawl, octagon |
| Enhancement | 5-6 | All MVP + firecrawl, octagon | github |
| Production | 7+ | All above | playwright, 21st-dev-magic |

### By Entity Type

| Entity Type | Primary Tools | Secondary Tools |
|-------------|---------------|-----------------|
| Person | brave-search, exa, memory | github (if developer) |
| Organization | brave-search, exa, octagon, memory | github, firecrawl |
| Place | brave-search (local), exa, memory | firecrawl (official sites) |
| Product | brave-search, exa, memory | github (if software), firecrawl |
| Concept | exa, brave-search, microsoft-learn | - |
| Event | brave-search (news), exa | - |
| Work | brave-search, exa | github (if code), firecrawl |

### By Task

| Task | Tools |
|------|-------|
| Initial Discovery | brave-search, exa |
| Deep Content Extraction | exa, firecrawl |
| Relationship Mapping | memory |
| Financial Data | octagon |
| Vector Storage | lancedb |
| Embedding Generation | OpenAI |
| Analysis & Reasoning | Claude |
| Dynamic Content | playwright |
| Code/Tech Entities | github, microsoft-learn |

---

## Budget Estimation

### Per Entity Cost (Target: $1.00)

| Service | Usage | Estimated Cost |
|---------|-------|----------------|
| Brave Search | 10-20 queries | $0.05 |
| Exa | 5 searches + 10 crawls | $0.20 |
| Firecrawl | 5 pages | $0.10 |
| Claude | ~30K tokens | $0.50 |
| OpenAI Embeddings | ~10K tokens | $0.001 |
| LanceDB | Storage + queries | $0.05 |
| Octagon | 1-2 queries (if needed) | $0.10 |
| **Total** | | **$1.00** |

### Monthly Budget Estimates

| Scale | Entities/Month | Estimated Cost |
|-------|----------------|----------------|
| Research | 50 | $50 |
| Small Scale | 500 | $500 |
| Medium Scale | 5,000 | $5,000 |
| Large Scale | 50,000 | $50,000 |

---

## Recommended MCP Servers to Add

### Priority 1: Essential Additions

1. **wikidata-mcp**
   - **Why**: Direct access to structured entity data
   - **Use Case**: Entity disambiguation, initial data collection
   - **Alternative**: Use brave-search to access Wikidata

2. **wikipedia-mcp**
   - **Why**: High-quality, comprehensive entity information
   - **Use Case**: Primary source for many entity types
   - **Alternative**: Use exa or firecrawl to scrape Wikipedia

### Priority 2: Valuable Additions

3. **arxiv-mcp**
   - **Why**: Academic papers and research
   - **Use Case**: Concept and research entities
   - **Alternative**: Use brave-search or exa

4. **youtube-mcp**
   - **Why**: Video content about entities
   - **Use Case**: Multi-modal information collection
   - **Alternative**: Use brave video search

### Priority 3: Nice-to-Have

5. **image-analysis-mcp**
   - **Why**: Understand images beyond text
   - **Use Case**: Extract information from photos, diagrams
   - **Alternative**: Use Claude's vision capabilities

6. **voyageai-mcp** or **cohere-mcp**
   - **Why**: Alternative embedding models
   - **Use Case**: A/B testing embedding quality
   - **Alternative**: Stick with OpenAI embeddings

---

## Integration Recommendations

### Week 3: MVP Core (Must Implement)

```python
# Priority order
1. brave-search: Primary web search
2. exa: Deep content extraction
3. lancedb: Vector storage
4. memory: Knowledge graph
5. OpenAI: Embeddings
6. Claude: Analysis and reasoning
```

### Week 4-5: Enhanced Collection

```python
7. firecrawl: Website crawling
8. octagon: Financial entities
9. github: Tech entities
```

### Week 6+: Advanced Features

```python
10. [Removed] browserbase: Dynamic content
11. Additional MCP servers as needed
```

---

## Tool Testing Priority

### High Priority (Test First)
1. ✅ Brave Search API - verify rate limits and response quality
2. ✅ Exa MCP - test search and crawl capabilities
3. ✅ LanceDB - verify connection and operations
4. ✅ Claude API - test with sample entity analysis
5. ✅ OpenAI Embeddings - generate test embeddings

### Medium Priority (Test Week 2-3)
6. Memory MCP - test knowledge graph operations
7. Firecrawl MCP - test with sample websites
8. Octagon API - test with sample company queries

### Low Priority (Test as Needed)
9. Browserbase - only if dynamic content needed
10. GitHub MCP - only for tech entities
11. Other specialized tools

---

## Risk Assessment

### High Risk (Mitigate Immediately)

1. **API Rate Limits**
   - Risk: Getting blocked during collection
   - Mitigation: Implement rate limiting, backoff, queuing

2. **API Costs**
   - Risk: Budget overruns
   - Mitigation: Cost tracking, limits per entity, monitoring

3. **LLM Token Limits**
   - Risk: Context overflow with Claude
   - Mitigation: Chunking strategy, incremental processing

### Medium Risk (Monitor)

4. **Search Quality Variance**
   - Risk: Poor results for some entities
   - Mitigation: Multiple sources, fallbacks, validation

5. **Service Availability**
   - Risk: APIs down or slow
   - Mitigation: Retry logic, alternative sources, graceful degradation

### Low Risk (Accept)

6. **Specialized Tool Limitations**
   - Risk: Some entities can't use all tools
   - Mitigation: Acceptable - use applicable tools only

---

## Summary: Tools by Criticality

### 🔴 Critical (Must Have for MVP)
- brave-search
- exa
- lancedb
- memory
- Anthropic Claude
- OpenAI (embeddings)

### 🟡 Important (Should Have)
- firecrawl
- octagon
- github

### 🟢 Optional (Nice to Have)
- playwright
- microsoft-learn
- crewai-docs
- design-patterns

### ⚪ Not Relevant
- semgrep (unless processing code)
- 21st-dev-magic (UI development)

---

## References

[^1]: Lewis, P., et al. (2020). "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks." *NeurIPS*. https://arxiv.org/abs/2005.11401 (Establishes RAG system requirements)

[^2]: Karpukhin, V., et al. (2020). "Dense Passage Retrieval for Open-Domain Question Answering." *EMNLP*. (Best practices for embedding-based retrieval)

[^3]: Brave Search (2021-present). "Brave Search API Documentation." https://brave.com/search/api/ (Privacy-focused web search with news, images, and local search)

[^4]: Exa AI (2023-present). "Exa Search Documentation." https://exa.ai/ (Neural search with content extraction capabilities)

[^5]: LanceDB (2023-present). "LanceDB Documentation." https://lancedb.com/ (Embedded and serverless vector database with SQL interface)

[^6]: Anthropic (2024). "Claude 3.5 Sonnet Technical Report." https://www.anthropic.com/ (200K context, advanced reasoning capabilities)

[^7]: OpenAI (2024). "Text Embedding Models." https://platform.openai.com/docs/guides/embeddings (text-embedding-3-large: 3072 dimensions)

[^8]: Big Book API (2024). "API Documentation." https://bigbookapi.com/docs/ (Semantic book search with extensive metadata)

[^9]: Octagon AI (2024). "Financial Intelligence Platform." https://octagon.ai/ (Public and private company data with SEC filings analysis)

---

**Last Updated**: 2025-12-29  
**Version**: 1.0.0  
**Maintainer**: KnowledgeBuilder Team
