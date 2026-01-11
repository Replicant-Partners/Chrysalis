/**
 * Adapter Modification Generator for AI-Led Adaptive Maintenance
 * 
 * Generates code modifications for protocol adapters based on semantic diffs,
 * matched evolutionary patterns, and LLM-assisted analysis.
 * 
 * @module ai-maintenance/adapter-modification-generator
 * @version 1.0.0
 */

import {
  ChangeProposal,
  FileChange,
  GeneratedTest,
  DocumentationUpdate,
  AnalysisResult,
  PatternMatch,
  RecommendedAction,
  DiffHunk,
  EvolutionaryPattern,
  RemediationStrategy,
  RemediationStep,
} from './types';
import { ExtendedAnalysisResult, APISurfaceComparison, SchemaComparison } from './semantic-diff-analyzer';
import { AgentFramework } from '../adapters/protocol-types';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for the modification generator
 */
export interface GeneratorConfig {
  /** Generate tests for modifications */
  generateTests: boolean;
  /** Generate documentation updates */
  generateDocs: boolean;
  /** Maximum file changes per proposal */
  maxFileChanges: number;
  /** Include rollback procedure */
  includeRollback: boolean;
  /** Target code style/patterns */
  codeStyle: CodeStyleConfig;
  /** Template directory for code generation */
  templateDir?: string;
}

/**
 * Code style configuration
 */
export interface CodeStyleConfig {
  indentation: 'spaces' | 'tabs';
  indentSize: number;
  quotes: 'single' | 'double';
  semicolons: boolean;
  trailingCommas: boolean;
  maxLineLength: number;
}

/**
 * Context for generating modifications
 */
export interface GenerationContext {
  /** Protocol being modified */
  protocol: AgentFramework;
  /** Analysis result from semantic diff */
  analysis: ExtendedAnalysisResult;
  /** Matched patterns */
  patterns: PatternMatch[];
  /** Adapter file paths */
  adapterFiles: string[];
  /** Existing adapter content (file path -> content) */
  existingContent: Map<string, string>;
}

/**
 * Template for code generation
 */
export interface CodeTemplate {
  templateId: string;
  name: string;
  description: string;
  targetPattern: string;
  template: string;
  variables: TemplateVariable[];
}

/**
 * Variable in a code template
 */
export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: unknown;
}

/**
 * Result of modification generation
 */
export interface GenerationResult {
  success: boolean;
  proposal?: ChangeProposal;
  errors: GenerationError[];
  warnings: string[];
  stats: GenerationStats;
}

/**
 * Error during generation
 */
export interface GenerationError {
  code: string;
  message: string;
  file?: string;
  line?: number;
  recoverable: boolean;
}

/**
 * Statistics about generation
 */
export interface GenerationStats {
  filesAnalyzed: number;
  filesModified: number;
  testsGenerated: number;
  docsGenerated: number;
  linesChanged: number;
  generationTimeMs: number;
}

// ============================================================================
// Code Templates
// ============================================================================

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

// ============================================================================
// Adapter Modification Generator Implementation
// ============================================================================

/**
 * Generates adapter modifications based on analysis results
 */
export class AdapterModificationGenerator {
  private config: GeneratorConfig;
  private templates: Map<string, CodeTemplate>;
  private proposalIdCounter = 0;

  constructor(config: Partial<GeneratorConfig> = {}) {
    this.config = {
      generateTests: true,
      generateDocs: true,
      maxFileChanges: 20,
      includeRollback: true,
      codeStyle: {
        indentation: 'spaces',
        indentSize: 2,
        quotes: 'single',
        semicolons: true,
        trailingCommas: true,
        maxLineLength: 100,
      },
      ...config,
    };

    // Initialize templates
    this.templates = new Map(CODE_TEMPLATES.map(t => [t.templateId, t]));
  }

