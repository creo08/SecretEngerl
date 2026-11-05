/** Locale-aware formatting in the current language. */
import { language, locale } from './i18n.ts';

/**
 * Formats a budget the way the draw shows it: "20 €" or "12,50 €" in German.
 * Outside German a round is not tied to the euro, so only the amount is shown.
 */
export function formatBudget(amount: number): string {
  const digits = Number.isInteger(amount) ? 0 : 2;
  const number = new Intl.NumberFormat(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount);
  return language() === 'de' ? `${number} €` : number;
}

/** Formats an ISO date as a long date, e.g. "20. Dezember 2026". */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat(locale(), { dateStyle: 'long', timeZone: 'UTC' }).format(Date.UTC(y, m - 1, d));
}

/** Formats a moment (milliseconds) with date and time. */
export function formatDateTime(ms: number): string {
  return new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(ms);
}

/** "Anna, Bernd und Clara". */
export function formatList(items: readonly string[]): string {
  return new Intl.ListFormat(locale(), { type: 'conjunction' }).format(items);
}

/** "392.160" in German grouping. */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat(locale()).format(n);
}
