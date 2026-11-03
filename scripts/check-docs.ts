/**
 * Checks that every English document in docs/ has a German counterpart with
 * the same structure. Run with `npm run check:docs`; exits non-zero on errors.
 *
 * Rules per pair `x.en.md` / `x.de.md`:
 * - both files exist,
 * - the same sequence of heading levels,
 * - the same number of quote blocks in each section,
 * - every quote in a language other than the file's own is followed by a
 *   translation line ("English:" or "Deutsch:"). The quote's language comes
 *   from the parentheses of the nearest heading, e.g. "### Julklapp (Svenska)",
 *   or from a language name in the heading text.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

type Lang = 'en' | 'de';

interface Section {
  heading: string;
  level: number;
  /** Line numbers (1-based) where quote blocks start. */
  quotes: { line: number; lang: string | undefined; translated: boolean }[];
}

const TRANSLATION_PREFIX: Record<Lang, string> = { en: 'English:', de: 'Deutsch:' };

/** Language names as they appear in headings, mapped to language codes. */
const LANGUAGE_NAMES: Record<string, string> = {
  german: 'de', deutsch: 'de',
  english: 'en', englischen: 'en',
  svenska: 'sv', swedish: 'sv',
  español: 'es', spanish: 'es',
  português: 'pt', portuguese: 'pt',
  nederlands: 'nl', dutch: 'nl',
  polski: 'pl', polish: 'pl',
  українська: 'uk', ukrainian: 'uk',
  filipino: 'fil',
};

/** Finds the language a heading names, preferring its parentheses. */
export function headingLanguage(heading: string): string | undefined {
  const paren = /\(([^)]*)\)\s*$/.exec(heading)?.[1];
  const candidates = paren ? [paren.split(',')[0]!.trim()] : heading.split(/[^\p{L}]+/u);
  for (const word of candidates) {
    const code = LANGUAGE_NAMES[word.toLowerCase()];
    if (code) return code;
  }
  return undefined;
}

/** Splits Markdown into sections at headings, skipping fenced code blocks. */
export function parseSections(markdown: string, lang: Lang): Section[] {
  const lines = markdown.split('\n');
  const sections: Section[] = [{ heading: '(start)', level: 0, quotes: [] }];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith('```')) inFence = !inFence;
    if (inFence) continue;
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      sections.push({ heading: h[2]!, level: h[1]!.length, quotes: [] });
      continue;
    }
    const isQuoteStart = line.startsWith('>') && !(lines[i - 1] ?? '').startsWith('>');
    if (!isQuoteStart) continue;
    let j = i;
    while (j < lines.length && lines[j]!.startsWith('>')) j++;
    while (j < lines.length && lines[j]!.trim() === '') j++;
    const section = sections[sections.length - 1]!;
    section.quotes.push({
      line: i + 1,
      lang: headingLanguage(section.heading),
      translated: (lines[j] ?? '').startsWith(TRANSLATION_PREFIX[lang]),
    });
  }
  return sections;
}

/** Compares one English/German pair and returns error messages. */
export function comparePair(en: string, de: string, name: string): string[] {
  const errors: string[] = [];
  const a = parseSections(en, 'en');
  const b = parseSections(de, 'de');
  const levels = (s: Section[]) => s.map((x) => x.level).join(',');
  if (levels(a) !== levels(b)) {
    errors.push(`${name}: heading structure differs (${a.length - 1} vs ${b.length - 1} headings, or different levels)`);
    return errors;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i]!.quotes.length !== b[i]!.quotes.length) {
      errors.push(`${name}: section "${a[i]!.heading}" has ${a[i]!.quotes.length} quote(s) in English, ${b[i]!.quotes.length} in German`);
    }
  }
  for (const [lang, sections] of [['en', a], ['de', b]] as const) {
    for (const s of sections) {
      for (const q of s.quotes) {
        if (!q.lang) errors.push(`${name}.${lang}.md:${q.line}: cannot tell the language of this quote from "${s.heading}"`);
        else if (q.lang !== lang && !q.translated) {
          errors.push(`${name}.${lang}.md:${q.line}: quote in "${q.lang}" needs a line starting with "${TRANSLATION_PREFIX[lang]}"`);
        }
      }
    }
  }
  return errors;
}

function listMarkdown(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && /\.(en|de)\.md$/.test(e.name))
    .map((e) => join(e.parentPath, e.name));
}

function main(): void {
  const root = 'docs';
  const files = new Set(listMarkdown(root));
  const errors: string[] = [];
  for (const file of files) {
    const other = file.endsWith('.en.md') ? file.replace(/\.en\.md$/, '.de.md') : file.replace(/\.de\.md$/, '.en.md');
    if (!files.has(other)) errors.push(`${relative('.', file)}: missing counterpart ${relative('.', other)}`);
    if (!file.endsWith('.en.md') || !files.has(other)) continue;
    const name = relative('.', file).replace(/\.en\.md$/, '');
    errors.push(...comparePair(readFileSync(file, 'utf8'), readFileSync(other, 'utf8'), name));
  }
  if (errors.length) {
    for (const e of errors) console.error(e);
    process.exit(1);
  }
  console.log(`docs: ok (${files.size} files)`);
}

if (import.meta.main) main();
