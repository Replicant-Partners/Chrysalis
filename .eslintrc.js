/**
 * ESLint Configuration for Chrysalis Integration Platform
 * 
 * This configuration enforces consistent code style and catches common errors.
 * Based on recommendations from the comprehensive code review (2026-01-11).
 * 
 * @see docs/COMPREHENSIVE_CODE_REVIEW_2026-01-11.md Section 2.1
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  plugins: [
    '@typescript-eslint',
    'import',
    'security',
    'jsdoc',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
    'plugin:security/recommended-legacy',
  ],
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  ignorePatterns: [
    'dist/',
    'node_modules/',
    'coverage/',
    '*.js',
    '!.eslintrc.js',
    'htmlcov/',
    '.venv/',
  ],
  rules: {
    // =====================================================
    // TypeScript-Specific Rules (from code review Section 2.1)
    // =====================================================
    
    // Require explicit return types on functions and class methods
    '@typescript-eslint/explicit-function-return-type': ['error', {
      allowExpressions: true,
      allowTypedFunctionExpressions: true,
      allowHigherOrderFunctions: true,
      allowDirectConstAssertionInArrowFunctions: true,
    }],
    
    // Disallow the `any` type (security recommendation)
    '@typescript-eslint/no-explicit-any': 'error',
    
    // Require Promise-like values to be handled appropriately
    '@typescript-eslint/no-floating-promises': 'error',
    
    // Disallow async functions which have no await expression
    '@typescript-eslint/require-await': 'warn',
    
    // Enforce consistent usage of type imports
    '@typescript-eslint/consistent-type-imports': ['error', {
      prefer: 'type-imports',
      disallowTypeAnnotations: false,
    }],
    
    // Require explicit accessibility modifiers on class properties/methods
    '@typescript-eslint/explicit-member-accessibility': ['error', {
      accessibility: 'explicit',
      overrides: {
        constructors: 'no-public',
      },
    }],
    
    // Disallow unused variables
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    }],
    
    // Prevent misuse of Promises
    '@typescript-eslint/no-misused-promises': ['error', {
      checksVoidReturn: {
        attributes: false,
      },
    }],
    
    // Disallow non-null assertions
    '@typescript-eslint/no-non-null-assertion': 'warn',
    
    // =====================================================
    // Import Rules
    // =====================================================
    
    // Ensure imports resolve
    'import/no-unresolved': 'error',
    
    // Enforce consistent import ordering
    'import/order': ['error', {
      'groups': [
        'builtin',
        'external',
        'internal',
        ['parent', 'sibling'],
        'index',
        'type',
      ],
      'newlines-between': 'always',
      'alphabetize': {
        order: 'asc',
        caseInsensitive: true,
      },
    }],
    
    // No duplicate imports
    'import/no-duplicates': 'error',
    
    // No circular dependencies
    'import/no-cycle': 'warn',
    
    // =====================================================
    // Security Rules (from code review recommendations)
    // =====================================================
    
    // Detect potential RegExp DoS
    'security/detect-unsafe-regex': 'error',
    
    // Detect potential buffer overflow
    'security/detect-buffer-noassert': 'error',
    
    // Detect use of eval()
    'security/detect-eval-with-expression': 'error',
    
    // Detect potential non-literal require
    'security/detect-non-literal-require': 'warn',
    
    // Detect potential non-literal fs calls
    'security/detect-non-literal-fs-filename': 'warn',
    
    // Detect potential object injection
    'security/detect-object-injection': 'warn',
    
    // =====================================================
    // Code Quality Rules
    // =====================================================
    
    // Enforce consistent brace style
    'curly': ['error', 'all'],
    
    // Require === and !==
    'eqeqeq': ['error', 'always'],
    
    // Disallow eval()
    'no-eval': 'error',
    
    // Disallow implied eval()
    'no-implied-eval': 'error',
    
    // Disallow the use of console
    'no-console': ['warn', {
      allow: ['warn', 'error'],
    }],
    
    // Disallow debugger
    'no-debugger': 'error',
    
    // Maximum function length (code smell indicator)
    'max-lines-per-function': ['warn', {
      max: 100,
      skipBlankLines: true,
      skipComments: true,
    }],
    
    // Maximum cyclomatic complexity
    'complexity': ['warn', 15],
    
    // Maximum depth of nested blocks
    'max-depth': ['warn', 4],
    
    // Maximum number of parameters
    'max-params': ['warn', 5],
    
    // Disallow nested ternary expressions
    'no-nested-ternary': 'error',
    
    // Prefer const over let
    'prefer-const': 'error',
    
    // No var declarations
    'no-var': 'error',
    
    // Prefer template literals
    'prefer-template': 'warn',
    
    // =====================================================
    // JSDoc Rules (documentation coverage)
    // =====================================================
    
    // Require JSDoc for public API
    'jsdoc/require-jsdoc': ['warn', {
      publicOnly: true,
      require: {
        FunctionDeclaration: true,
        MethodDefinition: true,
        ClassDeclaration: true,
      },
    }],
    
    // Require @param tags
    'jsdoc/require-param': 'warn',
    
    // Require @returns tags
    'jsdoc/require-returns': 'warn',
    
    // Check param types
    'jsdoc/check-param-names': 'warn',
    
    // Check tag names
    'jsdoc/check-tag-names': 'warn',
  },
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.json',
      },
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      },
    },
    'jsdoc': {
      mode: 'typescript',
    },
  },
  overrides: [
    // Test files have relaxed rules
    {
      files: ['**/*.test.ts', '**/*.spec.ts', '**/tests/**/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        'max-lines-per-function': 'off',
        'security/detect-object-injection': 'off',
        'jsdoc/require-jsdoc': 'off',
      },
    },
    // Configuration files
    {
      files: ['*.config.js', '*.config.ts', '.eslintrc.js'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
    // Migration/script files
    {
      files: ['scripts/**/*.ts', 'scripts/**/*.js'],
      rules: {
        'no-console': 'off',
        'security/detect-non-literal-fs-filename': 'off',
      },
    },
  ],
};
