/**
 * Calendar entry for the exchange day, made on the device. It never contains
 * the Bengerl's name, because calendars sync to the cloud.
 */
import { t } from '../i18n/i18n.ts';

const compactDate = (iso: string) => iso.replaceAll('-', '');

function nextDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** Escapes text for an iCalendar TEXT value (RFC 5545 section 3.3.11). */
function escapeText(text: string): string {
  return text.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
}

/** An all-day event on `exchangeDate` (ISO). `uid` should be random; `now` sets DTSTAMP. */
export function exchangeEvent(exchangeDate: string, uid: string, now: Date): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SecretEngerl//SecretEngerl//DE',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compactDate(exchangeDate)}`,
    `DTEND;VALUE=DATE:${compactDate(nextDay(exchangeDate))}`,
    `SUMMARY:${escapeText(t('ics.summary'))}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}
