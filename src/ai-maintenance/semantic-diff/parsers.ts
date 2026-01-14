/**
 * Parsing functions for Semantic Diff Analysis
 */

import type {
  APISignature,
  ParameterSignature,
  SchemaDefinition,
  SchemaField,
  FileContentChange,
  SemanticDiffConfig,
} from './types';

/**
 * Parse APIs from file content
 */
export function parseAPIsFromContent(content: string, filePath: string): APISignature[] {
  const apis: APISignature[] = [];

  const exportFunctionRegex =
    /export\s+(async\s+)?function\s+(\w+)\s*(<[^>]+>)?\s*\(([^)]*)\)\s*:\s*([^{;]+)/g;
  let match;
  while ((match = exportFunctionRegex.exec(content)) !== null) {
    const [, , name, , params, returnType] = match;
    apis.push({
      name,
      parameters: parseParameters(params),
      returnType: returnType.trim(),
    });
  }

  const methodRegex = /(?:public|async|static|\s)+(\w+)\s*(<[^>]+>)?\s*\(([^)]*)\)\s*:\s*([^{;]+)/g;
  while ((match = methodRegex.exec(content)) !== null) {
    const [, name, , params, returnType] = match;
    if (!['constructor', 'if', 'for', 'while', 'switch'].includes(name)) {
      apis.push({
        name,
        parameters: parseParameters(params),
        returnType: returnType.trim(),
      });
    }
  }

  if (filePath.includes('openapi') || filePath.includes('swagger')) {
    try {
      const spec = JSON.parse(content);
      if (spec.paths) {
        for (const [path, methods] of Object.entries(spec.paths)) {
          for (const [method, def] of Object.entries(methods as Record<string, unknown>)) {
            const definition = def as {
              operationId?: string;
              parameters?: unknown[];
              deprecated?: boolean;
            };
            if (definition.operationId) {
              apis.push({
                name: definition.operationId,
                path,
                method: method.toUpperCase(),
                parameters: parseOpenAPIParameters(definition.parameters || []),
                deprecated: definition.deprecated,
              });
            }
          }
        }
      }
    } catch {
      // Not valid JSON, skip
    }
  }

  return apis;
}

/**
 * Parse TypeScript parameter string into ParameterSignature array
 */
export function parseParameters(paramString: string): ParameterSignature[] {
  if (!paramString.trim()) return [];

  const params: ParameterSignature[] = [];
  const paramParts = paramString.split(',');

  for (const part of paramParts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/(\w+)\??:\s*([^=]+)(?:=\s*(.+))?/);
    if (match) {
      const [, name, type, defaultValue] = match;
      params.push({
        name,
        type: type.trim(),
        required: !trimmed.includes('?'),
        default: defaultValue?.trim(),
      });
    }
  }

  return params;
}

/**
 * Parse OpenAPI parameters into ParameterSignature array
 */
export function parseOpenAPIParameters(params: unknown[]): ParameterSignature[] {
  return params.map((p: unknown) => {
    const param = p as {
      name: string;
      schema?: { type: string };
      required?: boolean;
      default?: unknown;
    };
    return {
      name: param.name,
      type: param.schema?.type || 'unknown',
      required: param.required || false,
      default: param.default,
    };
  });
}

/**
 * Parse schema from file content
 */
export function parseSchema(content: string, filePath: string): SchemaDefinition {
  const schema: SchemaDefinition = {
    name: filePath,
    version: '1.0.0',
    fields: [],
    required: [],
  };

  if (filePath.endsWith('.json')) {
    try {
      const parsed = JSON.parse(content);
      if (parsed.properties) {
        schema.fields = extractSchemaFields(parsed.properties);
        schema.required = parsed.required || [];
      }
    } catch {
      // Invalid JSON
    }
  }

  const interfaceRegex = /interface\s+(\w+)\s*{([^}]+)}/g;
  let match;
  while ((match = interfaceRegex.exec(content)) !== null) {
    const [, name, body] = match;
    schema.name = name;
    schema.fields.push(...parseTypeScriptFields(body));
  }

  return schema;
}

/**
 * Extract schema fields from JSON Schema properties
 */
export function extractSchemaFields(properties: Record<string, unknown>): SchemaField[] {
  return Object.entries(properties).map(([name, def]) => {
    const definition = def as { type?: string; nullable?: boolean; enum?: string[] };
    return {
      name,
      type: definition.type || 'unknown',
      nullable: definition.nullable,
      enum: definition.enum,
    };
  });
}

/**
 * Parse TypeScript interface body into SchemaField array
 */
export function parseTypeScriptFields(body: string): SchemaField[] {
  const fields: SchemaField[] = [];
  const fieldRegex = /(\w+)\??:\s*([^;]+);/g;
  let match;
  while ((match = fieldRegex.exec(body)) !== null) {
    const [fullMatch, name, type] = match;
    fields.push({
      name,
      type: type.trim(),
      nullable: fullMatch.includes('?'),
    });
  }
  return fields;
}

/**
 * Create file changes from paths (placeholder implementation)
 */
export function createFileChangesFromPaths(paths: string[]): FileContentChange[] {
  return paths.map((path) => ({
    path,
    before: undefined,
    after: undefined,
  }));
}

/**
 * Check if a file should be ignored based on config patterns
 */
export function shouldIgnoreFile(path: string, ignorePatterns: string[]): boolean {
  return ignorePatterns.some((pattern) => {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return regex.test(path);
  });
}

/**
 * Check if a file is API-related
 */
export function isAPIRelatedFile(path: string): boolean {
  const apiPatterns = [/\.ts$/, /\.js$/, /\.py$/, /openapi\./, /swagger\./, /api\./, /schema\./];
  return apiPatterns.some((p) => p.test(path));
}

/**
 * Check if a file is a schema file
 */
export function isSchemaFile(path: string): boolean {
  const schemaPatterns = [
    /schema\.json$/,
    /schema\.yaml$/,
    /\.schema\./,
    /types\.ts$/,
    /models\.ts$/,
    /\.proto$/,
  ];
  return schemaPatterns.some((p) => p.test(path));
}

/**
 * Default semantic diff config
 */
export function getDefaultConfig(overrides: Partial<SemanticDiffConfig> = {}): SemanticDiffConfig {
  return {
    strictMode: true,
    detectBehavioralChanges: true,
    includeDocumentationChanges: false,
    ignorePatterns: ['*.test.*', '*.spec.*', '**/test/**', '**/tests/**'],
    breakingChangeThreshold: 0.7,
    ...overrides,
  };
}
