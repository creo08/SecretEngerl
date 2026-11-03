# Concept: SecretEngerl

As of November 2026. The variants of the custom are described in [variants.en.md](variants.en.md). This English version is the reference; a maintained German version lives in [`concept.de.md`](concept.de.md).

## Goal

A web app for Engerl-Bengerl, Wichteln and Secret Santa that covers every form of the custom, works without instructions and sends no data to a server. It runs as a static PWA in the browser, works offline, ships in German first and is open source under MIT.

## Name and language

Engerl-Bengerl is the Austrian name of the custom: the Engerl (little angel) secretly gives a gift to their Bengerl (little rascal). SecretEngerl is Secret Santa the Austrian way, and that is where the app comes from. The app, the READMEs and every description therefore use the same order: Engerl-Bengerl first, then Wichteln, then Secret Santa.

German is the primary language of the app. Further languages are all those a form of the custom comes from: English, Swedish, Spanish, Portuguese, Dutch, Polish, Ukrainian and, last, Filipino. They are added only once the German version works completely, in that order. Every translation is visibly marked as an AI translation in the app, with an invitation to correct it.

Other languages keep the name and explain it on first use, in English for example "Engerl-Bengerl, the Austrian Secret Santa". Each language also gives its own name for the custom (Wichteln, amigo invisible, lootjes trekken, Monito-Monita …). The roles are called Engerl and Bengerl in every language. The app starts in the browser's language if it has been translated already and falls back to German otherwise.

The repository works the other way round: English first, because almost every German speaker reads English, while few English speakers read German. `README.md`, `CHANGELOG.md`, `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, code, comments, commits, issues and pull requests are in English. The documentation lives in `docs/`: files ending in `.en.md` are the reference, files ending in `.de.md` the maintained German version, plus `README.de.md`. Where the two disagree, the English version wins, and the German version is updated in the same commit. The changelog exists in English only.

## Privacy

Privacy comes before every other goal. Four criteria apply to every feature:

1. No data on a server.
2. The draw is never visible in plain text.
3. The draw is not trivially decodable.
4. Only what is strictly needed is passed on.

The threat model is deliberately modest. The app protects the draw from a passive host, from server logs, from link previews in messengers and from accidental reading. A participant who deliberately takes the link apart to peek can do so. No app prevents that, and usability is not sacrificed to try. In practice, draws are sent via WhatsApp or Signal almost every time.

"End to end" here means: the draw is encrypted on the organizer's device and decrypted only on the device of the person giving the gift; the host never sees it. The key travels in the link, so every link belongs in a private one-to-one chat.

The threat model has these limits, and the README states them:

- Whoever can change what GitHub Pages serves (a compromised account, a manipulated build chain) can read draws as they are opened. That holds for every web app. The public repository and the release attestation show what is served.
- The GCM tag detects altered links. It does not prove that a link came from the organizer: anyone can build a valid link with their own key. The draw number in the draw makes a faked draw stand out in the group.
- The organizer's device holds the assignment (see storage).
- Before the app removes it from the address bar, a link can land in the browser history, in browser sync, in a messenger's in-app browser or in the clipboard history.
- The expiry date is enforced by the app, not by the cryptography. Someone who decrypts a link by hand ignores it.
- All GitHub Pages sites of one account share one origin (`https://creo08.github.io`) and with it browser storage. No other Pages project that is not maintained the same way may run on this account, and there must never be a repository `creo08.github.io`, because its service worker could control the whole origin.

Multi-party protocols without a trusted person (mixnets, zero knowledge) were rejected. They would remove the need to trust the organizer, but they cost several rounds of back and forth between all participants.

## Existing solutions

Reviewed in November 2026: web services and about 25 public repositories.

Among web services, "no sign-up" has long been standard. The data still sits with the provider almost everywhere; on Elfster, for example, organizers can see every draw. There are many serverless open-source generators. Their "encrypted links" are usually Base64 or use a key hard-coded in the source, and most use `Math.random` for randomness.

