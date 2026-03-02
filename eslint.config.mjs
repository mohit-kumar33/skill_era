// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    // ── Global ignores ──────────────────────────────────────────────────
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            'prisma/**',
            'admin-panel/**',
            'user-frontend/**',
            '*.js',
            '*.mjs',
            '*.cjs',
        ],
    },

    // ── Base JS recommended rules ───────────────────────────────────────
    eslint.configs.recommended,

    // ── TypeScript strict + stylistic ───────────────────────────────────
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,

    // ── Parser & project config ─────────────────────────────────────────
    {
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },

    // ── Custom rule overrides ───────────────────────────────────────────
    {
        rules: {
            // ── Errors (must fix) ───────────────────────────────────────
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-misused-promises': 'error',
            '@typescript-eslint/await-thenable': 'error',
            '@typescript-eslint/no-unnecessary-condition': 'error',
            '@typescript-eslint/strict-boolean-expressions': 'off',

            // ── Warnings (cleanup over time) ────────────────────────────
            '@typescript-eslint/no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_',
            }],
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unsafe-assignment': 'warn',
            '@typescript-eslint/no-unsafe-member-access': 'warn',
            '@typescript-eslint/no-unsafe-call': 'warn',
            '@typescript-eslint/no-unsafe-argument': 'warn',
            '@typescript-eslint/no-unsafe-return': 'warn',
            '@typescript-eslint/restrict-template-expressions': 'warn',

            // ── Off (too noisy for existing codebase) ───────────────────
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/no-dynamic-delete': 'off',
        },
    },

    // ── Test file relaxations ───────────────────────────────────────────
    {
        files: ['src/tests/**/*.ts'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-argument': 'off',
            '@typescript-eslint/no-unsafe-return': 'off',
            '@typescript-eslint/no-floating-promises': 'off',
        },
    },
);
