# 🦋 Chrysalis - Start Here

**Welcome to Chrysalis!** This guide will get you oriented quickly.

---

## First: Execute Reorganization

**The documentation needs reorganization**. Run this command in your terminal:

```bash
cd ~/Documents/GitClones/Chrysalis && python3 reorganize_docs.py
```

This will organize 60+ files into a clean, professional structure (~2 minutes).

---

## Then: Read These Documents (In Order)

### 1. [README.md](README.md) - 5 minutes
**What**: System overview, key features, quick links  
**Why**: Understand what Chrysalis is and does

### 2. [QUICK_START.md](QUICK_START.md) - 10 minutes
**What**: Build and run instructions  
**Why**: Get the system running locally

### 3. [ARCHITECTURE.md](ARCHITECTURE.md) - 30 minutes
**What**: System architecture with diagrams  
**Why**: Understand how Chrysalis works

### 4. [docs/README.md](docs/README.md) - 15 minutes
**What**: Complete documentation map  
**Why**: Navigate all 40+ documents

### 5. [docs/current/UNIFIED_SPEC_V3.1.md](docs/current/UNIFIED_SPEC_V3.1.md) - 2 hours
**What**: Complete technical specification  
**Why**: Deep understanding of entire system

---

## Quick Answers

**What is Chrysalis?**  
→ Universal agent transformation system with distributed memory

**What can it do?**  
→ Morph agents between types, sync experiences, merge state

**What's implemented?**  
→ Agent morphing ✅, Experience sync ✅, State merging ✅, MCP servers ✅

**What's designed but not coded?**  
→ True gossip protocol 📋, CRDT merging 📋, Vector embeddings 📋

**How do I build it?**  
→ `npm install && npm run build`

**Where's the code?**  
→ `src/` directory (31 TypeScript modules)

**Where are the docs?**  
→ `docs/` directory (after reorganization)

**Which spec is current?**  
→ v3.1.0 (CHRYSALIS_UNIFIED_SPEC_V3.1.md → docs/current/UNIFIED_SPEC_V3.1.md)

---

## Visual Structure

```
                    START HERE
                        ↓
                   README.md
                        ↓
            ┌───────────┼───────────┐
            ↓           ↓           ↓
       QUICK_START  ARCHITECTURE  docs/README.md
            ↓           ↓           ↓
         Build      Understand   Navigate
         System     Design       All Docs
```

---

## Common Workflows

### I Want To...

**Understand the system** → README.md + ARCHITECTURE.md  
**Build and run** → QUICK_START.md  
**Read complete spec** → docs/current/UNIFIED_SPEC_V3.1.md  
**Understand research** → docs/research/  
**See examples** → examples/  
**Contribute** → CONTRIBUTING.md  
**Review code** → src/  

---

## Current Status

**Version**: 3.1.0  
**Phase**: Active development, research phase  
**Build**: ✅ Success (31 modules, 0 errors)  
**Documentation**: ✅ Comprehensive (18+ documents, 26,000+ lines)  
**Organization**: ⏸️ Requires reorganization execution

---

## Three Steps to Clean Structure

```bash
# 1. Reorganize
cd ~/Documents/GitClones/Chrysalis
python3 reorganize_docs.py

# 2. Verify
ls docs/current/
ls *.md | wc -l  # Should be ~6-10

# 3. Commit
git add -A
git commit -m "docs: reorganize structure"
git push origin main
```

---

## Help

**Questions?** Open an issue on GitHub  
**Bugs?** See CONTRIBUTING.md  
**Confused?** Read README.md → ARCHITECTURE.md → docs/README.md

---

🦋 **Welcome to Chrysalis - transformation through rigorous evolution** 🦋

**Next Action**: `python3 reorganize_docs.py`
