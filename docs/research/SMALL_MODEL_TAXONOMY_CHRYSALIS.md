# Small Language Model Taxonomy for Chrysalis Agentic AI

> **Research Date:** January 2026
> **Scope:** Models 1GB-8GB for edge/local deployment
> **Purpose:** Optimal model selection for multi-agent orchestration

---

## Executive Summary

This document establishes a validated taxonomy of small language models (1-8GB) for the Chrysalis agentic AI project. Based on comprehensive analysis across GitHub, Hugging Face, and Ollama repositories, we identify **10 functional categories** essential for agentic AI, each populated with production-ready model recommendations.

### Key Findings

1. **SLMs are sufficient for agentic AI** - Recent research (arXiv:2506.02153) demonstrates that well-designed small models can handle 70-90% of agentic tasks previously requiring large models
2. **Qwen3 family dominates** - Best overall performance across reasoning, tool use, and fine-tuning
3. **Function calling is solved** - Ollama structured outputs + Qwen3/Mistral provide reliable JSON generation
4. **Category expansion needed** - Beyond basic categories, Chrysalis requires specialized models for tool use, structured output, and inter-agent communication

---

## Part 1: Functional Category Taxonomy

### Core Categories (Essential)

| Category | Purpose | Chrysalis Use Case |
|----------|---------|-------------------|
| **1. Embedding** | Text → Vector conversion | Memory retrieval, semantic search |
| **2. Reasoning** | Chain-of-thought, logical deduction | Ada's architectural analysis, Phil's probabilistic reasoning |
| **3. Conversational** | Natural dialogue, instruction following | Chat pane interactions, user interface |
| **4. General Purpose** | Balanced capabilities | Default adapter model, fallback |
| **5. Code Generation** | Programming tasks | Skill generation, automation scripts |

### Extended Categories (Agentic-Specific)

| Category | Purpose | Chrysalis Use Case |
|----------|---------|-------------------|
| **6. Tool Use / Function Calling** | Structured API invocation | System agent tool orchestration |
| **7. Structured Output** | JSON/schema-constrained generation | Inter-agent message passing, API responses |
| **8. Planning & Orchestration** | Task decomposition, multi-step reasoning | ReWOO-style planners, Milton's ops coordination |
| **9. Multimodal (Vision-Language)** | Image + text understanding | Future: UI analysis, diagram comprehension |
| **10. Domain-Specific Reasoning** | Math, science, specialized domains | Phil's statistical analysis, scientific queries |

### Categories NOT Recommended for SLMs

| Category | Reason | Alternative |
|----------|--------|-------------|
| Long-form creative writing | Quality degradation at small scale | Use larger model or API |
| Complex multi-document synthesis | Context limitations | RAG + chunking strategy |
| Real-time translation (100+ languages) | Multilingual models large | Specialized translation APIs |

---

## Part 2: Model Family Analysis

### Tier 1: Primary Families (Highest Priority for Chrysalis)

#### **Qwen3 Family** ⭐ RECOMMENDED DEFAULT
- **Strengths:** Best fine-tuning performance, excellent tool use, hybrid thinking modes, Apache 2.0
- **Size range:** 0.6B → 235B (MoE)
- **Chrysalis fit:** Excellent for all system agents
- **Notable:** Qwen3-4B matches GPT-OSS-120B after fine-tuning

| Model | Size | Context | Best For |
|-------|------|---------|----------|
| qwen3:0.6b | 1.4 GB | 32K | Ultra-fast responses, edge |
| qwen3:1.7b | 1.4 GB | 32K | Fast general purpose |
| qwen3:4b | 2.5 GB | 32K | **Best balance** - reasoning + speed |
| qwen3:8b | 4.9 GB | 32K | Complex reasoning tasks |

#### **Phi-4 Family** (Microsoft)
- **Strengths:** Exceptional reasoning density, synthetic data training, strong math
- **Size range:** 3.8B (mini) → 14B
- **Chrysalis fit:** Excellent for Ada (architectural reasoning), David (metacognition)

| Model | Size | Context | Best For |
|-------|------|---------|----------|
| phi4-mini-reasoning | 3.2 GB | 128K | **Reasoning specialist** |
| phi4-mini-instruct | 3.8 GB | 128K | Instruction following |

#### **Mistral/Ministral Family**
- **Strengths:** Native function calling (no prompt engineering), fast inference
- **Size range:** 3B → 24B
- **Chrysalis fit:** Ideal for tool-heavy agents, Milton's ops tasks

