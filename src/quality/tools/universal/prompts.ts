/**
 * Universal Quality Tool Prompts
 *
 * Prompt templates for LLM-based tool output interpretation.
 *
 * The LLM acts as a flexible parser that can:
 * - Understand any tool's output format using registry hints
 * - Normalize issues to a common structure
 * - Handle edge cases and malformed output gracefully
 *
 * @module quality/tools/universal/prompts
 * @version 1.0.0
 */

import { QualityToolEntry, TOOL_CATEGORIES } from './registry';

// ============================================================================
// Output Normalization Principles
// ============================================================================

export const OUTPUT_PARSING_PRINCIPLES = `
## Quality Tool Output Parsing Rules

### Rule 1: NORMALIZE TO COMMON STRUCTURE
All tool outputs must be normalized to:
{
  "issues": [
    {
      "file": "path/to/file.py",
      "line": 42,
      "column": 8,
      "severity": "error|warning|info",
      "message": "Human-readable issue description",
      "code": "TOOL_CODE",
      "tool": "tool-name",
      "category": "LINT|FORMAT|TYPE_CHECK|SECURITY"
    }
  ],
  "summary": {
    "totalIssues": 5,
    "byCategory": { "error": 2, "warning": 2, "info": 1 },
    "byFile": { "file.py": 3, "other.py": 2 }
  }
}

### Rule 2: SEVERITY MAPPING
Map tool-specific severities to standard levels:
- "error": Must be fixed (blocks CI, type errors, security critical)
- "warning": Should be fixed (style issues, medium security)
- "info": Nice to have (refactoring suggestions, notes)

### Rule 3: HANDLE MALFORMED OUTPUT
If output is malformed or unexpected:
- Extract what you can
- Set "parseError" field with explanation
- Return partial results rather than failing

### Rule 4: PRESERVE CONTEXT
- Keep original tool code (e.g., "E501", "TS2322")
- Include tool name in each issue
- Map to semantic category
`;

// ============================================================================
// Prompt Builders
// ============================================================================

/**
 * Build prompt to parse tool output
 */
export function buildOutputParsePrompt(
  tool: QualityToolEntry,
  rawOutput: string,
  exitCode: number
): string {
  const categoryInfo = TOOL_CATEGORIES[tool.category];

  return `
${OUTPUT_PARSING_PRINCIPLES}

---
# Parse Tool Output: ${tool.name}

## Tool Specification
- **Name**: ${tool.name} (${tool.id})
- **Language**: ${tool.language}
- **Category**: ${tool.category} - ${categoryInfo.description}
- **Output Format**: ${tool.output.format}
- **Exit Code**: ${exitCode}

## Tool-Specific Hints
${tool.hints}

## Severity Mapping
${Object.entries(tool.severityMap)
  .map(([from, to]) => `- "${from}" → "${to}"`)
  .join('\n')}

${tool.output.fieldMappings ? `
## JSON Field Mappings
${Object.entries(tool.output.fieldMappings)
  .map(([field, path]) => `- ${field}: ${path}`)
  .join('\n')}
` : ''}

${tool.output.textPattern ? `
## Text Pattern
Regex: \`${tool.output.textPattern}\`
Groups: file, line, column, severity, message
` : ''}

---
## Raw Output to Parse

\`\`\`
${rawOutput}
\`\`\`

---
## Response Format (JSON only)

\`\`\`json
{
  "success": true,
  "issues": [
    {
      "file": "path/to/file",
      "line": 1,
      "column": 1,
      "severity": "error|warning|info",
      "message": "issue description",
      "code": "TOOL_CODE",
      "tool": "${tool.id}",
      "category": "${tool.category}"
    }
  ],
  "summary": {
    "totalIssues": 0,
    "byCategory": {},
    "byFile": {}
  },
  "parseError": null
}
\`\`\`

Return ONLY valid JSON. No explanation text.
`;
}

/**
 * Build prompt to aggregate results from multiple tools
 */
export function buildAggregationPrompt(
  toolResults: Array<{ tool: string; issues: unknown[] }>
): string {
  return `
${OUTPUT_PARSING_PRINCIPLES}

---
# Aggregate Quality Results

## Input: Results from ${toolResults.length} tools

${toolResults.map(r => `
### ${r.tool}
\`\`\`json
${JSON.stringify(r.issues, null, 2)}
\`\`\`
`).join('\n')}

---
## Task

1. **Deduplicate**: Same file+line+message from different tools = 1 issue
2. **Prioritize**: Keep highest severity when deduplicating
3. **Categorize**: Group by file, then by severity
4. **Summarize**: Overall health score (0-100)

---
## Response Format (JSON only)

\`\`\`json
{
  "aggregatedIssues": [
    {
      "file": "path/to/file",
      "line": 1,
      "severity": "error",
      "message": "description",
      "tools": ["tool1", "tool2"],
      "category": "LINT"
    }
  ],
  "byFile": {
    "file.py": {
      "errors": 2,
      "warnings": 1,
      "issues": [...]
    }
  },
  "healthScore": 75,
  "summary": {
    "totalIssues": 10,
    "criticalFiles": ["file.py"],
    "topCategories": ["LINT", "TYPE_CHECK"]
  }
}
\`\`\`
`;
}

/**
 * Build prompt to suggest fixes
 */
export function buildFixSuggestionPrompt(
  tool: QualityToolEntry,
  issues: Array<{ file: string; line: number; code: string; message: string }>,
  fileContent?: string
): string {
  return `
# Suggest Fixes: ${tool.name} Issues

## Tool Information
- **Tool**: ${tool.name}
- **Category**: ${tool.category}
- **Docs**: ${tool.docsUrl}

## Issues to Fix

${issues.map((issue, i) => `
### Issue ${i + 1}: ${issue.code}
- **File**: ${issue.file}:${issue.line}
- **Message**: ${issue.message}
`).join('\n')}

${fileContent ? `
## Relevant File Content

\`\`\`
${fileContent}
\`\`\`
` : ''}

---
## Response Format (JSON only)

\`\`\`json
{
  "fixes": [
    {
      "issueCode": "CODE",
      "suggestion": "How to fix this issue",
      "autoFixable": true,
      "command": "command to auto-fix if applicable",
      "manualSteps": ["step 1", "step 2"]
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
  OUTPUT_PARSING_PRINCIPLES,
  buildOutputParsePrompt,
  buildAggregationPrompt,
  buildFixSuggestionPrompt,
};