| Project | Serverless | Draw protected | Useful as |
|---|---|---|---|
| [s3eidat/secret-santa](https://github.com/s3eidat/secret-santa) (MIT) | yes | only pass-the-phone and paper slips | UX model: explains impossible rules, folded slips, strict CSP |
| [BrianMitchL/gift-exchange](https://github.com/BrianMitchL/gift-exchange) (ISC) | yes | not applicable (library) | reference for uniform draws with groups and exclusions |
| [dustball/cipher.ink](https://github.com/dustball/cipher.ink) (AGPL-3.0) | no | AES-256-GCM, key in the fragment | model for threat model, SHA256SUMS, CSP; code cannot be reused |
| [arcanis/secretsanta](https://github.com/arcanis/secretsanta) (MIT) | yes | key hard-coded | UX model; biased draw |
| [eddmann/secret-santa-pwa](https://github.com/eddmann/secret-santa-pwa) | yes | password as build constant | no license |
| [rafa-coelho/amigo-secreto](https://github.com/rafa-coelho/amigo-secreto) | yes | Base64 only | no license |
| [NikPerne/secret-santa](https://github.com/NikPerne/secret-santa) (Apache-2.0) | no | accounts, database | feature list |
| [EmCousin/secretsanta](https://github.com/EmCousin/secretsanta) | yes | encoded only, per its README | honest privacy documentation |

cipher.ink fails criterion 1 because open counters, wish lists, anonymous threads and deletion deadlines need a database. None of these features is needed for an Engerl-Bengerl round. The AGPL-3.0 also rules out copying code into an MIT project. The app is therefore written from scratch and takes ideas only.

## Architecture

The app is a static site on a static host (GitHub Pages). There is no backend, no accounts, no analytics, no third-party fonts and no CDN. Everything runs in the browser.

It has five parts:

- The matching engine `losfee` is a pure TypeScript library with no dependency on the UI. It runs in a Web Worker.
- The configuration model covers categories A to K; templates are stored configurations.
- Distribution creates encrypted links and hands them to the share sheet.
- Local storage keeps the round on the organizer's device.
- The party game module runs the game on a single device.

## A standard round, step by step

Example: 10 people, gifts exchanged at a family evening.

### 1. Set up

The organizer picks the template "Engerl-Bengerl classic" and enters the names, one per line. A blank line separates groups, such as a household, a couple, a family or a team; people in the same group do not draw each other. Budget and exchange date follow. Optional: place, theme, a hint per person (wishes, no-gos), how the reveal works and whether the organizer takes part. The hint is free text; below it the app says that only what the Engerl needs to know belongs there, and that no diagnoses are needed ("no nuts" is enough).

Groups are named after their members: "Group Anna and Bernd", or "Group Anna, Bernd and 2 more" for larger ones. Up to 50 people can take part.

The app never asks for phone numbers, email addresses, postal addresses or surnames. The only exception is the postal address in postal rounds, and even that appears only in the draw of the respective Engerl.

### 2. Draw

By default, "no mutual pairs" applies: two people never give to each other. The app checks beforehand whether the rules can be satisfied and otherwise names the reason, for example "Anna, Bernd and Clara may only give to two people between them". Tapping "Draw" creates the matching locally and encrypts one link per person. Nothing is shown.

### 3. Distribute

The app shows a list: "Anna: Send", "Bernd: Send" and so on. A tap opens the device's share sheet. There you pick Signal or WhatsApp, the one-to-one chat with Anna, and send. Anna then gets a check mark.

Anna receives exactly this:

```
Dein Engerl-Bengerl-Los 🎁
Nur für dich, bitte nicht weiterleiten.
https://creo08.github.io/SecretEngerl/#1.k3Fq…Zp.Qm9x…7aB
```

The encrypted link contains the name of her Bengerl, the budget, the date, theme and hint if set, the template, the draw number and the expiry date. It does not contain Anna's own name, the list of participants or who drew whom otherwise. The link preview in the chat is identical for every draw, and the host only sees a page request with an IP address.

### 4. Open

Anna taps the link. The app immediately removes the draw from the address bar and shows "Tap to reveal". Then it reads: "You are Bernd's Engerl", with budget, date and hint. She can look again at any time through the link in the chat.

Optionally, "Add to calendar" creates a local `.ics` file titled "Engerl-Bengerl exchange". Bernd's name is not in it, because calendars sync to the cloud.

### 5. During the round

If someone loses their link, the organizer taps "Send again" and sees nothing in the process.

If someone drops out, "Remove person" changes as little as possible: the Engerl of the person who left takes over that person's Bengerl. Exactly one person receives a new link. The organizer learns who gets a new link, but not for whom.

This repair can break a rule: the new pair may share a household, be excluded, repeat last year or break a must rule, and if the person who left was in a circle of three, two people now give to each other. In that case the app says: "The rules no longer hold completely. They are only guaranteed with a new draw." and offers "Keep it anyway" and "Draw again". If the person who left and their Engerl gave to each other (possible only when mutual pairs are allowed), the Engerl would draw themselves; then only "Draw again" is offered.

For real emergencies there is "View assignment" (see storage).

### 6. Exchange and reveal

| Variant | How it works | App needed |
|---|---|---|
| In person | The Engerl hands over the gift and is revealed by doing so | no |
| Guessing | Gifts go on the table with the Bengerl's name; everyone guesses their Engerl, then the group reveals in turn | no |
| Chain | One person hands over a gift, the recipient continues; when a loop closes, the next open person starts | no |
| Stage | On the organizer's device, "Start reveal", pair by pair | yes, round stored |
| Never | Stays secret | no |

The stage reveal shows one pair at a time and follows the chain: whoever was just given a gift is next, until a circle closes and the next open person starts. It is always available on the organizer's device. From the exchange date on it opens without a hurdle; before that it needs the same hurdle as "View assignment", and every use is logged.

### 7. Afterwards

Fourteen days after the exchange date, the app deletes the round and old links show "Round expired". With "Remember for next year", names, groups, pairings, budget and hints are kept so nobody draws the same person the following year (see last year's data).

## Link format

```
https://creo08.github.io/SecretEngerl/#1.<key>.<ciphertext>

1           format version, authenticated as additional authenticated data
key         128 random bits, base64url
ciphertext  IV (12 random bytes) ‖ AES-GCM ciphertext ‖ tag (16 bytes), base64url
```

Every link has its own key, so an IV is never reused under the same key.

Before encryption, the plaintext is compact JSON in UTF-8:

```json
{"r":"Bernd","b":"20 €","m":"","d":"2026-12-20","h":"","t":"engerl-bengerl","n":1,"x":1799020799}
```

`r` is the Bengerl, `b` the budget, `m` the theme, `d` the exchange date, `h` the hint, `t` the template from the fixed list (the app shows the template's rule from its language file, for Schrottwichteln "Buy nothing, only what you already have"), `n` the draw number and `x` the expiry date as a Unix timestamp: the end of the day 14 days after the exchange date, in UTC (here 2027-01-03T23:59:59Z). The plaintext is padded with `0x00` bytes to exactly 256 bytes, so every link of every round has the same length. On decryption, the trailing `0x00` bytes are removed; a `0x00` inside the JSON is an error. If a draw does not fit into 256 bytes, the app does not allow the draw and shows how many characters are left in the hint field.

Two templates add to this. In Postal Wichteln, `a` holds the Bengerl's postal address, at most 100 bytes, entered by the organizer per person; it appears only in the draw of that person's Engerl. In the Advent-Engerl, `m` may hold one theme per Advent week, separated by `|`, and "Add to calendar" creates one event per week. Both keys count toward the 256 bytes, so every link still has the same length.

Browsers do not send the fragment after `#` to servers ([RFC 3986](https://www.rfc-editor.org/info/rfc3986/)), and it is stripped from the Referer header. Messengers build previews with an ordinary HTTP request, which carries no fragment either.

Key and ciphertext in the same link do not stop a determined person who has the link. Compared with Base64, AES-GCM still has three advantages. An online decoder, a messenger's built-in AI or a link scanner cannot read the draw in passing; someone has to open the app on purpose, and that difference is exactly what the threat model covers. The GCM tag detects altered links, such as a swapped name; it makes cheating harder but does not prove who built a link. And WebCrypto is built in, so the extra code is about 20 lines.

What remains: the full link sits in the chat history and in chat backups. WhatsApp backups on Google Drive or iCloud are end-to-end encrypted only if the user turns that on. The expiry date makes old links useless to casual readers.

The expiry date has to sit inside the ciphertext. In the clear it would reveal roughly the exchange date to anyone who sees the link, and links would no longer all look alike. The app therefore decrypts, checks `x` and then shows only "Round expired", never the content. Someone who decrypts by hand can still read it; that is the price of a link without a server.

On opening, the app reads the fragment into a variable and immediately calls `history.replaceState`. It decrypts only after the tap and shows the result via `textContent`. The receiving side stores nothing.

## Distribution

Draws are sent with the [Web Share API](https://web-platform-dx.github.io/web-features-explorer/features/share). Tapping "Send" hands text and link to the operating system's share sheet, without a network request and without a permission prompt. The app cannot preselect a contact and does not learn where the link went; the check mark only means "target chosen".

Supported: Safari on iOS and macOS, Chrome and Firefox on Android, Edge, and desktop Chrome on Windows and ChromeOS and, from version 128, on macOS. Desktop Firefox and Chrome on Linux lack it, so the app copies the link to the clipboard there. The app detects support with `navigator.canShare`, not by the browser name. Whether WhatsApp and Signal accept text and link as separate fields needs testing on iOS and Android; if not, the link goes into the text.

The app never shows links as a list, and there is no "copy all". Direct links such as `wa.me/?text=…` are ruled out, because the link and its key would travel in the query string to Meta's servers. The first time someone distributes, a short hint appears: send each link in a one-to-one chat, not in the group.

## Storage, emergency access and backup

By default, the app keeps the round on the organizer's device in IndexedDB and asks the browser for persistent storage. Stored are the sent link per person and what "Send again", a new draw and a drop-out need: names, households, rules, dates, the emergency log, the optional PIN and an optional title of the round. The title is for the organizer's own overview only and never goes into a link. There is no plain-text assignment table; the assignment exists on the device only inside the links that were sent anyway, and a drop-out repair decrypts them in memory only. That is what makes "Send again" work. Because each link carries its key, anyone with the device and developer tools can read the whole assignment. Database and cache names start with `secretengerl-`. Fourteen days after the exchange date the round deletes itself, and "Delete round now" works at any time.

Under "Emergency" there is "View assignment". The app always shows one person at a time ("Who does Anna give to?"), never the whole list. Before that, the organizer confirms with the two words "Ich spicke" (I'm peeking) or holds the button for two seconds. A PIN is optional, for devices other people use too. Every view leaves an entry "Anna's assignment viewed on …" that cannot be deleted in the app until the round ends. The hurdle is meant to be felt, and it relies on people playing fair: PIN and log are barriers in the app, not encryption, and clearing the site data removes both. The documentation says so. The app expects personal responsibility here.

"Seal and forget" is an explicit choice when distributing. Afterwards nothing remains on the device, and the app warns beforehand: lost links can only be replaced by a new draw.

A backup file can be exported, for example for a new device or a second organizer. The file name is neutral, such as `runde-2026-12.wichtel`. A password is optional. Without one, the file is plain JSON with the same protection as the storage on the device, and the app says so before saving. With one, it is encrypted on top, which is worth it if the file travels by email or cloud: PBKDF2-HMAC-SHA256 with 600,000 iterations and a 16-byte random salt derives an AES-256-GCM key, the IV is 96 random bits, and a versioned header (format, version, salt, iterations) is authenticated as additional data. The file is JSON text. Without a password it reads `{"format":"secretengerl-backup","version":1,"round":{…}}`. With a password it reads `{"header":{"format":"secretengerl-backup","version":1,"salt":"…","iterations":600000},"iv":"…","data":"…"}`, and the UTF-8 bytes of the header, with the keys in exactly this order, are the additional authenticated data. The yearly file uses the same envelope with `"format":"secretengerl-year"`. Opening a backup of a round that already exists on the device asks before replacing it and shows which draw number is newer.

## Randomness and the draw

The only source of randomness is `crypto.getRandomValues`, never `Math.random`. There is no seed, so a draw cannot be recomputed from the names. Keys and IVs come from the same source.

Integers are drawn without modulo bias: values above the last full multiple are rejected. A Fisher-Yates shuffle builds on that. Larger numbers, up to about 50! ≈ 3·10^64 for the weighted choice below, are assembled from as many 32-bit words as needed into a `BigInt`, with the same rejection.

```ts
function randInt(n: number): number {
  const lim = Math.floor(2 ** 32 / n) * n;
  const b = new Uint32Array(1);
  do crypto.getRandomValues(b); while (b[0] >= lim);
  return b[0] % n;
}
```

Every valid draw must be exactly equally likely. Assigning person by person and backtracking at dead ends would be faster, but it skews the probabilities. Listing all solutions is impossible beyond small groups: 20 people already have about 9·10^17 derangements. The engine works for up to 50 people like this:

1. Fixed must rules ("Anna gives to Bernd") are set first and removed from the problem. The remaining rules split into households (nobody gives to themselves or to someone in their own household; a single person is a household of one) and additional rules: directed and mutual exclusions, last year's pairings, must rules with a choice, "no mutual pairs" and "one big chain".
2. Feasibility: a bipartite matching (Hopcroft-Karp) over all rules that fit into a "who may give to whom" matrix. If none exists, the König–Hall argument yields the group that is too small, and the app names it in words. A bounded depth-first search over all rules then checks whether any valid draw exists, so impossible rules are named at once: "With these rules there is no valid draw", or with "one big chain" "With these rules there is no big chain". Its result is discarded and does not influence the draw.
3. Standard draw: first, a draw exactly uniform over all assignments that respect the households. The forbidden cells of the households are rectangles that share no row and no column, so their number is Σ (−1)^k · r_k · (m−k)!, where r is the product of the rook polynomials of the rectangles (for an a×b rectangle, r_k = C(a,k) · C(b,k) · k!). The engine picks one giver after another, weighted by the number of completions; after each step the forbidden cells are still rectangles. Recipients that leave the same remaining shape form one class, and within a class the choice is uniform. All counts are exact `BigInt`s. If the result breaks an additional rule, it is discarded and drawn again. Every valid draw is therefore exactly equally likely.
4. With "one big chain", the engine puts everyone in a random order as one circle (Fisher-Yates) and discards it on any rule violation. That is exactly uniform over all valid chains.
5. Budget: at most 1,000,000 attempts or 2 seconds. If that is not enough, there is no fair draw: the app names the additional rule that failed most often and suggests loosening it. A skewed draw is never used as a way out. If the search in step 2 found a valid draw or hit its own limit, the app says "The rules are too strict for a fair draw".

For a round of 10 with three couples the household count is instant, and typical rounds of 50 need a few to a few dozen attempts.

Figures for 10 people with three couples as households and four single people, from a full enumeration of all 3,628,800 permutations. "Drawing from a hat" means one uniformly random permutation of all names. The last-year figures assume that last year was itself a random valid draw of the same kind; they vary slightly with last year's actual draw.

| Measure | households only | default: households and no mutual pairs |
|---|---|---|
| Valid draws | 672,240 | 392,160 |
| Of which a single big chain | 26.1% | 44.8% |
| With at least one mutual pair | 41.7% | 0% |
| Valid when drawing from a hat | 18.5% | 10.8% |
| Attempts when shuffling everyone (for comparison) | about 5 | about 9, about 21 with "one big chain" |
| Two identical draws | 1 in 672,240 | 1 in 392,160 |
| At least one pairing repeated from last year | about 70%, 1.2 pairings on average | about 70%, 1.2 pairings on average |
| Valid draws with "not like last year" | about 203,000 | about 119,000 |

"No mutual pairs" is the default in every template. Many people see two people giving to each other as a mistake, and enough solutions remain. As a side effect, the share of unbroken chains rises from a quarter to almost half. "One big chain" is needed only for the chain reveal. "Not like last year" belongs in the family template; until the yearly file arrives in phase 6, last year's pairings are entered by hand.

Equally likely draws do not mean equally likely people. In the example, Anna draws each member of another couple with 13.4% and each single person with 11.6%, in both columns. That follows from the household rules and is not a bug; the tests document it.

Drawing again is a deliberate action with a confirmation, and the draw number is part of the draw. A serverless draw cannot be revoked, so old links keep opening. After a new draw, everyone therefore gets a note that only the new draw counts.

The engine receives its random number generator from outside. Tests use a fixed generator for the logic. For uniformity, they count all valid solutions of small cases (4 to 7 people) by brute force, draw at least 50 times as often as there are solutions and apply a chi-squared test at the 0.001 level. The household count is checked against brute force up to 10 people, and a speed test draws 200 random rounds of 50 people. In production, only `crypto.getRandomValues` runs.

## Last year's data

The main route is a yearly file (phase 6; until then, pairings are entered by hand). At any time during a round, "Remember for next year" saves a file such as `engerl-2026.wichtel` with names, groups, pairings, budget and hints. A week before the round deletes itself, the app reminds the organizer to save it. The password is optional and encrypts the file like the backup file; the storage location is up to the user. Next year, "Start round from file" pre-fills everything and excludes last year's pairings.

On the same device, the app also remembers the round: when it deletes itself, names, groups, pairings, budget and hints stay as last year's round until a new round starts from them or "Forget last year" removes them. Like the file, this holds last year's assignment in plain text; the app shows it only through "Ich spicke". It is not reliable either. Safari deletes a website's data after seven days without a visit unless it was added to the home screen; on top of that come new devices and cleared browsing data. The app therefore always offers the file.

If last year's round was drawn on paper and revealed openly, the pairings can also be entered by hand.

The app never displays last year's pairings, only "10 pairings from 2026 will be excluded". Viewing them requires "Ich spicke". On import it shows missing and new names, and the user matches them. Obfuscating the file makes no sense: with 10 names there are only 90 possible pairs, so hashes would be tried in no time.

## Pre-fill link

A link can pre-fill a new round, again in the fragment:

```
https://creo08.github.io/SecretEngerl/neu#v=1&f=engerl-bengerl&n=Anna,Bernd;Clara,David;Eva&b=20&d=2026-12-20
```

`f` is the template, `n` the names with `,` within and `;` between groups, `b` the budget and `d` the exchange date. The app fills in the wizard with it and shows a confirmation page; the draw happens only after the organizer taps. Someone can pass on a ready invitation to set up a round, and an AI assistant asked to "make an Engerl-Bengerl for Anna, Bernd and Clara" can build a matching link directly. The names do not reach the host, but names given to an AI assistant do reach the assistant's provider.

The link is untrusted input. Version 1 accepts: `f` only from the list of templates; at most 50 names, each 1 to 40 characters after NFC normalisation, with control and bidi characters (Unicode Cc and Cf) removed, whitespace trimmed and no duplicates; `b` as a decimal number from 0 to 9999; `d` as an ISO date. Unknown keys are ignored. A name that contains `,`, `;`, `&`, `=` or `%` is percent-encoded, for example `%2C`. Errors show a friendly message, never a stack trace. The pre-fill link comes in phase 5.

## Documentation inside the app

All explanations are available inside the app, not only in the repository: how it works, one page per form of the custom, privacy and threat model, FAQ, and a static privacy page `/datenschutz/`. It says that the app stores nothing on servers, that GitHub logs IP addresses of page requests for security purposes, and that what people enter into a round stays on the devices of those taking part and in the chats the links go through. As contact it links the GitHub account `creo08` and the issues. The source is the Markdown in `docs/*.de.md` for the German app and `docs/*.en.md` for the English one. The build turns it into static HTML pages that are readable without JavaScript and are served offline from the cache. Each form page links straight to its template.

## Findability for people and AI

Anyone who asks a search engine or an AI assistant "Engerl-Bengerl online auslosen" or "make an Engerl-Bengerl" should land on the app. To that end:

- Every page is statically pre-rendered. Many AI crawlers do not run JavaScript.
- The app lives at `https://creo08.github.io/SecretEngerl/`. The base path `/SecretEngerl/` is set in one place, so a move to another GitHub Pages address stays cheap.
- Separate pages per form and language with readable URLs (`/SecretEngerl/engerl-bengerl/`, `/SecretEngerl/wichteln/`, `/SecretEngerl/schrottwichteln/`, `/SecretEngerl/en/secret-santa/` …), clean titles, `hreflang` and `canonical`.
- `llms.txt` at `/SecretEngerl/llms.txt`, following the [llmstxt.org](https://llmstxt.org/) proposal, which allows a subpath: what the app does, the forms with links, the format of the pre-fill link and the note that names given to an assistant reach its provider.
- Structured data as JSON-LD (`WebApplication`, `HowTo` per form) and a `sitemap.xml` under `/SecretEngerl/`. A `robots.txt` only works at the root of the host; without one there, everything is allowed. The sitemap is submitted to search engines by hand. Draws are unaffected, because they live only in the fragment.
- In the repository, `AGENTS.md` describes structure, modules and conventions for AI tools that work on the code. Code and comments are in English, with clear names, small modules and TSDoc on every exported function.

## Party games

The party game module runs on one device at the table, offline and without links. It offers turn order, a digital die with an editable rule table, a timer and a steal counter with a lock. It comes after the drawn forms.

## Hardening and verifiability

- Content Security Policy as a meta tag, since GitHub Pages does not allow custom headers: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; worker-src 'self'; base-uri 'none'; form-action 'none'`. It is the first element in `<head>`. No inline script, no third-party sources.
- A meta tag cannot enforce `frame-ancestors`, so the app hides distribution and emergency access when it runs inside a frame (`top !== self`).
- `<meta name="referrer" content="no-referrer">` and generic Open Graph tags without names.
- The service worker caches only the static files, never a fragment, and no service worker code reads `location.hash`. A new version waits until the user taps "New version – reload" or all tabs are closed; there is no silent `skipWaiting()`.
- Only tags `v*` are deployed. The deploy workflow builds exactly the tagged commit, creates `SHA256SUMS` over the served files and an artifact attestation, attaches both to the GitHub release and deploys that same artifact. The served site therefore always matches a tag, and `SHA256SUMS` can be checked with `sha256sum -c`, the attestation with `gh attestation verify`.
- GitHub Actions are pinned to commit SHAs and run with least-privilege permissions.
- The README states the threat model in a few lines and names its limits openly (see privacy).
- Privacy notice on `/datenschutz/`: the app stores nothing on servers. GitHub logs IP addresses of page requests for security purposes; the draw is not part of that.

## Plan

| Phase | Content | Acceptance |
|---|---|---|
| 1 | Configuration model for categories A to K, templates as JSON | schema and templates validated |
| 2 | Matching engine `losfee` with feasibility check, explanations, drop-out logic, last year's pairings entered by hand | unit and property tests, chi-squared tests, 1,000 random configurations agree with brute force, 50-person speed test |
| 3 | Link format, opening, distribution, storage, emergency access | round-trip tests, all links equally long, expiry works, tampered links rejected |
| 4 | German UI with the templates "Engerl-Bengerl classic", "Schrottwichteln", "Family Wichteln", "Office Wichteln"; documentation in the app; `/datenschutz/`; PWA | setting up a round takes under two minutes without help, tested with non-technical people; no requests except to the app's own origin |
| 5 | Findability: pages per form, `llms.txt`, JSON-LD, sitemap, pre-fill link | pages readable without JavaScript |
| 6 | Last year's data (yearly file and memory on the device), backup file, stage reveal, "Postal Wichteln" with the address in the draw, Advent-Engerl; the Advent calendar follows only when requested | |
| 7 | Party games | playable on one phone at the table |
| 8 | Further languages in the order English, Swedish, Spanish, Portuguese, Dutch, Polish, Ukrainian, Filipino; all marked as AI translations | no hard-coded strings in the code |
| 9 | Hardening, accessibility, release with `SHA256SUMS` and attestation | Lighthouse 95 or better, external review of the cryptography |

Phases 1 to 4 are the MVP. Accessibility (WCAG 2.2 AA, full keyboard and screen reader use, an alternative to the two-second press) applies from phase 4; phase 9 audits it.

## Sources

- [cipher.ink Secret Santa](https://cipher.ink/secret-santa) and [repository](https://github.com/dustball/cipher.ink)
- [RFC 3986, Uniform Resource Identifier](https://www.rfc-editor.org/info/rfc3986/)
- [Referer, MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referer)
- [History.replaceState, MDN](https://developer.mozilla.org/en-US/docs/Web/API/History/replaceState)
- [Web Share, Web Features Explorer](https://web-platform-dx.github.io/web-features-explorer/features/share)
- [Link previews, WhatsApp Business Platform](https://developers.facebook.com/documentation/business-messaging/whatsapp/link-previews/)
- [What is GitHub Pages? Data collection, GitHub Docs](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Elfster: who can see the draws](https://help.elfster.com/en/articles/11500522-how-do-i-see-who-someone-or-everyone-drew)
- [AGPL-3.0 and MIT, FOSSA](https://fossa.com/resources/license-compliance-tools/license-compatibility-checker/agpl-3-0-vs-mit/)
- [gift-exchange README](https://unpkg.com/gift-exchange@4.0.3/README.md)
- [llms.txt, a proposal for AI-readable site descriptions](https://llmstxt.org/)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [Content Security Policy Level 3, W3C](https://www.w3.org/TR/CSP3/)