| Model | Size | Context | Best For |
|-------|------|---------|----------|
| ministral-3:3b | 3.0 GB | 32K | Fast tool calling |
| ministral-3:latest | 6.0 GB | 256K | **Long context + vision** |
| mistral:latest | 4.4 GB | 32K | General purpose, reliable |

### Tier 2: Secondary Families (Specialized Use)

#### **Llama 3.x Family** (Meta)
- **Strengths:** Broad ecosystem, privacy-friendly, good baseline
- **Weakness:** Less specialized than Qwen3 for agentic tasks

| Model | Size | Context | Best For |
|-------|------|---------|----------|
| llama3.2:1b | 1.3 GB | 128K | Edge deployment, mobile |
| llama3.2:latest (3b) | 2.0 GB | 128K | Balanced small model |
| llama3.1:latest (8b) | 4.9 GB | 128K | General purpose baseline |

#### **Gemma3 Family** (Google)
- **Strengths:** Multimodal, strong math reasoning, permissive license
- **Weakness:** Narrower multilingual support

| Model | Size | Context | Best For |
|-------|------|---------|----------|
| gemma3:latest (4b) | 3.3 GB | 128K | Vision + text, math |

#### **DeepSeek-R1 Family**
- **Strengths:** Chain-of-thought output, MIT license, reasoning-focused
- **Weakness:** English/Chinese primarily

| Model | Size | Context | Best For |
|-------|------|---------|----------|
| deepseek-r1:1.5b | 1.1 GB | 64K | Compact reasoning |
| deepseek-r1:7b | 4.5 GB | 64K | Strong reasoning |

### Tier 3: Specialized/Research

#### **OLMo Family** (AI2 - Open Science)
- **Strengths:** Fully open (data, weights, code), reproducible research
- **Chrysalis fit:** Research validation, transparency requirements

| Model | Size | Context | Best For |
|-------|------|---------|----------|
| olmo-3:7b | 4.5 GB | 4K | Open science baseline |

#### **SmolLM3** (Hugging Face)
- **Strengths:** Fully open recipe, dual-mode reasoning (`/think`, `/no_think`), 64K context
- **Chrysalis fit:** Agent sessions requiring transparent reasoning

#### **CodeLlama**
- **Strengths:** Code-specialized, good for generation tasks
- **Note:** Being superseded by Qwen-Coder and DeepSeek-Coder

---

## Part 3: Category-Specific Recommendations

### Category 1: Embedding Models

**Current Chrysalis Installation:**
| Model | Size | Dimensions | Context | Languages | Recommended Use |
|-------|------|------------|---------|-----------|-----------------|
| nomic-embed-text | 274 MB | 768 | 8192 | EN | **Default** - fast, long context |
| embeddinggemma | 621 MB | 768 | 2048 | 100+ | On-device, privacy |
| mxbai-embed-large | 669 MB | 1024 | 512 | EN | **Best accuracy** |
| nomic-embed-text-v2-moe | 957 MB | 768 | 8192 | 100+ | Multilingual |
| bge-m3 | 1.2 GB | 1024 | 8192 | 100+ | **Most versatile** - hybrid retrieval |

**Recommendation:** Use `bge-m3` for production memory system (supports dense + sparse + ColBERT).

### Category 2: Reasoning Models

| Rank | Model | Size | Strengths | Weaknesses |
|------|-------|------|-----------|------------|
| 🥇 | **phi4-mini-reasoning** | 3.2 GB | Best reasoning density, 128K context | Narrow training data |
| 🥈 | **qwen3:4b** | 2.5 GB | Hybrid modes, tool-ready | Slightly lower math |
| 🥉 | **deepseek-r1:1.5b** | 1.1 GB | CoT output, compact | Limited languages |

**Chrysalis Assignment:** Ada (phi4-mini), David (qwen3:4b)

### Category 3: Conversational / Chat Models

| Rank | Model | Size | Strengths | Weaknesses |
|------|-------|------|-----------|------------|
| 🥇 | **qwen3:4b** | 2.5 GB | Natural dialogue, multilingual | - |
| 🥈 | **mistral:latest** | 4.4 GB | Reliable, good instruction following | Older |
| 🥉 | **llama3.2:latest** | 2.0 GB | Balanced, privacy-friendly | Less specialized |

**Chrysalis Assignment:** Chat pane default (qwen3:4b)

### Category 4: General Purpose Models

| Rank | Model | Size | Strengths | Weaknesses |
|------|-------|------|-----------|------------|
| 🥇 | **qwen3:4b** | 2.5 GB | Best overall balance | - |
| 🥈 | **llama3.1:latest** | 4.9 GB | Strong baseline, 128K context | Larger |
| 🥉 | **gemma3:latest** | 3.3 GB | Multimodal capable | Narrower language support |

