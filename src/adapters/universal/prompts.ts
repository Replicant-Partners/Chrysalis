/**
 * Universal Adapter
 *
 * ENHANCED prompt set with:
 * - Protocol-specific semantic hints integration
 * - Token-optimized formatting
 * - Versioned spec awareness
 * - Structured output enforcement
 *
 * CORE PRINCIPLE: Map by Semantic Category Meaning
 *
 * The system maps fields by the MEANING of their category in the schema,
 * not by syntactic field names. When we see "tool" in MCP and "capability"
 * in A2A, they map because they belong to the same semantic category:
 * "actions an agent can perform."
 *
 * @module adapters/universal/prompts-v2
 * @version 2.0.0 (version marker)
 */

import { SemanticHints, ProtocolEntry, MinimalSchema } from './registry';

// ============================================================================
// Semantic Category Definitions
// ============================================================================

/**
 * Semantic categories that represent fundamental agent concepts.
 * These are protocol-agnostic conceptual buckets that guide translation.
 */
export const SEMANTIC_CATEGORIES = {
  IDENTITY: {
    description: 'Who the agent is - unique identifiers and names',
    concepts: ['id', 'uuid', 'name', 'identifier', 'agentId', 'agent_name', 'displayName', 'title', 'role', 'did'],
    priority: 'required'
  },
  CAPABILITIES: {
    description: 'What the agent can do - tools, skills, functions',
    concepts: ['tool', 'capability', 'function', 'skill', 'action', 'method', 'command', 'plugin', 'interface'],
    priority: 'required'
  },
  INSTRUCTIONS: {
    description: 'How the agent behaves - prompts, personas, goals',
    concepts: ['system_prompt', 'instructions', 'persona', 'goal', 'backstory', 'system_message', 'system'],
    priority: 'high'
  },
  STATE: {
    description: 'What the agent remembers - memory, context',
    concepts: ['memory', 'context', 'state', 'history', 'knowledge', 'working_set', 'beliefs', 'episodic', 'semantic'],
    priority: 'medium'
  },
  COMMUNICATION: {
    description: 'How the agent talks - style, voice, patterns',
    concepts: ['voice', 'tone', 'communication_style', 'manner', 'adjectives', 'topics'],
    priority: 'low'
  },
  EXECUTION: {
    description: 'How the agent runs - LLM config, runtime settings',
    concepts: ['llm', 'model', 'runtime', 'execution', 'llm_config', 'temperature', 'max_tokens'],
    priority: 'medium'
  },
  METADATA: {
    description: 'Descriptive information - version, author, tags',
    concepts: ['version', 'author', 'description', 'tags', 'created', 'modified', 'metadata'],
    priority: 'low'
  },
  SECURITY: {
    description: 'Access control and authentication',
    concepts: ['security', 'securityDefinitions', 'authentication', 'auth', 'credentials', 'proof'],
    priority: 'medium'
  }
} as const;

// ============================================================================
// Core Mapping Principles (Token-Optimized)
// ============================================================================

/**
 * Compact mapping principles for LLM context.
 * Designed to minimize tokens while preserving semantic clarity.
 */
export const MAPPING_PRINCIPLES_COMPACT = `
## Agent Protocol Translation Rules

### Rule 1: SEMANTIC CATEGORY MAPPING (Primary Rule)
Map fields by MEANING, not syntax. Categories:
- IDENTITY: id, name, uuid, title, role, did → agent identifier
- CAPABILITIES: tools, skills, functions, actions, plugins → agent abilities
- INSTRUCTIONS: system_prompt, instructions, goal, backstory → behavior guidance
- STATE: memory, context, history, beliefs → agent knowledge
- EXECUTION: llm, model, runtime → execution config
- METADATA: version, author, tags → descriptive info

### Rule 2: PRESERVE ALL DATA
- Never drop fields. Use extension field for unmappable data.
- Round-trip: source → target → source should be lossless.

### Rule 3: STRUCTURAL TRANSFORMS
- Flat ↔ Nested: \`agent.identity.name\` ↔ \`name\`
- Array ↔ Object: Transform bidirectionally
- Type coerce: string IDs ↔ URIs

### Rule 4: REQUIRED FIELDS
- Always populate target required fields
- Defaults: ID=UUID, version="1.0.0", name="Unnamed Agent"

### Rule 5: TOOL/CAPABILITY MAPPING
| Concept | Equivalents |
|---------|------------|
| tool | capability, function, skill, action |
| inputSchema | parameters, args, arguments |
| description | help, summary, doc |
`;

