import { describe, expect, it, vi } from 'vitest';
import { adventSundays, calendarFile, exchangeEvent } from '../src/ics/ics.ts';
import { shareDraw, shareMessage } from '../src/share/share.ts';
import { t } from '../src/i18n/i18n.ts';

describe('sharing', () => {
  const message = shareMessage('https://creo08.github.io/SecretEngerl/#1.k.c');

  it('puts the link into the message', () => {
    expect(message).toBe('Dein Engerl-Bengerl-Los 🎁\nNur für dich, bitte nicht weiterleiten.\nhttps://creo08.github.io/SecretEngerl/#1.k.c');
  });

  it('uses the share sheet when supported', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    expect(await shareDraw(message, { canShare: () => true, share, clipboard: { writeText } } as never)).toBe('shared');
    expect(share).toHaveBeenCalledWith({ text: message });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('reports a cancelled share sheet', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('no', 'AbortError'));
    expect(await shareDraw(message, { canShare: () => true, share, clipboard: { writeText: vi.fn() } } as never)).toBe('cancelled');
  });

  it('falls back to the clipboard without Web Share', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await shareDraw(message, { clipboard: { writeText } } as never)).toBe('copied');
    expect(writeText).toHaveBeenCalledWith(message);
    expect(await shareDraw(message, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error()) } } as never)).toBe('failed');
  });
});

describe('Advent Sundays', () => {
  it('are the four Sundays before Christmas, up to the exchange', () => {
    // 2026: Christmas is a Friday, the fourth Sunday of Advent is 20 December.
    expect(adventSundays('2026-12-24')).toEqual(['2026-11-29', '2026-12-06', '2026-12-13', '2026-12-20']);
    expect(adventSundays('2026-12-15')).toEqual(['2026-11-29', '2026-12-06', '2026-12-13']);
    // 2022: Christmas is a Sunday, so the fourth Sunday of Advent is 18 December.
    expect(adventSundays('2022-12-24')).toEqual(['2022-11-27', '2022-12-04', '2022-12-11', '2022-12-18']);
    // An exchange in January belongs to the Advent before.
    expect(adventSundays('2027-01-06')).toEqual(['2026-11-29', '2026-12-06', '2026-12-13', '2026-12-20']);
  });

  it('become one event each in one calendar file', () => {
    const ics = calendarFile([{ date: '2026-11-29', summary: 'Woche 1; rot' }, { date: '2026-12-06', summary: 'Woche 2' }], 'u', new Date(Date.UTC(2026, 10, 1)));
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain('UID:u-1\r\n');
    expect(ics).toContain('SUMMARY:Woche 1\\; rot\r\n');
  });
});

describe('calendar entry', () => {
  it('is an all-day event without any name', () => {
    const ics = exchangeEvent('2026-12-31', 'a1b2', new Date(Date.UTC(2026, 11, 1, 8, 30)));
    expect(ics).toContain('DTSTART;VALUE=DATE:20261231\r\n');
    expect(ics).toContain('DTEND;VALUE=DATE:20270101\r\n');
    expect(ics).toContain('DTSTAMP:20261201T083000Z\r\n');
    expect(ics).toContain('SUMMARY:Engerl-Bengerl Übergabe\r\n');
    expect(ics.split('\r\n').filter((l) => l.startsWith('DESCRIPTION') || l.startsWith('ATTENDEE'))).toEqual([]);
  });
});

describe('texts', () => {
  it('fills placeholders and fails loudly on a missing key', () => {
    expect(t('share.message', { link: 'L' }).endsWith('\nL')).toBe(true);
    expect(() => t('nope')).toThrow();
  });
});
