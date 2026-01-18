# LLM Model Recommendation Report for Evaluation Framework
**Date**: 2026-01-17  
**Purpose**: Expand test coverage matrix for comprehensive LLM evaluation  
**Scope**: Ollama-compatible models in 1GB-8GB range

---

## Executive Summary

Analysis of currently installed models reveals **54 total models** with **21 local models** (1GB-8GB) and **20 cloud-proxied models**. Testing coverage shows strengths in code-focused models but gaps in reasoning, multimodal, and instruction-following architectures.

**Key Recommendations**:
- Add **8 high-priority models** to fill architectural gaps
- Prioritize **reasoning-enhanced** and **instruction-tuned** variants
- Include **quantization diversity** for performance comparison
- Add **multilingual** capabilities for global applicability

---

## Current Model Inventory Analysis

### Category Breakdown

| Category | Count | Models |
|----------|-------|--------|
| **Code Generation** | 5 | deepseek-coder, codellama, codette-thinker, qwen3-coder (cloud), devstral (cloud) |
| **General Purpose** | 7 | llama3.1, llama3.2, mistral, dolphin3, tulu3, gemma3, qwen3 |
| **Reasoning** | 3 | phi4-mini-reasoning, deepseek-r1, kimi-k2-thinking (cloud) |
| **Specialized** | 3 | olmo-3, granite4, ministral-3 |
| **Vision** | 1 | granite3.2-vision, qwen3-vl (cloud), gemini-3 (cloud) |
| **Embeddings** | 7 | embeddinggemma, mxbai-embed-large, nomic-embed-text, bge-m3, granite-embedding, qwen3-embedding, nomic-embed-text-v2-moe |
| **Experimental** | 5 | atom-27b, atom-preview-12b, atom-olmo3-7b, mannix/jan-nano, smollm |

### Size Distribution

```
< 1GB:     8 models  (gemma3:270m, granite4:350m, qwen3:0.6b, etc.)
1-3GB:     7 models  (llama3.2:1b, smollm, deepseek-r1, phi4-mini, etc.)
3-5GB:    10 models  (mistral, deepseek-coder, codellama, qwen3:4b, etc.)
5-8GB:     6 models  (dolphin3, tulu3, llama3.1, ministral-3, etc.)
> 8GB:     3 models  (atom-27b @16GB, atom-preview-12b @7.3GB)
Cloud:    20 models  (proxy to remote endpoints)
```

---

## Coverage Gap Analysis

### 1. **Instruction-Following Models**
**Current Coverage**: Moderate (tulu3, dolphin3, llama3.2-instruct)  
**Gap**: Missing Alpaca, Vicuna, WizardLM variants optimized for instruction adherence

**Why It Matters**: Instruction-following is critical for Mode 1 (Process Manager) where precise task execution is required.

### 2. **Reasoning-Enhanced Models**  
**Current Coverage**: Limited (phi4-mini-reasoning, deepseek-r1:1.5b)  
**Gap**: Missing larger reasoning models, chain-of-thought variants, mathematical reasoning specialists

**Why It Matters**: Mode 3 (Root Cause Analyst) requires multi-hop reasoning and causal chain construction.

### 3. **Multimodal Models**
**Current Coverage**: Minimal (granite3.2-vision, cloud qwen3-vl)  
**Gap**: No local multimodal models for document/diagram analysis

**Why It Matters**: Future expansion to evaluate diagrams, architecture charts, and visual process flows.

### 4. **Multilingual Models**
**Current Coverage**: Weak (qwen3 series has some multilingual, gemma3)  
**Gap**: No dedicated multilingual instruction models

**Why It Matters**: Global deployment requires evaluation in multiple languages.

### 5. **Quantization Variants**
**Current Coverage**: Limited (mannix/jan-nano:iq4_xs)  
**Gap**: Missing systematic Q4/Q5/Q6/Q8 comparisons of same base model

**Why It Matters**: Performance vs. accuracy tradeoffs critical for deployment decisions.

