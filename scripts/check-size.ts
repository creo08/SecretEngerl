/** Fails if the app's JavaScript in dist/ exceeds 100 KB gzip. Run after `npm run build`. */
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const LIMIT = 100 * 1024;
const files = [...readdirSync('dist/assets').filter((f) => f.endsWith('.js')).map((f) => `dist/assets/${f}`), 'dist/sw.js'];
const total = files.reduce((sum, f) => sum + gzipSync(readFileSync(f)).length, 0);
console.log(`JavaScript: ${(total / 1024).toFixed(1)} KB gzip in ${files.length} files (limit ${LIMIT / 1024} KB)`);
if (total > LIMIT) process.exit(1);
