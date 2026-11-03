import { describe, expect, it } from 'vitest';
import { parseAmount, parseFreeText, parseIsoDate, parseName, parseNameList, utf8Length } from '../src/input/validate.ts';

describe('input validation', () => {
  it('cleans names: NFC, no control or bidi characters, trimmed', () => {
    expect(parseName('  Anna  ', 'n')).toEqual({ ok: true, value: 'Anna' });
    expect(parseName('Cla‮ra\u0007', 'n')).toEqual({ ok: true, value: 'Clara' });
    expect(parseName('René', 'n')).toEqual({ ok: true, value: 'René' });
  });

  it('rejects empty, too long and non-string names', () => {
    expect(parseName('​ ', 'n').ok).toBe(false);
    expect(parseName('a'.repeat(41), 'n').ok).toBe(false);
    expect(parseName('😀'.repeat(40), 'n').ok).toBe(true);
    expect(parseName(42, 'n').ok).toBe(false);
  });

  it('reads households from lines and blank lines, rejecting duplicates', () => {
    expect(parseNameList('Anna\nBernd\n\nClara\n  \nDavid\n')).toEqual({ ok: true, value: [['Anna', 'Bernd'], ['Clara'], ['David']] });
    expect(parseNameList('Anna\n\u00A0\nBernd\n\u200B\nClara')).toEqual({ ok: true, value: [['Anna'], ['Bernd'], ['Clara']] });
    const dup = parseNameList('Anna\n\nanna');
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.errors[0]!.code).toBe('name.duplicate');
  });

  it('allows at most 50 people', () => {
    const names = (n: number) => Array.from({ length: n }, (_, i) => `P${i}`).join('\n');
    expect(parseNameList(names(50)).ok).toBe(true);
    expect(parseNameList(names(51)).ok).toBe(false);
  });

  it('parses amounts strictly', () => {
    expect(parseAmount('20', 'b')).toEqual({ ok: true, value: 20 });
    expect(parseAmount('12,50', 'b')).toEqual({ ok: true, value: 12.5 });
    for (const bad of ['', '-1', '10000', '1e3', '20 €', '0x10', '1.234']) expect(parseAmount(bad, 'b').ok).toBe(false);
  });

  it('parses ISO dates strictly', () => {
    expect(parseIsoDate('2026-12-20', 'd').ok).toBe(true);
    for (const bad of ['2026-02-30', '2026-13-01', '20.12.2026', '2026-12-20T00:00', 20261220]) expect(parseIsoDate(bad, 'd').ok).toBe(false);
  });

  it('limits free text by UTF-8 bytes and keeps line breaks', () => {
    expect(parseFreeText('keine\r\nNüsse‏', 'h', 50)).toEqual({ ok: true, value: 'keine\nNüsse' });
    expect(parseFreeText('ü'.repeat(11), 'h', 21).ok).toBe(false);
    expect(utf8Length('€')).toBe(3);
  });
});