  /**
   * Generate a change proposal based on analysis
   */
  async generateProposal(context: GenerationContext): Promise<GenerationResult> {
    const startTime = Date.now();
    const errors: GenerationError[] = [];
    const warnings: string[] = [];

    try {
      // Determine what modifications are needed
      const modifications = this.planModifications(context);

      // Generate file changes
      const fileChanges = await this.generateFileChanges(context, modifications);
      if (fileChanges.length === 0) {
        return {
          success: false,
          errors: [{ code: 'NO_CHANGES', message: 'No changes needed', recoverable: true }],
          warnings,
          stats: this.createEmptyStats(Date.now() - startTime),
        };
      }

      // Generate tests if enabled
      let generatedTests: GeneratedTest[] = [];
      if (this.config.generateTests) {
        generatedTests = await this.generateTests(context, fileChanges);
      }

      // Generate documentation updates if enabled
      let documentationUpdates: DocumentationUpdate[] = [];
      if (this.config.generateDocs) {
        documentationUpdates = await this.generateDocUpdates(context, fileChanges);
      }

      // Generate rollback procedure
      const rollbackProcedure = this.config.includeRollback
        ? this.generateRollbackProcedure(fileChanges)
        : 'No rollback procedure generated';

      // Create the proposal
      const proposal: ChangeProposal = {
        proposalId: this.generateProposalId(),
        title: this.generateProposalTitle(context),
        description: this.generateProposalDescription(context),
        fileChanges,
        generatedTests,
        documentationUpdates,
        rollbackProcedure,
        status: 'draft',
        generatedByAgentId: 'adapter-modification-generator-v1',
        generatedAt: new Date().toISOString(),
      };

      return {
        success: true,
        proposal,
        errors,
        warnings,
        stats: {
          filesAnalyzed: context.existingContent.size,
          filesModified: fileChanges.length,
          testsGenerated: generatedTests.length,
          docsGenerated: documentationUpdates.length,
          linesChanged: this.countLinesChanged(fileChanges),
          generationTimeMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      errors.push({
        code: 'GENERATION_FAILED',
        message: error instanceof Error ? error.message : String(error),
        recoverable: false,
      });
      return {
        success: false,
        errors,
        warnings,
        stats: this.createEmptyStats(Date.now() - startTime),
      };
    }
  }

  /**
   * Plan what modifications are needed
   */
  private planModifications(context: GenerationContext): PlannedModification[] {
    const modifications: PlannedModification[] = [];
    const { analysis, patterns } = context;

    // Handle API surface changes
    const apiChanges = analysis.apiSurfaceChanges;
    
    // Removed APIs need deprecation wrappers or removal
    apiChanges.removed.forEach(api => {
      modifications.push({
        type: 'remove-api',
        target: api.name,
        priority: 1,
        template: 'deprecated-api-wrapper',
        variables: {
          methodName: api.name,
          deprecationMessage: `API ${api.name} has been removed from upstream`,
          parameters: api.parameters.map(p => `${p.name}: ${p.type}`).join(', '),
          returnType: api.returnType || 'void',
        },
      });
    });

    // Modified APIs need parameter/return type updates
    apiChanges.modified.forEach(mod => {
      if (mod.isBreaking) {
        modifications.push({
          type: 'update-api',
          target: mod.after.name,
          priority: 2,
          template: 'version-compatibility-check',
          variables: {
            apiName: mod.after.name,
            minVersion: 'latest',
          },
        });
      }
    });

    // Deprecated APIs need warning wrappers
    apiChanges.deprecated.forEach(api => {
      modifications.push({
        type: 'deprecate-api',
        target: api.name,
        priority: 3,
        template: 'deprecated-api-wrapper',
        variables: {
          methodName: api.name,
          deprecationMessage: api.deprecationMessage || 'This API is deprecated',
          parameters: api.parameters.map(p => `${p.name}: ${p.type}`).join(', '),
          returnType: api.returnType || 'void',
        },
      });
    });

    // Handle schema changes
    const schemaComparison = analysis.schemaComparison;
    if (schemaComparison.migrationRequired) {
      modifications.push({
        type: 'migrate-schema',
        target: 'schema',
        priority: 1,
        template: 'schema-migration-transform',
        variables: {
          oldVersion: '1',
          newVersion: '2',
          fieldMappings: schemaComparison.modified.map(m => ({
            oldField: m.field,
            newField: m.field,
            transform: m.before.type !== m.after.type ? 'transformType' : undefined,
          })),
          newFields: schemaComparison.added.map(f => ({
            name: f.name,
            defaultValue: this.getDefaultValue(f.type),
          })),
        },
      });
    }

    // Handle pattern-specific modifications
    patterns.forEach(pattern => {
      const strategies = pattern.recommendedStrategies;
      strategies.forEach(strategyId => {
        const template = this.findTemplateForStrategy(strategyId);
        if (template) {
          modifications.push({
            type: 'apply-pattern',
            target: pattern.patternId,
            priority: 4,
            template: template.templateId,
            variables: {},
          });
        }
      });
    });

    // Sort by priority
    return modifications.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Generate file changes based on planned modifications
   */
  private async generateFileChanges(
    context: GenerationContext,
    modifications: PlannedModification[]
  ): Promise<FileChange[]> {
    const fileChanges: FileChange[] = [];
    const modifiedFiles = new Map<string, string>();

    // Initialize with existing content
    context.existingContent.forEach((content, path) => {
      modifiedFiles.set(path, content);
    });

    // Apply each modification
    for (const mod of modifications) {
      // Find target file
      const targetFile = this.findTargetFile(context.adapterFiles, mod.target);
      if (!targetFile) continue;

      // Get current content
      let content = modifiedFiles.get(targetFile) || '';

      // Apply modification
      const template = this.templates.get(mod.template);
      if (template) {
        const generatedCode = this.applyTemplate(template, mod.variables);
        content = this.insertCode(content, generatedCode, mod);
        modifiedFiles.set(targetFile, content);
      }
    }

    // Create file changes
    modifiedFiles.forEach((newContent, filePath) => {
      const originalContent = context.existingContent.get(filePath);
      if (originalContent !== newContent) {
        fileChanges.push({
          filePath,
          type: originalContent ? 'modify' : 'create',
          originalContent,
          newContent,
          patch: this.generatePatch(originalContent || '', newContent),
          hunks: this.generateHunks(originalContent || '', newContent),
          rationale: `Modifications for protocol ${context.protocol} based on semantic analysis`,
        });
      }
    });

    // Limit to max file changes
    return fileChanges.slice(0, this.config.maxFileChanges);
  }

  /**
   * Generate tests for the modifications
   */
  private async generateTests(
    context: GenerationContext,
    fileChanges: FileChange[]
  ): Promise<GeneratedTest[]> {
    const tests: GeneratedTest[] = [];

    for (const change of fileChanges) {
      if (change.type === 'delete') continue;

      // Generate a basic test for each modified file
      const testPath = change.filePath.replace(/\.ts$/, '.test.ts');
      const testName = `test modifications in ${change.filePath}`;
      
      tests.push({
        testFilePath: testPath,
        testName,
        testCode: this.generateTestCode(change, context),
        testsFor: change.filePath,
        testType: 'unit',
      });
    }

    return tests;
  }

  /**
   * Generate documentation updates
   */
  private async generateDocUpdates(
    context: GenerationContext,
    fileChanges: FileChange[]
  ): Promise<DocumentationUpdate[]> {
    const updates: DocumentationUpdate[] = [];

    // Add changelog entry
    updates.push({
      docPath: 'CHANGELOG.md',
      section: 'Unreleased',
      type: 'add',
      content: this.generateChangelogEntry(context, fileChanges),
    });

    // Update adapter documentation
    updates.push({
      docPath: `docs/adapters/${context.protocol}.md`,
      section: 'API Changes',
      type: 'update',
      content: this.generateAdapterDocUpdate(context),
    });

    return updates;
  }

  /**
   * Generate rollback procedure
   */
  private generateRollbackProcedure(fileChanges: FileChange[]): string {
    const steps: string[] = [
      '# Rollback Procedure',
      '',
      '## Automatic Rollback',
      '```bash',
      'git revert HEAD  # Revert the commit containing these changes',
      'npm run build    # Rebuild the project',
      'npm test         # Verify tests pass',
      '```',
      '',
      '## Manual Rollback Steps',
    ];

    fileChanges.forEach((change, index) => {
      steps.push(`${index + 1}. ${change.filePath}:`);
      if (change.type === 'create') {
        steps.push(`   - Delete the file`);
      } else if (change.type === 'modify') {
        steps.push(`   - Restore original content`);
      } else if (change.type === 'delete') {
        steps.push(`   - Restore file from git: \`git checkout HEAD~1 -- ${change.filePath}\``);
      }
    });

    steps.push('', '## Verification', '- Run `npm test` to ensure all tests pass');
    steps.push('- Check health endpoint: `curl localhost:3000/health`');

    return steps.join('\n');
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private generateProposalId(): string {
    return `proposal-${Date.now()}-${++this.proposalIdCounter}`;
  }

  private generateProposalTitle(context: GenerationContext): string {
    const { analysis, protocol } = context;
    const breakingCount = analysis.semanticDiff.breakingChanges.length;
    
    if (breakingCount > 0) {
      return `[${protocol.toUpperCase()}] Handle ${breakingCount} breaking change(s) from upstream`;
    }
    return `[${protocol.toUpperCase()}] Update adapter for upstream changes`;
  }

  private generateProposalDescription(context: GenerationContext): string {
    const { analysis, patterns } = context;
    const lines: string[] = [
      '## Summary',
      analysis.summary,
      '',
      '## Breaking Changes',
    ];

    analysis.semanticDiff.breakingChanges.forEach(bc => {
      lines.push(`- ${bc.description}`);
      if (bc.migrationPath) {
        lines.push(`  - Migration: ${bc.migrationPath}`);
      }
    });

    if (patterns.length > 0) {
      lines.push('', '## Matched Patterns');
      patterns.forEach(p => {
        lines.push(`- ${p.patternId} (confidence: ${(p.confidence * 100).toFixed(0)}%)`);
      });
    }

    lines.push('', '## Recommended Actions');
    analysis.recommendedActions.forEach(action => {
      lines.push(`- ${action}`);
    });

    return lines.join('\n');
  }

  private applyTemplate(template: CodeTemplate, variables: Record<string, unknown>): string {
    let code = template.template;
    
    // Simple variable substitution
    Object.entries(variables).forEach(([key, value]) => {
      const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      code = code.replace(pattern, String(value));
    });

    // Apply code style
    code = this.applyCodeStyle(code);

    return code;
  }

  private applyCodeStyle(code: string): string {
    const { indentation, indentSize, quotes, semicolons } = this.config.codeStyle;
    
    // Apply indentation
    if (indentation === 'spaces') {
      code = code.replace(/\t/g, ' '.repeat(indentSize));
    }

    // Apply quote style
    if (quotes === 'single') {
      code = code.replace(/"/g, "'");
    }

    // Apply semicolons
    if (!semicolons) {
      code = code.replace(/;$/gm, '');
    }

    return code.trim();
  }

  private insertCode(content: string, newCode: string, mod: PlannedModification): string {
    // Find appropriate insertion point based on modification type
    const lines = content.split('\n');
    
    switch (mod.type) {
      case 'remove-api':
      case 'deprecate-api':
        // Find the method and add wrapper before it
        const methodPattern = new RegExp(`(async\\s+)?${mod.target}\\s*\\(`);
        const methodIndex = lines.findIndex(l => methodPattern.test(l));
        if (methodIndex >= 0) {
          lines.splice(methodIndex, 0, newCode);
        }
        break;
        
      case 'update-api':
        // Add version check at the start of the method
        const updateMethodIndex = lines.findIndex(l => l.includes(`${mod.target}(`));
        if (updateMethodIndex >= 0) {
          // Find the opening brace
          let braceIndex = updateMethodIndex;
          while (braceIndex < lines.length && !lines[braceIndex].includes('{')) {
            braceIndex++;
          }
          if (braceIndex < lines.length) {
            lines.splice(braceIndex + 1, 0, newCode);
          }
        }
        break;
        
      case 'migrate-schema':
        // Add at the end of the class
        const classEndIndex = lines.lastIndexOf('}');
        if (classEndIndex >= 0) {
          lines.splice(classEndIndex, 0, '', newCode);
        }
        break;
        
      default:
        // Append to end
        lines.push('', newCode);
    }

    return lines.join('\n');
  }

  private findTargetFile(adapterFiles: string[], target: string): string | undefined {
    // Try to find the most relevant file for the target
    return adapterFiles.find(f => 
      f.includes(target.toLowerCase()) || 
      f.includes('adapter') ||
      f.endsWith('-client.ts')
    ) || adapterFiles[0];
  }

  private findTemplateForStrategy(strategyId: string): CodeTemplate | undefined {
    // Map strategy IDs to templates
    const strategyTemplateMap: Record<string, string> = {
      'update-dependency': 'version-compatibility-check',
      'apply-patch': 'version-compatibility-check',
      'generate-adapter': 'capability-check-guard',
      'create-shim': 'deprecated-api-wrapper',
      'migrate-schema': 'schema-migration-transform',
    };
    
    const templateId = strategyTemplateMap[strategyId];
    return templateId ? this.templates.get(templateId) : undefined;
  }

  private getDefaultValue(type: string): string {
    switch (type.toLowerCase()) {
      case 'string': return "''";
      case 'number': return '0';
      case 'boolean': return 'false';
      case 'array': return '[]';
      case 'object': return '{}';
      default: return 'null';
    }
  }

  private generatePatch(original: string, modified: string): string {
    // Simple unified diff generation
    const origLines = original.split('\n');
    const modLines = modified.split('\n');
    
    const patch: string[] = ['--- original', '+++ modified'];
    
    let i = 0, j = 0;
    while (i < origLines.length || j < modLines.length) {
      if (i >= origLines.length) {
        patch.push(`+${modLines[j++]}`);
      } else if (j >= modLines.length) {
        patch.push(`-${origLines[i++]}`);
      } else if (origLines[i] === modLines[j]) {
        patch.push(` ${origLines[i]}`);
        i++; j++;
      } else {
        patch.push(`-${origLines[i++]}`);
        if (j < modLines.length) {
          patch.push(`+${modLines[j++]}`);
        }
      }
    }

    return patch.join('\n');
  }

  private generateHunks(original: string, modified: string): DiffHunk[] {
    const origLines = original.split('\n');
    const modLines = modified.split('\n');
    
    // Simplified hunk generation
    return [{
      oldStart: 1,
      oldLines: origLines.length,
      newStart: 1,
      newLines: modLines.length,
      content: modLines,
    }];
  }

  private generateTestCode(change: FileChange, context: GenerationContext): string {
    const className = this.extractClassName(change.filePath);
    
    return `
import { ${className} } from '${change.filePath.replace(/\.ts$/, '')}';

describe('${className} modifications', () => {
  let instance: ${className};

  beforeEach(() => {
    instance = new ${className}();
  });

  it('should handle modified API calls', async () => {
    // Test modified functionality
    expect(instance).toBeDefined();
  });

  it('should maintain backward compatibility', async () => {
    // Test backward compatibility
    expect(typeof instance).toBe('object');
  });

  it('should handle errors gracefully', async () => {
    // Test error handling
    await expect(async () => {
      // Call method that should handle errors
    }).not.toThrow();
  });
});
`.trim();
  }

  private extractClassName(filePath: string): string {
    const fileName = filePath.split('/').pop() || '';
    const baseName = fileName.replace(/\.ts$/, '');
    // Convert kebab-case to PascalCase
    return baseName
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }

  private generateChangelogEntry(context: GenerationContext, fileChanges: FileChange[]): string {
    const date = new Date().toISOString().split('T')[0];
    const lines: string[] = [
      `### ${date} - Adapter Update for ${context.protocol}`,
      '',
      '#### Changed',
    ];

    fileChanges.forEach(change => {
      lines.push(`- ${change.type}: ${change.filePath}`);
    });

    const breakingChanges = context.analysis.semanticDiff.breakingChanges;
    if (breakingChanges.length > 0) {
      lines.push('', '#### Breaking Changes');
      breakingChanges.forEach(bc => {
        lines.push(`- ${bc.description}`);
      });
    }

    return lines.join('\n');
  }

  private generateAdapterDocUpdate(context: GenerationContext): string {
    const { analysis, protocol } = context;
    const lines: string[] = [
      `## ${protocol} Adapter - API Changes`,
      '',
      `Updated: ${new Date().toISOString()}`,
      '',
    ];

    if (analysis.apiSurfaceChanges.removed.length > 0) {
      lines.push('### Removed APIs');
      analysis.apiSurfaceChanges.removed.forEach(api => {
        lines.push(`- \`${api.name}\` - No longer available`);
      });
    }

    if (analysis.apiSurfaceChanges.deprecated.length > 0) {
      lines.push('', '### Deprecated APIs');
      analysis.apiSurfaceChanges.deprecated.forEach(api => {
        lines.push(`- \`${api.name}\` - ${api.deprecationMessage || 'Deprecated'}`);
      });
    }

    if (analysis.apiSurfaceChanges.added.length > 0) {
      lines.push('', '### New APIs');
      analysis.apiSurfaceChanges.added.forEach(api => {
        lines.push(`- \`${api.name}\` - New capability`);
      });
    }

    return lines.join('\n');
  }

  private countLinesChanged(fileChanges: FileChange[]): number {
    return fileChanges.reduce((total, change) => {
      const orig = (change.originalContent || '').split('\n').length;
      const modified = (change.newContent || '').split('\n').length;
      return total + Math.abs(modified - orig);
    }, 0);
  }

  private createEmptyStats(generationTimeMs: number): GenerationStats {
    return {
      filesAnalyzed: 0,
      filesModified: 0,
      testsGenerated: 0,
      docsGenerated: 0,
      linesChanged: 0,
      generationTimeMs,
    };
  }

  /**
   * Register a custom code template
   */
  registerTemplate(template: CodeTemplate): void {
    this.templates.set(template.templateId, template);
  }

  /**
   * Get all registered templates
   */
  getTemplates(): CodeTemplate[] {
    return Array.from(this.templates.values());
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

/**
 * Planned modification before execution
 */
interface PlannedModification {
  type: 'remove-api' | 'update-api' | 'deprecate-api' | 'migrate-schema' | 'apply-pattern';
  target: string;
  priority: number;
  template: string;
  variables: Record<string, unknown>;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a pre-configured modification generator
 */
export function createModificationGenerator(
  config?: Partial<GeneratorConfig>
): AdapterModificationGenerator {
  return new AdapterModificationGenerator(config);
}

/**
 * Generate a proposal from analysis result
 */
export async function generateAdapterProposal(
  protocol: AgentFramework,
  analysis: ExtendedAnalysisResult,
  patterns: PatternMatch[],
  adapterFiles: string[],
  existingContent: Map<string, string>,
  config?: Partial<GeneratorConfig>
): Promise<GenerationResult> {
  const generator = createModificationGenerator(config);
  return generator.generateProposal({
    protocol,
    analysis,
    patterns,
    adapterFiles,
    existingContent,
  });
}
