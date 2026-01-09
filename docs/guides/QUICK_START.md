# Chrysalis Quick Start Guide

**Version**: 1.0.0  
**Last Updated**: January 9, 2026  
**Estimated Time**: 15 minutes

## Overview

This guide will help you get Chrysalis up and running in 15 minutes. By the end, you'll have processed your first legend and generated semantic embeddings.

## Prerequisites

### Required
- **Python**: 3.10 or higher
- **Go**: 1.21 or higher (for SkillBuilder CLI)
- **Git**: For cloning the repository
- **API Key**: Voyage AI or OpenAI (or use deterministic mode for testing)

### System Requirements
- **OS**: Linux, macOS, or Windows (WSL recommended)
- **RAM**: 4GB minimum, 8GB recommended
- **Disk**: 2GB free space
- **Network**: Internet connection for API calls

## Step 1: Clone Repository

```bash
# Clone the repository
git clone https://github.com/your-org/Chrysalis.git
cd Chrysalis
```

**Verify**:
```bash
ls -la
# Should see: README.md, memory_system/, projects/, scripts/, etc.
```

## Step 2: Set Up Environment

### Create Virtual Environment

```bash
# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate  # Linux/macOS
# or
venv\Scripts\activate  # Windows
```

### Install Dependencies

```bash
# Install memory system dependencies
cd memory_system
pip install -r requirements.txt
cd ..

# Install KnowledgeBuilder dependencies
cd projects/KnowledgeBuilder
pip install -r requirements.txt
cd ../..

# Install SkillBuilder dependencies
cd projects/SkillBuilder
pip install -r requirements.txt
cd ../..
```

**Verify**:
```bash
python -c "import lancedb; print('✓ LanceDB installed')"
python -c "import voyageai; print('✓ Voyage AI installed')"
```

### Build SkillBuilder CLI (Optional)

```bash
cd projects/SkillBuilder
make build
cd ../..
```

**Verify**:
```bash
./projects/SkillBuilder/bin/search-swarm --version
```

## Step 3: Configure API Keys

### Option A: Use Voyage AI (Recommended)

```bash
# Create .env file
cat > .env << 'EOF'
EMBEDDING_PROVIDER=voyage
VOYAGE_API_KEY=your-voyage-api-key-here
LOG_LEVEL=INFO
EOF
```

