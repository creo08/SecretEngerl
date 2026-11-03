# AGENTS.md

Guide for AI tools and people working on this code. The specification is binding: [docs/concept.en.md](docs/concept.en.md) and [docs/variants.en.md](docs/variants.en.md). Where code and concept disagree, the concept wins. Never change the concept on your own; propose a diff and wait for the maintainer's explicit okay. English and German versions change in the same commit.

## What this is

SecretEngerl is a static web app (PWA) for Engerl-Bengerl, Wichteln and Secret Santa. There is no backend. The organizer draws in the browser, and each person gets an encrypted link whose key lives in the URL fragment.

## Layout

| Path | Purpose |
|---|---|
| `src/random/` | Randomness from `crypto.getRandomValues` only, unbiased integers and `BigInt`s |
| `src/config/` | Configuration model for categories A to K, templates as JSON, validation |
| `src/input/` | Validation of names, amounts and dates from URL, file and form |
| `src/losfee/` | Matching engine: rules, feasibility (Hopcroft-Karp, Hall), uniform draw, drop-out repair. No DOM. Gets its RNG from outside |
| `src/link/` | Link format v1: AES-GCM, 256-byte padding, expiry |
| `src/store/` | IndexedDB storage of a round on the organizer's device |
| `src/worker/` | Web Worker that runs `losfee` |
| `src/i18n/` | Language files; no user-facing text in code |
| `src/ui/` | DOM code |
| `src/sw/` | Service worker |
| `scripts/` | Repository checks and build helpers |
| `tests/` | Vitest tests; `tests/e2e/` holds Playwright tests |
| `docs/` | Specification and in-app documentation, `*.en.md` reference, `*.de.md` German |

## Commands

Node 26 (see `.nvmrc`).

```sh
npm ci                # install exactly the locked dev dependencies
npm test              # unit, property and statistics tests
npm run build         # type check and static build into dist/
npm run check:docs    # English/German docs have the same structure
npm run check:hygiene # identity and content rules for all commits
npm run test:e2e      # Playwright, against the built site
```

## Conventions

- Code, identifiers, comments and commits in English. App texts German first, from `src/i18n/`.
- TypeScript `strict`. Small modules with one job, TSDoc on every exported function, types for every data structure.
- Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `ci:`, `chore:`), small commits.
- No runtime dependencies and no UI framework. Every new dependency, dev dependencies included, needs the maintainer's okay.
- No code from AGPL projects (in particular cipher.ink). Ideas yes, code no.
- Example names are made up: Anna, Bernd, Clara, David, Eva …

## Privacy and security rules

- Randomness only from `crypto.getRandomValues`. `Math.random` must not appear in source; a test enforces it.
- Cryptography only through WebCrypto (`crypto.subtle`).
- User data reaches the DOM only via `textContent`, never `innerHTML`.
- Validate every input from URL, file and form. Errors show a friendly message, never a stack trace.
- No network requests at runtime except to the app's own origin. No third-party fonts, no CDN, no analytics.
- No inline scripts; the Content Security Policy from the concept is the first element in `<head>`.
- The service worker never reads `location.hash` and never calls `skipWaiting()` without the user's consent.
- IndexedDB and cache names start with `secretengerl-`.
- All GitHub Pages sites of `creo08` share the origin `https://creo08.github.io`, and with it IndexedDB and storage. No other Pages project may run on this account unless it is maintained the same way, and there must never be a repository `creo08.github.io`, because its service worker could control the whole origin.

## Repositories

Work happens in the private `creo08/SecretEngerl-dev`. The public `creo08/SecretEngerl` only receives commits through `.github/workflows/promote.yml`, which the maintainer triggers. Never push there directly. Git author and committer are always `creo08 <285598642+creo08@users.noreply.github.com>`; run `git config core.hooksPath .githooks` once so the hygiene hooks run.
