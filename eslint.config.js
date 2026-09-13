// eslint.config.js
const { defineConfig } = require('eslint/config');
const globals = require('globals');
const { fixupPluginRules } = require('@eslint/compat');
const eslintPluginDiff = require('eslint-plugin-diff');

let stylistic;

const runESMImports = async () => {
  stylistic = await import('@stylistic/eslint-plugin').then((d) => d.default);
};

const isFixMode = process.argv.some((arg) => arg === '--fix' || arg === '--fix-dry-run');

const mainLintFiles = [
  './eslint.config.js',
  'tests/**/*.{ts,js}',
  'playwright/**/*.{js,ts}',
  'packages/bruno-app/**/*.{js,jsx,ts}',
  'packages/bruno-app/plugins/**/*.{js,cjs,mjs}',
  'packages/bruno-app/src/test-utils/mocks/codemirror.js',
  'packages/bruno-cli/**/*.js',
  'packages/bruno-common/**/*.ts',
  'packages/bruno-converters/**/*.js',
  'packages/bruno-electron/**/*.js',
  'packages/bruno-filestore/**/*.ts',
  'packages/bruno-schema-types/**/*.ts',
  'packages/bruno-js/**/*.js',
  'packages/bruno-lang/**/*.js',
  'packages/bruno-requests/**/*.ts',
  'packages/bruno-requests/**/*.js',
  'packages/bruno-tests/**/*.{js,ts}',
  'packages/bruno-sqlite/**/*.{js,ts}'
];

