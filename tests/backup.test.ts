import { describe, expect, it } from 'vitest';
import { backupContent, backupFileName, mergeForRestore, roundFromBackup } from '../src/files/backup.ts';
import { openFile, sealFile } from '../src/files/envelope.ts';
import { compileRound } from '../src/losfee/index.ts';
import { saveDraw } from '../src/store/rounds.ts';
import { memoryStore } from './helpers/memory-store.ts';
import { round as makeConfig } from './helpers/round.ts';

const BASE = 'https://creo08.github.io/SecretEngerl/';

describe('backup file', () => {
  it('carries the whole round through an encrypted file', async () => {
    const config = makeConfig([['Anna'], ['Bernd'], ['Clara']]);
    const { names } = compileRound(config);
    const round = await saveDraw(memoryStore(), { config, names, assignment: [1, 2, 0], base: BASE });
    expect(backupFileName(round)).toBe('runde-2026-12.wichtel');
    const text = await sealFile('secretengerl-backup', backupContent(round), 'pw', 100_000);
    expect(text).not.toContain('Anna');
    const opened = await openFile(text, 'pw');
    if (opened.status !== 'ok') throw new Error(opened.status);
    expect(opened.format).toBe('secretengerl-backup');
    expect(roundFromBackup(opened.content, BASE)).toEqual(round);
  });

  it('keeps every logged view when a backup replaces a round', () => {
    const base = { id: 'r', views: [{ name: 'Anna', at: 1 }] } as never;
    const restored = mergeForRestore({ ...(base as object), views: [{ name: 'Bernd', at: 2 }] } as never, { ...(base as object), views: [{ name: 'Anna', at: 1 }, { name: 'Clara', at: 3 }] } as never);
    expect(restored.views).toEqual([{ name: 'Anna', at: 1 }, { name: 'Bernd', at: 2 }, { name: 'Clara', at: 3 }]);
  });

  it('keeps a PIN set on the device when the backup has none', () => {
    const pin = { salt: 's', iterations: 600000, hash: 'h' };
    const restored = mergeForRestore({ id: 'r', views: [], pin: null } as never, { id: 'r', views: [], pin } as never);
    expect(restored.pin).toEqual(pin);
  });

  it('refuses rounds with links to another site', async () => {
    const config = makeConfig([['Anna'], ['Bernd'], ['Clara']]);
    const { names } = compileRound(config);
    const round = await saveDraw(memoryStore(), { config, names, assignment: [1, 2, 0], base: 'https://evil.example/' });
    expect(roundFromBackup(backupContent(round), BASE)).toBeNull();
    expect(roundFromBackup({}, BASE)).toBeNull();
  });
});
