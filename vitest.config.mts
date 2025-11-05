import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true, // Use global describe, it, expect without imports
    environment: 'node', // Node.js environment (not browser)
    exclude: ['node_modules/', 'dist/', '**/*.config.ts', '**/*.d.ts'],
    coverage: {
      provider: 'v8', // Code coverage tool
      reporter: ['text', 'html'], // Coverage output formats
      exclude: ['node_modules/', 'dist/', '**/*.config.ts', '**/*.d.ts'],
    },
  },
});