module.exports = runESMImports().then(() => defineConfig([
  // Global ignores - must be a standalone object with ONLY ignores
  {
    ignores: [
      '**/node_modules/**/*',
      '**/dist/**/*',
      '**/*.bru',
      'packages/bruno-js/src/sandbox/bundle-browser-rollup.js',
      'packages/bruno-app/public/static/**/*',
      'packages/bruno-app/.next/**/*',
      'packages/bruno-electron/web/**/*'
    ]
  },
  {
    plugins: {
      'diff': fixupPluginRules(eslintPluginDiff),
      '@stylistic': stylistic
    },
    languageOptions: {
      parser: require('@typescript-eslint/parser'),
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    files: mainLintFiles,
    rules: {
      ...stylistic.configs.customize({
        indent: 2,
        quotes: 'single',
        semi: true,
        jsx: true
      }).rules,
      '@stylistic/comma-dangle': ['error', 'never'],
      '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],
      '@stylistic/arrow-parens': ['error', 'always'],
      '@stylistic/curly-newline': ['error', {
        multiline: true,
        minElements: 2,
        consistent: true
      }],
      '@stylistic/function-paren-newline': ['off'],
      '@stylistic/array-bracket-spacing': ['error', 'never'],
      '@stylistic/arrow-spacing': ['error', { before: true, after: true }],
      '@stylistic/function-call-spacing': ['error', 'never'],
      '@stylistic/multiline-ternary': ['off'],
      '@stylistic/padding-line-between-statements': ['off'],
      '@stylistic/semi-style': ['error', 'last'],
      '@stylistic/max-len': ['off'],
      '@stylistic/jsx-one-expression-per-line': ['off'],
      '@stylistic/max-statements-per-line': ['off'],
      '@stylistic/no-mixed-operators': ['off'],
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
      'no-debugger': 'warn',
      'eqeqeq': isFixMode ? 'off' : ['warn', 'always'],
      'prefer-const': isFixMode ? 'off' : 'warn',
      'no-var': 'warn',
      'no-unreachable': 'warn',
      'no-duplicate-imports': 'warn',
      'no-self-compare': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-use-before-define': ['warn', { functions: false }]
    }
  },
  {
    files: ['packages/bruno-app/**/*.{js,jsx,ts}'],
    ignores: ['**/*.config.js', '**/public/**/*', '**/plugins/**/*'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.jest,
        global: false,
        require: false,
        Buffer: false,
        process: false,
        ipcRenderer: false
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    rules: {
      'no-undef': 'error'
    }
  },
  {
    // Rsbuild/rspack plugins are Node build tooling (CommonJS + ESM), not browser UI.
    files: ['packages/bruno-app/plugins/**/*.{js,cjs,mjs}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest
      }
    },
    rules: {
      'no-undef': 'error'
    }
  },
  {
    files: ['packages/bruno-app/**/*.{js,jsx,ts}'],
    ignores: ['**/*.config.js', '**/public/**/*', '**/plugins/**/*'],
    plugins: { 'react-hooks': require('eslint-plugin-react-hooks') },
    rules: {
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'warn'
    }
  },
  {
    // Prevent coarse Redux subscriptions. `state.collections.collections` and
    // `state.tabs.tabs` are replaced frequently, so subscribing to either causes
    // unnecessary re-renders when unrelated items or tabs change.
    //
    // Prefer narrow selectors from src/selectors/ when the value affects rendering.
    // If the value is only needed at event time and does not affect rendering,
    // read it from the store inside the event handler.
    //
    // Kept at `warn` during migration; change to `error` once existing violations
    // have been converted.
    files: ['packages/bruno-app/src/{components,providers,hooks}/**/*.{js,jsx,ts,tsx}'],
    ignores: ['**/*.spec.*', '**/*.test.*'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector:
            'CallExpression[callee.name="useSelector"] > ArrowFunctionExpression > MemberExpression.body[property.name="collections"][object.type="MemberExpression"][object.property.name="collections"][object.object.type="Identifier"]',
          message:
            'Do not subscribe to state.collections.collections. Use a narrow selector from src/selectors/collections (for example, selectCollectionByUid or selectItemByUid).'
        },
        {
          selector:
            'CallExpression[callee.name="useSelector"] > ArrowFunctionExpression > MemberExpression.body[property.name="collections"][object.type="Identifier"]',
          message:
            'Do not subscribe to the whole state.collections slice. Select only the data the component needs from src/selectors/collections.'
        },
        {
          selector:
            'CallExpression[callee.name="useSelector"] > ArrowFunctionExpression > MemberExpression.body[property.name="tabs"][object.type="MemberExpression"][object.property.name="tabs"][object.object.type="Identifier"]',
          message:
            'Do not subscribe to state.tabs.tabs. Use a narrow selector such as selectTabByUid, selectActiveTab, or makeSelectTabsForCollection.'
        },
        {
          selector:
            'CallExpression[callee.name="useSelector"] > ArrowFunctionExpression > MemberExpression.body[property.name="tabs"][object.type="Identifier"]',
          message:
            'Do not subscribe to the whole state.tabs slice. Select only the data the component needs from src/selectors/tab.'
        }
      ]
    }
  },
  {
    // It prevents lint errors when using CommonJS exports (module.exports) in Jest mocks.
    files: ['packages/bruno-app/src/test-utils/mocks/codemirror.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest
      }
    },
    rules: {
      'no-undef': 'error'
    }
  },
  {
    // Storybook config files use CommonJS with __dirname and module.exports
    files: ['packages/bruno-app/storybook/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node
      }
    },
    rules: {
      'no-undef': 'error'
    }
  },
  {
    files: ['packages/bruno-cli/**/*.js'],
    ignores: ['**/*.config.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest
      },
      parserOptions: {
        ecmaVersion: 'latest'
      }
    },
    rules: {
      'no-undef': 'error'
    }
  },
  {
    files: ['packages/bruno-common/**/*.ts'],
    ignores: ['**/*.config.js', '**/dist/**/*'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest
      },
      parser: require('@typescript-eslint/parser'),
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './packages/bruno-common/tsconfig.json'
      }
    },
    rules: {
      'no-undef': 'error'
    }
  },
  {
    files: ['packages/bruno-converters/**/*.js'],
    ignores: ['**/*.config.js', '**/dist/**/*'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    rules: {
      'no-undef': 'error',
      'no-case-declarations': 'error'
    }
  },
  {
    files: ['packages/bruno-electron/**/*.js'],
    ignores: ['**/*.config.js', '**/web/**/*'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest
      }
    },
    rules: {
      'no-undef': 'error'
    }
  },
  {
    files: ['packages/bruno-filestore/**/*.ts'],
    ignores: ['**/*.config.js', '**/dist/**/*'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest
      },
      parser: require('@typescript-eslint/parser'),
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './packages/bruno-filestore/tsconfig.json'
      }
    },
    rules: {
      'no-undef': 'error'
    }
  },
  {
    files: ['packages/bruno-js/**/*.js'],
    ignores: ['**/*.config.js', '**/dist/**/*'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
        window: false,
        self: false,
        HTMLElement: false,
        typeDetectGlobalObject: false
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    rules: {
      'no-undef': 'error'
    }
  },
  {
    files: ['packages/bruno-lang/**/*.js'],
    ignores: ['**/*.config.js', '**/dist/**/*'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    rules: {
      'no-undef': 'error'
    }
  },
  {
    files: ['packages/bruno-requests/**/*.ts'],
    ignores: ['**/*.config.js', '**/dist/**/*'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest
      },
      parser: require('@typescript-eslint/parser'),
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './packages/bruno-requests/tsconfig.json'
      }
    },
    rules: {
      'no-undef': 'error'
    }
  },
  {
    files: ['packages/bruno-requests/**/*.js'],
    ignores: ['**/*.config.js', '**/dist/**/*'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    rules: {
      'no-undef': 'error'
    }
  }
]));
