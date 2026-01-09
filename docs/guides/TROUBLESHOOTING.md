# Chrysalis Troubleshooting Guide

**Version**: 1.0.0  
**Last Updated**: January 9, 2026

## Overview

This guide provides solutions to common issues encountered when using Chrysalis. Issues are organized by category for easy navigation.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Configuration Issues](#configuration-issues)
- [API and Provider Issues](#api-and-provider-issues)
- [Database Issues](#database-issues)
- [Processing Issues](#processing-issues)
- [Performance Issues](#performance-issues)
- [Data Issues](#data-issues)
- [Debugging Techniques](#debugging-techniques)

## Installation Issues

### Python Version Mismatch

**Symptom**: `SyntaxError` or `ModuleNotFoundError` during installation

**Cause**: Python version < 3.10

**Solution**:
```bash
# Check Python version
python --version

# Should be 3.10 or higher
# If not, install Python 3.10+
```

**macOS**:
```bash
brew install python@3.10
```

**Ubuntu/Debian**:
```bash
sudo apt update
sudo apt install python3.10 python3.10-venv
```

### Missing Dependencies

**Symptom**: `ModuleNotFoundError: No module named 'lancedb'`

**Cause**: Dependencies not installed

**Solution**:
```bash
# Activate virtual environment
source venv/bin/activate

# Install all dependencies
pip install -r memory_system/requirements.txt
pip install -r projects/KnowledgeBuilder/requirements.txt
pip install -r projects/SkillBuilder/requirements.txt

# Verify installation
python -c "import lancedb; print('✓ LanceDB')"
python -c "import voyageai; print('✓ Voyage AI')"
```

### Go Build Fails

**Symptom**: `go: command not found` or build errors

**Cause**: Go not installed or wrong version

**Solution**:
```bash
# Check Go version
go version

# Should be 1.21 or higher
# Install Go from https://go.dev/dl/

# Build SkillBuilder
cd projects/SkillBuilder
make clean
make build
```

## Configuration Issues

### Missing API Key

**Symptom**: `ValueError: No API key found for provider 'voyage'`

**Cause**: API key not set in environment

**Solution**:
```bash
# Check if .env exists
ls -la .env

# If not, create it
cat > .env << 'EOF'
EMBEDDING_PROVIDER=voyage
VOYAGE_API_KEY=your-key-here
EOF

# Load environment
source .env

# Or export directly
export VOYAGE_API_KEY=your-key-here

# Verify
python -c "import os; print('Key:', '✓' if os.getenv('VOYAGE_API_KEY') else '✗')"
```

### Wrong Provider Selected

**Symptom**: Using wrong embedding provider

**Cause**: `EMBEDDING_PROVIDER` not set or incorrect

**Solution**:
```bash
# Check current provider
echo $EMBEDDING_PROVIDER

# Set provider
export EMBEDDING_PROVIDER=voyage  # or openai or deterministic

# Verify
python -c "import os; print(f'Provider: {os.getenv(\"EMBEDDING_PROVIDER\", \"auto\")}')"
```

### Environment Variables Not Loading

**Symptom**: Configuration not being read from .env

**Cause**: .env file not in correct location or not loaded

**Solution**:
```bash
# Ensure .env is in project root
ls -la .env

# Load manually
set -a
source .env
set +a

# Or use python-dotenv
pip install python-dotenv
```

**In Python**:
```python
from dotenv import load_dotenv
load_dotenv()
```

## API and Provider Issues

### Rate Limit Exceeded

**Symptom**: `429 Too Many Requests` or `RateLimitError`

**Cause**: Exceeded API rate limits

**Solution 1 - Use Deterministic Mode**:
```bash
export EMBEDDING_PROVIDER=deterministic
python scripts/process_legends.py --legend bob_ross --allow-deterministic
```

**Solution 2 - Add Delays**:
```python
import time

# Add delay between requests
for legend in legends:
    process_legend(legend)
    time.sleep(1)  # 1 second delay
```

**Solution 3 - Batch Processing**:
```bash
# Process in smaller batches
python scripts/process_legends.py --legend bob_ross
sleep 60  # Wait 1 minute
python scripts/process_legends.py --legend ada_lovelace
```

**Rate Limits**:
- **Voyage AI**: 60 requests/minute
- **OpenAI**: 3,500 requests/minute (tier 1)

**Reference**: [Configuration Guide - Rate Limits](../CONFIGURATION.md#rate-limits)

### API Authentication Failed

**Symptom**: `401 Unauthorized` or `Invalid API key`

**Cause**: Invalid or expired API key

**Solution**:
```bash
# Verify key format
echo $VOYAGE_API_KEY  # Should start with "pa-"
echo $OPENAI_API_KEY  # Should start with "sk-"

# Test key
python -c "
from voyageai import Client
client = Client(api_key='your-key')
result = client.embed(['test'])
print('✓ Key valid')
"
```

**Get New Key**:
- Voyage AI: [https://dash.voyageai.com/](https://dash.voyageai.com/)
- OpenAI: [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)

### Network Timeout

**Symptom**: `TimeoutError` or `Connection timeout`

**Cause**: Slow network or API unavailable

**Solution**:
```python
# Increase timeout
from voyageai import Client

client = Client(
    api_key=api_key,
    timeout=60.0  # 60 seconds
)
```

**Check API Status**:
- Voyage AI: [https://status.voyageai.com/](https://status.voyageai.com/)
- OpenAI: [https://status.openai.com/](https://status.openai.com/)

## Database Issues

### LanceDB Dimension Mismatch

**Symptom**: `ValueError: Dimension mismatch: table has 3072, embedding has 1024`

**Cause**: Table created with wrong dimensions

**Root Cause**: SimplePipeline not coordinating dimensions with EmbeddingService

**Solution**:
```bash
# Delete LanceDB directory
rm -rf projects/KnowledgeBuilder/data/lancedb/

# Recreate with correct dimensions
python scripts/process_legends.py --legend bob_ross --run-count 1
```

**Verify Dimensions**:
```python
import lancedb

db = lancedb.connect("projects/KnowledgeBuilder/data/lancedb")
table = db.open_table("knowledgebuilder_entities")
print(f"Table dimensions: {table.schema}")
```

**Prevention**: The fix in `SimplePipeline.__init__()` and `LanceDBClient._ensure_table()` prevents this issue.

### SQLite Cache Corruption

**Symptom**: `sqlite3.DatabaseError: database disk image is malformed`

**Cause**: Corrupted cache database

**Solution**:
```bash
# Backup cache
cp projects/KnowledgeBuilder/data/schema_cache.db schema_cache.db.bak

# Delete corrupted cache
rm projects/KnowledgeBuilder/data/schema_cache.db

# Cache will be recreated automatically
python scripts/process_legends.py --legend bob_ross --run-count 1
```

### File Lock Timeout

**Symptom**: `Timeout waiting for file lock on all_embeddings.json`

**Cause**: Multiple processes accessing consolidated files

**Solution 1 - Wait**:
```bash
# Wait for other processes to complete
ps aux | grep process_legends.py

# Kill if stuck
kill <pid>
```

**Solution 2 - Increase Timeout**:
```python
# In process_legends.py
lock = FileLock(str(ALL_EMBEDDINGS) + ".lock", timeout=300)  # 5 minutes
```

**Solution 3 - Sequential Processing**:
```bash
# Process one legend at a time
python scripts/process_legends.py --legend bob_ross
python scripts/process_legends.py --legend ada_lovelace
```

### Disk Space Full

**Symptom**: `OSError: [Errno 28] No space left on device`

**Cause**: Insufficient disk space

**Solution**:
```bash
# Check disk space
df -h

# Clean up old data
rm -rf projects/KnowledgeBuilder/data/lancedb/*.old
rm -rf logs/*.log

# Compress old embeddings
gzip Replicants/legends/Embeddings/*_full.json
```

## Processing Issues

### Legend Not Found

**Symptom**: `No legend found matching: xyz`

**Cause**: Legend file doesn't exist or name mismatch

**Solution**:
```bash
# List available legends
ls Replicants/legends/*.json

# Check exact name
ls Replicants/legends/ | grep -i bob

# Use exact filename (without .json)
python scripts/process_legends.py --legend bob_ross
```

### Processing Hangs

**Symptom**: Script stops responding

**Cause**: API timeout, network issue, or infinite loop

**Solution**:
```bash
# Enable debug logging
export LOG_LEVEL=DEBUG
python scripts/process_legends.py --legend bob_ross --run-count 1

# Check for hanging processes
ps aux | grep python

# Kill if necessary
kill -9 <pid>
```

**Debug**:
```python
# Add timeout to API calls
import signal

def timeout_handler(signum, frame):
    raise TimeoutError("Operation timed out")

signal.signal(signal.SIGALRM, timeout_handler)
signal.alarm(30)  # 30 second timeout

try:
    result = api_call()
finally:
    signal.alarm(0)  # Cancel alarm
```

### Merge Not Working

**Symptom**: Embeddings/skills not being merged, always added as new

**Cause**: Similarity threshold too high or embeddings too different

**Solution**:
```python
# Lower similarity threshold
from semantic_embedding_merger import EmbeddingMerger

merger = EmbeddingMerger(similarity_threshold=0.75)  # Lower from 0.85
```

**Verify Merging**:
```bash
# Check merge counts
python scripts/validate_semantic_merge.py

# Should show merged_count > 1
```

**Debug**:
```python
# Check similarity scores
merger = EmbeddingMerger()
sim = merger.cosine_similarity(embedding1, embedding2)
print(f"Similarity: {sim:.3f} (threshold: 0.85)")
```

### Empty Results

**Symptom**: No embeddings or skills generated

**Cause**: Data collection failed or empty descriptors

**Solution**:
```bash
# Check logs
tail -100 logs/process_legends.log

# Verify legend file
cat Replicants/legends/bob_ross.json | jq .

# Test with known good legend
python scripts/process_legends.py --legend bob_ross --run-count 1
```

## Performance Issues

### Slow Processing

**Symptom**: Processing takes much longer than expected

**Cause**: Network latency, API rate limits, or large data

**Solution 1 - Use Deterministic Mode**:
```bash
export EMBEDDING_PROVIDER=deterministic
python scripts/process_legends.py --allow-deterministic
```

**Solution 2 - Reduce Run Count**:
```bash
# Use fewer runs
python scripts/process_legends.py --legend bob_ross --run-count 1
```

**Solution 3 - Batch Processing**:
```bash
# Process in parallel (careful with rate limits)
python scripts/process_legends.py --legend bob_ross &
python scripts/process_legends.py --legend ada_lovelace &
wait
```

**Benchmarks**:
- Deterministic: ~10 seconds per legend (2 runs)
- Voyage AI: ~30 seconds per legend (2 runs)
- OpenAI: ~30 seconds per legend (2 runs)

### High Memory Usage

**Symptom**: Process using excessive memory

**Cause**: Large embeddings or memory leak

**Solution**:
```bash
# Monitor memory
top -p $(pgrep -f process_legends)

# Process one legend at a time
python scripts/process_legends.py --legend bob_ross
```

**Optimize**:
```python
# Clear embeddings after processing
import gc

for legend in legends:
    process_legend(legend)
    gc.collect()  # Force garbage collection
```

### Large File Sizes

**Symptom**: Consolidated files growing too large

**Cause**: Many legends or high-dimensional embeddings

**Solution**:
```bash
# Compress old files
gzip Replicants/legends/Embeddings/*_full.json

# Archive old versions
mkdir -p Replicants/legends/Embeddings/archive
mv Replicants/legends/Embeddings/*_2025*.json Replicants/legends/Embeddings/archive/
```

**Optimize**:
```python
# Use lower-dimensional embeddings
# Voyage AI: 1024 dimensions (default)
# OpenAI small: 1536 dimensions
# OpenAI large: 3072 dimensions (avoid if possible)
```

## Data Issues

### Corrupted JSON

**Symptom**: `json.decoder.JSONDecodeError`

**Cause**: Malformed JSON file

**Solution**:
```bash
# Validate JSON
python -m json.tool Replicants/legends/Embeddings/all_embeddings.json > /dev/null

# If corrupted, restore from backup
cp Replicants/legends/Embeddings/all_embeddings.json.bak Replicants/legends/Embeddings/all_embeddings.json

# Or regenerate
rm Replicants/legends/Embeddings/all_embeddings.json
python scripts/process_legends.py --legend bob_ross --run-count 1
```

### Missing Fields

**Symptom**: `KeyError: 'embedding'` or missing data

**Cause**: Old data format or incomplete processing

**Solution**:
```bash
# Backup old data
cp Replicants/legends/Embeddings/all_embeddings.json all_embeddings.json.old

# Regenerate with current format
rm Replicants/legends/Embeddings/all_embeddings.json
python scripts/process_legends.py --run-count 1
```

**Migrate Old Format**:
```python
# The load_consolidated_embeddings() function automatically migrates
# list format to dict format
```

### Duplicate Entries

**Symptom**: Same legend appears multiple times

**Cause**: Processing error or manual editing

**Solution**:
```python
import json

# Load and deduplicate
with open('all_embeddings.json') as f:
    data = json.load(f)

# Legends should be a dict, not a list
if isinstance(data['legends'], list):
    # Convert list to dict
    legends_dict = {legend['name']: legend for legend in data['legends']}
    data['legends'] = legends_dict
    
    # Save
    with open('all_embeddings.json', 'w') as f:
        json.dump(data, f, indent=2)
```

## Debugging Techniques

### Enable Debug Logging

```bash
# Set log level
export LOG_LEVEL=DEBUG

# Run with debug output
python scripts/process_legends.py --legend bob_ross --run-count 1 2>&1 | tee debug.log
```

### Inspect Embeddings

```python
import json
import numpy as np

# Load embeddings
with open('Replicants/legends/Embeddings/all_embeddings.json') as f:
    data = json.load(f)

# Inspect specific legend
legend = data['legends']['Bob Ross']
print(f"Name: {legend['name']}")
print(f"Runs: {legend['run_count']}")

# Check embedding dimensions
kb_emb = legend['knowledge_builder']['embeddings'][0]
print(f"KB dimensions: {len(kb_emb['embedding'])}")
print(f"KB merged count: {kb_emb.get('merged_count', 1)}")

# Calculate statistics
embeddings = [emb['embedding'] for emb in legend['knowledge_builder']['embeddings']]
mean = np.mean(embeddings, axis=0)
std = np.std(embeddings, axis=0)
print(f"Mean: {np.mean(mean):.4f}")
print(f"Std: {np.mean(std):.4f}")
```

### Test Similarity Calculation

```python
from semantic_embedding_merger import EmbeddingMerger

merger = EmbeddingMerger()

# Test with known vectors
vec1 = [1.0, 0.0, 0.0]
vec2 = [0.95, 0.05, 0.0]

sim = merger.cosine_similarity(vec1, vec2)
print(f"Similarity: {sim:.3f}")

# Should be ~0.95 (95% similar)
```

### Validate Data Integrity

```bash
# Run validation tool
python scripts/validate_semantic_merge.py

# Check for issues
python -c "
import json

with open('Replicants/legends/Embeddings/all_embeddings.json') as f:
    data = json.load(f)

# Check structure
assert 'version' in data
assert 'legends' in data
assert isinstance(data['legends'], dict)

print('✓ Structure valid')

# Check embeddings
for name, legend in data['legends'].items():
    kb_embs = legend['knowledge_builder']['embeddings']
    for emb in kb_embs:
        assert len(emb['embedding']) in [1024, 1536, 3072]
        assert 'merged_count' in emb
    print(f'✓ {name} valid')
"
```

### Profile Performance

```python
import cProfile
import pstats

# Profile processing
cProfile.run('process_legend("bob_ross")', 'profile_stats')

# Analyze results
stats = pstats.Stats('profile_stats')
stats.sort_stats('cumulative')
stats.print_stats(20)  # Top 20 functions
```

### Memory Profiling

```python
from memory_profiler import profile

@profile
def process_legend(name):
    # Your processing code
    pass

# Run with memory profiling
python -m memory_profiler scripts/process_legends.py
```

## Getting Help

### Check Documentation

1. **[Quick Start Guide](QUICK_START.md)** - Getting started
2. **[Configuration Guide](../CONFIGURATION.md)** - Configuration options
3. **[API Documentation](../API.md)** - API reference
4. **[Data Models](../DATA_MODELS.md)** - Data structures

### Search Issues

```bash
# Search GitHub issues
# https://github.com/your-org/Chrysalis/issues

# Search documentation
grep -r "your error message" docs/
```

### Report a Bug

When reporting a bug, include:

1. **Error Message**: Full error traceback
2. **Environment**: OS, Python version, dependencies
3. **Configuration**: Provider, settings (redact API keys)
4. **Steps to Reproduce**: Minimal example
5. **Expected vs. Actual**: What should happen vs. what happens
6. **Logs**: Relevant log output

**Template**:
```markdown
## Bug Report

**Environment**:
- OS: Ubuntu 22.04
- Python: 3.10.12
- Provider: Voyage AI
- Version: 1.0.0

**Error**:
```
ValueError: Dimension mismatch: table has 3072, embedding has 1024
```

**Steps to Reproduce**:
1. Set EMBEDDING_PROVIDER=voyage
2. Run: python scripts/process_legends.py --legend bob_ross
3. Error occurs

**Expected**: Processing completes successfully
**Actual**: Dimension mismatch error

**Logs**:
```
[Include relevant logs]
```
```

### Community Support

- **GitHub Discussions**: [https://github.com/your-org/Chrysalis/discussions](https://github.com/your-org/Chrysalis/discussions)
- **Issues**: [https://github.com/your-org/Chrysalis/issues](https://github.com/your-org/Chrysalis/issues)

## Related Documentation

- [Quick Start Guide](QUICK_START.md)
- [Configuration Guide](../CONFIGURATION.md)
- [API Documentation](../API.md)
- [Semantic Merge Feature](../features/SEMANTIC_MERGE.md)

---

**Last Updated**: January 9, 2026  
**Version**: 1.0.0  
**Maintainer**: Chrysalis Team
