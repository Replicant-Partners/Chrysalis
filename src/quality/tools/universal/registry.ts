/**
 * Universal Quality Tool Registry
 *
 * Declarative specification of quality tools across languages.
 * Instead of writing separate adapter classes, we declare:
 * - CLI interface (command, args pattern, output format)
 * - Output parsing hints (issue format, severity mapping)
 * - Semantic category (LINT, FORMAT, TYPE_CHECK, SECURITY)
 *
 * Adding a new tool = adding a registry entry (no code required)
 *
 * @module quality/tools/universal/registry
 * @version 1.0.0
 */

// ============================================================================
// Semantic Categories for Quality Tools
// ============================================================================

/**
 * Quality tool semantic categories.
 * These are tool-agnostic concepts that enable uniform understanding.
 */
export const TOOL_CATEGORIES = {
  LINT: {
    description: 'Code style and best practice checks',
    concepts: ['style', 'convention', 'lint', 'code-quality'],
    issueSeverities: ['error', 'warning', 'convention', 'refactor'],
  },
  FORMAT: {
    description: 'Code formatting and whitespace',
    concepts: ['format', 'whitespace', 'indent', 'line-length'],
    issueSeverities: ['error', 'warning'],
  },
  TYPE_CHECK: {
    description: 'Static type analysis',
    concepts: ['type', 'typing', 'inference', 'annotation'],
    issueSeverities: ['error', 'warning', 'note'],
  },
  SECURITY: {
    description: 'Security vulnerability detection',
    concepts: ['security', 'vulnerability', 'cve', 'injection'],
    issueSeverities: ['critical', 'high', 'medium', 'low'],
  },
  COMPLEXITY: {
    description: 'Code complexity metrics',
    concepts: ['complexity', 'cyclomatic', 'cognitive', 'maintainability'],
    issueSeverities: ['high', 'medium', 'low'],
  },
  TEST: {
    description: 'Test quality and coverage',
    concepts: ['test', 'coverage', 'assertion', 'mock'],
    issueSeverities: ['error', 'warning', 'info'],
  },
} as const;

export type ToolCategory = keyof typeof TOOL_CATEGORIES;

// ============================================================================
// Tool Registry Entry Type
// ============================================================================

export interface QualityToolEntry {
  /** Unique tool identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Programming language */
  language: 'python' | 'typescript' | 'javascript' | 'go' | 'rust' | 'multi';

  /** Semantic category */
  category: ToolCategory;

  /** CLI specification */
  cli: {
    /** Command to execute */
    command: string;
    /** Version flag (for availability check) */
    versionFlag: string;
    /** Check arguments pattern ({{TARGET}} is replaced with path) */
    checkArgs: string[];
    /** Fix arguments pattern (if supported) */
    fixArgs?: string[];
    /** Expected exit codes for success */
    successExitCodes: number[];
  };

  /** Output specification */
  output: {
    /** Output format */
    format: 'json' | 'text' | 'sarif' | 'checkstyle' | 'custom';
    /** Flag to enable JSON output (if not default) */
    jsonFlag?: string;
    /** Regex pattern for text output (groups: file, line, col, severity, message) */
    textPattern?: string;
    /** JSON path to issues array */
    jsonIssuePath?: string;
    /** Field mappings for JSON output */
    fieldMappings?: {
      file: string;
      line: string;
      column?: string;
      severity: string;
      message: string;
      code?: string;
    };
  };

  /** Severity normalization */
  severityMap: Record<string, 'error' | 'warning' | 'info'>;

  /** Tool-specific hints for LLM interpretation */
  hints: string;

  /** Documentation URL */
  docsUrl: string;
}

// ============================================================================
// Quality Tool Registry
// ============================================================================