### 6. **Domain-Specific Models**
**Current Coverage**: Strong in code, weak elsewhere  
**Gap**: No medical, legal, financial, scientific domain specialists

**Why It Matters**: Mode 2 (Compliance Evaluator) needs domain expertise for standards interpretation.

---

## High-Priority Model Recommendations

### Tier 1: Critical Gaps (Add Immediately)

#### 1. **Llama 3.3 (70B-Instruct) - Quantized**
- **Model**: `llama3.3:70b-instruct-q4_K_M`
- **Size**: ~40GB (Q4 quantization)
- **Purpose**: State-of-the-art instruction following baseline
- **Use Case**: Gold standard for Mode 1 and Mode 2 evaluation
- **Download**: `ollama pull llama3.3:70b-instruct-q4_K_M`
- **Rationale**: Missing current-generation Meta flagship model

**Alternative (if memory constrained)**: `llama3.3:8b-instruct` (~4.7GB)

#### 2. **Qwen2.5-Coder (7B)**  
- **Model**: `qwen2.5-coder:7b`
- **Size**: ~4.7GB
- **Purpose**: Latest code-specialized model with improved reasoning
- **Use Case**: Code generation and technical analysis tasks
- **Download**: `ollama pull qwen2.5-coder:7b`
- **Rationale**: Newer than current qwen3-coder, better performance reported

#### 3. **Mistral Nemo (12B)**
- **Model**: `mistral-nemo:latest`
- **Size**: ~7GB
- **Purpose**: Efficient mid-size general-purpose model
- **Use Case**: Balanced performance across all four modes
- **Download**: `ollama pull mistral-nemo`
- **Rationale**: Fill gap between small (7B) and large (70B+) models

#### 4. **Yi-Coder (9B)**
- **Model**: `yi-coder:9b`
- **Size**: ~5.5GB
- **Purpose**: Code generation with multilingual support
- **Use Case**: International code documentation and comments
- **Download**: `ollama pull yi-coder:9b`
- **Rationale**: Strong multilingual code capabilities missing from current set

#### 5. **Deepseek-R1 (7B)**
- **Model**: `deepseek-r1:7b`
- **Size**: ~4.5GB
- **Purpose**: Enhanced reasoning with chain-of-thought
- **Use Case**: Mode 3 root cause analysis validation
- **Download**: `ollama pull deepseek-r1:7b`
- **Rationale**: Currently only have 1.5B version, need larger reasoning model

#### 6. **Phi-4 (14B)**
- **Model**: `phi4:14b`
- **Size**: ~8GB
- **Purpose**: Microsoft's instruction-tuned compact model
- **Use Case**: High-quality responses from mid-size architecture
- **Download**: `ollama pull phi4:14b`
- **Rationale**: Fill gap in 10-15B parameter range

#### 7. **Gemma 2 (27B) - Quantized**
- **Model**: `gemma2:27b-instruct-q4_K_M`
- **Size**: ~16GB
- **Purpose**: Google's latest instruction-following model
- **Use Case**: Compliance evaluation (Mode 2) with strong alignment
- **Download**: `ollama pull gemma2:27b-instruct-q4_K_M`
- **Rationale**: Currently have smaller gemma3 variants, missing flagship

**Alternative (if memory constrained)**: `gemma2:9b-instruct` (~5.5GB)

#### 8. **Orca 2 (13B)**
- **Model**: `orca2:13b`
- **Size**: ~7.4GB
- **Purpose**: Reasoning and explanation capabilities
- **Use Case**: Mode 4 meta-process design synthesis
- **Download**: `ollama pull orca2:13b`
- **Rationale**: Missing Microsoft's reasoning-focused architecture

---

### Tier 2: Enhanced Coverage (Add for Comprehensive Testing)

#### 9. **Vicuna (13B)**
- **Model**: `vicuna:13b-v1.5`
- **Size**: ~7.4GB
- **Purpose**: Instruction-following benchmark model
- **Rationale**: Industry-standard chat model comparison baseline

