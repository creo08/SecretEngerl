/**
 * Vite plugin for the static site. At build time it renders the help and form
 * pages from docs/guide/*.<lang>.md into plain HTML for every language (readable without JavaScript),
 * adds canonical URLs and JSON-LD, writes sitemap.xml, llms.txt, the pre-fill
 * page /neu/ and redirects from old addresses, and fills the service worker's
 * precache list and version from the finished bundle.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { Marked, type Tokens } from 'marked';
import type { Plugin } from 'vite';
import de from '../src/i18n/de.json' with { type: 'json' };
import en from '../src/i18n/en.json' with { type: 'json' };
import { LANGUAGES, type Language } from '../src/i18n/i18n.ts';
import { PAGE_PATHS, pageFromGermanPath, type PageId } from '../src/site/pages.ts';

type Texts = Record<string, unknown>;
const TEXTS: Record<Language, Texts> = { de, en };

/** A plain text from a language file, for the static pages. */
function text(lang: Language, key: string): string {
  const value = TEXTS[lang][key];
  if (typeof value !== 'string') throw new Error(`missing text for the site: ${lang} ${key}`);
  return value;
}

/** Help and form pages: every page id except the app; `form-*` pages carry HowTo data. */
export const PAGES = (Object.keys(PAGE_PATHS) as PageId[]).filter((id) => id !== 'home');

/** Addresses of v0.1.0 and v0.2.0 that moved; each keeps a page that forwards without script. */
export const REDIRECTS = [
  { from: 'vorlagen/engerl-bengerl/', to: 'engerl-bengerl/' },
  { from: 'vorlagen/schrottwichteln/', to: 'schrottwichteln/' },
  { from: 'vorlagen/familien-wichteln/', to: 'familien-wichteln/' },
  { from: 'vorlagen/buero-wichteln/', to: 'buero-wichteln/' },
] as const;

const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; worker-src 'self'; base-uri 'none'; form-action 'none'";

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** A JSON-LD data block. It is data, not script: browsers never run it and the policy does not apply. */
export function jsonLd(data: object): string {
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

/**
 * Replaces `<!-- variant: Name -->` with the description in the original
 * language from docs/variants.<lang>.md: the quote and, if present, its translation line.
 */
export function insertVariants(markdown: string, variants: string): string {
  return markdown.replace(/<!-- variant: (.+?) -->/g, (_, name: string) => {
    const lines = variants.split('\n');
    const start = lines.findIndex((l) => l.startsWith(`### ${name} (`));
    if (start === -1) throw new Error(`variant not found: ${name}`);
    const block: string[] = [];
    for (let i = start + 1; i < lines.length && !lines[i]!.startsWith('#'); i++) block.push(lines[i]!);
    return block.join('\n').trim();
  });
}

/** The first ordered list of a page as plain-text steps, for the HowTo data. */
export function howToSteps(markdown: string): string[] {
  const list = new Marked().lexer(markdown).find((t): t is Tokens.List => t.type === 'list' && t.ordered);
  return (list?.items ?? []).map((item) => item.text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*/g, '').trim());
}

/** Everything a page needs to know about where it lives. */
interface PageContext {
  id: PageId;
  lang: Language;
  css: string;
  /** Absolute URL of a page in a language. */
  url: (id: PageId, lang: Language) => string;
  /** Extra tags for the head, e.g. JSON-LD. */
  head?: string;
}

function title(markdown: string): string {
  return /^# (.+)$/m.exec(markdown)?.[1] ?? 'SecretEngerl';
}

/** The `<link rel="alternate">` tags of a page in every language, and the canonical one. */
export function alternates(id: PageId, lang: Language, url: (id: PageId, lang: Language) => string): string {
  const links = LANGUAGES.map((l) => `<link rel="alternate" hreflang="${l}" href="${escapeHtml(url(id, l))}">`);
  links.push(`<link rel="alternate" hreflang="x-default" href="${escapeHtml(url(id, 'de'))}">`);
  return `<link rel="canonical" href="${escapeHtml(url(id, lang))}">\n    ${links.join('\n    ')}`;
}

