/** Locale-aware formatting. German first; the locale becomes a parameter when more languages arrive. */

const LOCALE = 'de-AT';

/** Formats a budget the way the draw shows it, e.g. "20 €" or "12,50 €". */
export function formatBudget(amount: number): string {
  const digits = Number.isInteger(amount) ? 0 : 2;
  const number = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount);
  return `${number} €`;
}

/** Formats an ISO date as a long German date, e.g. "20. Dezember 2026". */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'long', timeZone: 'UTC' }).format(Date.UTC(y, m - 1, d));
}

/** Formats a moment (milliseconds) with date and time. */
export function formatDateTime(ms: number): string {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeStyle: 'short' }).format(ms);
}

/** "Anna, Bernd und Clara". */
export function formatList(items: readonly string[]): string {
  return new Intl.ListFormat(LOCALE, { type: 'conjunction' }).format(items);
}

/** "392.160" in German grouping. */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat(LOCALE).format(n);
}