// ============================================================================
// Translation Prompt Builder
// ============================================================================

/**
 * Build optimized translation prompt with protocol-specific hints
 */
export function buildTranslationPrompt(
  agent: Record<string, unknown>,
  sourceProtocol: string,
  targetProtocol: string,
  sourceEntry: ProtocolEntry,
  targetEntry: ProtocolEntry,
  sourceSpec?: string,
  targetSpec?: string
): string {
  const sourceHints = sourceEntry.semanticHints;
  const targetHints = targetEntry.semanticHints;
  
  // Build protocol-specific guidance
  const protocolGuidance = buildProtocolGuidance(sourceHints, targetHints);
  
  // Use fallback schema if spec not provided
  const sourceSchema = sourceSpec || JSON.stringify(sourceEntry.fallbackSchema, null, 2);
  const targetSchema = targetSpec || JSON.stringify(targetEntry.fallbackSchema, null, 2);

  return `
${MAPPING_PRINCIPLES_COMPACT}

---
# Translation Task: ${sourceProtocol} → ${targetProtocol}

## Protocol-Specific Guidance
${protocolGuidance}

## Source Protocol: ${sourceEntry.name} (v${sourceEntry.specVersion})
${sourceHints.notes}

Schema:
\`\`\`json
${sourceSchema}
\`\`\`

## Target Protocol: ${targetEntry.name} (v${targetEntry.specVersion})
${targetHints.notes}

Schema:
\`\`\`json
${targetSchema}
\`\`\`

## Agent Data to Translate
\`\`\`json
${JSON.stringify(agent, null, 2)}
\`\`\`

---
## Response Format (JSON only)
\`\`\`json
{
  "translatedAgent": { /* Agent in ${targetProtocol} format */ },
  "confidence": 0.95,
  "fieldMappings": [
    {"source": "path.to.field", "target": "target.path", "category": "IDENTITY"}
  ],
  "unmappedFields": ["field.stored.in.extensions"],
  "warnings": ["any translation issues"]
}
\`\`\`

Return ONLY valid JSON. No explanation text.
`;
}

/**
 * Build protocol-specific field mapping guidance
 */
function buildProtocolGuidance(
  sourceHints: SemanticHints,
  targetHints: SemanticHints
): string {
  const lines: string[] = [];
  
  // Identity mapping
  lines.push(`Identity: ${sourceHints.identityField} → ${targetHints.identityField}`);
  
  // Capabilities mapping
  lines.push(`Capabilities: ${sourceHints.capabilitiesField} → ${targetHints.capabilitiesField}`);
  
  // Description mapping
  lines.push(`Description: ${sourceHints.descriptionField} → ${targetHints.descriptionField}`);
  
  // Prompt/Instructions mapping (if both have it)
  if (sourceHints.promptField && targetHints.promptField) {
    lines.push(`Instructions: ${sourceHints.promptField} → ${targetHints.promptField}`);
  }
  
  // Extension field for unmappable data
  lines.push(`Extensions: unmapped fields → ${targetHints.extensionField}`);
  
  return lines.join('\n');
}

// ============================================================================
// Specialized Prompt Builders
// ============================================================================

/**
 * Build validation prompt with protocol-specific schema
 */
export function buildValidationPrompt(
  agent: Record<string, unknown>,
  protocolEntry: ProtocolEntry,
  spec?: string
): string {
  const schema = spec || JSON.stringify(protocolEntry.fallbackSchema, null, 2);
  
  return `
# Validate Agent: ${protocolEntry.name}

## Protocol Schema (v${protocolEntry.specVersion})
\`\`\`json
${schema}
\`\`\`

## Agent Data
\`\`\`json
${JSON.stringify(agent, null, 2)}
\`\`\`

## Required Fields
${protocolEntry.fallbackSchema?.required?.join(', ') || 'See schema'}

## Response (JSON only)
\`\`\`json
{
  "valid": true,
  "errors": [{"path": "field.path", "error": "message", "expected": "type"}],
  "warnings": [{"path": "field.path", "warning": "message"}],
  "suggestions": ["improvement suggestions"]
}
\`\`\`
`;
}

