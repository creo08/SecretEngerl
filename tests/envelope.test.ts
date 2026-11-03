import { describe, expect, it } from 'vitest';
import { openFile, sealFile } from '../src/files/envelope.ts';

const content = { year: 2026, names: ['Anna', 'Bernd'] };

describe('file envelope', () => {
  it('writes plain JSON without a password', async () => {
    const text = await sealFile('secretengerl-year', content);
    expect(JSON.parse(text)).toEqual({ format: 'secretengerl-year', version: 1, ...content });
    expect(await openFile(text)).toEqual({ status: 'ok', format: 'secretengerl-year', content });
  });

  it('encrypts with a password and authenticates the header', async () => {
    const text = await sealFile('secretengerl-backup', content, 'geheim', 100_000);
    expect(text).not.toContain('Anna');
    const parsed = JSON.parse(text);
    expect(Object.keys(parsed.header)).toEqual(['format', 'version', 'salt', 'iterations']);
    expect(await openFile(text)).toEqual({ status: 'password' });
    expect(await openFile(text, 'falsch')).toEqual({ status: 'wrongPassword' });
    expect(await openFile(text, 'geheim')).toEqual({ status: 'ok', format: 'secretengerl-backup', content });
    // Changing the header (here: the claimed format) breaks the authentication.
    const swapped = JSON.stringify({ ...parsed, header: { ...parsed.header, format: 'secretengerl-year' } });
    expect(await openFile(swapped, 'geheim')).toEqual({ status: 'wrongPassword' });
  });

  it('rejects foreign or hostile files', async () => {
    expect(await openFile('kein json')).toEqual({ status: 'invalid' });
    expect(await openFile('{"format":"other","version":1}')).toEqual({ status: 'invalid' });
    expect(await openFile('{"format":"secretengerl-year","version":2}')).toEqual({ status: 'invalid' });
    const text = JSON.parse(await sealFile('secretengerl-year', content, 'x', 100_000));
    text.header.iterations = 1e12;
    expect(await openFile(JSON.stringify(text), 'x')).toEqual({ status: 'invalid' });
    expect(await openFile('x'.repeat(1_000_001))).toEqual({ status: 'invalid' });
  });
});