export const QUALITY_TOOL_REGISTRY: Record<string, QualityToolEntry> = {
  // =========================================================================
  // PYTHON TOOLS
  // =========================================================================

  flake8: {
    id: 'flake8',
    name: 'Flake8',
    language: 'python',
    category: 'LINT',
    cli: {
      command: 'flake8',
      versionFlag: '--version',
      checkArgs: ['--format=json', '{{TARGET}}'],
      successExitCodes: [0, 1], // 1 = issues found (not error)
    },
    output: {
      format: 'json',
      jsonFlag: '--format=json',
      fieldMappings: {
        file: 'filename',
        line: 'line_number',
        column: 'column_number',
        severity: 'code', // E=error, W=warning, etc.
        message: 'text',
        code: 'code',
      },
    },
    severityMap: {
      'E': 'error',    // Error codes
      'W': 'warning',  // Warning codes
      'F': 'error',    // Fatal codes
      'C': 'info',     // Convention codes
      'N': 'info',     // Naming codes
    },
    hints: 'Flake8 codes: E=error, W=warning, F=pyflakes, C=mccabe, N=naming. First letter indicates category.',
    docsUrl: 'https://flake8.pycqa.org/',
  },

  black: {
    id: 'black',
    name: 'Black',
    language: 'python',
    category: 'FORMAT',
    cli: {
      command: 'black',
      versionFlag: '--version',
      checkArgs: ['--check', '--diff', '{{TARGET}}'],
      fixArgs: ['{{TARGET}}'],
      successExitCodes: [0, 1], // 1 = would reformat
    },
    output: {
      format: 'text',
      textPattern: '^would reformat (.+)$',
    },
    severityMap: {
      'would reformat': 'warning',
      'reformatted': 'info',
    },
    hints: 'Black is opinionated. Check mode returns 1 if files would be reformatted. No line-level issues, just file-level.',
    docsUrl: 'https://black.readthedocs.io/',
  },

  mypy: {
    id: 'mypy',
    name: 'mypy',
    language: 'python',
    category: 'TYPE_CHECK',
    cli: {
      command: 'mypy',
      versionFlag: '--version',
      checkArgs: ['--output=json', '{{TARGET}}'],
      successExitCodes: [0, 1], // 1 = type errors found
    },
    output: {
      format: 'json',
      jsonFlag: '--output=json',
      fieldMappings: {
        file: 'file',
        line: 'line',
        column: 'column',
        severity: 'severity',
        message: 'message',
        code: 'code',
      },
    },
    severityMap: {
      'error': 'error',
      'warning': 'warning',
      'note': 'info',
    },
    hints: 'mypy reports type inference issues. error=type mismatch, note=informational. Some errors have codes like [assignment], [return-value].',
    docsUrl: 'https://mypy.readthedocs.io/',
  },

  bandit: {
    id: 'bandit',
    name: 'Bandit',
    language: 'python',
    category: 'SECURITY',
    cli: {
      command: 'bandit',
      versionFlag: '--version',
      checkArgs: ['-f', 'json', '-r', '{{TARGET}}'],
      successExitCodes: [0, 1], // 1 = issues found
    },
    output: {
      format: 'json',
      jsonFlag: '-f json',
      jsonIssuePath: 'results',
      fieldMappings: {
        file: 'filename',
        line: 'line_number',
        column: 'col_offset',
        severity: 'issue_severity',
        message: 'issue_text',
        code: 'test_id',
      },
    },
    severityMap: {
      'HIGH': 'error',
      'MEDIUM': 'warning',
      'LOW': 'info',
    },
    hints: 'Bandit security scanner. issue_confidence indicates how sure it is. test_id is the check name (e.g., B101=assert, B102=exec).',
    docsUrl: 'https://bandit.readthedocs.io/',
  },

  // =========================================================================
  // TYPESCRIPT/JAVASCRIPT TOOLS
  // =========================================================================

  eslint: {
    id: 'eslint',
    name: 'ESLint',
    language: 'typescript',
    category: 'LINT',
    cli: {
      command: 'npx',
      versionFlag: 'eslint --version',
      checkArgs: ['eslint', '--format=json', '{{TARGET}}'],
      fixArgs: ['eslint', '--fix', '{{TARGET}}'],
      successExitCodes: [0, 1], // 1 = issues found
    },
    output: {
      format: 'json',
      jsonFlag: '--format=json',
      fieldMappings: {
        file: 'filePath',
        line: 'line',
        column: 'column',
        severity: 'severity', // 1=warning, 2=error
        message: 'message',
        code: 'ruleId',
      },
    },
    severityMap: {
      '2': 'error',
      '1': 'warning',
      '0': 'info',
    },
    hints: 'ESLint severity: 2=error, 1=warning, 0=off. ruleId contains the rule name. Messages array is per-file.',
    docsUrl: 'https://eslint.org/',
  },

  tsc: {
    id: 'tsc',
    name: 'TypeScript Compiler',
    language: 'typescript',
    category: 'TYPE_CHECK',
    cli: {
      command: 'npx',
      versionFlag: 'tsc --version',
      checkArgs: ['tsc', '--noEmit', '--pretty', 'false'],
      successExitCodes: [0, 2], // 2 = type errors
    },
    output: {
      format: 'text',
      // Format: file(line,col): error TSxxxx: message
      textPattern: '^(.+)\\((\\d+),(\\d+)\\): (error|warning) (TS\\d+): (.+)$',
    },
    severityMap: {
      'error': 'error',
      'warning': 'warning',
    },
    hints: 'TypeScript compiler output is text. Error codes start with TS (e.g., TS2322=type mismatch). --pretty false gives parseable output.',
    docsUrl: 'https://www.typescriptlang.org/',
  },

  prettier: {
    id: 'prettier',
    name: 'Prettier',
    language: 'multi',
    category: 'FORMAT',
    cli: {
      command: 'npx',
      versionFlag: 'prettier --version',
      checkArgs: ['prettier', '--check', '{{TARGET}}'],
      fixArgs: ['prettier', '--write', '{{TARGET}}'],
      successExitCodes: [0, 1], // 1 = would reformat
    },
    output: {
      format: 'text',
      textPattern: '^Checking formatting\\.\\.\\.\\n(.+)$',
    },
    severityMap: {
      'would change': 'warning',
    },
    hints: 'Prettier outputs list of files that would change. Exit 1 if any file needs formatting. No line-level info.',
    docsUrl: 'https://prettier.io/',
  },

  // =========================================================================
  // GO TOOLS
  // =========================================================================

  golint: {
    id: 'golint',
    name: 'golangci-lint',
    language: 'go',
    category: 'LINT',
    cli: {
      command: 'golangci-lint',
      versionFlag: 'version',
      checkArgs: ['run', '--out-format=json', '{{TARGET}}'],
      successExitCodes: [0, 1],
    },
    output: {
      format: 'json',
      jsonFlag: '--out-format=json',
      jsonIssuePath: 'Issues',
      fieldMappings: {
        file: 'Pos.Filename',
        line: 'Pos.Line',
        column: 'Pos.Column',
        severity: 'Severity',
        message: 'Text',
        code: 'FromLinter',
      },
    },
    severityMap: {
      'error': 'error',
      'warning': 'warning',
      'info': 'info',
    },
    hints: 'golangci-lint aggregates many Go linters. FromLinter tells you which linter found it. Has auto-fix for some issues.',
    docsUrl: 'https://golangci-lint.run/',
  },
};

// ============================================================================
// Registry Helper Functions
// ============================================================================

/**
 * Get tool by ID
 */
export function getTool(id: string): QualityToolEntry | undefined {
  return QUALITY_TOOL_REGISTRY[id];
}

/**
 * Get tools by language
 */
export function getToolsByLanguage(language: QualityToolEntry['language']): QualityToolEntry[] {
  return Object.values(QUALITY_TOOL_REGISTRY).filter(t => t.language === language || t.language === 'multi');
}

/**
 * Get tools by category
 */
export function getToolsByCategory(category: ToolCategory): QualityToolEntry[] {
  return Object.values(QUALITY_TOOL_REGISTRY).filter(t => t.category === category);
}

/**
 * List all registered tools
 */
export function listTools(): Array<{ id: string; name: string; language: string; category: string }> {
  return Object.values(QUALITY_TOOL_REGISTRY).map(t => ({
    id: t.id,
    name: t.name,
    language: t.language,
    category: t.category,
  }));
}
