import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // setupFiles runs in each test worker BEFORE any test modules are imported.
        // This populates process.env before env.ts is loaded, preventing process.exit(1).
        setupFiles: ['src/tests/setup.ts'],

        // Use node environment for backend tests
        environment: 'node',

        // Include only test files in src/tests
        include: ['src/tests/**/*.test.ts'],

        // Verbose output for CI visibility
        reporters: ['verbose'],
    },
});
