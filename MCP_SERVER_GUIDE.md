# MCP Server Guide

A comprehensive guide to the 30 Model Context Protocol (MCP) servers configured in this environment. This document helps AI/LLM systems understand when and how to use each server's capabilities.

---

## Table of Contents

1. [Code Quality & Analysis](#1-code-quality--analysis)
2. [Search & Research](#2-search--research)
3. [Thinking & Reasoning](#3-thinking--reasoning)
4. [Development & Automation](#4-development--automation)
5. [Data & Storage](#5-data--storage)
6. [Media Generation](#6-media-generation)
7. [Domain-Specific](#7-domain-specific)
8. [Browser & Web Automation](#8-browser--web-automation)

---

## 1. Code Quality & Analysis

### Sourcery
**When to Use**: Code refactoring, identifying code smells, improving code quality, automated code review.

| Tool | Description |
|------|-------------|
| `review` | Analyzes code for quality issues, suggests improvements |
| `refactor` | Proposes refactoring suggestions for cleaner code |
| `explain` | Explains complex code sections |
| `metrics` | Provides code metrics and complexity analysis |

---

### Serena
**When to Use**: Semantic code navigation in large codebases, finding definitions/references, intelligent code editing across 30+ languages.

| Tool | Description |
|------|-------------|
| `find_symbol` | Finds symbols (functions, classes, variables) by name |
| `find_references` | Finds all references to a symbol |
| `go_to_definition` | Navigates to symbol definitions |
| `find_implementations` | Finds implementations of interfaces/abstract classes |
| `get_document_symbols` | Lists all symbols in a file |
| `rename_symbol` | Renames symbols across the codebase |
| `get_hover_info` | Gets type/documentation info for symbols |
| `find_type_definition` | Finds type definitions |
| `get_call_hierarchy` | Shows incoming/outgoing calls for functions |
| `workspace_symbol` | Searches symbols across entire workspace |

**Supported Languages**: TypeScript, JavaScript, Python, Go, Rust, Java, C#, C/C++, Kotlin, Ruby, Swift, Scala, Elixir, Haskell, and 20+ more.

---

### Sentry
**When to Use**: Error tracking, debugging production issues, analyzing error patterns, performance monitoring.

| Tool | Description |
|------|-------------|
| `get_issues` | Retrieves error issues from Sentry projects |
| `get_issue_details` | Gets detailed information about specific issues |
| `get_events` | Lists events/occurrences for an issue |
| `resolve_issue` | Marks issues as resolved |
| `get_project_stats` | Gets error statistics for projects |

**Connection**: SSE endpoint at `https://mcp.sentry.dev/sse`

---

### GitHub
**When to Use**: Repository management, PR reviews, issue tracking, code search, GitHub API operations.

| Tool | Description |
|------|-------------|
| `create_repository` | Creates new GitHub repositories |
| `search_repositories` | Searches for repositories |
| `get_file_contents` | Retrieves file contents from repos |
| `create_or_update_file` | Creates or updates files in repos |
| `push_files` | Pushes multiple files to a repository |
| `create_issue` | Creates new issues |
| `list_issues` | Lists repository issues |
| `create_pull_request` | Creates pull requests |
| `list_pull_requests` | Lists pull requests |
| `merge_pull_request` | Merges pull requests |
| `get_pull_request_diff` | Gets PR diff content |
| `create_branch` | Creates new branches |
| `list_branches` | Lists repository branches |
| `fork_repository` | Forks repositories |
| `search_code` | Searches code across GitHub |
| `get_commit` | Gets commit details |
| `list_commits` | Lists repository commits |

---

### Codegen
**When to Use**: AI-powered code generation, creating boilerplate, generating implementations from specifications.

| Tool | Description |
|------|-------------|
| `generate_code` | Generates code from natural language descriptions |
| `complete_code` | Completes partial code snippets |
| `explain_code` | Explains what code does |
| `refactor_code` | Suggests refactoring improvements |

---

## 2. Search & Research

### Brave Search
**When to Use**: General web search, finding current information, researching topics.

| Tool | Description |
|------|-------------|
| `brave_web_search` | Performs web searches via Brave Search API |
| `brave_local_search` | Searches for local businesses and places |

---

### Tavily
**When to Use**: AI-optimized search for research, fact-checking, gathering comprehensive information.

| Tool | Description |
|------|-------------|
| `tavily_search` | Performs AI-optimized web search |
| `tavily_extract` | Extracts content from URLs |
| `tavily_qna` | Direct question-answering from web |

---

### Exa
**When to Use**: Semantic search, finding similar content, neural search for research.

| Tool | Description |
|------|-------------|
| `search` | Neural/semantic search across the web |
| `find_similar` | Finds content similar to given URLs |
| `get_contents` | Extracts clean content from URLs |
| `search_and_contents` | Combined search + content extraction |

---

### Kagi
**When to Use**: Premium search with summarization, ad-free results, high-quality research.

| Tool | Description |
|------|-------------|
| `search` | Performs Kagi web search |
| `summarize` | Summarizes web pages or documents |
| `enrich` | Enriches queries with additional context |

---

### Stack Overflow
**When to Use**: Finding programming solutions, debugging code issues, best practices.

| Tool | Description |
|------|-------------|
| `search_questions` | Searches Stack Overflow questions |
| `get_question` | Gets question details and answers |
| `get_answers` | Gets answers for a question |
| `search_by_tag` | Searches questions by tag |

**Connection**: Remote MCP at `mcp.stackoverflow.com`

---

### Context7
**When to Use**: Documentation lookup, API reference search, library documentation.

| Tool | Description |
|------|-------------|
| `resolve-library-id` | Resolves library names to Context7 IDs |
| `get-library-docs` | Fetches documentation for libraries |

---

### Deep Wiki
**When to Use**: Knowledge base queries, wiki-style information retrieval.

| Tool | Description |
|------|-------------|
| `search` | Searches the Deep Wiki knowledge base |
| `get_page` | Retrieves specific wiki pages |
| `summarize` | Summarizes wiki content |

**Connection**: SSE endpoint at `https://mcp.deepwiki.com/sse`

---

### Microsoft Learn
**When to Use**: Microsoft documentation, Azure guides, .NET references, Windows development.

| Tool | Description |
|------|-------------|
| `search` | Searches Microsoft Learn documentation |
| `get_article` | Retrieves specific documentation articles |
| `get_module` | Gets learning module content |

**Connection**: Streamable HTTP at `https://learn.microsoft.com/api/mcp`

---

## 3. Thinking & Reasoning

### Sequential Thinking
**When to Use**: Step-by-step reasoning, breaking down complex problems, structured thinking.

| Tool | Description |
|------|-------------|
| `sequentialthinking` | Processes thoughts in sequential steps with revision support |

**Parameters**:
- `thought`: Current thinking step content
- `thoughtNumber`: Sequence number (≥1)
- `totalThoughts`: Estimated total steps
- `nextThoughtNeeded`: Whether another step is required
- `isRevision`: Whether revising previous thought
- `branchFromThought`: Branch point for exploration
- `needsMoreThoughts`: Whether to extend sequence

---

### MAS Sequential Thinking (Multi-Agent System)
**When to Use**: Complex analysis requiring multiple perspectives, deep problem-solving, comprehensive research.

| Tool | Description |
|------|-------------|
| `sequentialthinking` | Multi-agent parallel processing with 6 cognitive perspectives |

**Agent Types**:
| Agent | Role |
|-------|------|
| 🔬 Factual | Gathers objective data with web research |
| ⚠️ Critical | Identifies risks and problems |
| ✨ Optimistic | Explores opportunities and benefits |
| 🎨 Creative | Generates innovative solutions |
| 💭 Emotional | Provides intuitive insights |
| 🔗 Synthesis | Integrates all perspectives |

**Note**: Uses 5-10x more tokens than simple sequential thinking but provides much deeper analysis.

---

### Shannon Thinking
**When to Use**: Systematic problem-solving using Claude Shannon's methodology, information theory approaches.

| Tool | Description |
|------|-------------|
| `shannon_think` | Applies Shannon's problem-solving framework |
| `decompose_problem` | Breaks problems into information-theoretic components |
| `find_analogies` | Finds analogous problems from other domains |

---

### Memory
**When to Use**: Persisting information across conversations, storing user preferences, maintaining context.

| Tool | Description |
|------|-------------|
| `store_memory` | Stores key-value pairs in persistent memory |
| `retrieve_memory` | Retrieves stored memories by key |
| `list_memories` | Lists all stored memory keys |
| `delete_memory` | Removes specific memories |
| `search_memories` | Searches memories by content |

---

## 4. Development & Automation

### Filesystem
**When to Use**: Reading/writing files, directory operations, file management.

| Tool | Description |
|------|-------------|
| `read_file` | Reads file contents |
| `read_multiple_files` | Reads multiple files at once |
| `write_file` | Writes content to files |
| `create_directory` | Creates directories |
| `list_directory` | Lists directory contents |
| `move_file` | Moves/renames files |
| `search_files` | Searches for files by pattern |
| `get_file_info` | Gets file metadata |
| `list_allowed_directories` | Shows accessible directories |

**Configured Path**: `/home/mdz-axolotl/Documents/GitClones`

---

### E2B (Code Interpreter)
**When to Use**: Running code in sandboxed environments, executing Python/JavaScript, data analysis.

| Tool | Description |
|------|-------------|
| `run_code` | Executes code in isolated sandbox |
| `install_packages` | Installs Python/npm packages |
| `upload_file` | Uploads files to sandbox |
| `download_file` | Downloads files from sandbox |
| `list_files` | Lists files in sandbox |

**Supported Languages**: Python, JavaScript, TypeScript, R, Julia

---

### Playwright
**When to Use**: Browser automation, web scraping, testing web applications.

| Tool | Description |
|------|-------------|
| `browser_navigate` | Navigates to URLs |
| `browser_screenshot` | Takes screenshots |
| `browser_click` | Clicks elements |
| `browser_fill` | Fills form inputs |
| `browser_select` | Selects dropdown options |
| `browser_hover` | Hovers over elements |
| `browser_evaluate` | Executes JavaScript |
| `browser_get_content` | Gets page content |
| `browser_wait` | Waits for elements/conditions |
| `browser_pdf` | Generates PDFs |

---

### Browserbase
**When to Use**: Cloud browser automation, stealth browsing, large-scale web scraping.

| Tool | Description |
|------|-------------|
| `create_session` | Creates cloud browser session |
| `navigate` | Navigates to URLs |
| `screenshot` | Takes screenshots |
| `get_content` | Extracts page content |
| `click` | Clicks elements |
| `type` | Types text into inputs |
| `evaluate` | Runs JavaScript |
| `close_session` | Closes browser session |

---

### Oxylabs
**When to Use**: Web scraping at scale, bypassing anti-bot measures, structured data extraction.

| Tool | Description |
|------|-------------|
| `scrape_url` | Scrapes single URLs |
| `scrape_google` | Scrapes Google search results |
| `scrape_amazon` | Scrapes Amazon product data |
| `scrape_ecommerce` | Scrapes e-commerce sites |
| `get_job_results` | Gets async scraping results |

---

### Time
**When to Use**: Getting current time, timezone conversions, time calculations.

| Tool | Description |
|------|-------------|
| `get_current_time` | Gets current time in specified timezone |
| `convert_time` | Converts between timezones |
| `add_time` | Adds duration to time |
| `time_difference` | Calculates difference between times |

---

## 5. Data & Storage

### Zotero
**When to Use**: Managing research citations, organizing papers, academic research.

| Tool | Description |
|------|-------------|
| `search_items` | Searches Zotero library |
| `get_item` | Gets item details |
| `create_item` | Creates new bibliography items |
| `get_collections` | Lists collections |
| `add_to_collection` | Adds items to collections |
| `get_annotations` | Gets PDF annotations |
| `semantic_search` | AI-powered similarity search |
| `get_tags` | Gets item tags |

**Features**: Local Zotero integration with OpenAI embeddings for semantic search.

---

### Intugle
**When to Use**: Semantic data modeling, knowledge graph operations, structured data queries.

| Tool | Description |
|------|-------------|
| `create_entity` | Creates semantic entities |
| `query_entities` | Queries entity database |
| `create_relation` | Creates entity relationships |
| `semantic_search` | Searches by meaning |

---

## 6. Media Generation

### Video Gen (RunwayML + Luma AI)
**When to Use**: Generating videos from text/images, AI video creation, visual content production.

| Tool | Description |
|------|-------------|
| `generate_text_to_video` | Creates video from text prompts |
| `generate_image_to_video` | Animates images into video |
| `enhance_prompt` | Refines prompts using OpenRouter LLMs |
| `luma_generate_image` | Generates images from text |
| `luma_list_generations` | Lists previous Luma generations |
| `luma_get_generation` | Gets generation details |
| `luma_delete_generation` | Deletes generations |
| `luma_get_camera_motions` | Lists supported camera motions |
| `luma_add_audio` | Adds audio to generations |
| `luma_upscale` | Upscales to 1080p or 4K |

**Providers**:
- **RunwayML**: Gen3a models for high-quality video
- **Luma AI**: Ray-2 models, image generation, audio

---

## 7. Domain-Specific

### BioMCP
**When to Use**: Biomedical research, clinical trials, gene/variant information, medical literature.

| Tool | Description |
|------|-------------|
| `article_search` | Searches PubMed and preprints |
| `article_get` | Gets full article details |
| `trial_search` | Searches ClinicalTrials.gov |
| `trial_get` | Gets clinical trial details |
| `gene_getter` | Gets gene information |
| `disease_getter` | Gets disease info with synonyms |
| `variant_search` | Searches ClinVar for variants |
| `variant_get` | Gets variant details with annotations |
| `think` | Biomedical reasoning tool |

**Features**: OncoKB integration, NCI API support, automatic disease synonym expansion.

---

### Octagon MCP
**When to Use**: Financial data analysis, company research, market intelligence.

| Tool | Description |
|------|-------------|
| `company_search` | Searches company information |
| `get_financials` | Gets company financial data |
| `market_data` | Gets market statistics |
| `news_search` | Searches financial news |

---

### Octagon VC Agents
**When to Use**: Venture capital research, startup analysis, investment due diligence.

| Tool | Description |
|------|-------------|
| `analyze_startup` | Analyzes startup companies |
| `market_research` | Conducts market research |
| `competitor_analysis` | Analyzes competitors |
| `funding_research` | Researches funding rounds |

---

### Octagon Deep Research
**When to Use**: Comprehensive multi-source research, deep analysis, complex investigations.

| Tool | Description |
|------|-------------|
| `deep_research` | Conducts comprehensive research |
| `synthesize` | Synthesizes multiple sources |
| `fact_check` | Verifies claims |

---

## 8. Browser & Web Automation

### Playwright
*See [Development & Automation](#playwright) section*

### Browserbase
*See [Development & Automation](#browserbase) section*

### Oxylabs
*See [Development & Automation](#oxylabs) section*

---

## Quick Reference: When to Use What

| Need | Recommended MCP |
|------|-----------------|
| **Code refactoring** | Sourcery |
| **Navigate large codebase** | Serena |
| **Debug production errors** | Sentry |
| **GitHub operations** | GitHub |
| **General web search** | Brave Search, Tavily |
| **Semantic/AI search** | Exa, Kagi |
| **Programming help** | Stack Overflow |
| **Step-by-step reasoning** | Sequential Thinking |
| **Deep multi-perspective analysis** | MAS Sequential Thinking |
| **File operations** | Filesystem |
| **Run code safely** | E2B |
| **Browser automation** | Playwright, Browserbase |
| **Web scraping at scale** | Oxylabs |
| **Research citations** | Zotero |
| **Generate videos** | Video Gen |
| **Biomedical research** | BioMCP |
| **Financial research** | Octagon MCP, Octagon VC Agents |
| **Microsoft docs** | Microsoft Learn |
| **Library documentation** | Context7 |
| **Persistent memory** | Memory |
| **Time operations** | Time |

---

## Token Usage Considerations

| MCP | Token Usage | Notes |
|-----|-------------|-------|
| MAS Sequential Thinking | 🔴 Very High (5-10x) | Multi-agent parallel processing |
| Octagon Deep Research | 🟠 High | Comprehensive multi-source research |
| Serena | 🟡 Medium | Depends on codebase size |
| BioMCP | 🟡 Medium | Medical literature can be verbose |
| Most others | 🟢 Low | Standard tool calls |

---

## Configuration Notes

- **Filesystem** is limited to `/home/mdz-axolotl/Documents/GitClones`
- **Serena** project root set to `/home/mdz-axolotl/Documents/GitClones`
- **MAS Sequential Thinking** uses Anthropic Claude models
- **Video Gen** requires RunwayML + Luma AI + OpenRouter keys
- **Zotero** requires local Zotero desktop app running

---

*Last updated: January 2026*
*Total MCP Servers: 30*
