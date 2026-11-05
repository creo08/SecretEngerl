/**
 * Vite plugin for the static site. At build time it renders the help and form
 * pages from docs/guide/*.de.md into plain HTML (readable without JavaScript),
 * adds canonical URLs and JSON-LD, writes sitemap.xml, llms.txt, the pre-fill
 * page /neu/ and redirects from old addresses, and fills the service worker's
 * precache list and version from the finished bundle.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { Marked, type Tokens } from 'marked';
import type { Plugin } from 'vite';

/** Help and form pages: source in docs/guide, URL path below the base. Form pages name their template. */
export const PAGES = [
  { src: 'how-it-works', path: 'so-funktionierts/' },
  { src: 'security', path: 'sicherheit/' },
  { src: 'faq', path: 'faq/' },
  { src: 'privacy-notice', path: 'datenschutz/' },
  { src: 'form-engerl-bengerl', path: 'engerl-bengerl/', template: 'engerl-bengerl' },
  { src: 'form-wichteln', path: 'wichteln/', template: 'engerl-bengerl' },
  { src: 'form-schrottwichteln', path: 'schrottwichteln/', template: 'schrottwichteln' },
  { src: 'form-familien-wichteln', path: 'familien-wichteln/', template: 'familien-wichteln' },
  { src: 'form-buero-wichteln', path: 'buero-wichteln/', template: 'buero-wichteln' },
  { src: 'form-post-wichteln', path: 'post-wichteln/', template: 'post-wichteln' },
  { src: 'form-advent-engerl', path: 'advent-engerl/', template: 'advent-engerl' },
] as const;

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
  /** Number of path segments below the base. */
  depth: number;
  css: string;
  /** Absolute URL of this page. */
  url: string;
  /** Extra tags for the head, e.g. JSON-LD. */
  head?: string;
}

function title(markdown: string): string {
  return /^# (.+)$/m.exec(markdown)?.[1] ?? 'SecretEngerl';
}

/** Renders one help or form page to a complete HTML document. */
export function renderPage(markdown: string, page: PageContext): string {
  const rel = '../'.repeat(page.depth);
  const marked = new Marked({
    walkTokens(token) {
      if (token.type === 'link' && token.href.startsWith('app:')) token.href = rel + token.href.slice(4) || './';
    },
  });
  const body = marked.parse(markdown, { async: false });
  // A paragraph holding only a link into the app is the page's one action: set it as the primary button.
  const html = body.replace(/<p><a href="([^"]*\?vorlage=[^"]*)">([^<]+)<\/a><\/p>/g, '<p class="start"><a class="btn btn--ink" href="$1">$2</a></p>');
  const description = /^# .+\n+([^\n#<].+)$/m.exec(markdown)?.[1]?.slice(0, 160) ?? '';
  return `<!doctype html>
<html lang="de">
  <head>
    <meta http-equiv="Content-Security-Policy" content="${CSP}">
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="referrer" content="no-referrer">
    <title>${escapeHtml(title(markdown))} · SecretEngerl</title>
    <meta name="description" content="${escapeHtml(description.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'))}">
    <link rel="canonical" href="${escapeHtml(page.url)}">
    <link rel="stylesheet" href="${rel}${page.css}">
    <link rel="icon" href="${rel}icons/icon.svg" type="image/svg+xml">
    <link rel="manifest" href="${rel}manifest.webmanifest">
    ${page.head ?? ''}
  </head>
  <body>
    <a class="skip" href="#main">Zum Inhalt</a>
    <header class="masthead">
      <div class="container masthead-row">
        <a class="wordmark" href="${rel || './'}" aria-label="SecretEngerl, Startseite">SecretEngerl</a>
        <nav aria-label="Hilfe">
          <ul class="nav">
            <li><a href="${rel}so-funktionierts/">So funktioniert’s</a></li>
            <li><a href="${rel}sicherheit/">Sicherheit</a></li>
            <li><a href="${rel}faq/">FAQ</a></li>
          </ul>
        </nav>
      </div>
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
          <li><a href="${rel}so-funktionierts/">So funktioniert’s</a></li>
          <li><a href="${rel}sicherheit/">Datenschutz und Sicherheit</a></li>
          <li><a href="${rel}faq/">FAQ</a></li>
          <li><a href="${rel}datenschutz/">Datenschutzhinweis</a></li>
          <li><a href="https://github.com/creo08/SecretEngerl">Quellcode auf GitHub</a></li>
        </ul>
        <p class="muted small">Open Source unter MIT. Alle Texte sind maschinell erstellt.</p>
      </div>
    </footer>
  </body>
</html>
`;
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
        const description = /<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? '';
        const app = {
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'SecretEngerl',
          url: absolute(''),
          description,
          inLanguage: 'de',
          applicationCategory: 'LifestyleApplication',
          operatingSystem: 'Any, in the browser',
          isAccessibleForFree: true,
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        };
        return html.replace('</head>', `  <link rel="canonical" href="${absolute('')}">\n    ${jsonLd(app)}\n  </head>`);
      },
    },
    generateBundle(_, bundle) {
      const css = Object.values(bundle).find((f) => f.type === 'asset' && f.fileName.endsWith('.css'))?.fileName;
      const index = bundle['index.html'];
      if (!css || !index || index.type !== 'asset') throw new Error('stylesheet or index.html missing from the bundle');
      const variants = readFileSync(join(root, 'docs/variants.de.md'), 'utf8');
      // Files emitted in this hook do not show up in `bundle` yet, so they are also kept here.
      const emitted = new Map<string, string>();
      const emit = (fileName: string, source: string) => {
        this.emitFile({ type: 'asset', fileName, source });
        emitted.set(fileName, source);
      };

      for (const page of PAGES) {
        const markdown = insertVariants(readFileSync(join(root, 'docs/guide', `${page.src}.de.md`), 'utf8'), variants);
        const url = absolute(page.path);
        const head =
          'template' in page
            ? jsonLd({
                '@context': 'https://schema.org',
                '@type': 'HowTo',
                name: title(markdown),
                url,
                inLanguage: 'de',
                step: howToSteps(markdown).map((text, i) => ({ '@type': 'HowToStep', position: i + 1, text })),
              })
            : '';
        emit(`${page.path}index.html`, renderPage(markdown, { depth: page.path.split('/').length - 1, css, url, head }));
      }
      for (const r of REDIRECTS) emit(`${r.from}index.html`, renderRedirect(r.to, absolute(r.to), css, r.from.split('/').length - 1));

      // The pre-fill page is the app itself under /neu/; its links are absolute, so the same HTML works there.
      const app = String(index.source);
      emit('neu/index.html', app.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n    <meta name="robots" content="noindex">'));
      emit('sitemap.xml', sitemap([absolute(''), ...PAGES.map((p) => absolute(p.path))]));
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
