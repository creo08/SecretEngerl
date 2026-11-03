/** Locale-aware formatting. German first; the locale becomes a parameter when more languages arrive. */

const LOCALE = 'de-AT';

/** Formats a budget the way the draw shows it, e.g. "20 €" or "12,50 €". */
export function formatBudget(amount: number): string {
  const digits = Number.isInteger(amount) ? 0 : 2;
  const number = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount);
  return `${number} €`;
}
