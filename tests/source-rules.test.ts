import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && /\.(ts|js|mjs|html)$/.test(e.name))
    .map((e) => join(e.parentPath, e.name));
}

describe('source rules', () => {
  const files = [...sourceFiles('src'), ...sourceFiles('scripts'), 'index.html'];

  it('never uses Math.random', () => {
    const forbidden = ['Math', 'random'].join('.');
    const offenders = files.filter((f) => readFileSync(f, 'utf8').includes(forbidden));
    expect(offenders).toEqual([]);
  });

  it('never assigns innerHTML', () => {
    const forbidden = ['inner', 'HTML'].join('');
    const offenders = files.filter((f) => readFileSync(f, 'utf8').includes(forbidden));
    expect(offenders).toEqual([]);
  });
});