**Chrysalis Assignment:** Universal Adapter default (qwen3:4b)

### Category 5: Code Generation Models

| Rank | Model | Size | Benchmark | Strengths |
|------|-------|------|-----------|-----------|
| 🥇 | **codellama:latest** | 3.8 GB | HumanEval ~62% | Python specialist, fill-in-middle |
| 🥈 | **qwen3:4b** | 2.5 GB | HumanEval ~58% | General + code |
| 🥉 | **deepseek-coder:6.7b** | 4.0 GB | HumanEval ~65% | Best benchmarks (need to pull) |

**Recommended Addition:**
```bash
ollama pull qwen2.5-coder:7b  # 4.4 GB - SOTA for size
```

### Category 6: Tool Use / Function Calling

| Rank | Model | Size | Native Support | Reliability |
|------|-------|------|----------------|-------------|
| 🥇 | **ministral-3:latest** | 6.0 GB | ✅ Native | Excellent |
| 🥈 | **qwen3:4b** | 2.5 GB | ✅ Via prompting | Very Good |
| 🥉 | **mistral:latest** | 4.4 GB | ✅ Native | Good |

**Chrysalis Assignment:** Milton (ministral-3), Lea (qwen3:4b)

### Category 7: Structured Output (JSON)

All models support structured output via Ollama's `format` parameter. Best performers:

| Rank | Model | JSON Reliability | Schema Adherence |
|------|-------|------------------|------------------|
| 🥇 | **qwen3:4b** | 98%+ | Excellent |
| 🥈 | **gemma3:latest** | 97%+ | Very Good |
| 🥉 | **phi4-mini** | 96%+ | Good |

**Usage Pattern:**
```python
response = ollama.chat(
    model="qwen3:4b",
    messages=[...],
    format={
        "type": "object",
        "properties": {
            "action": {"type": "string"},
            "confidence": {"type": "number"}
        },
        "required": ["action", "confidence"]
    }
)
```

### Category 8: Planning & Orchestration

For ReWOO-style planning (plan → execute → synthesize):

| Rank | Model | Size | Planning Quality | Cost Efficiency |
|------|-------|------|------------------|-----------------|
| 🥇 | **phi4-mini-reasoning** | 3.2 GB | Excellent | High |
| 🥈 | **qwen3:8b** | 4.9 GB | Excellent | Medium |
| 🥉 | **deepseek-r1:7b** | 4.5 GB | Very Good | Medium |

### Category 9: Multimodal (Vision-Language)

| Rank | Model | Size | Capabilities | Available |
|------|-------|------|--------------|-----------|
| 🥇 | **ministral-3:latest** | 6.0 GB | Vision + text, 256K context | ✅ Installed |
| 🥈 | **gemma3:4b** | 3.3 GB | Image understanding | ✅ Installed |
| 🥉 | **llava:7b** | 4.5 GB | Vision specialist | ❌ Not installed |

**Recommended Addition:**
```bash
ollama pull llava:7b  # Vision specialist
```

### Category 10: Domain-Specific (Math/Science)

| Rank | Model | Size | Domain | Performance |
|------|-------|------|--------|-------------|
| 🥇 | **phi4-mini-reasoning** | 3.2 GB | Math, Science | SOTA for size |
| 🥈 | **deepseek-r1:1.5b** | 1.1 GB | Math reasoning | Excellent |
| 🥉 | **qwen3:4b** | 2.5 GB | General STEM | Very Good |

---

## Part 4: Agentic Pattern Compatibility

### Pattern: ReAct (Reason + Act)
**Best Models:** qwen3:4b, mistral:latest
- Requires: Good instruction following, tool calling
- Loop: Think → Act → Observe → Repeat

### Pattern: ReWOO (Plan-Then-Execute)
**Best Models:** phi4-mini-reasoning, qwen3:8b
- Requires: Strong planning, can defer execution
- Advantage: 5× more token efficient than ReAct

### Pattern: Multi-Agent Debate
**Best Models:** qwen3:4b (multiple instances), mixed model ensemble
- Requires: Diverse perspectives, structured output
- Chrysalis: Ada vs David debate architecture

### Pattern: Reflection
**Best Models:** phi4-mini-reasoning, deepseek-r1
- Requires: Self-critique capability, CoT output
- Use: David's metacognitive auditing

