import js from '@eslint/js';
import globals from 'globals';
import { defineConfig } from 'eslint/config';

export default defineConfig([
    {
        files: ['**/*.{js,mjs,cjs}'],
        plugins: { js },
        extends: ['js/recommended'],
        rules: {
            'semi': 'error', // require semicolons
            'no-unused-vars': [
                'warn',
                { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
            ], // ignore unused variables that start with _
            'indent': ['warn', 4, { SwitchCase: 1 }] // 4 spaces
        }
    },
    { files: ['**/*.js'], languageOptions: { sourceType: 'module' } },
    { files: ['**/*.{js,mjs,cjs}'], languageOptions: { globals: globals.node } }
]);
