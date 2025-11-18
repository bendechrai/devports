// @ts-check
// TARGET STRICT ESLint Configuration for Future Implementation
// This represents best-in-class 2025 standards we should strive for

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  // Global ignores - 2025 best practice
  {
    ignores: ['dist/', 'node_modules/', 'coverage/', '**/*.d.ts'],
  },

  // Base ESLint recommended rules
  eslint.configs.recommended,

  // TypeScript files - STRICT configuration
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true, // v8 feature: uses same APIs as VS Code
        tsconfigRootDir: import.meta.dirname,
        allowDefaultProject: ['*.config.*'],
      },
      globals: {
        ...globals.node,
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    extends: [
      ...tseslint.configs.strictTypeChecked, // STRICT: Maximum type safety
      ...tseslint.configs.stylisticTypeChecked, // STRICT: Consistent style
    ],
    rules: {
      // TypeScript strict rules - ALL ERRORS (no warnings)
      '@typescript-eslint/no-explicit-any': 'error', // Zero tolerance for any
      '@typescript-eslint/no-unsafe-assignment': 'error', // Complete type safety
      '@typescript-eslint/no-unsafe-call': 'error', // No unsafe function calls
      '@typescript-eslint/no-unsafe-member-access': 'error', // No unsafe property access
      '@typescript-eslint/no-unsafe-return': 'error', // No unsafe returns
      '@typescript-eslint/restrict-template-expressions': [
        // Strict template expressions
        'error',
        {
          allowNumber: true,
          allowBoolean: true,
          allowNullish: false,
          allowRegExp: false,
        },
      ],

      // Modern TypeScript - ENFORCED
      '@typescript-eslint/prefer-nullish-coalescing': 'error', // Use ?? not ||
      '@typescript-eslint/prefer-optional-chain': 'error', // Use ?. consistently
      '@typescript-eslint/no-non-null-assertion': 'error', // No ! operator
      '@typescript-eslint/prefer-readonly': 'error', // Immutability where possible
      '@typescript-eslint/prefer-readonly-parameter-types': 'warn', // Gradual readonly adoption

      // Advanced type safety
      '@typescript-eslint/no-floating-promises': 'error', // Always handle promises
      '@typescript-eslint/no-misused-promises': 'error', // Correct promise usage
      '@typescript-eslint/require-await': 'error', // Meaningful async functions
      '@typescript-eslint/return-await': ['error', 'always'], // Consistent await returns

      // Security rules - ZERO TOLERANCE
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-extend-native': 'error', // Don't modify built-ins
      'no-global-assign': 'error', // Don't reassign globals

      // Modern JavaScript - ENFORCED
      'prefer-const': 'error', // Immutability first
      'no-var': 'error', // ES6+ only
      'object-shorthand': 'error', // Clean object syntax
      'prefer-arrow-callback': 'error', // Consistent functions
      'prefer-template': 'error', // Template literals required
      'prefer-destructuring': [
        'error',
        {
          // Modern destructuring
          array: true,
          object: true,
        },
      ],

      // Code quality - STRICT
      eqeqeq: ['error', 'always'], // Strict equality only
      curly: ['error', 'all'], // Always use braces
      'no-console': 'error', // No console in production
      'no-debugger': 'error', // No debugger statements
      'no-alert': 'error', // No alert/confirm/prompt

      // Performance
      'no-loop-func': 'error', // Functions in loops
      'no-caller': 'error', // No deprecated patterns

      // Unused code - STRICT
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },

  // Test files - More permissive but still strict where it matters
  {
    files: ['**/*.test.ts', '**/*.spec.ts', 'test/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        ...globals.vitest,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    extends: [...tseslint.configs.recommendedTypeChecked],
    rules: {
      // Allow some flexibility in tests
      '@typescript-eslint/no-explicit-any': 'warn', // Tests may need any for mocking
      '@typescript-eslint/no-unsafe-assignment': 'off', // Test setup flexibility
      '@typescript-eslint/no-unsafe-call': 'off', // Mock call flexibility
      '@typescript-eslint/no-unsafe-member-access': 'off', // Test assertion flexibility
      '@typescript-eslint/no-unsafe-return': 'off', // Test return flexibility
      '@typescript-eslint/no-non-null-assertion': 'warn', // Tests may use ! for known values
      '@typescript-eslint/unbound-method': 'off', // Jest/Vitest patterns
      '@typescript-eslint/no-require-imports': 'off', // Legacy test patterns

      // Keep security rules strict even in tests
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',

      // Allow console in tests
      'no-console': 'off',
    },
  },

  // JavaScript files - Basic strict rules
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    extends: [tseslint.configs.disableTypeChecked],
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      'prefer-template': 'error',

      // Security rules apply to JS too
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },

  // CLI entry point - Special allowances
  {
    files: ['src/cli.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off', // CLI exports many functions
      'no-console': 'warn', // CLI needs console output
    },
  },

  // Config files
  {
    files: ['*.config.{js,mjs,ts}', 'vitest.config.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off', // Config files may log
      '@typescript-eslint/no-require-imports': 'off', // Legacy config patterns
      '@typescript-eslint/no-var-requires': 'off', // Legacy config patterns
    },
  }
);
