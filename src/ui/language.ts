/**
 * Which language the app shows, and relabelling a page in place.
 * The address decides the language of a page; a draw link and the pre-fill page
 * follow the stored choice or the browser instead, so the draw in the address is never lost.
 */
import { isLanguage, language, setLanguage, t, type Language } from '../i18n/i18n.ts';
import { isPageId, PAGE_PATHS } from '../site/pages.ts';

const STORAGE_KEY = 'secretengerl-lang';

/** The language chosen in the footer earlier, if any. Storage can be blocked; then there is none. */
export function storedLanguage(): Language | undefined {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isLanguage(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Remembers the language chosen in the footer. */
export function storeLanguage(lang: Language): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Without storage the choice simply is not remembered.
  }
}

/** The first of the browser's languages the app is translated into. */
export function browserLanguage(languages: readonly string[] = navigator.languages): Language | undefined {
  return languages.map((l) => l.slice(0, 2).toLowerCase()).find(isLanguage);
}

/** The start page of the app in the current language. */
export function homeUrl(): string {
  return import.meta.env.BASE_URL + PAGE_PATHS.home[language()];
}

/** Loads `lang` and rewrites every marked text, attribute and link of the page in it. */
export async function relabelPage(lang: Language): Promise<void> {
  await setLanguage(lang);
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll<HTMLElement>('[data-t]')) el.textContent = t(el.dataset.t!);
  for (const el of document.querySelectorAll<HTMLElement>('[data-t-attr]')) {
    const [attr, key] = el.dataset.tAttr!.split(':') as [string, string];
    el.setAttribute(attr, t(key));
  }
  for (const a of document.querySelectorAll<HTMLAnchorElement>('a[data-page]')) {
    if (isPageId(a.dataset.page)) a.href = import.meta.env.BASE_URL + PAGE_PATHS[a.dataset.page][lang];
  }
  for (const note of document.querySelectorAll<HTMLElement>('[data-ai-note]')) note.hidden = lang === 'de';
}

