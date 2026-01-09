# Semantic Merging Implementation

## Overview

The SkillBuilder and KnowledgeBuilder pipelines now use **semantic merging** to consolidate knowledge and skills across multiple processing runs. This enables true incremental learning where the AI agent accumulates and integrates knowledge over time.

## What Changed

### Before (Replacement Strategy)
- Each processing run **replaced** previous embeddings
- Skills were deduplicated by MD5 signature only
- No semantic similarity comparison
- Knowledge was lost between runs

### After (Semantic Merging Strategy)
- Embeddings are **merged** using cosine similarity
- Similar embeddings are averaged (weighted toward newer: 60/40)
- Skills are consolidated based on semantic similarity
- Knowledge accumulates and integrates over time

## Key Components

### 1. `semantic_embedding_merger.py`
Core utilities for semantic merging:

- **`EmbeddingMerger`**: Merges embeddings using cosine similarity
  - Threshold: 0.85 (85% similar)
  - Weighted averaging: 60% new, 40% existing
  - Tracks merge counts and similarity scores

- **`SkillMerger`**: Merges skills based on embedding similarity
  - Threshold: 0.90 (90% similar)
  - Consolidates metadata (salts, descriptors)
  - Prevents duplicate skills with different names

### 2. Updated `process_legends.py`
Modified functions:

- **`save_embeddings()`**: Now semantically merges instead of replacing
- **`save_skill_artifacts()`**: Uses semantic similarity instead of MD5 signatures
- **`load_consolidated_embeddings()`**: Migrates old list format to dict format

### 3. Test Suite
Comprehensive testing:

- **`test_semantic_merge.py`**: Unit tests for merger utilities
- **`test_integration_semantic_merge.py`**: Integration tests
- **`test_process_legends_mock.py`**: Tests for process_legends.py functions
- **`validate_semantic_merge.py`**: Validates consolidated files

## How It Works

### Embedding Merging Process

```
New Embedding → Compare with Existing → Cosine Similarity
                                              ↓
                                    Similarity ≥ 0.85?
                                    ↙              ↘
                                  YES              NO
                                   ↓                ↓
                        Weighted Average      Add as New
                        (60% new, 40% old)    Entry
                               ↓
                        Update merged_count
                        Record similarity
```

### Skill Merging Process

```
New Skill → Compare Embeddings → Find Most Similar
                                        ↓
                              Similarity ≥ 0.90?
                              ↙              ↘
                            YES              NO
                             ↓                ↓
                  Merge Embeddings      Add as New
                  Merge Salts           Skill
                  Update Count
```

## Usage

### Process a Single Legend
```bash
python scripts/process_legends.py --legend bob_ross --run-count 3
```

### Process All Legends
```bash
python scripts/process_legends.py --run-count 3
```

### Validate Merging
```bash
python scripts/validate_semantic_merge.py
```

### Run Tests
```bash
# Unit tests
python scripts/test_semantic_merge.py

# Integration tests
python scripts/test_integration_semantic_merge.py

# Process_legends tests
python scripts/test_process_legends_mock.py
```

### Backup Before Reprocessing
```bash
python scripts/backup_consolidated_files.py
```

## Output Files

### `all_embeddings.json`
```json
{
  "version": "1.0.0",
  "consolidated_at": "2024-01-09T...",
  "total_legends": 49,
  "legends": {
    "Ada Lovelace": {
      "knowledge_builder": {
        "embeddings": [
          {
            "embedding": [...],
            "merged_count": 2,
            "similarity_score": 0.95,
            "descriptors": ["trait1", "trait2", "trait3"]
          }
        ]
      }
    }
  }
}
```

### `all_skills.json`
```json
{
  "version": "1.0.0",
  "total_skills": 346,
  "skills_by_legend": {
    "Ada Lovelace": [
      {
        "skill_name": "programming",
        "embedding": [...],
        "merged_count": 3,
        "similarity_score": 0.92,
        "salts_used": ["coding", "software", "development"]
      }
    ]
  }
}
```

## Key Features

### 1. Incremental Learning
- Each processing run builds on previous knowledge
- Similar concepts are consolidated, not duplicated
- Embeddings evolve to incorporate new perspectives

### 2. Semantic Deduplication
- Uses cosine similarity, not string matching
- Detects semantically similar content with different wording
- Configurable similarity thresholds

### 3. Metadata Preservation
- Merge counts track how many times concepts were consolidated
- Similarity scores show how closely related merged items are
- Descriptors and salts are accumulated from all runs

### 4. Weighted Averaging
- Newer embeddings weighted 60%, existing 40%
- Allows adaptation to new information
- Preserves core knowledge from previous runs

## Configuration

### Similarity Thresholds

Edit in `process_legends.py`:

```python
# For embeddings (line ~555)
embedding_merger = EmbeddingMerger(similarity_threshold=0.85)

# For skills (line ~480)
skill_merger = SkillMerger(similarity_threshold=0.90)
```

### Weighting Strategy

Edit in `semantic_embedding_merger.py`:

```python
# In merge_similar_embeddings (line ~95)
merged_emb = self.average_embeddings(
    [existing_emb, new_embedding],
    weights=[0.4, 0.6]  # Adjust these weights
)
```

## Validation Criteria

After processing, validate that:

1. ✅ `merged_count` > 1 for some embeddings
2. ✅ `similarity_score` is recorded for merged items
3. ✅ Total embeddings < (runs × legends)
4. ✅ Descriptors are accumulated across runs
5. ✅ Skills show semantic consolidation

## Migration Notes

### Old Format (List)
```json
{
  "legends": [
    {"name": "Ada Lovelace", ...},
    {"name": "Bob Ross", ...}
  ]
}
```

### New Format (Dict)
```json
{
  "legends": {
    "Ada Lovelace": {...},
    "Bob Ross": {...}
  }
}
```

The system automatically migrates from list to dict format on first load.

## Troubleshooting

### No Merges Detected
- Check similarity thresholds (may be too high)
- Verify embeddings are actually similar
- Run validation script to diagnose

### Too Many Merges
- Increase similarity thresholds
- Check that embeddings are diverse enough
- Review descriptor selection strategy

### LanceDB Table Errors
- The KnowledgeBuilder may fail if table exists
- This is a known issue with the pipeline
- Use `--allow-deterministic` for testing without external APIs

## Performance

- **Cosine similarity**: O(n) per comparison, O(n²) for full merge
- **Memory**: Loads full consolidated files into memory
- **Disk**: Consolidated files grow incrementally, not linearly
- **Typical run**: ~1-2 seconds per legend with semantic merging

## Future Enhancements

1. **Hierarchical Merging**: Cluster similar embeddings before merging
2. **Adaptive Thresholds**: Adjust thresholds based on embedding quality
3. **Temporal Weighting**: Weight by recency, not just new vs. old
4. **Conflict Resolution**: Handle contradictory information explicitly
5. **Merge Visualization**: Show how embeddings evolved over time

## References

- **Cosine Similarity**: https://en.wikipedia.org/wiki/Cosine_similarity
- **Vector Averaging**: Standard technique in embedding spaces
- **Incremental Learning**: Continual learning without catastrophic forgetting
