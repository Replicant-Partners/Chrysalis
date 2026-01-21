/**
 * Universal Adapter Prompts
 *
 * CORE PRINCIPLE: Map by Semantic Category Meaning
 *
 * The system maps fields by the MEANING of their category in the schema,
 * not by syntactic field names. When we see "tool" in MCP and "capability"
 * in A2A, they map because they belong to the same semantic category:
 * "actions an agent can perform."
 *
 * This is the core insight: transformation logic lives in prompts that
 * express principles about semantic category equivalence. The LLM applies
 * these principles to any protocol pair.
 *
 * @module adapters/universal/prompts
 * @version 1.0.0
 */

// ============================================================================
// Core Mapping Principles
// ============================================================================

/**
 * Mapping Principles Prompt
 * 
 * These principles guide the LLM in translating between ANY two agent protocols.
 * They are protocol-agnostic and focus on semantic equivalence.
 */
export const MAPPING_PRINCIPLES_PROMPT = `
# Agent Protocol Translation Principles

You are translating an AI agent definition from one protocol format to another.
Apply these principles to ensure accurate, lossless translation.

## Principle 1: Map by Semantic Category Meaning (CORE PRINCIPLE)

The fundamental translation principle is: **map by the MEANING of the category in the schema**.

Every field in a schema belongs to a semantic category - a conceptual bucket of meaning.
Translation happens at the category level, not the field name level.

Example Semantic Categories:
- **ACTIONS** (things the agent can do): tool, capability, function, skill, action, method, command
- **IDENTITY** (who the agent is): id, uuid, name, identifier, agentId, agent_name, displayName
- **STATE** (what the agent remembers): memory, context, state, history, knowledge, working_set
- **COMMUNICATION** (how the agent talks): system_prompt, instructions, persona, voice, style

When you see "tools" in MCP and "capabilities" in A2A, don't think "these are different fields."
Think: "Both belong to the ACTIONS semantic category - they represent what the agent can do."

Then map by category meaning:
- Source field → Identify its semantic category → Find target field(s) in same category → Map

## Principle 2: Preserve All Information

- Never drop fields - if a target protocol lacks an equivalent, use an extension mechanism:
  - Store in "_extensions", "metadata", "additionalProperties", or similar
  - Document what was preserved and where
- Round-trip preservation: source → target → source should be lossless

## Principle 3: Structural Transformation

- Flat ↔ Nested: If source has \`agent.identity.name\` and target wants \`name\`, flatten appropriately
- Array ↔ Object: Some protocols use arrays, others use keyed objects - transform bidirectionally
- Type coercion: String IDs may need to become URIs or vice versa

## Principle 4: Required Fields

- Always ensure target protocol's REQUIRED fields are populated
- Use reasonable defaults if source lacks the data:
  - IDs: Generate UUID if missing
  - Timestamps: Use current time
  - Versions: Use "1.0.0" or "unknown"
  - Names: Use a descriptive placeholder like "Unnamed Agent"

## Principle 5: Capability Mapping

Agent capabilities/tools/functions are the most complex mapping. Map by:

| Source Concept | Equivalent Target Concepts |
|----------------|---------------------------|
| tool | capability, function, skill, action, method |
| input_schema | parameters, args, inputSchema, arguments |
| description | help, summary, doc, documentation |
| returns | output, result, outputSchema, response |

## Principle 6: Memory/Context Mapping

| Source Concept | Equivalent Target Concepts |
|----------------|---------------------------|
| memory | context, state, history, knowledge |
| episodic | events, logs, history |
| semantic | facts, knowledge_base, learned |
| short_term | working_memory, buffer, cache |
| long_term | persistent, stored, archived |

## Principle 7: Identity Mapping

| Source Concept | Equivalent Target Concepts |
|----------------|---------------------------|
| id | identifier, uuid, agentId, agent_id |
| name | title, label, displayName, agent_name |
| version | schema_version, api_version, ver |
| created | createdAt, created_at, timestamp, birthdate |

## Principle 8: Communication Style

| Source Concept | Equivalent Target Concepts |
|----------------|---------------------------|
| system_prompt | instructions, system_message, persona |
| personality | traits, characteristics, style |
| voice | tone, communication_style, manner |
`;

// ============================================================================
// Translation Prompt Builder
// ============================================================================

/**
 * Build a complete translation prompt
 * 
 * This combines:
 * 1. Mapping principles (how to translate)
 * 2. Source protocol spec (what we're translating from)
 * 3. Target protocol spec (what we're translating to)
 * 4. Agent data (what to translate)
 */
