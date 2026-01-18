# Universal Adapter Task Specification

**Version**: 2.0.0  
**Date**: January 16, 2026  
**Status**: Design Specification  

---

## Executive Summary

This document specifies the **task structure, LLM specification, reference registry, and prompt branching logic** for the Chrysalis Universal Adapter. The adapter handles multiple task types through a JSON-based task definition format, with configurable LLM providers and a registry of reference specifications used to inform prompt construction.

---

## Table of Contents

1. [Task Structure (JSON Format)](#1-task-structure-json-format)
2. [LLM Provider Specification](#2-llm-provider-specification)
3. [Reference Registry](#3-reference-registry)
4. [Prompt Pipeline and Branching Logic](#4-prompt-pipeline-and-branching-logic)
5. [Task Types and Workflows](#5-task-types-and-workflows)
6. [Integration Points](#6-integration-points)
7. [Usage Examples](#7-usage-examples)

---

## 1. Task Structure (JSON Format)

### 1.1 Core Task Schema

Every Universal Adapter task follows this JSON structure:

```json
{
  "taskId": "uuid-v4",
  "taskType": "translate | morph | validate | discover | generate_mappings",
  "priority": "low | normal | high | critical",
  "createdAt": "2026-01-16T10:30:00Z",
  
  "llmConfig": {
    "provider": "anthropic | openai | ollama | custom",
    "model": "claude-sonnet-4-20250514",
    "tier": "local_slm | cloud_llm | hybrid",
    "fallbackChain": ["local_slm", "cloud_llm", "cached"],
    "options": {
      "maxTokens": 8192,
      "temperature": 0.1,
      "responseFormat": "json",
      "timeoutMs": 30000
    }
  },
  
  "references": {
    "sourceProtocol": "mcp",
    "targetProtocol": "a2a",
    "registryVersion": "v2",
    "specUrls": {
      "source": "https://modelcontextprotocol.io/specification/2025-11-25/schema",
      "target": "https://google.github.io/A2A/specification/"
    },
    "semanticHints": true,
    "fallbackSchemas": true
  },
  
  "input": {
    "agent": { /* Agent data to process */ },
    "context": {
      "cachedMappings": [],
      "previousTranslations": [],
      "userOverrides": {}
    }
  },
  
  "promptPipeline": {
    "stages": ["validate_input", "fetch_specs", "build_prompt", "execute", "verify"],
    "branchingRules": { /* See section 4 */ },
    "enableCaching": true,
    "enableVerification": false
  },
  
  "output": {
    "schema": "TranslationResultV2",
    "includeMetadata": true,
    "includeReasoningTrace": false
  }
}
```

### 1.2 Task Types

| Task Type | Description | Primary Prompt | Output Schema |
|-----------|-------------|----------------|---------------|
| `translate` | Convert agent between protocols | `buildTranslationPromptV2` | `TranslationResultV2` |
| `morph` | Identity-preserving transformation | `buildAgentMorphingPrompt` | `MorphingResult` |
| `validate` | Check agent against protocol spec | `buildValidationPromptV2` | `ValidationResult` |
| `discover` | Analyze protocol capabilities | `buildCapabilityDiscoveryPromptV2` | `ProtocolCapabilities` |
| `generate_mappings` | Pre-compute field mappings | `buildFieldMappingPromptV2` | `FieldMapping[]` |

### 1.3 Batch Task Structure

For processing multiple agents or protocol pairs:

```json
{
  "batchId": "batch-uuid",
  "tasks": [
    { /* Task 1 */ },
    { /* Task 2 */ }
  ],
  "execution": {
    "mode": "sequential | parallel | priority_ordered",
    "maxConcurrency": 5,
    "stopOnError": false,
    "aggregateResults": true
  },
  "sharedConfig": {
    "llmConfig": { /* Shared LLM config */ },
    "references": { /* Shared registry config */ }
  }
}
```

---

## 2. LLM Provider Specification

### 2.1 Provider Configuration

```json
{
  "llmConfig": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "tier": "cloud_llm",
    "apiKey": "${ANTHROPIC_API_KEY}",
    "baseUrl": "https://api.anthropic.com/v1",
    
    "options": {
      "maxTokens": 8192,
      "temperature": 0.1,
      "responseFormat": "json",
      "timeoutMs": 30000,
      "retryPolicy": {
        "maxRetries": 2,
        "backoffMs": [1000, 3000],
        "retryOn": ["timeout", "rate_limit", "transient_error"]
      }
    },
    
    "fallbackChain": [
      {
        "provider": "ollama",
        "model": "gemma:7b",
        "tier": "local_slm",
        "trigger": "cloud_unavailable | latency_exceeded"
      },
      {
        "source": "cache",
        "tier": "cached",
        "trigger": "all_providers_failed"
      }
    ]
  }
}
```

### 2.2 Model Tier Selection

The adapter uses complexity-based routing to select the appropriate model tier:

```typescript
// Complexity routing rules
const TIER_SELECTION_RULES = {
  local_slm: {
    useCases: [
      "simple_validation",
      "cached_mapping_lookup",
      "protocol_discovery",
      "small_agent_translation"
    ],
    constraints: {
      maxInputTokens: 2000,
      maxAgentFields: 50,
      complexity: "standard"
    },
    models: ["gemma:2b", "gemma:7b", "phi-3"]
  },
  
  cloud_llm: {
    useCases: [
      "complex_translation",
      "agent_morphing",
      "multi_protocol_chain",
      "novel_protocol_handling",
      "high_fidelity_required"
    ],
    constraints: {
      maxInputTokens: 100000,
      maxAgentFields: "unlimited",
      complexity: "any"
    },
    models: ["claude-sonnet-4-20250514", "claude-opus-4-20250514", "gpt-4o"]
  },
  
  hybrid: {
    strategy: "local_first_escalate",
    escalationTriggers: [
      "localConfidence < 0.7",
      "inputTokens >= 2000",
      "complexity === 'high'",
      "novelPattern === true",
      "unmappedFields > 5"
    ]
  }
};
```

### 2.3 LLM Provider Interface

```typescript
interface LLMProviderV2 {
  /** Provider name */
  name: string;
  
  /** Complete a prompt */
  complete(prompt: string, options?: LLMCompletionOptions): Promise<LLMResponse>;
  
  /** Check availability */
  isAvailable?(): Promise<boolean>;
  
  /** Get token count estimate */
  estimateTokens?(text: string): number;
}

interface LLMCompletionOptions {
  maxTokens?: number;
  temperature?: number;
  responseFormat?: 'text' | 'json';
  stopSequences?: string[];
  systemPrompt?: string;
  timeoutMs?: number;
}

interface LLMResponse {
  content: string;
  json?: Record<string, unknown>;
  confidence?: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
}
```

---

## 3. Reference Registry

### 3.1 Protocol Registry Structure

The registry provides specification URLs, semantic hints, and fallback schemas for each protocol:

```json
{
  "registryId": "protocol_registry_v2",
  "version": "2.0.0",
  
  "protocols": {
    "mcp": {
      "name": "Model Context Protocol",
      "specUrl": "https://modelcontextprotocol.io/specification/2025-11-25/schema",
      "altSpecUrls": [
        "https://modelcontextprotocol.io/specification/2025-06-18/schema",
        "https://raw.githubusercontent.com/modelcontextprotocol/specification/main/schema/schema.json"
      ],
      "docsUrl": "https://spec.modelcontextprotocol.io/",
      "repoUrl": "https://github.com/modelcontextprotocol/specification",
      "specVersion": "2025-11-25",
      "lastVerified": "2026-01-12",
      "trustLevel": "verified",
      "cacheTtl": 86400,
      
      "semanticHints": {
        "identityField": "name",
        "capabilitiesField": "tools",
        "descriptionField": "description",
        "promptField": "instructions",
        "extensionField": "_meta",
        "fieldMappings": {
          "tools": ["tools", "capabilities"],
          "resources": ["resources"],
          "prompts": ["prompts"],
          "name": ["name", "serverInfo.name"]
        },
        "notes": "MCP uses JSON-RPC 2.0. Key types: Tool (with inputSchema), Resource (with uri), Prompt..."
      },
      
      "fallbackSchema": {
        "type": "object",
        "required": ["protocolVersion"],
        "properties": {
          "protocolVersion": { "type": "string" },
          "capabilities": { "type": "object" },
          "tools": { "type": "array" },
          "resources": { "type": "array" }
        }
      }
    }
  }
}
```

### 3.2 Semantic Categories

Protocol-agnostic conceptual categories that guide LLM translation:

```json
{
  "semanticCategories": {
    "IDENTITY": {
      "description": "Who the agent is - unique identifiers and names",
      "concepts": ["id", "uuid", "name", "identifier", "agentId", "displayName", "title", "role", "did"],
      "priority": "required"
    },
    "CAPABILITIES": {
      "description": "What the agent can do - tools, skills, functions",
      "concepts": ["tool", "capability", "function", "skill", "action", "method", "command", "plugin", "interface"],
      "priority": "required"
    },
    "INSTRUCTIONS": {
      "description": "How the agent behaves - prompts, personas, goals",
      "concepts": ["system_prompt", "instructions", "persona", "goal", "backstory", "system_message", "system"],
      "priority": "high"
    },
    "STATE": {
      "description": "What the agent remembers - memory, context",
      "concepts": ["memory", "context", "state", "history", "knowledge", "working_set", "beliefs", "episodic", "semantic"],
      "priority": "medium"
    },
    "COMMUNICATION": {
      "description": "How the agent communicates - style, voice, patterns",
      "concepts": ["voice", "tone", "communication_style", "manner", "adjectives", "topics"],
      "priority": "low"
    },
    "EXECUTION": {
      "description": "How the agent runs - LLM config, runtime settings",
      "concepts": ["llm", "model", "runtime", "execution", "llm_config", "temperature", "max_tokens"],
      "priority": "medium"
    },
    "METADATA": {
      "description": "Descriptive information - version, author, tags",
      "concepts": ["version", "author", "description", "tags", "created", "modified", "metadata"],
      "priority": "low"
    },
    "SECURITY": {
      "description": "Access control and authentication",
      "concepts": ["security", "securityDefinitions", "authentication", "auth", "credentials", "proof"],
      "priority": "medium"
    }
  }
}
```

### 3.3 Reference URL Resolution

```typescript
// Reference resolution with fallback
async function resolveReference(protocol: string): Promise<SpecResult> {
  const entry = PROTOCOL_REGISTRY_V2[protocol];
  
  // 1. Try primary URL
  const urls = [entry.specUrl, ...(entry.altSpecUrls || [])];
  
  for (const url of urls) {
    if (url.startsWith('internal://')) continue;
    
    try {
      const response = await fetch(url, { timeout: 10000 });
      if (response.ok) {
        return {
          content: await response.text(),
          source: url,
          isFallback: false
        };
      }
    } catch {
      continue; // Try next URL
    }
  }
  
  // 2. Fall back to embedded schema
  if (entry.fallbackSchema) {
    return {
      content: JSON.stringify(entry.fallbackSchema),
      source: 'fallback',
      isFallback: true
    };
  }
  
  // 3. Generate minimal spec from hints
  return {
    content: generateMinimalSpec(entry.semanticHints),
    source: 'generated',
    isFallback: true
  };
}
```

---

## 4. Prompt Pipeline and Branching Logic

### 4.1 Pipeline Stages

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        UNIVERSAL ADAPTER PIPELINE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌───────┐ │
│  │ VALIDATE │───▶│  FETCH   │───▶│  BUILD   │───▶│ EXECUTE  │───▶│VERIFY │ │
│  │  INPUT   │    │  SPECS   │    │ PROMPT   │    │   LLM    │    │OUTPUT │ │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘    └───┬───┘ │
│       │               │               │               │              │     │
│       ▼               ▼               ▼               ▼              ▼     │
│   [Branch:        [Branch:        [Branch:        [Branch:      [Branch:   │
│    Invalid]        Network]        Complex]        Escalate]     Verify]   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Stage Definitions

```json
{
  "pipelineStages": {
    "validate_input": {
      "description": "Validate task input and agent data",
      "inputs": ["task", "agent"],
      "outputs": ["validatedAgent", "validationResult"],
      "branches": {
        "valid": "fetch_specs",
        "invalid": "return_error",
        "needs_normalization": "normalize_input"
      },
      "timeout": 1000
    },
    
    "fetch_specs": {
      "description": "Fetch protocol specifications from registry",
      "inputs": ["sourceProtocol", "targetProtocol", "registryConfig"],
      "outputs": ["sourceSpec", "targetSpec", "cacheHits"],
      "branches": {
        "specs_found": "build_prompt",
        "source_not_found": "return_error",
        "target_not_found": "return_error",
        "network_error": "use_fallback_schemas"
      },
      "timeout": 15000,
      "cache": {
        "enabled": true,
        "ttlFromRegistry": true
      }
    },
    
    "build_prompt": {
      "description": "Construct LLM prompt from specs and principles",
      "inputs": ["agent", "sourceSpec", "targetSpec", "cachedMappings", "taskType"],
      "outputs": ["prompt", "estimatedTokens"],
      "branches": {
        "simple_translation": "execute_local",
        "complex_translation": "execute_cloud",
        "has_cached_mappings": "execute_with_hints",
        "novel_protocol": "execute_cloud_with_discovery"
      },
      "promptSelection": {
        "translate": "buildTranslationPromptV2",
        "morph": "buildAgentMorphingPrompt",
        "validate": "buildValidationPromptV2",
        "discover": "buildCapabilityDiscoveryPromptV2",
        "generate_mappings": "buildFieldMappingPromptV2"
      }
    },
    
    "execute_llm": {
      "description": "Execute prompt against LLM provider",
      "inputs": ["prompt", "llmConfig"],
      "outputs": ["llmResponse", "usage"],
      "branches": {
        "success": "verify_output",
        "timeout": "retry_or_escalate",
        "rate_limited": "backoff_retry",
        "low_confidence": "escalate_to_cloud",
        "provider_error": "try_fallback"
      },
      "timeout": 30000,
      "retries": 2
    },
    
    "verify_output": {
      "description": "Verify translation output quality",
      "inputs": ["originalAgent", "translatedAgent", "targetSpec"],
      "outputs": ["verificationResult", "fidelityScore"],
      "branches": {
        "verified": "return_result",
        "verification_failed": "retry_with_feedback",
        "partial_success": "return_with_warnings"
      },
      "optional": true,
      "enabledBy": "task.promptPipeline.enableVerification"
    }
  }
}
```

### 4.3 Branching Rules

```json
{
  "branchingRules": {
    "complexity_routing": {
      "description": "Route to appropriate LLM tier based on complexity",
      "conditions": [
        {
          "if": "estimatedTokens < 2000 AND knownProtocolPair",
          "then": "execute_local",
          "tier": "local_slm"
        },
        {
          "if": "estimatedTokens >= 2000 OR novelProtocol",
          "then": "execute_cloud",
          "tier": "cloud_llm"
        },
        {
          "if": "hasCachedMappings AND confidence >= 0.8",
          "then": "execute_with_cached_hints",
          "tier": "local_slm"
        }
      ]
    },
    
    "confidence_escalation": {
      "description": "Escalate to higher tier if confidence is low",
      "conditions": [
        {
          "if": "localResponse.confidence < 0.7",
          "then": "escalate_to_cloud",
          "action": "retry_with_cloud_llm"
        },
        {
          "if": "cloudResponse.confidence < 0.5",
          "then": "flag_for_review",
          "action": "return_with_low_confidence_warning"
        }
      ]
    },
    
    "error_recovery": {
      "description": "Handle errors with fallback chain",
      "conditions": [
        {
          "on": "timeout",
          "then": "retry_with_backoff",
          "maxRetries": 2
        },
        {
          "on": "provider_unavailable",
          "then": "try_next_in_fallback_chain"
        },
        {
          "on": "all_providers_failed",
          "then": "use_cached_result_or_fail"
        }
      ]
    },
    
    "verification_flow": {
      "description": "Optional bidirectional verification",
      "conditions": [
        {
          "if": "enableVerification AND translateSuccess",
          "then": "perform_round_trip_verification"
        },
        {
          "if": "fidelityScore < 0.8",
          "then": "retry_with_explicit_field_mappings"
        },
        {
          "if": "fidelityScore >= 0.95",
          "then": "cache_successful_mappings"
        }
      ]
    }
  }
}
```

### 4.4 Prompt Selection Flow

```
                              ┌─────────────────┐
                              │   Task Type?    │
                              └────────┬────────┘
                                       │
          ┌──────────────┬─────────────┼─────────────┬──────────────┐
          ▼              ▼             ▼             ▼              ▼
     ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
     │translate│   │  morph  │   │validate │   │discover │   │mappings │
     └────┬────┘   └────┬────┘   └────┬────┘   └────┬────┘   └────┬────┘
          │              │             │             │              │
          ▼              ▼             ▼             ▼              ▼
     ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
     │ V2      │   │ Agent   │   │ V2      │   │ V2      │   │ V2      │
     │Translate│   │ Morph   │   │Validate │   │CapDisc  │   │FieldMap │
     │ Prompt  │   │ Prompt  │   │ Prompt  │   │ Prompt  │   │ Prompt  │
     └────┬────┘   └────┬────┘   └────┬────┘   └────┬────┘   └────┬────┘
          │              │             │             │              │
          └──────────────┴─────────────┴─────────────┴──────────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │   Inject:       │
                              │ • Registry specs│
                              │ • Semantic hints│
                              │ • Cached maps   │
                              │ • User overrides│
                              └────────┬────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │  Execute LLM    │
                              └─────────────────┘
```

---

## 5. Task Types and Workflows

### 5.1 Translation Workflow

```json
{
  "workflow": "translate",
  "stages": [
    {
      "stage": "input_validation",
      "prompts": [],
      "logic": "validateAgentSchema(input.agent)"
    },
    {
      "stage": "spec_resolution",
      "prompts": [],
      "logic": "resolveSpecs(sourceProtocol, targetProtocol)"
    },
    {
      "stage": "mapping_lookup",
      "prompts": [],
      "logic": "checkCachedMappings(source, target)"
    },
    {
      "stage": "translation",
      "prompts": ["buildTranslationPromptV2"],
      "llmCall": true,
      "logic": "executeWithTierRouting(prompt)"
    },
    {
      "stage": "verification",
      "prompts": ["buildTranslationPromptV2"],
      "llmCall": true,
      "conditional": "config.enableVerification",
      "logic": "roundTripVerification(original, translated)"
    },
    {
      "stage": "cache_update",
      "prompts": [],
      "logic": "updateMappingCache(result.fieldMappings)"
    }
  ]
}
```

### 5.2 Morphing Workflow (Identity Preservation)

```json
{
  "workflow": "morph",
  "stages": [
    {
      "stage": "identity_extraction",
      "prompts": [],
      "logic": "extractCoreIdentity(input.agent, sourceHints)"
    },
    {
      "stage": "capability_mapping",
      "prompts": [],
      "logic": "mapCapabilitiesSemanticCategory(agent.capabilities)"
    },
    {
      "stage": "morphing",
      "prompts": ["buildAgentMorphingPrompt"],
      "llmCall": true,
      "llmTier": "cloud_llm",
      "logic": "preserveIdentityDuringTransform(agent)"
    },
    {
      "stage": "identity_verification",
      "prompts": [],
      "logic": "verifyIdentityPreservation(original, morphed)"
    },
    {
      "stage": "capability_verification",
      "prompts": [],
      "logic": "verifyCapabilityEquivalence(original, morphed)"
    }
  ],
  "morphingReport": {
    "identityPreserved": "boolean",
    "capabilitiesCount": { "source": "number", "target": "number" },
    "instructionsTransferred": "boolean",
    "statePreserved": "boolean",
    "dataLoss": "string[]",
    "transformations": "TransformRecord[]"
  }
}
```

### 5.3 Multi-Protocol Chain

```json
{
  "workflow": "multi_protocol_chain",
  "description": "Translate through intermediate protocols for better fidelity",
  "stages": [
    {
      "stage": "analyze_path",
      "logic": "findBestTranslationPath(source, target, capabilityMatrix)"
    },
    {
      "stage": "execute_chain",
      "logic": "for each hop in path: translate(current, next)"
    }
  ],
  "example": {
    "source": "elizaos",
    "target": "mcp",
    "path": ["elizaos", "usa", "mcp"],
    "rationale": "elizaos → usa has 0.95 fidelity, usa → mcp has 0.98 fidelity"
  }
}
```

---

## 6. Integration Points

### 6.1 Current Usage in Codebase

| Location | Usage | Task Type |
|----------|-------|-----------|
| `src/cli/chrysalis-cli.ts` | CLI morph command | `morph` |
| `src/converter/Converter.ts` | Agent conversion | `translate` |
| `src/quality/tools/universal/adapter.ts` | Quality tool translation | `translate` |
| `src/mcp-server/chrysalis-tools.ts` | MCP tool bridging | `translate` |
| `src/agents/system/EvaluationCoordinator.ts` | Evaluation persona routing | `validate` |

### 6.2 Potential New Integration Points

| Location | Potential Usage | Task Type |
|----------|-----------------|-----------|
| `src/adapters/acp/server.ts` | ACP ↔ Chrysalis bridge | `morph` |
| `memory_system/fusion.py` | Memory schema translation | `translate` |
| `go-services/internal/agents/registry.go` | Go service agent registry | `validate` |
| `projects/SkillBuilder/` | Skill card protocol mapping | `generate_mappings` |

### 6.3 Integration with System Agents (Horizontal 2)

The Universal Adapter integrates with the System Agents layer for complex evaluations:

```json
{
  "integration": "system_agents",
  "flow": [
    {
      "agent": "ada",
      "task": "analyze translation structure",
      "adapterTask": "validate"
    },
    {
      "agent": "lea",
      "task": "review translation implementation",
      "adapterTask": "translate"
    },
    {
      "agent": "phil",
      "task": "predict translation success",
      "adapterTask": "discover"
    },
    {
      "agent": "david",
      "task": "metacognitive audit of translation decisions",
      "adapterTask": "morph"
    }
  ]
}
```

---

## 7. Usage Examples

### 7.1 Simple Translation Task

```typescript
import { createUniversalAdapter, type LLMProviderV2 } from './adapters/universal';

// Create LLM provider
const llm: LLMProviderV2 = {
  name: 'anthropic',
  async complete(prompt, options) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: options?.maxTokens ?? 8192,
      messages: [{ role: 'user', content: prompt }]
    });
    return {
      content: response.content[0].text,
      json: JSON.parse(response.content[0].text)
    };
  }
};

// Create adapter
const adapter = createUniversalAdapter(llm, {
  enableSpecCache: true,
  enableMappingCache: true,
  enableVerification: false
});

// Execute translation task
const result = await adapter.translate(
  myCrewAIAgent,
  'crewai',
  'mcp'
);

console.log(result.translatedAgent);
console.log(`Confidence: ${result.confidence}`);
console.log(`Unmapped: ${result.unmappedFields.join(', ')}`);
```

### 7.2 Batch Translation with Hybrid Routing

```typescript
const tasks = [
  { agent: agent1, from: 'crewai', to: 'mcp' },
  { agent: agent2, from: 'langchain', to: 'a2a' },
  { agent: agent3, from: 'elizaos', to: 'usa' }
];

// Process with parallel execution
const results = await Promise.all(
  tasks.map(task => adapter.translate(task.agent, task.from, task.to))
);

// Aggregate statistics
const stats = {
  totalTranslations: results.length,
  avgConfidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length,
  cacheHitRate: results.filter(r => r.cacheHits.mappingCache).length / results.length
};
```

### 7.3 Agent Morphing with Custom Mappings

```typescript
const morphResult = await adapter.morph(
  myAgent,
  'openai',
  'a2a',
  {
    preserveExtensions: true,
    targetCapabilities: ['streaming', 'multi_turn'],
    customMappings: {
      'functions': 'skills',
      'assistant_id': 'agentCard.id'
    }
  }
);

console.log('Identity preserved:', morphResult.morphingReport.identityPreserved);
console.log('Capabilities:', morphResult.morphingReport.capabilitiesCount);
console.log('Data loss:', morphResult.morphingReport.dataLoss);
```

---

## Appendix A: Complete Task Schema (TypeScript)

```typescript
interface UniversalAdapterTask {
  taskId: string;
  taskType: 'translate' | 'morph' | 'validate' | 'discover' | 'generate_mappings';
  priority: 'low' | 'normal' | 'high' | 'critical';
  createdAt: string;
  
  llmConfig: {
    provider: 'anthropic' | 'openai' | 'ollama' | 'custom';
    model: string;
    tier: 'local_slm' | 'cloud_llm' | 'hybrid';
    apiKey?: string;
    baseUrl?: string;
    options: LLMCompletionOptions;
    fallbackChain: FallbackConfig[];
  };
  
  references: {
    sourceProtocol: string;
    targetProtocol?: string;
    registryVersion: string;
    specUrls?: Record<string, string>;
    semanticHints: boolean;
    fallbackSchemas: boolean;
  };
  
  input: {
    agent: Record<string, unknown>;
    context?: {
      cachedMappings?: FieldMapping[];
      previousTranslations?: TranslationRecord[];
      userOverrides?: Record<string, string>;
    };
  };
  
  promptPipeline: {
    stages: string[];
    branchingRules: BranchingRules;
    enableCaching: boolean;
    enableVerification: boolean;
  };
  
  output: {
    schema: string;
    includeMetadata: boolean;
    includeReasoningTrace: boolean;
  };
}
```

---

**Document Owner**: Chrysalis Architecture Team  
**Next Review**: After implementation milestone