/** The line under the header on translated pages; German pages have none. */
function aiNote(lang: Language): string {
  return lang === 'de' ? '' : `\n      <p class="container ai-note">${escapeHtml(text(lang, 'page.aiNote'))} <a href="https://github.com/creo08/SecretEngerl/issues">${escapeHtml(text(lang, 'page.aiFix'))}</a></p>`;
}

/** Renders one help or form page to a complete HTML document. */
export function renderPage(markdown: string, page: PageContext): string {
  const { lang } = page;
  const rel = '../'.repeat(PAGE_PATHS[page.id][lang].split('/').length - 1);
  const to = (id: PageId) => rel + PAGE_PATHS[id][lang] || './';
  const marked = new Marked({
    walkTokens(token) {
      if (token.type !== 'link' || !token.href.startsWith('app:')) return;
      // The sources link with German paths; each language points at its own page or app.
      const target = token.href.slice(4);
      const query = target.startsWith('?') ? target : '';
      const id = query ? 'home' : pageFromGermanPath(target);
      if (!id) throw new Error(`unknown app link in ${page.id}.${lang}.md: ${token.href}`);
      token.href = rel + PAGE_PATHS[id][lang] + query || './';
    },
  });
  const body = marked.parse(markdown, { async: false });
  // A paragraph holding only a link into the app is the page's one action: set it as the primary button.
  const html = body.replace(/<p><a href="([^"]*\?(?:vorlage|spiel)=[^"]*)">([^<]+)<\/a><\/p>/g, '<p class="start"><a class="btn btn--ink" href="$1">$2</a></p>');
  const description = /^# .+\n+([^\n#<].+)$/m.exec(markdown)?.[1]?.slice(0, 160) ?? '';
  const x = (key: string) => escapeHtml(text(lang, key));
  const languages = LANGUAGES.map((l) => `<li><a href="${rel + PAGE_PATHS[page.id][l] || './'}" lang="${l}" hreflang="${l}">${escapeHtml(text(l, `lang.${l}`))}</a></li>`).join('');
  return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta http-equiv="Content-Security-Policy" content="${CSP}">
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="referrer" content="no-referrer">
    <title>${escapeHtml(title(markdown))} · SecretEngerl</title>
    <meta name="description" content="${escapeHtml(description.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'))}">
    ${alternates(page.id, lang, page.url)}
    <link rel="stylesheet" href="${rel}${page.css}">
    <link rel="icon" href="${rel}icons/icon.svg" type="image/svg+xml">
    <link rel="manifest" href="${rel}manifest.webmanifest">
    ${page.head ?? ''}
  </head>
  <body>
    <a class="skip" href="#main">${x('page.skip')}</a>
    <header class="masthead">
      <div class="container masthead-row">
        <a class="wordmark" href="${to('home')}" aria-label="${x('page.homeLabel')}">SecretEngerl</a>
        <nav aria-label="${x('page.help')}">
          <ul class="nav">
            <li><a href="${to('how-it-works')}">${x('page.howItWorks')}</a></li>
            <li><a href="${to('security')}">${x('page.security')}</a></li>
            <li><a href="${to('faq')}">${x('page.faq')}</a></li>
          </ul>
        </nav>
      </div>${aiNote(lang)}
    </header>
    <main id="main" class="container">
      <article class="doc">
${html}
      </article>
    </main>
    <footer class="site-footer">
      <div class="container footer-row">
        <p class="wordmark">SecretEngerl</p>
        <ul class="footer-links">
          <li><a href="${to('how-it-works')}">${x('page.howItWorks')}</a></li>
          <li><a href="${to('security')}">${x('page.securityLong')}</a></li>
          <li><a href="${to('faq')}">${x('page.faq')}</a></li>
          <li><a href="${to('privacy-notice')}">${x('page.privacy')}</a></li>
          <li><a href="https://github.com/creo08/SecretEngerl">${x('page.source')}</a></li>
        </ul>
        <ul class="footer-links lang-links" aria-label="${x('page.language')}">${languages}</ul>
        <p class="muted small">${x('page.license')}</p>
      </div>
    </footer>
  </body>
</html>
`;
}

/**
 * The app's start page in `lang`, made from the built German one: texts marked
 * with `data-t` and `data-t-attr`, links marked with `data-page`, the language,
 * the canonical and alternate links, and the AI note.
 */
export function localizeIndex(html: string, lang: Language, base: string, head: string): string {
  const fill = (key: string) => escapeHtml(text(lang, key));
  let out = html
    .replace('<html lang="de">', `<html lang="${lang}">`)
    .replace(/(<(\w+)\b[^>]*\sdata-t="([\w.-]+)"[^>]*>)[^<]*(<\/\2>)/g, (_, open: string, _tag, key: string, close: string) => open + fill(key) + close)
    .replace(/<[^>]*\sdata-t-attr="([\w-]+):([\w.-]+)"[^>]*>/g, (tag: string, attr: string, key: string) => tag.replace(new RegExp(`\\s${attr}="[^"]*"`), ` ${attr}="${fill(key)}"`))
    .replace(/<a\b[^>]*\sdata-page="([\w-]+)"[^>]*>/g, (tag: string, id: string) => tag.replace(/\shref="[^"]*"/, ` href="${base}${PAGE_PATHS[id as PageId][lang]}"`))
    .replace(/<!-- site-head -->[\s\S]*<!-- \/site-head -->/, head);
  if (lang !== 'de') out = out.replace(' data-ai-note hidden>', ' data-ai-note>');
  return out;
}