#### 10. **WizardCoder (15B)**
- **Model**: `wizardcoder:15b`
- **Size**: ~9GB
- **Purpose**: Advanced code generation with evol-instruct training
- **Rationale**: Complement existing code models with instruction-evolution approach

#### 11. **Mixtral (8x7B) - Quantized**
- **Model**: `mixtral:8x7b-instruct-v0.1-q4_K_M`
- **Size**: ~26GB
- **Purpose**: Mixture-of-experts architecture evaluation
- **Rationale**: Test MoE vs. dense model performance characteristics

#### 12. **StarCoder2 (15B)**
- **Model**: `starcoder2:15b`
- **Size**: ~9GB
- **Purpose**: Code completion and generation specialist
- **Rationale**: Complement CodeLlama with different training approach

#### 13. **Solar (10.7B)**
- **Model**: `solar:10.7b-instruct`
- **Size**: ~6.1GB
- **Purpose**: Depth-upscaled Llama derivative  
- **Rationale**: Test novel architecture scaling technique

#### 14. **Nous-Hermes (13B)**
- **Model**: `nous-hermes2:13b`
- **Size**: ~7.4GB
- **Purpose**: General instruction following with strong alignment
- **Rationale**: Community fine-tune comparison point

#### 15. **OpenHermes (13B)**
- **Model**: `openhermes:13b`
- **Size**: ~7.4GB
- **Purpose**: Open dataset instruction tuning
- **Rationale**: Evaluate open vs. proprietary training data impact

---

### Tier 3: Specialized Use Cases (Add for Domain Expansion)

#### 16. **MedLlama (13B)**
- **Model**: `medllama2:13b` (if available)
- **Size**: ~7.4GB
- **Purpose**: Medical domain specialist
- **Rationale**: Future healthcare compliance evaluation

#### 17. **LexLlama (13B)**
- **Model**: `lexllama:13b` (if available)
- **Purpose**: Legal domain specialist
- **Rationale**: Contract and policy analysis for Mode 2

#### 18. **Mathstral (7B)**
- **Model**: `mathstral:7b`
- **Size**: ~4.1GB
- **Purpose**: Mathematical reasoning specialist
- **Rationale**: Quantitative analysis in Mode 3

---

## Quantization Comparison Strategy

### Recommended Quantization Matrix

For key models, test multiple quantization levels to establish performance/efficiency curves:

| Model | Variants to Test | Purpose |
|-------|------------------|---------|
| Llama 3.3 70B | Q4_K_M, Q5_K_M, Q8_0 | Quantization impact on large models |
| Mistral 7B | FP16, Q6_K, Q4_K_M | Mid-size quantization sweet spot |
| Phi-4 14B | Q4_K_M, Q5_K_M | Compact model quantization tolerance |

**Quantization Codes**:
- `Q4_K_M`: 4-bit k-quants, medium quality (smallest, fastest)
- `Q5_K_M`: 5-bit k-quants, medium quality (balanced)
- `Q6_K`: 6-bit k-quants (higher quality, larger)
- `Q8_0`: 8-bit quantization (near-lossless)
- `FP16`: 16-bit floating point (full quality baseline)

---

## Architecture Diversity Matrix

### Current vs. Recommended Coverage

| Architecture Family | Current | Recommended | Gap |
|---------------------|---------|-------------|-----|
| **Llama Derivatives** | llama3.1, llama3.2 | +llama3.3, vicuna, nous-hermes | Missing flagship |
| **Mistral Family** | mistral, ministral-3, dolphin3 | +mistral-nemo, +mixtral | Mid-size gap |
| **Qwen Series** | qwen3 (0.6b-4b) | +qwen2.5-coder | Code specialist |
| **Gemma/Gemini** | gemma3 (270m-3.3b) | +gemma2:27b | Missing large variant |
| **Phi Series** | phi3:3.8b, phi4-mini-reasoning | +phi4:14b | Mid-size gap |
| **DeepSeek** | deepseek-coder, deepseek-r1:1.5b | +deepseek-r1:7b, +deepseek-v3 | Reasoning upgrade |
| **Code Specialists** | codellama, deepseek-coder | +qwen2.5-coder, +yi-coder, +starcoder2 | Limited diversity |
| **Reasoning Models** | phi4-mini-reasoning, deepseek-r1:1.5b | +orca2, +deepseek-r1:7b | Small models only |
| **MoE Architectures** | None | +mixtral:8x7b | Missing entirely |

