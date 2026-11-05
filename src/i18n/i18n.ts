/** Texts come from language files; nothing user-facing is hard-coded. German first, others load on demand. */
import de from './de.json' with { type: 'json' };

type Texts = Record<string, string | Partial<Record<Intl.LDMLPluralRule, string>>>;

/** The languages the app is translated into, in the order of the concept. */
export const LANGUAGES = ['de', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

const LOCALES: Record<Language, string> = { de: 'de-AT', en: 'en-GB' };
const LOADERS: Record<Exclude<Language, 'de'>, () => Promise<{ default: Texts }>> = { en: () => import('./en.json', { with: { type: 'json' } }) };

let current: Language = 'de';
let texts: Texts = de;
let plural = new Intl.PluralRules(LOCALES.de);

/** True if `raw` is one of the app's languages. */
export function isLanguage(raw: unknown): raw is Language {
  return LANGUAGES.includes(raw as Language);
}

/** Switches all texts and formats to `lang`; German needs no loading. */
export async function setLanguage(lang: Language): Promise<void> {
  texts = lang === 'de' ? de : (await LOADERS[lang]()).default;
  current = lang;
  plural = new Intl.PluralRules(LOCALES[lang]);
}

/** The language texts currently come from. */
export function language(): Language {
  return current;
}

/** The locale for `Intl` formatting in the current language. */
export function locale(): string {
  return LOCALES[current];
}

/** True if the language file has `key`. */
export function hasText(key: string): boolean {
  return key in texts;
}

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
