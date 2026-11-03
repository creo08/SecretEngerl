import { describe, expect, it, vi } from 'vitest';
import { configFromTemplate } from '../src/config/templates.ts';
import { buildLink, readFragment, sealFragment, takeFragment } from '../src/link/link.ts';
import { decodePayload, encodePayload, expiryFor, freeHintBytes, oversizedDraws, payloadFor, PAYLOAD_BYTES } from '../src/link/payload.ts';

const BASE = 'https://creo08.github.io/SecretEngerl/';
const NOW = Date.UTC(2026, 11, 1);
const config = configFromTemplate('engerl-bengerl', [['Anna', 'Bernd'], ['Clara']], '2026-12-20');
const fragmentOf = (link: string) => link.slice(link.indexOf('#'));

describe('link format v1', () => {
  it('sets the expiry to the end of the day 14 days after the exchange, in UTC', () => {
    expect(expiryFor('2026-12-20')).toBe(1799020799);
    expect(new Date(expiryFor('2026-12-20') * 1000).toISOString()).toBe('2027-01-03T23:59:59.000Z');
  });

  it('round-trips a draw', async () => {
    const payload = payloadFor(config, 'Bernd', 1);
    expect(payload).toEqual({ r: 'Bernd', b: '20 €', m: '', d: '2026-12-20', h: '', t: 'engerl-bengerl', n: 1, x: 1799020799 });
    const link = await buildLink(BASE, payload);
    expect(link).toMatch(/^https:\/\/creo08\.github\.io\/SecretEngerl\/#1\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{379}$/);
    expect(await readFragment(fragmentOf(link), NOW)).toEqual({ status: 'ok', payload });
  });

  it('makes every link the same length, also with a long hint and multi-byte names', async () => {
    const long = structuredClone(config);
    long.participants.households = [['Ö😀'.repeat(20), 'Ödön'], ['Clara']];
    long.gifts.theme = 'Selbstgemacht';
    // Fill Clara's draw up to the last byte.
    long.gifts.hints = { Clara: 'ü'.repeat(Math.floor(freeHintBytes(long, 'Clara', 12) / 2)) };
    expect(freeHintBytes(long, 'Clara', 12)).toBeLessThan(2);
    const payloads = [payloadFor(long, 'Ö😀'.repeat(20), 2), payloadFor(long, 'Clara', 12), payloadFor(config, 'Anna', 1)];
    const lengths = await Promise.all(payloads.map(async (p) => (await buildLink(BASE, p)).length));
    expect(new Set(lengths).size).toBe(1);
  });

  it('carries a postal address only in postal rounds, with the same link length', async () => {
    const post = configFromTemplate('post-wichteln', [['Anna'], ['Bernd'], ['Clara']], '2026-12-20');
    post.addresses = { Bernd: 'Bernd Beispiel\nHauptplatz 1\n8010 Graz' };
    const withAddress = payloadFor(post, 'Bernd', 1);
    expect(withAddress.a).toBe('Bernd Beispiel\nHauptplatz 1\n8010 Graz');
    expect(payloadFor(post, 'Clara', 1)).not.toHaveProperty('a');
    const [a, b] = await Promise.all([buildLink(BASE, withAddress), buildLink(BASE, payloadFor(config, 'Bernd', 1))]);
    expect(a.length).toBe(b.length);
    expect(await readFragment(fragmentOf(a), NOW)).toEqual({ status: 'ok', payload: withAddress });
  });

  it('never two equal links for the same draw', async () => {
    const payload = payloadFor(config, 'Bernd', 1);
    expect(await buildLink(BASE, payload)).not.toBe(await buildLink(BASE, payload));
  });

  it('shows only "expired" after the expiry date, never the content', async () => {
    const link = await buildLink(BASE, payloadFor(config, 'Bernd', 1));
    expect(await readFragment(fragmentOf(link), 1799020799 * 1000)).toMatchObject({ status: 'ok' });
    expect(await readFragment(fragmentOf(link), 1799020800 * 1000)).toEqual({ status: 'expired' });
  });

  it('rejects tampered and malformed links', async () => {
    const fragment = fragmentOf(await buildLink(BASE, payloadFor(config, 'Bernd', 1)));
    const [, key, body] = fragment.slice(1).split('.') as [string, string, string];
    const flip = (s: string, i: number) => s.slice(0, i) + (s[i] === 'A' ? 'B' : 'A') + s.slice(i + 1);
    const bad = [
      `#2.${key}.${body}`,
      `#1.${flip(key, 3)}.${body}`,
      `#1.${key}.${flip(body, 20)}`,
      `#1.${key}.${flip(body, 5)}`,
      `#1.${key}.${flip(body, body.length - 3)}`,
      `#1.${key}.${body.slice(0, -4)}`,
      `#1.${key}.${body}.x`,
      '#1..',
      '#hallo',
      `#1.${key}.${body}=`,
    ];
    for (const fragment of bad) expect(await readFragment(fragment, NOW), fragment).toEqual({ status: 'invalid' });
  });

  it('reports an empty fragment', async () => {
    expect(await readFragment('', NOW)).toEqual({ status: 'empty' });
    expect(await readFragment('#', NOW)).toEqual({ status: 'empty' });
  });

  it('rejects a 0x00 inside the JSON and invalid fields, but ignores unknown keys', async () => {
    const seal = async (json: string, at = 0) => {
      const bytes = new Uint8Array(PAYLOAD_BYTES);
      bytes.set(new TextEncoder().encode(json), at);
      return readFragment(await sealFragment(bytes), NOW);
    };
    const good = JSON.stringify(payloadFor(config, 'Bernd', 1));
    expect(await seal(good)).toMatchObject({ status: 'ok' });
    expect(await seal(good.replace('}', ',"z":1}'))).toMatchObject({ status: 'ok' });
    expect(await seal(good.replace('"Bernd"', '"Ber\\u0000nd"'))).toMatchObject({ status: 'ok', payload: { r: 'Bernd' } });
    expect(await seal(good, 1)).toEqual({ status: 'invalid' });
    expect(await seal(good.replace('engerl-bengerl', 'pyramid'))).toEqual({ status: 'invalid' });
    expect(await seal(good.replace('"n":1', '"n":0'))).toEqual({ status: 'invalid' });
    expect(await seal(good.replace('2026-12-20', '2026-02-30'))).toEqual({ status: 'invalid' });
    expect(await seal('[1,2]')).toEqual({ status: 'invalid' });
    const withNul = encodePayload(payloadFor(config, 'Bernd', 1));
    withNul[3] = 0;
    expect(decodePayload(withNul)).toBeNull();
  });

  it('refuses draws that do not fit into 256 bytes before the draw, and says how much is free', () => {
    const tooLong = structuredClone(config);
    tooLong.gifts.hints = { Clara: 'x'.repeat(200) };
    tooLong.gifts.theme = 'y'.repeat(40);
    expect(oversizedDraws(config, 1)).toEqual([]);
    const over = oversizedDraws(tooLong, 1);
    expect(over.map((o) => o.name)).toEqual(['Clara']);
    expect(freeHintBytes(tooLong, 'Clara', 1)).toBe(-over[0]!.overBy);
    expect(() => encodePayload(payloadFor(tooLong, 'Clara', 1))).toThrow(RangeError);
  });

  it('removes the fragment from the address bar before anything else', () => {
    const replaceState = vi.fn();
    const fragment = takeFragment({ hash: '#1.abc.def', pathname: '/SecretEngerl/', search: '' }, { replaceState });
    expect(fragment).toBe('#1.abc.def');
    expect(replaceState).toHaveBeenCalledWith(null, '', '/SecretEngerl/');
  });
});