/** A page that forwards to `to` without script and names it as canonical. */
export function renderRedirect(to: string, toUrl: string, css: string, depth: number): string {
  const rel = '../'.repeat(depth);
  return `<!doctype html>
<html lang="de">
  <head>
    <meta http-equiv="Content-Security-Policy" content="${CSP}">
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="referrer" content="no-referrer">
    <meta name="robots" content="noindex">
    <meta http-equiv="refresh" content="0; url=${rel}${to}">
    <title>Umgezogen · SecretEngerl</title>
    <link rel="canonical" href="${escapeHtml(toUrl)}">
    <link rel="stylesheet" href="${rel}${css}">
  </head>
  <body>
    <main id="main" class="container doc">
      <p>Diese Seite ist umgezogen: <a href="${rel}${to}">weiter zur neuen Adresse</a>.</p>
    </main>
  </body>
</html>
`;
}

/** sitemap.xml for the given absolute URLs. */
export function sitemap(urls: readonly string[]): string {
  const entries = urls.map((u) => `  <url><loc>${escapeHtml(u)}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile())
    .map((e) => relative(dir, join(e.parentPath, e.name)).split('\\').join('/'));
}

/** The plugin. `root` is the project root, `origin` the host the site is served from. */
export function sitePlugin(root: string, origin: string): Plugin {
  let base = '/';
  let publicDir = join(root, 'public');
  const absolute = (path: string) => `${origin}${base}${path}`;
  const pageUrl = (id: PageId, lang: Language) => absolute(PAGE_PATHS[id][lang]);
  /** Canonical, alternates and WebApplication data of the app's start page in `lang`, between markers. */
  const appHead = (lang: Language) => {
    const app = {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'SecretEngerl',
      url: pageUrl('home', lang),
      description: text(lang, 'page.description'),
      inLanguage: lang,
      applicationCategory: 'LifestyleApplication',
      operatingSystem: 'Any, in the browser',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    };
    return `<!-- site-head -->${alternates('home', lang, pageUrl)}\n    ${jsonLd(app)}<!-- /site-head -->`;
  };
  return {
    name: 'secretengerl-site',
    enforce: 'post',
    configResolved(config) {
      base = config.base;
      publicDir = config.publicDir;
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        // Vite's dev server injects inline styles; the policy applies to the built site only.
        if (ctx.server) return html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\s*/, '');
        return html.replace('</head>', `  ${appHead('de')}\n  </head>`);
      },
    },
    generateBundle(_, bundle) {
      const css = Object.values(bundle).find((f) => f.type === 'asset' && f.fileName.endsWith('.css'))?.fileName;
      const index = bundle['index.html'];
      if (!css || !index || index.type !== 'asset') throw new Error('stylesheet or index.html missing from the bundle');
      // Files emitted in this hook do not show up in `bundle` yet, so they are also kept here.
      const emitted = new Map<string, string>();
      const emit = (fileName: string, source: string) => {
        this.emitFile({ type: 'asset', fileName, source });
        emitted.set(fileName, source);
      };

      for (const lang of LANGUAGES) {
        const variants = readFileSync(join(root, `docs/variants.${lang === 'de' ? 'de' : 'en'}.md`), 'utf8');
        for (const id of PAGES) {
          const markdown = insertVariants(readFileSync(join(root, 'docs/guide', `${id}.${lang}.md`), 'utf8'), variants);
          const head = id.startsWith('form-')
            ? jsonLd({
                '@context': 'https://schema.org',
                '@type': 'HowTo',
                name: title(markdown),
                url: pageUrl(id, lang),
                inLanguage: lang,
                step: howToSteps(markdown).map((text, i) => ({ '@type': 'HowToStep', position: i + 1, text })),
              })
            : '';
          emit(`${PAGE_PATHS[id][lang]}index.html`, renderPage(markdown, { id, lang, css, url: pageUrl, head }));
        }
        if (lang !== 'de') emit(`${PAGE_PATHS.home[lang]}index.html`, localizeIndex(String(index.source), lang, base, appHead(lang)));
      }
      for (const r of REDIRECTS) emit(`${r.from}index.html`, renderRedirect(r.to, absolute(r.to), css, r.from.split('/').length - 1));

      // The pre-fill page is the app itself under /neu/; its links are absolute, so the same HTML works there.
      const app = String(index.source);
      emit('neu/index.html', app.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n    <meta name="robots" content="noindex">'));
      emit('sitemap.xml', sitemap(LANGUAGES.flatMap((lang) => (Object.keys(PAGE_PATHS) as PageId[]).map((id) => pageUrl(id, lang)))));
      emit('llms.txt', readFileSync(join(root, 'src/site/llms.txt'), 'utf8').replaceAll('{{app}}', absolute('')));

      const sw = bundle['sw.js'];
      if (!sw || sw.type !== 'chunk') throw new Error('sw.js missing from the bundle');
      const hash = createHash('sha256');
      const files: string[] = [];
      const add = (name: string, content: string | Uint8Array) => {
        files.push(name);
        hash.update(name).update(content);
      };
      for (const [name, file] of Object.entries(bundle)) if (name !== 'sw.js' && !name.endsWith('.map')) add(name, file.type === 'chunk' ? file.code : file.source);
      for (const [name, source] of emitted) add(name, source);
      for (const name of listFiles(publicDir)) add(name, readFileSync(join(publicDir, name)));
      const urls = files
        .filter((f) => !/\.(txt|xml)$/.test(f) && !REDIRECTS.some((r) => f.startsWith(r.from)))
        .sort()
        .map((f) => base + f.replace(/(^|\/)index\.html$/, '$1'));
      sw.code = sw.code.replaceAll('__PRECACHE__', JSON.stringify(urls)).replaceAll('__CACHE_VERSION__', JSON.stringify(hash.digest('hex').slice(0, 16)));
    },
  };
}
