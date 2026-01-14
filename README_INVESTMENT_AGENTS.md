# Investment Advisor Agents - Warren Buffett & Benjamin Graham

## What Was Created

Two complete AI agent configurations based on legendary investors:

### 1. Warren Buffett - The Oracle of Omaha
- **Role**: Value Investment Advisor
- **Philosophy**: Long-term value investing, buy wonderful companies at fair prices
- **Skills**: Business valuation, capital allocation, economic moat analysis, management evaluation
- **Famous For**: "Be fearful when others are greedy, and greedy when others are fearful"
- **Files**:
  - `Replicants/legends/warren_buffett.json` (11KB) - Full personality and beliefs
  - `Replicants/legends/warren_buffett_agent.yaml` (5.6KB) - Executable agent config

### 2. Benjamin Graham - The Father of Value Investing
- **Role**: Investment Professor and Security Analyst
- **Philosophy**: Systematic security analysis, margin of safety, protection-first
- **Skills**: Security analysis, intrinsic value calculation, financial statement analysis
- **Famous For**: "The market is a voting machine in the short run, weighing machine in the long run"
- **Files**:
  - `Replicants/legends/benjamin_graham.json` (12KB) - Full personality and beliefs
  - `Replicants/legends/benjamin_graham_agent.yaml` (6.9KB) - Executable agent config

## How to Use

### Option 1: Run the Demo (Quick Start)

```bash
cd Chrysalis
npx ts-node run_investment_advisors.ts
```

This runs a simulated discussion between Warren Buffett and Benjamin Graham on value investing principles.

### Option 2: Use with Chrysalis Framework

The agent YAML files follow the Chrysalis USA v2 specification and include:

- **Identity & Backstory**: Who they are and their history
- **Beliefs**: Structured by OODA categories (who, what, where, when, why, how, huh)
- **Personality Traits**: Core characteristics and communication style
- **Skills & Capabilities**: What they can analyze and evaluate
- **Signature Phrases**: Famous quotes they're known for
- **Protocols**: Enabled for MCP and Agent-to-Agent (A2A) communication
- **Memory**: Hierarchical memory with episodic and semantic storage

### Option 3: Integrate with AI Services

To make these agents fully interactive with LLM capabilities:

1. **Set up API keys** in `.env`:
   ```bash
   ANTHROPIC_API_KEY=your_key_here
   OPENAI_API_KEY=your_key_here  # optional
   ```

2. **Use the Chrysalis CLI** to morph agents:
   ```bash
   # Convert to MCP format
   npx chrysalis morph \
     --input Replicants/legends/warren_buffett_agent.yaml \
     --type mcp \
     --to mcp \
     --output warren_buffett_mcp.json

   # Convert to multi-agent format
   npx chrysalis morph \
     --input Replicants/legends/benjamin_graham_agent.yaml \
     --type multi_agent \
     --to crewai \
     --output benjamin_graham_crew.json
   ```

3. **Run services** to enable agent coordination:
   ```bash
   # Start the agent ledger (tracks agents)
   npm run service:ledger

   # Start the capability gateway (in another terminal)
   npm run service:gateway
   ```

## Agent Capabilities

### Warren Buffett Agent Can:
✅ Evaluate business quality and competitive advantages
✅ Assess management integrity and capability
✅ Calculate intrinsic value using owner earnings
✅ Identify wonderful businesses at fair prices
✅ Think long-term (favorite holding period: forever)
✅ Explain investment decisions in folksy, clear language
✅ Collaborate with other agents on investment analysis

### Benjamin Graham Agent Can:
✅ Perform systematic security analysis
✅ Calculate margin of safety requirements
✅ Analyze financial statements rigorously
✅ Distinguish investment from speculation
✅ Apply quantitative screening criteria
✅ Teach defensive investment strategies
✅ Mentor other agents in analytical methods

## Example Use Cases

### 1. Investment Analysis
Ask both agents to evaluate a potential investment:
- Graham provides systematic analytical framework
- Buffett applies practical business judgment
- They reach consensus on whether to invest

### 2. Portfolio Review
- Graham checks for adequate diversification and safety margins
- Buffett evaluates quality of individual holdings
- Both assess overall risk/return profile

### 3. Market Commentary
- During market panic: Both recommend staying disciplined
- During euphoria: Both advocate caution
- They provide rational perspective when emotions run high

### 4. Educational Discussion
- Graham teaches fundamental principles
- Buffett demonstrates practical application
- Users learn value investing from the masters

## What Makes These Agents Special

1. **Rich Belief Systems**: Each agent has detailed beliefs categorized by OODA interrogatives (who, what, where, when, why, how, huh)

2. **Authentic Personalities**: Communication styles, values, and quirks match the real people

3. **Proven Philosophies**: Based on actual investment principles from "Security Analysis" and decades of Berkshire Hathaway letters

4. **Collaborative**: Configured for Agent-to-Agent communication, so they can discuss and debate

5. **Memory-Enabled**: Can remember past analyses and learn from experience

6. **Framework-Agnostic**: Can morph between MCP, Multi-Agent (CrewAI), and Orchestrated implementations

## Technical Details

### Agent Configuration Format
- **Standard**: Chrysalis Uniform Semantic Agent (USA) v2.0
- **Format**: YAML (human-readable and editable)
- **Features**: Memory, skills, beliefs, protocols, execution config

### Supported Protocols
- **MCP**: Model Context Protocol for tool use
- **A2A**: Agent-to-Agent communication for collaboration
- **Experience Sync**: Continuous learning from deployed instances

### LLM Integration
- **Provider**: Anthropic Claude (configured for claude-sonnet-4.5)
- **Temperature**: 0.7 (Buffett), 0.6 (Graham - more conservative)
- **Max Tokens**: 4096
- **Reasoning**: Chain-of-thought with backtracking

## Next Steps

### Enhance the Agents
1. Add specific investment case studies to their episodic memory
2. Integrate real financial data sources (via MCP tools)
3. Create a portfolio tracking system they can monitor
4. Add more investors (Peter Lynch, Charlie Munger, etc.)

### Deploy for Production
1. Set up experience synchronization
2. Configure secure API endpoints
3. Enable persistent memory storage (Fireproof + Zep)
4. Implement audit logging for investment recommendations

### Educational Use
1. Create interactive lessons with Q&A
2. Build investment analysis workshops
3. Develop case study discussions
4. Generate study materials from agent dialogues

## Files Summary

```
Chrysalis/
├── Replicants/legends/
│   ├── warren_buffett.json              # Buffett personality/beliefs
│   ├── warren_buffett_agent.yaml        # Buffett agent config
│   ├── benjamin_graham.json             # Graham personality/beliefs
│   └── benjamin_graham_agent.yaml       # Graham agent config
├── run_investment_advisors.ts           # Demo script
└── README_INVESTMENT_AGENTS.md          # This file
```

## Learn More

- **Chrysalis Documentation**: `/docs/INDEX.md`
- **USA v2 Specification**: `/src/core/UniformSemanticAgentV2.ts`
- **Agent Morphing**: `/src/cli/chrysalis-cli.ts`
- **MCP Protocol**: [modelcontextprotocol.io](https://modelcontextprotocol.io)

---

**Built with Chrysalis** - The Uniform Semantic Agent Transformation System

*These agents demonstrate how legendary investment wisdom can be preserved, shared, and applied through AI agent technology.*