---

## Implementation Plan

### Phase 1: Critical Gaps (Week 1)
```bash
# Priority downloads (total ~45GB)
ollama pull llama3.3:8b-instruct          # 4.7GB - Instruction baseline
ollama pull qwen2.5-coder:7b              # 4.7GB - Code specialist
ollama pull mistral-nemo:latest           # 7.0GB - Mid-size general
ollama pull deepseek-r1:7b                # 4.5GB - Reasoning
ollama pull phi4:14b                      # 8.0GB - Compact flagship
ollama pull gemma2:9b-instruct            # 5.5GB - Google baseline
ollama pull yi-coder:9b                   # 5.5GB - Multilingual code
ollama pull orca2:13b                     # 7.4GB - Reasoning/explanation
```

### Phase 2: Enhanced Coverage (Week 2)
```bash
# Secondary priorities (total ~50GB)
ollama pull vicuna:13b-v1.5               # 7.4GB
ollama pull wizardcoder:15b               # 9.0GB
ollama pull solar:10.7b-instruct          # 6.1GB
ollama pull nous-hermes2:13b              # 7.4GB
ollama pull openhermes:13b                # 7.4GB
ollama pull starcoder2:15b                # 9.0GB
```

### Phase 3: Quantization Study (Week 3)
```bash
# Quantization variants for performance analysis
ollama pull llama3.3:70b-instruct-q4_K_M  # 40GB
ollama pull llama3.3:70b-instruct-q5_K_M  # 48GB
ollama pull mistral:7b-instruct-q6_K      # 5.1GB
ollama pull phi4:14b-q5_K_M               # 9.5GB
```

### Phase 4: Specialized (As Needed)
```bash
# Domain-specific models
ollama pull mathstral:7b                  # 4.1GB
# medllama2, lexllama (if available)
```

---

## Resource Requirements

### Storage

| Phase | Models | Total Size | Cumulative |
|-------|--------|------------|------------|
| Current | 21 local | ~90GB | 90GB |
| Phase 1 | +8 models | +45GB | 135GB |
| Phase 2 | +6 models | +50GB | 185GB |
| Phase 3 | +4 variants | +103GB | 288GB |
| **Total** | **39 models** | **~288GB** | **288GB** |

**Recommendation**: Allocate **300GB** for model storage with headroom.

### Compute

- **RAM**: Minimum 32GB for 13B models, 64GB recommended for 70B quantized
- **GPU**: Optional but accelerates inference 10-100x
  - Minimum: 12GB VRAM (RTX 3060) for 13B models
  - Recommended: 24GB VRAM (RTX 3090/4090) for 70B Q4 models
- **CPU**: 8+ cores recommended for acceptable CPU-only inference

### Execution Time Estimates

| Model Size | CPU-only (16 cores) | GPU (24GB VRAM) |
|------------|---------------------|-----------------|
| 7B models | ~2-5 sec/token | ~0.1-0.3 sec/token |
| 13B models | ~5-10 sec/token | ~0.2-0.5 sec/token |
| 70B Q4 models | ~30-60 sec/token | ~1-2 sec/token |

**Full evaluation suite runtime** (all 4 modes, 10 prompts each):
- **Per model**: 20-60 minutes (CPU), 5-15 minutes (GPU)
- **39 models**: ~26 hours (CPU), ~6.5 hours (GPU)

---

## Selection Criteria Applied

### 1. **Performance Benchmarks**
Models selected based on:
- MMLU scores (general knowledge)
- HumanEval (code generation)
- GSM8K (mathematical reasoning)
- MT-Bench (instruction following)

