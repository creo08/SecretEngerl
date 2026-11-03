import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { sitePlugin } from './scripts/vite-site.ts';

/** The only place that names where the site lives. Code reads import.meta.env.BASE_URL. */
const ORIGIN = 'https://creo08.github.io';
const BASE = '/SecretEngerl/';
const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  base: BASE,
  plugins: [sitePlugin(root, ORIGIN)],
  build: {
    target: 'es2023',
    sourcemap: false,
    rollupOptions: {
      input: { main: `${root}index.html`, sw: `${root}src/sw/sw.ts` },
      output: {
        // The service worker needs a fixed name; it is not hashed.
        entryFileNames: (chunk) => (chunk.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
  worker: { format: 'es' },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
