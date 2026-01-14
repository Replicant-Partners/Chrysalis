/**
 * Built-in Code Templates for Adapter Modifications
 * 
 * @module ai-maintenance/adapter-modification-generator/templates
 */

import { CodeTemplate } from './types';

/**
 * Built-in code templates for common modifications
 */
export const CODE_TEMPLATES: CodeTemplate[] = [
  {
    templateId: 'version-compatibility-check',
    name: 'Version Compatibility Check',
    description: 'Add version checking before API calls',
    targetPattern: 'PATTERN_EXTERNAL_DEPENDENCY_UPDATE',
    template: `
// Version compatibility check for {{apiName}}
const minVersion = '{{minVersion}}';
const currentVersion = this.getProtocolVersion();
if (semver.lt(currentVersion, minVersion)) {
  throw new ProtocolVersionError(
    \`{{apiName}} requires version >= \${minVersion}, got \${currentVersion}\`
  );
}
`,
    variables: [
      { name: 'apiName', type: 'string', description: 'API method name', required: true },
      { name: 'minVersion', type: 'string', description: 'Minimum required version', required: true },
    ],
  },
  {
    templateId: 'deprecated-api-wrapper',
    name: 'Deprecated API Wrapper',
    description: 'Wrap deprecated API with warning and migration path',
    targetPattern: 'PATTERN_API_DEPRECATION_CASCADE',
    template: `
/**
 * @deprecated {{deprecationMessage}}
 * @see {{replacementApi}}
 */
async {{methodName}}({{parameters}}): Promise<{{returnType}}> {
  console.warn(
    'Warning: {{methodName}} is deprecated and will be removed in {{removalVersion}}. ' +
    'Please use {{replacementApi}} instead.'
  );
  {{#if hasReplacement}}
  return this.{{replacementApi}}({{mappedParams}});
  {{else}}
  {{originalImplementation}}
  {{/if}}
}
`,
    variables: [
      { name: 'methodName', type: 'string', description: 'Method name', required: true },
      { name: 'deprecationMessage', type: 'string', description: 'Deprecation message', required: true },
      { name: 'replacementApi', type: 'string', description: 'Replacement API', required: false },
      { name: 'parameters', type: 'string', description: 'Method parameters', required: true },
      { name: 'returnType', type: 'string', description: 'Return type', required: true },
      { name: 'removalVersion', type: 'string', description: 'Version when removed', required: false, default: 'a future version' },
    ],
  },
  {
    templateId: 'schema-migration-transform',
    name: 'Schema Migration Transform',
    description: 'Add data transformation for schema changes',
    targetPattern: 'PATTERN_SCHEMA_MIGRATION',
    template: `
/**
 * Transform data from schema v{{oldVersion}} to v{{newVersion}}
 */
private transformSchemaV{{oldVersion}}ToV{{newVersion}}(data: SchemaV{{oldVersion}}): SchemaV{{newVersion}} {
  return {
    ...data,
    {{#each fieldMappings}}
    {{newField}}: {{#if transform}}{{transform}}(data.{{oldField}}){{else}}data.{{oldField}}{{/if}},
    {{/each}}
    {{#each newFields}}
    {{name}}: {{defaultValue}},
    {{/each}}
  };
}
`,
    variables: [
      { name: 'oldVersion', type: 'string', description: 'Old schema version', required: true },
      { name: 'newVersion', type: 'string', description: 'New schema version', required: true },
      { name: 'fieldMappings', type: 'array', description: 'Field mappings', required: true },
      { name: 'newFields', type: 'array', description: 'New required fields', required: false, default: [] },
    ],
  },
  {
    templateId: 'capability-check-guard',
    name: 'Capability Check Guard',
    description: 'Add runtime capability checking',
    targetPattern: 'PATTERN_PROTOCOL_EXTENSION',
    template: `
/**
 * Check if {{capabilityName}} capability is supported
 */
private hasCapability(capability: '{{capabilityName}}'): boolean {
  return this.capabilities.includes(capability);
}

/**
 * {{methodName}} with capability guard
 */
async {{methodName}}({{parameters}}): Promise<{{returnType}}> {
  if (!this.hasCapability('{{capabilityName}}')) {
    throw new CapabilityNotSupportedError(
      '{{capabilityName}} is not supported by this protocol version'
    );
  }
  {{implementation}}
}
`,
    variables: [
      { name: 'capabilityName', type: 'string', description: 'Capability identifier', required: true },
      { name: 'methodName', type: 'string', description: 'Method name', required: true },
      { name: 'parameters', type: 'string', description: 'Method parameters', required: true },
      { name: 'returnType', type: 'string', description: 'Return type', required: true },
    ],
  },
  {
    templateId: 'error-handling-wrapper',
    name: 'Error Handling Wrapper',
    description: 'Add comprehensive error handling',
    targetPattern: 'PATTERN_PERFORMANCE_DEGRADATION',
    template: `
/**
 * {{methodName}} with error handling and retry
 */
async {{methodName}}WithRetry(
  {{parameters}},
  options: { maxRetries?: number; timeoutMs?: number } = {}
): Promise<{{returnType}}> {
  const { maxRetries = 3, timeoutMs = {{defaultTimeout}} } = options;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const result = await this.{{methodName}}({{paramNames}});
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      if (attempt === maxRetries) {
        throw new RetryExhaustedError(
          \`{{methodName}} failed after \${maxRetries} attempts\`,
          { cause: error }
        );
      }
      await this.delay(Math.pow(2, attempt) * 1000); // Exponential backoff
    }
  }
  throw new Error('Unreachable');
}

private delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
`,
    variables: [
      { name: 'methodName', type: 'string', description: 'Method name', required: true },
      { name: 'parameters', type: 'string', description: 'Method parameters', required: true },
      { name: 'paramNames', type: 'string', description: 'Parameter names only', required: true },
      { name: 'returnType', type: 'string', description: 'Return type', required: true },
      { name: 'defaultTimeout', type: 'number', description: 'Default timeout', required: false, default: 30000 },
    ],
  },
];
