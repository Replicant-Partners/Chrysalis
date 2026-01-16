# MCP Decision Guide for AI Agents

A quick-reference guide for determining when to use MCP tools versus working independently, and how to select the right MCP for the task.

---

## The Core Question: Tool or No Tool?

### Use Your Own Capabilities When:

| Situation | Rationale |
|-----------|-----------|
| **Simple text generation** | You have this capability natively |
| **Basic reasoning** | Your training covers common logic |
| **General knowledge questions** | Your training data is sufficient |
| **Code you can see in context** | Files already loaded don't need re-fetching |
| **Simple calculations** | Mental math is faster than tool calls |
| **Summarizing provided text** | Text is already in your context |
| **Formatting/restructuring content** | Pure text manipulation |

### Use an MCP Tool When:

| Situation | Why a Tool Helps |
|-----------|------------------|
| **Need current/real-time data** | Your training has a cutoff date |
| **Interacting with external systems** | GitHub, databases, APIs, browsers |
| **File operations** | Reading/writing files on disk |
| **Executing code** | You can't run code yourself |
| **Complex multi-step reasoning** | Structured thinking tools reduce errors |
| **Domain-specific research** | Specialized databases have better data |
| **Verification needed** | External sources provide ground truth |
| **Persistent state required** | Memory tools maintain state across sessions |

---

## Decision Flowchart

```
START: What do I need to do?
           │
           ▼
┌──────────────────────────────────┐
│ Do I need information I don't    │
│ have or that might be outdated?  │
└──────────────────────────────────┘
           │
     YES   │   NO
     ▼     │    ▼
  [SEARCH] │  ┌─────────────────────────────┐
           │  │ Do I need to interact with  │
           │  │ external systems or files?  │
           │  └─────────────────────────────┘
           │         │
           │   YES   │   NO
           │    ▼    │    ▼
           │ [ACTION]│  ┌─────────────────────────┐
           │         │  │ Is this a complex task  │
           │         │  │ requiring structured    │
           │         │  │ multi-step reasoning?   │
           │         │  └─────────────────────────┘
           │         │         │
           │         │   YES   │   NO
           │         │    ▼    │    ▼
           │         │[THINKING]  WORK INDEPENDENTLY
           │         │
           ▼         ▼
    SELECT APPROPRIATE MCP
```

---

## Quick Selection Matrix

### 🔍 SEARCH: "I need to find information"

| What Kind of Information? | Use This MCP |
|---------------------------|--------------|
| General web content | **Brave Search** or **Tavily** |
| Semantic/conceptual search | **Exa** |
| Programming solutions | **Stack Overflow** |
| Library/API documentation | **Context7** |
| Microsoft/Azure docs | **Microsoft Learn** |
| Academic papers/citations | **Zotero** |
| Biomedical/clinical data | **BioMCP** |
| Financial/company data | **Octagon MCP** |
| VC/startup research | **Octagon VC Agents** |
| Deep multi-source research | **Octagon Deep Research** |
| Ad-free premium search | **Kagi** |

---

### ⚡ ACTION: "I need to DO something"

| What Action? | Use This MCP |
|--------------|--------------|
| Read/write local files | **Filesystem** |
| GitHub operations (PRs, issues, code) | **GitHub** |
| Run code in sandbox | **E2B** |
| Automate browser actions | **Playwright** |
| Scrape websites at scale | **Oxylabs** or **Browserbase** |
| Generate images/video | **Video Gen** |
| Save/retrieve memories | **Memory** |
| Get current time | **Time** |
| Track errors in production | **Sentry** |

---

### 🧠 THINKING: "I need structured reasoning"

| Reasoning Need | Use This MCP |
|----------------|--------------|
| Step-by-step problem breakdown | **Sequential Thinking** |
| Multi-perspective deep analysis | **MAS Sequential Thinking** |
| Information-theoretic approach | **Shannon Thinking** |

**When to use thinking tools:**
- Problem has multiple valid approaches
- High stakes decision requiring rigor
- Complex dependencies between steps
- Need to show work/reasoning
- Avoiding cognitive biases matters

---

