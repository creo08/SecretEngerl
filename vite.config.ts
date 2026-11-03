import { defineConfig } from 'vitest/config';

/** The only place that names the GitHub Pages base path. Code reads import.meta.env.BASE_URL. */
const BASE = '/SecretEngerl/';

export default defineConfig({
  base: BASE,
  build: {
    target: 'es2023',
    sourcemap: false,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
