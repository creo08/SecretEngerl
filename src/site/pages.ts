/**
 * Where each page lives in each language, below the base path. The build renders
 * the pages from it, and the app uses it to point links at the right language.
 */
import type { Language } from '../i18n/i18n.ts';

/** Page ids: `home` is the app, the others are help and form pages from docs/guide/<id>.<lang>.md. */
export const PAGE_PATHS = {
  home: { de: '', en: 'en/' },
  'how-it-works': { de: 'so-funktionierts/', en: 'en/how-it-works/' },
  security: { de: 'sicherheit/', en: 'en/security/' },
  faq: { de: 'faq/', en: 'en/faq/' },
  'privacy-notice': { de: 'datenschutz/', en: 'en/privacy/' },
  'form-engerl-bengerl': { de: 'engerl-bengerl/', en: 'en/engerl-bengerl/' },
  'form-wichteln': { de: 'wichteln/', en: 'en/secret-santa/' },
  'form-schrottwichteln': { de: 'schrottwichteln/', en: 'en/schrottwichteln/' },
  'form-familien-wichteln': { de: 'familien-wichteln/', en: 'en/family-secret-santa/' },
  'form-buero-wichteln': { de: 'buero-wichteln/', en: 'en/office-secret-santa/' },
  'form-post-wichteln': { de: 'post-wichteln/', en: 'en/postal-secret-santa/' },
  'form-advent-engerl': { de: 'advent-engerl/', en: 'en/advent-engerl/' },
  'form-raeuberwichteln': { de: 'raeuberwichteln/', en: 'en/white-elephant/' },
  'form-wuerfelwichteln': { de: 'wuerfelwichteln/', en: 'en/dice-game/' },
  'form-zufallswichteln': { de: 'zufallswichteln/', en: 'en/random-secret-santa/' },
} as const satisfies Record<string, Record<Language, string>>;

export type PageId = keyof typeof PAGE_PATHS;

/** True if `raw` names a page. */
export function isPageId(raw: unknown): raw is PageId {
  return typeof raw === 'string' && Object.hasOwn(PAGE_PATHS, raw);
}

/** The page id behind a German path such as "sicherheit/", as the Markdown sources write their links. */
export function pageFromGermanPath(path: string): PageId | undefined {
  return (Object.keys(PAGE_PATHS) as PageId[]).find((id) => PAGE_PATHS[id].de === path);
}