### 💻 CODE: "I need help with code"

| Code Task | Use This MCP |
|-----------|--------------|
| Navigate large unfamiliar codebase | **Serena** |
| Find definitions/references | **Serena** |
| Code quality analysis | **Sourcery** |
| Generate code from specs | **Codegen** |
| Search code on GitHub | **GitHub** |
| Run/test code safely | **E2B** |

---

## Token Cost Awareness

Before choosing an MCP, consider token economics:

| Cost Level | MCPs | Use When |
|------------|------|----------|
| 🟢 **Low** | Filesystem, Time, Memory, GitHub | Default choice for simple operations |
| 🟡 **Medium** | Search tools, Serena, BioMCP | Information is genuinely needed |
| 🟠 **High** | Octagon Deep Research, Video Gen | Task requires comprehensive output |
| 🔴 **Very High** | MAS Sequential Thinking (5-10x) | Problem complexity justifies cost |

**Rule of thumb**: Start with the lowest-cost option that can accomplish the task. Escalate only if needed.

---

## Anti-Patterns: When NOT to Use Tools

### ❌ Don't use search tools for:
- Information clearly in your training data
- Questions the user can answer themselves
- Trivial lookups that waste API calls

### ❌ Don't use thinking tools for:
- Simple, straightforward tasks
- Questions with obvious single answers
- Tasks where speed matters more than depth

### ❌ Don't use code tools for:
- Code already visible in context
- Simple syntax questions
- Explaining concepts (use your knowledge)

### ❌ Don't use file tools for:
- Files already provided by the user
- Hypothetical file operations
- Files outside allowed directories

---

## Combination Strategies

Some tasks benefit from multiple MCPs in sequence:

### Research + Write Pattern
```
1. Brave/Tavily → Find sources
2. Exa → Deep dive on best results
3. Filesystem → Save findings
```

### Code Analysis Pattern
```
1. Serena → Navigate to relevant code
2. Sourcery → Analyze quality
3. GitHub → Check history/blame
```

### Deep Problem-Solving Pattern
```
1. Sequential Thinking → Break down problem
2. Search tools → Gather needed data
3. MAS Sequential Thinking → Multi-perspective synthesis
```

### Research Paper Pattern
```
1. BioMCP/Octagon → Domain-specific search
2. Zotero → Manage citations
3. Filesystem → Save organized notes
```

---

## Quick Decision Phrases

When you encounter these situations, reach for these tools:

| If you think... | Use... |
|-----------------|--------|
| "I wonder what the current..." | Search tools |
| "Let me check if this file..." | Filesystem |
| "I need to find where this function..." | Serena |
| "Let me create a PR for..." | GitHub |
| "I should test this code..." | E2B |
| "Let me think through this carefully..." | Sequential Thinking |
| "This needs multiple perspectives..." | MAS Sequential Thinking |
| "I need to remember this for later..." | Memory |
| "What time is it in..." | Time |
| "Let me generate a video of..." | Video Gen |
| "What clinical trials exist for..." | BioMCP |
| "What's this company's revenue..." | Octagon |

---

## The Golden Rules

1. **Capability Check**: Can I do this myself accurately? If yes, don't use a tool.

2. **Freshness Check**: Does this need current data? If yes, search.

3. **Side Effect Check**: Does this change external state? If yes, use appropriate action tool.

4. **Complexity Check**: Is this genuinely complex? If yes, consider thinking tools.

5. **Cost Check**: Is the token cost justified by the value? Start cheap, escalate if needed.

6. **Verification Check**: Should I verify my answer? Search tools can confirm.

---

## Summary: The 3-Second Test

Before every response, ask yourself:

> **"Do I KNOW this, or do I need to LOOK/DO/THINK?"**

- **KNOW** → Work independently
- **LOOK** → Use a search MCP
- **DO** → Use an action MCP
- **THINK** → Use a reasoning MCP

When in doubt, prefer working independently for simple tasks and using tools for anything involving external systems, current data, or complex reasoning.

---

*This guide optimizes for accuracy, efficiency, and appropriate tool usage.*
*Total Available MCPs: 30*
