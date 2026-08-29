import { defineConfig } from 'vite-plus';

export default defineConfig({
  staged: {
    '*': ['vp fmt', 'vp lint --fix'],
  },
  fmt: {
    singleQuote: true,
    arrowParens: 'always',
    bracketSameLine: true,
    bracketSpacing: true,
    endOfLine: 'lf',
    printWidth: 120,
    tabWidth: 2,
    useTabs: false,
    sortImports: {
      newlinesBetween: true,
      groups: [
        'type-import',
        ['value-builtin', 'value-external'],
        'type-internal',
        'value-internal',
        ['type-parent', 'type-sibling', 'type-index'],
        ['value-parent', 'value-sibling', 'value-index'],
        'unknown',
      ],
    },
  },
  lint: {
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    rules: { 'vite-plus/prefer-vite-plus-imports': 'error' },
    options: { typeAware: true, typeCheck: true },
  },
});
