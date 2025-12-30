# Chrysalis: Quick Start Guide

**Get started with Chrysalis in 10 minutes**

---

## 🦋 What is Chrysalis?

**In One Sentence**:
> Chrysalis transforms agents between frameworks using 10 universal patterns from distributed systems and nature, enabling continuous learning and Byzantine-resistant evolution.

**In 30 Seconds**:
- Agents morph between MCP, Multi-Agent, and Orchestrated types
- Experiences sync back using gossip protocols (O(log N))
- State merges conflict-free using CRDTs
- Identity secured with cryptographic signatures
- Built on mathematically proven patterns

---

## ⚡ 5-Minute Quick Start

### Step 1: Build (1 minute)

```bash
cd ~/Documents/GitClones/Chrysalis
npm install  # Installs 6 validated dependencies
npm run build  # Compiles 29 modules
```

**Expected**: ✅ 0 errors, `dist/` directory created

### Step 2: Understand (3 minutes)

**The 10 Universal Patterns**:
1. **Hash** - Agent fingerprinting (SHA-384)
2. **Signatures** - Authentication (Ed25519)
3. **Random** - Instance placement
4. **Gossip** - Experience sync (O(log N))
5. **DAG** - Evolution tracking
6. **Convergence** - Skill aggregation
7. **Redundancy** - Multi-instance
8. **Threshold** - Byzantine resistance (2/3)
9. **Time** - Causal ordering
10. **CRDT** - Conflict-free merge

### Step 3: Use (1 minute)

```bash
# See available commands
chrysalis --help

# Morph an agent
chrysalis morph --agent agent.json --type multi_agent

# Sync experiences
chrysalis sync --instance <id> --agent agent.json
```

---

## 📖 Next Steps

### Read These (In Order)

**15-Minute Path**:
1. `README.md` - Project overview
2. `FINAL_SYNTHESIS.md` - What was delivered
3. Run `npm run build` - Verify it works

**1-Hour Path**:
1. `CHRYSALIS_FOUNDATION_SPEC.md` - Pattern foundations
2. `src/core/patterns/` - Implementation code
3. Examples (when created)

**Deep Dive Path**:
1. `CHRYSALIS_COMPLETE_SPEC.md` - Complete spec
2. `LAYER1_UNIVERSAL_PATTERNS_ANCHORED.md` - Evidence
3. `DEEP_RESEARCH_*.md` - Mathematical foundations

---

## 🎯 Key Concepts

### Agents Morph

```
Universal Agent (Canonical)
      ↓ morph
MCP / Multi-Agent / Orchestrated
      ↓ sync
Experiences flow back
      ↓ merge
Enhanced Agent
```

### Universal Patterns

Not ad-hoc design → Proven across domains:
- Hashing (Git, Bitcoin, IPFS)
- Signatures (TLS, Ethereum, Signal)
- Gossip (Cassandra, Ethereum 2.0)
- CRDTs (Automerge, Riak, Redis)

### Security

Byzantine-resistant:
- Tolerates < 1/3 malicious instances
- Median aggregation (outlier-resistant)
- Threshold verification (2/3)
- Cryptographic identity (unforgeable)

---

## 🔧 Commands

```bash
# Morph agent
chrysalis morph \
  --agent agent.json \
  --type multi_agent \
  --redundancy 3

# Sync from instance
chrysalis sync \
  --instance <id> \
  --agent agent.json

# View evolution
chrysalis evolution \
  --agent agent.json

# Verify agent
chrysalis verify \
  --agent agent.json \
  --quorum 2
```

---

## ✅ Verification

**Check it works**:

```bash
# 1. Dependencies installed?
ls node_modules/@noble/hashes
# Should show directory

# 2. TypeScript compiled?
ls dist/core/patterns/
# Should show .js files

# 3. Pattern modules exist?
ls src/core/patterns/*.ts
# Should show 5 files
```

**Expected**:
- ✅ 6 dependencies installed
- ✅ 29 modules compiled to dist/
- ✅ 5 pattern modules in src/

---

## 🎨 The Philosophy

**Chrysalis** (n): The transformative stage where organisms fundamentally change form

**Applied to Agents**:
- Agents **transform** (morph between types)
- Agents **learn** (experience sync)
- Agents **emerge** (enhanced from transformation)

**Universal Patterns**:
- Standing on 60+ years of research
- Using nature's proven solutions
- Applying "heat and pressure"
- Composition creates emergence

---

## 🆘 Troubleshooting

**Build fails?**
```bash
# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build
```

**Missing dependencies?**
```bash
# Install explicitly
npm install @noble/hashes @noble/ed25519 @noble/curves graphlib simple-statistics
```

**Want to see what's available?**
```bash
# List pattern implementations
ls src/core/patterns/

# See compiled output
ls dist/core/patterns/
```

---

## 📚 Full Documentation

```
Quick Start:
  └── QUICK_START.md (this file)

Specifications:
  ├── README.md
  ├── CHRYSALIS_FOUNDATION_SPEC.md
  ├── CHRYSALIS_COMPLETE_SPEC.md
  └── CHRYSALIS_V3_COMPLETE.md

Research:
  ├── LAYER1_UNIVERSAL_PATTERNS_ANCHORED.md
  ├── DEEP_RESEARCH_MATHEMATICAL_FOUNDATIONS.md
  ├── DEEP_RESEARCH_SECURITY_ATTACKS.md
  └── DEEP_RESEARCH_SYNTHESIS.md

V2 (Legacy):
  ├── UNIFIED_AGENT_MORPHING_SPECIFICATION_V2.md
  └── V2_COMPLETE_SPECIFICATION.md
```

---

## 🎉 You're Ready!

**Chrysalis is built and ready to transform agents.**

**Next actions**:
1. ✅ Build complete - `npm run build`
2. 📖 Read specs - Start with `README.md`
3. 🔍 Explore code - Check `src/core/patterns/`
4. 🚀 Morph agents - Use Chrysalis CLI

---

**🦋 Transform. Learn. Emerge. 🦋**
