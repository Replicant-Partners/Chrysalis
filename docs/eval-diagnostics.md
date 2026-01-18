# Evaluation Diagnostics Guide

## Overview

This guide helps diagnose and resolve failures in the Chrysalis evaluation system when testing local Ollama models on CPU-only hardware.

## Problem Statement

Recent evaluation runs show **100% timeout failures** for local models:
- All tasks fail with "Ollama request timeout after 90000ms"
- No partial completions or successful responses
- Issue occurs specifically on CPU-only devices with small models (1.5B-8B parameters)

## Root Cause Hypothesis (To Be Validated)

Based on code analysis, several potential causes:

1. **Prompt Complexity** (confidence: 85%)
   - Kata evaluation prompts are multi-step reasoning tasks
   - Require calculations, JSON schema adherence, strategic analysis
   - Small models on CPU may genuinely timeout on complex reasoning

2. **Timeout Configuration** (confidence: 70%)
   - 90-second timeout may be insufficient for CPU inference
   - First-token latency on CPU can be 30-60s for complex prompts
   - No adaptive timeout based on model size or hardware

3. **Request Format Issues** (confidence: 50%)
   - JSON schema requirements may confuse small models
   - "No extra text" instruction may conflict with model behavior
   - Possible model-specific formatting issues

4. **Resource Constraints** (confidence: 60%)
   - CPU-only inference significantly slower than GPU
   - Memory constraints may cause model unloading/reloading
   - Concurrent system load may impact performance

5. **Model Compatibility** (confidence: 40%)
   - Specific models (deepseek-r1) may have inference bugs
   - Quantization levels may affect performance
   - Model size vs available RAM mismatch

## Diagnostic Strategy

### Phase 1: Component Isolation

Run progressive diagnostic suite to identify the complexity threshold where failures begin.

**Test Sequence:**
1. **D1: Simple Echo** - Baseline connectivity (expected: <5s)
2. **D2: Simple JSON** - JSON generation (expected: <10s)
3. **D3: Basic Math** - Simple calculation (expected: <15s)
4. **D4: Array Average** - Array math (expected: <30s)
5. **D5: Math + JSON** - Combined task (expected: <60s)
6. **D6: Kata Simplified** - Reduced Kata task (expected: <120s)

**Success Criteria:**
- Identify last passing test (capability ceiling)
- Measure actual latency vs expected
- Capture partial responses if any

### Phase 2: Telemetry Analysis

Enhanced logging now captures:
- Request initiation timestamp
- Fetch duration (network + model loading)
- Parse duration (JSON processing)
- Token counts (prompt + response)
- Error details (type, timing, context)

**Analysis Points:**
- Where in the request lifecycle does timeout occur?
- Is the model responding at all (partial data)?
- Are there patterns in token generation rates?
- Do errors correlate with prompt length/complexity?

### Phase 3: Root Cause Validation

Based on diagnostic results, validate specific hypotheses:

**If D1-D3 pass, D4+ fail:**
→ Complexity threshold exceeded for model/hardware combo

**If D1-D2 pass, D3+ fail:**
→ Math reasoning capability limit

**If D2 passes, D3+ fail:**
→ Multi-step reasoning unsupported

**If D1 passes, D2+ fail:**
→ JSON formatting issues

**If all fail:**
→ Configuration or connectivity issue

## Running Diagnostics

### Prerequisites

```bash
# 1. Ensure Ollama is running
ollama serve

# 2. Verify model is available
ollama list | grep deepseek-r1

# 3. Build Chrysalis CLI
npm run build
```

### Execute Diagnostic Suite

```bash
# Run full progressive diagnostic suite
./scripts/eval/run_diagnostics.sh
```

### Expected Output

```
======================================
Ollama Diagnostic Suite
======================================

✓ Ollama is running
✓ CLI is available

Running Progressive Diagnostic Suite...
This will test increasing levels of complexity to isolate failure point.

Executing: diagnostic-suite.json
  - This suite stops on first error to identify the complexity threshold

[Progress output...]

======================================
Test Summary
======================================

D1: ✓ PASS - Simple Echo
D2: ✓ PASS - Simple JSON
D3: ✓ PASS - Basic Math
D4: ✗ FAIL - Array Average
D5: [not executed - stopped on error]
D6: [not executed - stopped on error]

Review the full results JSON and response files for details.
```

### Analyzing Results

1. **Check Result JSON**
   ```bash
   cat results/eval-suite/diagnostics/diagnostic-suite.result.json | jq .
   ```