/**
 * Build capability discovery prompt
 */
export function buildCapabilityDiscoveryPrompt(
  protocolEntry: ProtocolEntry,
  spec?: string
): string {
  const schema = spec || JSON.stringify(protocolEntry.fallbackSchema, null, 2);
  
  return `
# Discover Capabilities: ${protocolEntry.name}

## Protocol Schema (v${protocolEntry.specVersion})
\`\`\`json
${schema}
\`\`\`

## Semantic Hints
- Identity field: ${protocolEntry.semanticHints.identityField}
- Capabilities field: ${protocolEntry.semanticHints.capabilitiesField}
- Extension field: ${protocolEntry.semanticHints.extensionField}

## Response (JSON only)
\`\`\`json
{
  "protocol": "${protocolEntry.name}",
  "features": {
    "tools": "native|partial|unsupported",
    "memory": "native|partial|unsupported",
    "streaming": "native|partial|unsupported",
    "multiTurn": "native|partial|unsupported",
    "asyncTasks": "native|partial|unsupported",
    "artifacts": "native|partial|unsupported",
    "resources": "native|partial|unsupported",
    "discovery": "native|partial|unsupported",
    "authentication": "native|partial|unsupported"
  },
  "requiredFields": [],
  "optionalFields": [],
  "extensionMechanism": "${protocolEntry.semanticHints.extensionField}",
  "notes": "${protocolEntry.semanticHints.notes.substring(0, 100)}..."
}
\`\`\`
`;
}

/**
 * Build field mapping generation prompt between two protocols
 */
export function buildFieldMappingPrompt(
  sourceEntry: ProtocolEntry,
  targetEntry: ProtocolEntry,
  sourceSpec?: string,
  targetSpec?: string
): string {
  const sourceSchema = sourceSpec || JSON.stringify(sourceEntry.fallbackSchema, null, 2);
  const targetSchema = targetSpec || JSON.stringify(targetEntry.fallbackSchema, null, 2);
  
  return `
# Generate Field Mappings: ${sourceEntry.name} → ${targetEntry.name}

${MAPPING_PRINCIPLES_COMPACT}

## Source: ${sourceEntry.name} (v${sourceEntry.specVersion})
${sourceEntry.semanticHints.notes}

Known mappings:
${Object.entries(sourceEntry.semanticHints.fieldMappings)
  .map(([k, v]) => `- ${k}: ${v.join(', ')}`)
  .join('\n')}

Schema:
\`\`\`json
${sourceSchema}
\`\`\`

## Target: ${targetEntry.name} (v${targetEntry.specVersion})
${targetEntry.semanticHints.notes}

Known mappings:
${Object.entries(targetEntry.semanticHints.fieldMappings)
  .map(([k, v]) => `- ${k}: ${v.join(', ')}`)
  .join('\n')}

Schema:
\`\`\`json
${targetSchema}
\`\`\`

## Response (JSON only)
\`\`\`json
{
  "sourceProtocol": "${sourceEntry.name}",
  "targetProtocol": "${targetEntry.name}",
  "mappings": [
    {
      "source": "source.field.path",
      "target": "target.field.path",
      "category": "IDENTITY|CAPABILITIES|INSTRUCTIONS|STATE|EXECUTION|METADATA",
      "transform": "none|rename|restructure|typeCoerce",
      "bidirectional": true,
      "confidence": 0.95,
      "notes": "mapping rationale"
    }
  ],
  "sourceOnlyFields": ["fields with no target equivalent"],
  "targetOnlyFields": ["required target fields needing defaults"],
  "complexMappings": [
    {
      "description": "what needs special handling",
      "sourceFields": ["field1", "field2"],
      "targetFields": ["combined.field"],
      "logic": "transformation logic"
    }
  ]
}
\`\`\`
`;
}

