import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import de from '../src/i18n/de.json';
import { TEMPLATE_IDS } from '../src/config/types.ts';

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && e.name.endsWith('.ts'))
    .map((e) => readFileSync(join(e.parentPath, e.name), 'utf8'));
}

describe('language file', () => {
  it('has every text the code asks for', () => {
    const used = new Set(sources('src').flatMap((code) => [...code.matchAll(/\bt\('([\w.-]+)'/g)].map((m) => m[1]!)));
    for (const id of TEMPLATE_IDS) used.add(`template.${id}`);
    expect(used.size).toBeGreaterThan(100);
    expect([...used].filter((key) => !(key in de))).toEqual([]);
  });
});
