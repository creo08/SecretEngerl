/** Texts come from language files; nothing user-facing is hard-coded. German first. */
import de from './de.json';

type Texts = Record<string, string | Partial<Record<Intl.LDMLPluralRule, string>>>;
const texts: Texts = de;
const plural = new Intl.PluralRules('de-AT');

/**
 * Returns the text for `key` with `{name}` placeholders filled in. A text with
 * plural forms picks its form by the number in `params.count`.
 */
export function t(key: string, params: Record<string, string | number> = {}): string {
  const entry = texts[key];
  if (entry === undefined) throw new Error(`missing text: ${key}`);
  const template = typeof entry === 'string' ? entry : (entry[plural.select(Number(params.count))] ?? entry.other ?? '');
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}