// ============================================================================
// Agent Morphing Prompt (LLM as Flexible Adapter)
// ============================================================================

/**
 * Build prompt for agent morphing - LLM acts as flexible adapter middleware.
 * This is the core of the "LLM as adapter" paradigm.
 */
export function buildAgentMorphingPrompt(
  agent: Record<string, unknown>,
  sourceProtocol: string,
  targetProtocol: string,
  sourceEntry: ProtocolEntry,
  targetEntry: ProtocolEntry,
  additionalContext?: {
    preserveExtensions?: boolean;
    targetCapabilities?: string[];
    customMappings?: Record<string, string>;
  }
): string {
  const context = additionalContext || {};
  
  return `
# AGENT MORPHING: Transform Agent Identity Across Protocols

You are a **semantic protocol translator** that understands agent representations
across different frameworks. Your task is to MORPH an agent from one protocol's
representation to another while preserving its essential identity, capabilities,
and behavioral characteristics.

## Core Philosophy
The same agent should behave identically regardless of which protocol defines it.
"Tool" in MCP === "Skill" in A2A === "Function" in OpenAI === "Action" in LMOS.
These are syntactic differences; the semantic meaning is identical.

## Morphing Task
Transform: **${sourceEntry.name}** → **${targetEntry.name}**

### Source Agent (${sourceProtocol})
Identity field: \`${sourceEntry.semanticHints.identityField}\`
Capabilities: \`${sourceEntry.semanticHints.capabilitiesField}\`
${sourceEntry.semanticHints.notes}

\`\`\`json
${JSON.stringify(agent, null, 2)}
\`\`\`

### Target Protocol (${targetProtocol})
Identity field: \`${targetEntry.semanticHints.identityField}\`
Capabilities: \`${targetEntry.semanticHints.capabilitiesField}\`
Extensions: \`${targetEntry.semanticHints.extensionField}\`
${targetEntry.semanticHints.notes}

${context.targetCapabilities ? `
### Required Target Capabilities
${context.targetCapabilities.join(', ')}
` : ''}

${context.customMappings ? `
### Custom Field Overrides
${Object.entries(context.customMappings)
  .map(([s, t]) => `- ${s} → ${t}`)
  .join('\n')}
` : ''}

## Morphing Rules

1. **Preserve Agent Essence**: The morphed agent must:
   - Retain the same name/identifier (or closest equivalent)
   - Keep all capabilities/tools (transform format, not function)
   - Maintain behavioral instructions (system prompt, persona, goals)
   - Transfer memory/context configuration where applicable

2. **Capability Translation**:
   - Map tool schemas accurately (input parameters, descriptions)
   - Preserve tool names unless they conflict with target conventions
   - Include all tool metadata in extensions if not directly mappable

3. **Identity Preservation**:
   - Primary identifier must map to target's identity field
   - Version information should transfer to metadata
   - Author/creator info goes to metadata/extensions

4. **Behavioral Fidelity**:
   - System prompts → instructions field
   - Goals/objectives → clearly documented
   - Persona/backstory → preserved in appropriate field

5. **Extension Storage**: ${context.preserveExtensions !== false ? 
   `Store ALL unmappable data in \`${targetEntry.semanticHints.extensionField}\`` :
   'Minimal extension storage - only critical data'}

## Response Format (JSON only)
\`\`\`json
{
  "morphedAgent": {
    // Complete agent in ${targetProtocol} format
    // Include ALL fields, even optional ones populated from source
  },
  "morphingReport": {
    "identityPreserved": true,
    "capabilitiesCount": { "source": 5, "target": 5 },
    "instructionsTransferred": true,
    "statePreserved": true,
    "dataLoss": [],
    "transformations": [
      {"field": "tools[0]", "action": "renamed", "from": "search", "to": "web_search"}
    ]
  },
  "confidence": 0.95,
  "warnings": []
}
\`\`\`
`;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  SEMANTIC_CATEGORIES,
  MAPPING_PRINCIPLES_COMPACT,
  buildTranslationPrompt,
  buildValidationPrompt,
  buildCapabilityDiscoveryPrompt,
  buildFieldMappingPrompt,
  buildAgentMorphingPrompt
};