export function buildTranslationPrompt(
  agent: Record<string, unknown>,
  sourceProtocol: string,
  targetProtocol: string,
  sourceSpec: string,
  targetSpec: string
): string {
  return `
${MAPPING_PRINCIPLES_PROMPT}

---

# Translation Task

Translate the following agent from **${sourceProtocol}** format to **${targetProtocol}** format.

## Source Protocol Specification (${sourceProtocol})

\`\`\`json
${sourceSpec}
\`\`\`

## Target Protocol Specification (${targetProtocol})

\`\`\`json
${targetSpec}
\`\`\`

## Agent to Translate

\`\`\`json
${JSON.stringify(agent, null, 2)}
\`\`\`

---

## Response Format

Return a JSON object with exactly this structure:

\`\`\`json
{
  "translatedAgent": {
    // The agent in ${targetProtocol} format
  },
  "confidence": 0.95,  // Your confidence in the translation (0-1)
  "fieldMappings": [
    // List of how each field was mapped
    {"source": "source.path", "target": "target.path", "notes": "explanation"}
  ],
  "unmappedFields": [
    // Fields from source that couldn't be directly mapped (stored in extensions)
  ],
  "warnings": [
    // Any issues or concerns about the translation
  ]
}
\`\`\`

## Important

1. The translatedAgent MUST be valid according to the target protocol specification
2. Preserve ALL data - use extensions/metadata for unmappable fields
3. Generate required fields if missing from source
4. Return ONLY the JSON response, no additional text
`;
}

// ============================================================================
// Specialized Prompt Templates
// ============================================================================

/**
 * Prompt for validating an agent against a protocol spec
 */
export function buildValidationPrompt(
  agent: Record<string, unknown>,
  protocol: string,
  spec: string
): string {
  return `
# Agent Validation Task

Validate the following agent data against the ${protocol} protocol specification.

## Protocol Specification

\`\`\`json
${spec}
\`\`\`

## Agent Data

\`\`\`json
${JSON.stringify(agent, null, 2)}
\`\`\`

## Response Format

Return a JSON object:

\`\`\`json
{
  "valid": true,  // or false
  "errors": [
    // List of validation errors (empty if valid)
    {"path": "field.path", "error": "description of error", "expected": "what was expected"}
  ],
  "warnings": [
    // Non-fatal issues
    {"path": "field.path", "warning": "description"}
  ],
  "suggestions": [
    // Improvements that could be made
  ]
}
\`\`\`
`;
}

/**
 * Prompt for discovering protocol capabilities
 */
export function buildCapabilityDiscoveryPrompt(
  protocol: string,
  spec: string
): string {
  return `
# Protocol Capability Discovery

Analyze the ${protocol} protocol specification and extract its capabilities.

## Protocol Specification

\`\`\`json
${spec}
\`\`\`

## Response Format

Return a JSON object:

\`\`\`json
{
  "protocol": "${protocol}",
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
  "requiredFields": [
    // List of required fields in agent definition
  ],
  "optionalFields": [
    // List of optional fields
  ],
  "extensionMechanism": "how to store extra fields (e.g., 'metadata', '_extensions')",
  "notes": "any important observations about this protocol"
}
\`\`\`
`;
}

/**
 * Prompt for generating field mappings between two protocols
 */
export function buildFieldMappingPrompt(
  sourceProtocol: string,
  targetProtocol: string,
  sourceSpec: string,
  targetSpec: string
): string {
  return `
# Protocol Field Mapping Generation

Generate a comprehensive field mapping between ${sourceProtocol} and ${targetProtocol}.

## Source Protocol (${sourceProtocol}) Specification

\`\`\`json
${sourceSpec}
\`\`\`

## Target Protocol (${targetProtocol}) Specification

\`\`\`json
${targetSpec}
\`\`\`

${MAPPING_PRINCIPLES_PROMPT}

## Response Format

Return a JSON object with field mappings:

\`\`\`json
{
  "sourceProtocol": "${sourceProtocol}",
  "targetProtocol": "${targetProtocol}",
  "mappings": [
    {
      "source": "source.field.path",
      "target": "target.field.path",
      "transform": "none|rename|restructure|typeCoerce",
      "bidirectional": true,
      "confidence": 0.95,
      "notes": "explanation of mapping"
    }
  ],
  "sourceOnlyFields": [
    // Fields in source with no target equivalent (need extension storage)
  ],
  "targetOnlyFields": [
    // Required target fields with no source equivalent (need defaults)
  ],
  "complexMappings": [
    // Mappings that require special handling
    {
      "description": "what needs special handling",
      "sourceFields": ["field1", "field2"],
      "targetFields": ["combined.field"],
      "logic": "description of transformation logic"
    }
  ]
}
\`\`\`
`;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  MAPPING_PRINCIPLES_PROMPT,
  buildTranslationPrompt,
  buildValidationPrompt,
  buildCapabilityDiscoveryPrompt,
  buildFieldMappingPrompt
};
