/**
 * Vite plugin for the static site: renders the help pages from docs/guide/*.de.md
 * into plain HTML (readable without JavaScript), and fills the service
 * worker's precache list and version from the finished bundle.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { Marked } from 'marked';
import type { Plugin } from 'vite';

/** Help pages: source in docs/guide, URL path below the base. */
export const PAGES = [
  { src: 'how-it-works', path: 'so-funktionierts/' },
  { src: 'security', path: 'sicherheit/' },
  { src: 'faq', path: 'faq/' },
  { src: 'privacy-notice', path: 'datenschutz/' },
  { src: 'template-engerl-bengerl', path: 'vorlagen/engerl-bengerl/' },
  { src: 'template-schrottwichteln', path: 'vorlagen/schrottwichteln/' },
  { src: 'template-familien-wichteln', path: 'vorlagen/familien-wichteln/' },
  { src: 'template-buero-wichteln', path: 'vorlagen/buero-wichteln/' },
] as const;

const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; worker-src 'self'; base-uri 'none'; form-action 'none'";

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

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

/** Renders one help page to a complete HTML document. `depth` is the number of path segments below the base. */
export function renderPage(markdown: string, depth: number, css: string): string {
  const rel = '../'.repeat(depth);
  const marked = new Marked({
    walkTokens(token) {
      if (token.type === 'link' && token.href.startsWith('app:')) token.href = rel + token.href.slice(4) || './';
    },
  });
  const body = marked.parse(markdown, { async: false });
  const title = /^# (.+)$/m.exec(markdown)?.[1] ?? 'SecretEngerl';
  const description = /^# .+\n+([^\n#<].+)$/m.exec(markdown)?.[1]?.slice(0, 160) ?? '';
  return `<!doctype html>
<html lang="de">
  <head>
    <meta http-equiv="Content-Security-Policy" content="${CSP}">
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="referrer" content="no-referrer">
    <title>${escapeHtml(title)} · SecretEngerl</title>
    <meta name="description" content="${escapeHtml(description.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'))}">
    <link rel="stylesheet" href="${rel}${css}">
    <link rel="icon" href="${rel}icons/icon.svg" type="image/svg+xml">
    <link rel="manifest" href="${rel}manifest.webmanifest">
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
${body}
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

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile())
    .map((e) => relative(dir, join(e.parentPath, e.name)).split('\\').join('/'));
}

/** The plugin. `root` is the project root. */
export function sitePlugin(root: string): Plugin {
  let base = '/';
  let publicDir = join(root, 'public');
  return {
    name: 'secretengerl-site',
    enforce: 'post',
    configResolved(config) {
      base = config.base;
      publicDir = config.publicDir;
    },
    transformIndexHtml: {
      order: 'pre',
      // Vite's dev server injects inline styles; the policy applies to the built site only.
      handler: (html, ctx) => (ctx.server ? html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\s*/, '') : html),
    },
    generateBundle(_, bundle) {
      const css = Object.values(bundle).find((f) => f.type === 'asset' && f.fileName.endsWith('.css'))?.fileName;
      if (!css) throw new Error('no stylesheet in the bundle');
      const variants = readFileSync(join(root, 'docs/variants.de.md'), 'utf8');
      const pages = new Map<string, string>();
      for (const page of PAGES) {
        const markdown = insertVariants(readFileSync(join(root, 'docs/guide', `${page.src}.de.md`), 'utf8'), variants);
        const html = renderPage(markdown, page.path.split('/').length - 1, css);
        this.emitFile({ type: 'asset', fileName: `${page.path}index.html`, source: html });
        pages.set(`${page.path}index.html`, html);
      }

      const sw = bundle['sw.js'];
      if (!sw || sw.type !== 'chunk') throw new Error('sw.js missing from the bundle');
      const hash = createHash('sha256');
      const files: string[] = [];
      for (const [name, file] of Object.entries(bundle)) {
        if (name === 'sw.js' || name.endsWith('.map')) continue;
        files.push(name);
        hash.update(name).update(file.type === 'chunk' ? file.code : file.source);
      }
      // Files emitted in this hook are not in `bundle` yet.
      for (const [name, html] of pages) {
        files.push(name);
        hash.update(name).update(html);
      }
      for (const name of listFiles(publicDir)) {
        files.push(name);
        hash.update(name).update(readFileSync(join(publicDir, name)));
      }
      const urls = files
        .filter((f) => !f.endsWith('.txt'))
        .sort()
        .map((f) => base + f.replace(/(^|\/)index\.html$/, '$1'));
      sw.code = sw.code.replaceAll('__PRECACHE__', JSON.stringify(urls)).replaceAll('__CACHE_VERSION__', JSON.stringify(hash.digest('hex').slice(0, 16)));
    },
  };
}
