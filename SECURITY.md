# Security

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting in [creo08/SecretEngerl](https://github.com/creo08/SecretEngerl/security/advisories/new). For anything that is not sensitive, open an [issue](https://github.com/creo08/SecretEngerl/issues).

## Threat model

Privacy comes before every other goal. Every feature meets four criteria: no data on a server; the draw is never visible in plain text; the draw is not trivially decodable; only what is strictly needed is passed on.

The threat model is deliberately modest. The app protects the draw from a passive host, from server logs, from link previews in messengers and from accidental reading. A participant who deliberately takes a link apart to peek can do so.

"End to end" means: the draw is encrypted on the organizer's device and decrypted only on the device of the person giving the gift; the host never sees it. The key travels in the link, so every link belongs in a private one-to-one chat.

How it works:

- Each link is `#1.<key>.<ciphertext>`: a 128-bit random key per link, AES-GCM with a 96-bit random IV and a 128-bit tag, and the format version as additional authenticated data. The fragment after `#` is never sent to servers.
- The plaintext is padded to exactly 256 bytes, so all links look alike. It carries the Bengerl's name, budget, date, theme, hint, draw number and expiry date, but not the recipient's own name or the participant list.
- Randomness comes only from `crypto.getRandomValues`, cryptography only from WebCrypto.
- A strict Content Security Policy (meta tag), no inline scripts, no third-party requests, `no-referrer`.

## Limits

- Whoever can change what GitHub Pages serves (a compromised account, a manipulated build chain) can read draws as they are opened. That holds for every web app. The public repository and the release attestation show what is served.
- The GCM tag detects altered links. It does not prove that a link came from the organizer: anyone can build a valid link with their own key. The draw number inside the draw makes a faked draw stand out in the group.
- The organizer's device holds the assignment. The stored links contain their keys, so anyone with the device and the developer tools can read the assignment. The PIN and the "viewed on" log of the emergency view are barriers inside the app, not encryption; clearing the site data removes both.
- Before the app removes it from the address bar, a link can land in the browser history, in browser sync, in a messenger's in-app browser or in the clipboard history. The full link stays in the chat history and in chat backups.
- The expiry date is enforced by the app, not by the cryptography. Someone who decrypts a link by hand ignores it.
- A meta tag cannot enforce `frame-ancestors`, so the app hides distribution and emergency access when it runs inside a frame.
- All GitHub Pages sites of one account share one origin (`https://creo08.github.io`) and with it IndexedDB and storage. No other Pages project may run on this account unless it is maintained the same way, and there must never be a repository `creo08.github.io`, because its service worker could control the whole origin.

## Verifying a release

Only tags `v*` are deployed. The deploy workflow builds exactly the tagged commit and attaches `SHA256SUMS` and an artifact attestation to the GitHub release. To check a download of the served files:

```sh
sha256sum -c SHA256SUMS
gh attestation verify <file> --repo creo08/SecretEngerl
```