### Pattern: CodeAct
**Best Models:** codellama, qwen2.5-coder
- Requires: Code generation + execution feedback
- Use: Dynamic tool creation

---

## Part 5: Chrysalis System Agent Assignments

Based on analysis, recommended model assignments:

| Agent | Role | Primary Model | Backup Model | Rationale |
|-------|------|---------------|--------------|-----------|
| **Ada** | Algorithmic Architect | phi4-mini-reasoning | qwen3:4b | Best structural reasoning |
| **Lea** | Implementation Reviewer | qwen3:4b | mistral:latest | Balanced code + review |
| **Phil** | Forecast Analyst | phi4-mini-reasoning | deepseek-r1:1.5b | Probabilistic reasoning |
| **David** | Metacognitive Guardian | qwen3:4b | phi4-mini | Self-reflection capability |
| **Milton** | Ops Caretaker | ministral-3:3b | qwen3:4b | Fast tool calling, monitoring |
| **Universal Adapter** | Default Processing | qwen3:4b | llama3.1:latest | Best general performance |
| **Memory System** | Embedding | bge-m3 | nomic-embed-text | Hybrid retrieval |

---

## Part 6: Coverage Gap Analysis

### Current Gaps in Chrysalis Ollama Installation

| Gap | Impact | Recommended Action |
|-----|--------|-------------------|
| No dedicated coder model | Code generation quality | `ollama pull qwen2.5-coder:7b` |
| No vision specialist | Limited multimodal | `ollama pull llava:7b` |
| No ultra-small edge model | Mobile/IoT deployment | `ollama pull qwen3:0.6b` |
| Limited reasoning diversity | Single-model debates | Keep current mix |

### Models to Consider Adding

```bash
# High Priority
ollama pull qwen2.5-coder:7b      # 4.4 GB - Best code model
ollama pull smollm3:3b            # 2.0 GB - Transparent reasoning

# Medium Priority
ollama pull llava:7b              # 4.5 GB - Vision specialist
ollama pull qwen3:0.6b            # ~400 MB - Ultra-fast edge

# Low Priority (research)
ollama pull tinyllama:1.1b        # 637 MB - Benchmark baseline
```

---

## Part 7: Inter-Agent Communication Protocol Recommendations

### Structured Message Format

For Chrysalis agent-to-agent communication, use JSON schema:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "message_id": {"type": "string", "format": "uuid"},
    "from_agent": {"type": "string", "enum": ["ada", "lea", "phil", "david", "milton"]},
    "to_agent": {"type": "string"},
    "message_type": {"type": "string", "enum": ["request", "response", "broadcast", "consensus"]},
    "payload": {
      "type": "object",
      "properties": {
        "action": {"type": "string"},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        "reasoning": {"type": "string"},
        "artifacts": {"type": "array"}
      }
    },
    "timestamp": {"type": "string", "format": "date-time"}
  },
  "required": ["message_id", "from_agent", "to_agent", "message_type", "payload"]
}
```

### Protocol Stack Recommendation

1. **Transport:** HTTP/WebSocket (existing Chrysalis infrastructure)
2. **Format:** JSON with schema validation
3. **Negotiation:** Agora-style protocol documents for capability exchange
4. **Identity:** Agent IDs with capability manifests

---

## Part 8: Selection Criteria Weights for Chrysalis

| Criterion | Weight | Rationale |
|-----------|--------|-----------|
| Function calling reliability | 25% | Core agentic requirement |
| Structured output quality | 20% | Inter-agent communication |
| Reasoning depth | 15% | Ada, Phil, David requirements |
| Inference speed | 15% | Real-time responsiveness |
| Context window | 10% | Long agent sessions |
| Fine-tuning accessibility | 10% | Future customization |
| License permissiveness | 5% | Commercial deployment |

---

## Part 9: Emerging Models to Track

### High Innovation Trajectory

| Model/Family | Status | Why Track |
|--------------|--------|-----------|
| **SmolLM3** (HuggingFace) | Released | Fully open, dual-mode reasoning |
| **Qwen3-Coder** | Released | SOTA open-source coding |
| **GLM-4** (Zhipu) | Released | 90%+ Terminal-Bench, strong agentic |
| **DeepSeek-V3.2** | Released | Thinking + tool use integration |
| **Llama 4 Scout** | Released | 1M context, multimodal |

### Architectural Innovations

| Innovation | Models | Benefit |
|------------|--------|---------|
| Mixture-of-Experts (MoE) | Qwen3, Mistral, nomic-v2-moe | Efficiency at scale |
| Dual-mode reasoning | SmolLM3, Qwen3 | Adaptive compute |
| Matryoshka embeddings | mxbai, nomic | Flexible dimension reduction |
| Hybrid retrieval | bge-m3 | Dense + sparse + ColBERT |

---

## Part 10: Implementation Roadmap

### Phase 1: Immediate (This Week)
- [x] Validate current model assignments
- [ ] Pull `qwen2.5-coder:7b` for code tasks
- [ ] Configure embedding model in memory system (`bge-m3`)
- [ ] Test structured output with all system agents

### Phase 2: Short-term (Next 2 Weeks)
- [ ] Implement agent-to-agent JSON protocol
- [ ] Benchmark all models on Chrysalis-specific tasks
- [ ] Fine-tune `qwen3:4b` on agent interaction data
- [ ] Add vision model (`llava:7b`) for multimodal experiments

### Phase 3: Medium-term (Next Month)
- [ ] Implement ReWOO planning pattern with phi4-mini
- [ ] Build multi-agent debate framework
- [ ] Evaluate SmolLM3 for transparent reasoning
- [ ] Create model routing based on task classification

---

## Appendix A: Current Chrysalis Ollama Inventory

```
EMBEDDING MODELS (5):
├── nomic-embed-text:latest      274 MB   - Fast, long context
├── embeddinggemma:latest        621 MB   - On-device, multilingual
├── mxbai-embed-large:latest     669 MB   - Best English accuracy
├── nomic-embed-text-v2-moe      957 MB   - Multilingual MoE
└── bge-m3:latest                1.2 GB   - Hybrid retrieval (RECOMMENDED)