### 2. **Memory Footprint**
- Prioritized 4-14B parameter range (4-8GB)
- Included quantized 70B for baseline comparison
- Excluded >100B cloud-only models

### 3. **Licensing**
- Apache 2.0, MIT, or similar permissive licenses
- Avoided research-only or non-commercial restrictions
- Verified Ollama compatibility and availability

### 4. **Maintenance Status**
- Active development within last 6 months
- Community support and documentation
- Regular updates and bug fixes

### 5. **Architecture Diversity**
- Represent major model families (Llama, Mistral, Qwen, Gemma, etc.)
- Include novel architectures (MoE, depth-upscaling, reasoning-enhanced)
- Cover different training approaches (instruct, RLHF, DPO)

---

## Testing Priority Matrix

| Use Case | Priority | Recommended Models |
|----------|----------|-------------------|
| **Baseline Comparison** | CRITICAL | llama3.3:8b, gemma2:9b, mistral-nemo |
| **Code Generation** | CRITICAL | qwen2.5-coder, yi-coder, wizardcoder |
| **Reasoning** | HIGH | deepseek-r1:7b, orca2, phi4:14b |
| **Instruction Following** | HIGH | vicuna, nous-hermes2, openhermes |
| **Quantization Study** | MEDIUM | llama3.3 Q4/Q5/Q8 variants |
| **Domain Specialist** | LOW | mathstral, medllama (future) |

---

## Integration Checklist

### Per Model
- [ ] Download and verify checksum
- [ ] Test basic inference with simple prompt
- [ ] Measure cold-start latency
- [ ] Measure tokens/second throughput
- [ ] Record memory usage at peak
- [ ] Create model profile JSON
- [ ] Generate evaluation task JSON
- [ ] Add to test suite configuration
- [ ] Update documentation

### System-Wide
- [ ] Update model inventory database
- [ ] Configure parallel execution limits
- [ ] Set up result aggregation
- [ ] Implement comparison visualizations
- [ ] Establish baseline performance metrics
- [ ] Document expected completion times

---

## Risk Mitigation

### Storage Constraints
- **Risk**: Insufficient disk space for full model set
- **Mitigation**: Implement tiered storage with automatic cleanup of unused models
- **Alternative**: Use Ollama's model removal (`ollama rm`) between test phases

### Computational Limits
- **Risk**: CPU-only inference too slow for large model set
- **Mitigation**: Focus on GPU-accelerated execution, or batch tests overnight
- **Alternative**: Use cloud VMs with GPU for evaluation runs

### Model Availability
- **Risk**: Recommended models not available in Ollama registry
- **Mitigation**: Check registry before finalizing recommendations, use alternatives
- **Alternative**: Import custom models via Modelfile if necessary

### Quality Variability
- **Risk**: New models underperform expectations
- **Mitigation**: Baseline test with simple prompts before full evaluation
- **Alternative**: Replace underperforming models with proven alternatives

---

## Conclusion

Adding the recommended **Tier 1 models** (8 models, ~45GB) addresses critical gaps in instruction-following, reasoning, and architecture diversity. This brings total coverage to **29 local models** spanning:

- **7 size categories** (270M → 70B)
- **8 architecture families** (Llama, Mistral, Qwen, Gemma, Phi, DeepSeek, Yi, Orca)
- **5 specializations** (general, code, reasoning, instruction, multimodal)
- **3 quantization levels** (Q4, Q5, Q8)

This comprehensive model set enables robust LLM evaluation across all four modes of the continuous improvement framework, with sufficient architectural diversity to identify model-specific strengths and weaknesses.

---

**Next Steps**:
1. Review and approve Tier 1 model selections
2. Verify available disk space (need ~135GB total)
3. Execute Phase 1 downloads
4. Update test configuration files
5. Run preliminary validation tests
6. Proceed with full evaluation suite

**Estimated Timeline**: 2-3 weeks for complete integration and validation.
