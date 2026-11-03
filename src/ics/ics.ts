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

/** An all-day calendar entry. */
export interface CalendarDay {
  date: string;
  summary: string;
}

/**
 * The Sundays of Advent before an exchange date: the four Sundays before
 * Christmas of that Advent season, up to the exchange date. Dates are ISO.
 */
export function adventSundays(exchangeDate: string): string[] {
  const [y, m] = exchangeDate.split('-').map(Number) as [number, number];
  // An exchange in January still belongs to the Advent of the year before.
  const year = m >= 11 ? y : y - 1;
  const christmas = Date.UTC(year, 11, 25);
  const daysBack = new Date(christmas).getUTCDay() || 7;
  const fourth = christmas - daysBack * 86_400_000;
  return [3, 2, 1, 0]
    .map((weeks) => new Date(fourth - weeks * 7 * 86_400_000).toISOString().slice(0, 10))
    .filter((date) => date <= exchangeDate);
}

/** A calendar file with one all-day event per entry. `uid` should be random; `now` sets DTSTAMP. */
export function calendarFile(days: readonly CalendarDay[], uid: string, now: Date): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SecretEngerl//SecretEngerl//DE',
    'CALSCALE:GREGORIAN',
    ...days.flatMap((day, i) => [
      'BEGIN:VEVENT',
      `UID:${uid}-${i}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compactDate(day.date)}`,
      `DTEND;VALUE=DATE:${compactDate(nextDay(day.date))}`,
      `SUMMARY:${escapeText(day.summary)}`,
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

/** An all-day event on `exchangeDate` (ISO). `uid` should be random; `now` sets DTSTAMP. */
export function exchangeEvent(exchangeDate: string, uid: string, now: Date): string {
  return calendarFile([{ date: exchangeDate, summary: t('ics.summary') }], uid, now);
}