2. **Review Telemetry Logs**
   ```bash
   # Look for log output during execution
   # Enhanced logging shows:
   # - Ollama request starting
   # - Fetch completed (with duration)
   # - Request completed (with tokens)
   # - Or: request aborted/failed
   ```

3. **Inspect Response Files**
   ```bash
   ls -la results/eval-suite/responses/diagnostics/
   cat results/eval-suite/responses/diagnostics/d*.md
   ```

## Remediation Strategies

### Strategy A: Prompt Simplification (If D4+ fail)

**Issue:** Complex multi-step prompts exceed model capability

**Fix:** Decompose Kata tasks into simpler sub-prompts

```json
// Instead of one complex prompt:
{
  "prompt": "Calculate X, then Y, then propose Z in JSON format..."
}

// Break into sequential tasks:
[
  {"prompt": "Calculate average of [9.5, 8.7, 8.2, 7.9]"},
  {"prompt": "Given average {result1}, calculate gap to 6.0"},
  {"prompt": "Given gap {result2}, propose experiment"}
]
```

### Strategy B: Timeout Scaling (If D5/D6 timeout)

**Issue:** CPU inference needs more time

**Fix:** Implement dynamic timeout based on model size + hardware

```typescript
// In generate_eval_tasks.py
const cpuTimeoutMultiplier = 3; // CPU is ~3x slower than GPU
const baseTimeout = 90000;
const timeout = isCPU ? baseTimeout * cpuTimeoutMultiplier : baseTimeout;
```

### Strategy C: Model Selection (If D1-D3 fail)

**Issue:** Model incompatible with task format

**Fix:** Test alternative models optimized for instruction-following

```bash
# Try models with better instruction-following:
ollama pull llama3.2:1b-instruct
ollama pull qwen2.5:1.5b-instruct
ollama pull phi3.5:3.8b-mini-instruct
```

### Strategy D: JSON Format Relaxation (If D2 fails)

**Issue:** Strict JSON schema enforcement problematic

**Fix:** Allow markdown code fences, then extract JSON

```typescript
// In task-executor.ts
const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
if (jsonMatch) {
  return JSON.parse(jsonMatch[1].trim());
}
```

### Strategy E: Streaming Enablement (If D3+ timeout)

**Issue:** No progress feedback on long-running requests

**Fix:** Enable streaming to detect progress

```typescript
// In callOllama
stream: true,

// Then parse NDJSON stream progressively
// Detect if model is generating (not truly stuck)
```

## Environment Tuning

### Ollama Configuration

```bash
# Increase Ollama timeout
export OLLAMA_REQUEST_TIMEOUT=300s

# Reduce context window for faster processing
export OLLAMA_NUM_CTX=1024  # default 2048

# Enable all CPU cores
export OLLAMA_NUM_THREAD=$(nproc)
```

### CPU Optimization

```bash
# Check CPU governor (should be 'performance')
cat /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor

# Set to performance mode
echo performance | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor

# Monitor CPU usage during test
htop
```

### Memory Considerations

```bash
# Check available memory
free -h

# Ensure model fits in RAM
# Rule of thumb: model size (GB) * 1.5 = minimum RAM needed
# Example: 1.5B model @ Q4_0 = ~1GB * 1.5 = 1.5GB minimum RAM
```

## Next Steps

1. **Run Diagnostics**
   ```bash
   ./scripts/eval/run_diagnostics.sh
   ```

2. **Report Results**
   - Share the last passing test ID (D1-D6)
   - Attach `diagnostic-suite.result.json`
   - Include any console logs with timing info
   - Note your CPU specs (cores, speed)

3. **Implement Remediation**
   - Based on failure point, apply appropriate strategy
   - Re-run diagnostics to validate fix
   - Proceed to full evaluation suite

4. **Continuous Learning**
   - Document findings in this file
   - Update diagnostic suite with new edge cases
   - Share insights with community

## Troubleshooting

### Ollama Not Responding

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Check Ollama logs
journalctl -u ollama -f

# Restart Ollama
systemctl restart ollama
```

### Model Not Found

```bash
# List available models
ollama list

# Pull missing model
ollama pull deepseek-r1:1.5b

# Verify model works standalone
ollama run deepseek-r1:1.5b "Hello"
```

### Build Errors

```bash
# Clean and rebuild
npm run clean
npm run build

# Check for TypeScript errors
npm run type-check
```

## References

- [Ollama API Documentation](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [Ollama Model Library](https://ollama.com/library)
- [CPU Optimization Guide](https://github.com/ollama/ollama/blob/main/docs/faq.md#how-can-i-optimize-ollama-on-cpu)

---

**Last Updated:** 2026-01-18
**Maintainers:** Chrysalis Evaluation Team