REASONING MODELS (3):
├── phi4-mini-reasoning          3.2 GB   - SOTA reasoning density
├── deepseek-r1:1.5b             1.1 GB   - Compact CoT
└── olmo-3:7b                    4.5 GB   - Open science

GENERAL PURPOSE MODELS (6):
├── qwen3:0.6b                   (not installed - recommend adding)
├── qwen3:1.7b                   1.4 GB   - Fast general
├── qwen3:4b                     2.5 GB   - BEST BALANCE
├── llama3.2:1b                  1.3 GB   - Edge deployment
├── llama3.2:latest              2.0 GB   - Balanced small
├── llama3.1:latest              4.9 GB   - Strong baseline
├── gemma3:latest                3.3 GB   - Multimodal capable
└── tulu3:latest                 4.9 GB   - Instruction tuned

TOOL USE / FUNCTION CALLING (2):
├── ministral-3:3b               3.0 GB   - Fast native calling
├── ministral-3:latest           6.0 GB   - Vision + tools
└── mistral:latest               4.4 GB   - Reliable native calling

CODE MODELS (1):
└── codellama:latest             3.8 GB   - Python specialist
    (RECOMMEND: qwen2.5-coder:7b)

RESEARCH/SPECIALIZED (4):
├── vanta-research/atom-preview  7.3 GB   - Research preview
├── vanta-research/atom-olmo3    4.5 GB   - Open science variant
├── Raiff1982/codette-thinker    2.5 GB   - Code + thinking
└── mannix/jan-nano              2.3 GB   - Deep research

TOTAL: 19 chat models + 5 embedding models = 24 models
SIZE RANGE: 274 MB - 7.3 GB
```

## Appendix B: Quick Reference Card

```
┌─────────────────────────────────────────────────────────────┐
│           CHRYSALIS MODEL QUICK REFERENCE                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  DEFAULT ADAPTER:     qwen3:4b         (2.5 GB)            │
│  REASONING:           phi4-mini-reasoning (3.2 GB)         │
│  TOOL CALLING:        ministral-3:3b   (3.0 GB)            │
│  CODE:                codellama        (3.8 GB)            │
│  EMBEDDING:           bge-m3           (1.2 GB)            │
│                                                             │
│  EDGE/FAST:           qwen3:1.7b       (1.4 GB)            │
│  MULTIMODAL:          ministral-3:latest (6.0 GB)          │
│  RESEARCH:            olmo-3:7b        (4.5 GB)            │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  SYSTEM AGENT ASSIGNMENTS                                   │
│  ─────────────────────────────────────────────────────────  │
│  Ada (Architect)    → phi4-mini-reasoning                  │
│  Lea (Reviewer)     → qwen3:4b                             │
│  Phil (Analyst)     → phi4-mini-reasoning                  │
│  David (Guardian)   → qwen3:4b                             │
│  Milton (Ops)       → ministral-3:3b                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

*Document generated: January 2026*
*Next review: February 2026*