**Get API Key**: [Voyage AI Dashboard](https://dash.voyageai.com/)

### Option B: Use OpenAI

```bash
# Create .env file
cat > .env << 'EOF'
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=your-openai-api-key-here
LOG_LEVEL=INFO
EOF
```

**Get API Key**: [OpenAI API Keys](https://platform.openai.com/api-keys)

### Option C: Use Deterministic Mode (Testing)

```bash
# Create .env file
cat > .env << 'EOF'
EMBEDDING_PROVIDER=deterministic
LOG_LEVEL=INFO
EOF
```

**Note**: Deterministic mode requires no API keys but is only for testing.

## Step 4: Process Your First Legend

### Choose a Legend

```bash
# List available legends
ls Replicants/legends/*.json | head -5
```

Output:
```
Replicants/legends/ada_lovelace.json
Replicants/legends/banksy.json
Replicants/legends/bob_ross.json
Replicants/legends/bruce_schneier.json
Replicants/legends/burton_fisher.json
```

### Run Processing

```bash
# Process Bob Ross (2 runs)
python scripts/process_legends.py \
  --legend bob_ross \
  --run-count 2
```

**If using deterministic mode**, add `--allow-deterministic`:
```bash
python scripts/process_legends.py \
  --legend bob_ross \
  --run-count 2 \
  --allow-deterministic
```

### Expected Output

```
2026-01-09 10:00:00,000 - INFO - Found 1 legend files to process
2026-01-09 10:00:00,001 - INFO - Embeddings will be saved to: Replicants/legends/Embeddings
2026-01-09 10:00:00,002 - INFO - Processing legend: Bob Ross
2026-01-09 10:00:05,000 - INFO -   KnowledgeBuilder run 1 for Bob Ross
2026-01-09 10:00:10,000 - INFO -   SkillBuilder run 1 for Bob Ross
2026-01-09 10:00:15,000 - INFO -   KnowledgeBuilder run 2 for Bob Ross
2026-01-09 10:00:20,000 - INFO -   SkillBuilder run 2 for Bob Ross
2026-01-09 10:00:25,000 - INFO -   Semantically merging embeddings for Bob Ross
2026-01-09 10:00:25,100 - INFO -     KB: merged 1, added 1
2026-01-09 10:00:25,200 - INFO -     SB: merged 1, added 1
2026-01-09 10:00:26,000 - INFO -   Skill merge for Bob Ross: added 0, merged 10, skipped 0
2026-01-09 10:00:27,000 - INFO - Processing complete!
2026-01-09 10:00:27,001 - INFO -   Processed: 1 legends
2026-01-09 10:00:27,002 - INFO -   Errors: 0
```

**Processing Time**:
- Deterministic mode: ~10 seconds
- Voyage AI: ~30 seconds
- OpenAI: ~30 seconds

## Step 5: Verify Results

### Check Consolidated Files

```bash
# List output files
ls -lh Replicants/legends/Embeddings/all_*.json
```

Output:
```
-rw-r--r-- 1 user user 310K Jan  9 10:00 all_embeddings.json
-rw-r--r-- 1 user user 362K Jan  9 10:00 all_skills.json
-rw-r--r-- 1 user user 150K Jan  9 10:00 all_personas.json
```

### Validate Results

```bash
# Run validation tool
python scripts/validate_semantic_merge.py
```

Expected output:
```
============================================================
SEMANTIC MERGE VALIDATION
============================================================
Validating embeddings file...
  Total legends: 1
  Legends with merged embeddings: 1
  Total KB embeddings: 2
  Total SB embeddings: 2
  KB embeddings with merges: 1
  SB embeddings with merges: 1

✅ Embeddings validation passed!

Validating skills file...
  Total legends: 1
  Total skills: 10
  Skills with merges: 10

✅ Skills validation passed!

============================================================
SUMMARY
============================================================
✅ Validation complete!

Embeddings: 1/1 legends have merged embeddings
Skills: 1/1 legends have merged skills

✅ Semantic merging is WORKING!
```

### Inspect Embeddings

```bash
# View embeddings (first 50 lines)
head -50 Replicants/legends/Embeddings/all_embeddings.json
```

### Inspect Skills

```bash
# Count skills
python -c "import json; data=json.load(open('Replicants/legends/Embeddings/all_skills.json')); print(f'Total skills: {data[\"total_skills\"]}')"
```

## Step 6: Explore the Data

### Python Interactive Session

```python
import json

# Load embeddings
with open('Replicants/legends/Embeddings/all_embeddings.json') as f:
    embeddings = json.load(f)

# Explore Bob Ross data
bob_ross = embeddings['legends']['Bob Ross']
print(f"Name: {bob_ross['name']}")
print(f"Runs: {bob_ross['run_count']}")
print(f"KB embeddings: {len(bob_ross['knowledge_builder']['embeddings'])}")
print(f"SB embeddings: {len(bob_ross['skill_builder']['embeddings'])}")

# Check merge counts
kb_emb = bob_ross['knowledge_builder']['embeddings'][0]
print(f"KB merged count: {kb_emb.get('merged_count', 1)}")
print(f"KB similarity: {kb_emb.get('similarity_score', 'N/A')}")

# Load skills
with open('Replicants/legends/Embeddings/all_skills.json') as f:
    skills = json.load(f)

# List Bob Ross skills
bob_skills = skills['skills_by_legend']['Bob Ross']
print(f"\nBob Ross has {len(bob_skills)} skills:")
for skill in bob_skills[:5]:
    print(f"  - {skill['skill_name']} (merged: {skill.get('merged_count', 1)}x)")
```

## Step 7: Process More Legends

### Process Multiple Legends

```bash
# Process 3 legends
python scripts/process_legends.py \
  --legend ada_lovelace \
  --run-count 2

python scripts/process_legends.py \
  --legend banksy \
  --run-count 2

python scripts/process_legends.py \
  --legend bruce_schneier \
  --run-count 2
```

### Process All Legends

```bash
# Process all legends (takes longer)
python scripts/process_legends.py --run-count 2
```

**Warning**: Processing all 49 legends will take:
- Deterministic mode: ~8 minutes
- Voyage AI: ~25 minutes
- OpenAI: ~25 minutes

## Common Issues

### Issue: Missing API Key

**Error**: `ValueError: No API key found for provider 'voyage'`

**Solution**:
```bash
# Check .env file
cat .env

# Ensure key is set
export VOYAGE_API_KEY=your-key-here
```

### Issue: Dimension Mismatch

**Error**: `ValueError: Dimension mismatch: table has 3072, embedding has 1024`

**Solution**:
```bash
# Delete LanceDB and recreate
rm -rf projects/KnowledgeBuilder/data/lancedb/
python scripts/process_legends.py --legend bob_ross --run-count 1
```

### Issue: Rate Limit

**Error**: `429 Too Many Requests`

**Solution**:
```bash
# Use deterministic mode for testing
export EMBEDDING_PROVIDER=deterministic
python scripts/process_legends.py --legend bob_ross --run-count 2 --allow-deterministic
```

### Issue: Import Error

**Error**: `ModuleNotFoundError: No module named 'lancedb'`

**Solution**:
```bash
# Ensure virtual environment is activated
source venv/bin/activate

# Reinstall dependencies
pip install -r projects/KnowledgeBuilder/requirements.txt
```

## Next Steps

### Learn More

1. **[API Documentation](../API.md)** - Understand the APIs
2. **[Configuration Guide](../CONFIGURATION.md)** - Advanced configuration
3. **[Data Models](../DATA_MODELS.md)** - Understand data structures
4. **[Semantic Merge Feature](../features/SEMANTIC_MERGE.md)** - Deep dive into merging

### Explore Features

1. **Memory System**
   ```python
   from memory_system import ChrysalisMemory, MemoryStore, EmbeddingService
   
   memory = ChrysalisMemory(
       store=MemoryStore(),
       embedding_service=EmbeddingService(provider="voyage")
   )
   
   # Store a memory
   entry_id = memory.store("Bob Ross was a painter")
   
   # Retrieve similar memories
   results = memory.retrieve("famous painters", limit=5)
   ```

2. **KnowledgeBuilder Pipeline**
   ```python
   from projects.KnowledgeBuilder.src.pipeline import SimplePipeline
   
   pipeline = SimplePipeline(...)
   result = pipeline.process_entity(
       entity_name="Bob Ross",
       entity_type="Person",
       descriptors=["painter", "television host"]
   )
   ```

3. **SkillBuilder CLI**
   ```bash
   ./projects/SkillBuilder/bin/search-swarm extract \
     --entity "Bob Ross" \
     --type "Person" \
     --descriptors "painter,television host" \
     --output skills.json
   ```

### Customize Processing

1. **Change Descriptor Strategy**
   ```bash
   # Use focused strategy (more specific)
   python scripts/process_legends.py \
     --legend bob_ross \
     --run-count 2 \
     --strategy focused
   
   # Use diverse strategy (broader coverage)
   python scripts/process_legends.py \
     --legend bob_ross \
     --run-count 2 \
     --strategy diverse
   ```

2. **Adjust Merge Thresholds**
   ```python
   # In semantic_embedding_merger.py
   merger = EmbeddingMerger(similarity_threshold=0.90)  # More strict
   skill_merger = SkillMerger(similarity_threshold=0.85)  # More permissive
   ```

3. **Enable Debug Logging**
   ```bash
   export LOG_LEVEL=DEBUG
   python scripts/process_legends.py --legend bob_ross --run-count 2
   ```

### Contribute

1. **Report Issues**: [GitHub Issues](https://github.com/your-org/Chrysalis/issues)
2. **Submit Pull Requests**: See [CONTRIBUTING.md](../../CONTRIBUTING.md)
3. **Improve Documentation**: Help us improve these guides!

## Troubleshooting

For more detailed troubleshooting, see:
- **[Troubleshooting Guide](TROUBLESHOOTING.md)** - Common issues and solutions
- **[Configuration Guide](../CONFIGURATION.md)** - Configuration problems
- **[API Documentation](../API.md)** - API usage issues

## Getting Help

- **Documentation**: [docs/README.md](../README.md)
- **GitHub Issues**: [Report a bug](https://github.com/your-org/Chrysalis/issues)
- **Community**: [Discussions](https://github.com/your-org/Chrysalis/discussions)

## Summary

Congratulations! You've successfully:
- ✅ Installed Chrysalis and dependencies
- ✅ Configured API keys
- ✅ Processed your first legend
- ✅ Verified semantic merging is working
- ✅ Explored the generated data

You're now ready to explore the full capabilities of Chrysalis!

---

**Last Updated**: January 9, 2026  
**Version**: 1.0.0  
**Estimated Time**: 15 minutes  
**Difficulty**: Beginner
