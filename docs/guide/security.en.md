# Privacy and threat model

Privacy comes before every other goal. Every feature meets four criteria: no data on a server, the draw is never visible in plain text, the draw is not trivially decodable, and only what is strictly needed is passed on.

## End to end

The draw is encrypted on the organizer's device and decrypted only on the device of the person giving the gift; the host never sees it. The key travels in the link, so every link belongs in a private one-to-one chat.

## What a link contains

Each link holds one encrypted draw: the name of the Bengerl, budget, date, theme and hint if set, in postal rounds the Bengerl's postal address, the template, the draw number and the expiry date. It does not hold the recipient's own name, the list of participants or who drew whom otherwise. Every draw is padded to the same length, so all links look alike.

The encryption is AES-GCM with a fresh 128-bit key for every link. The key and the ciphertext sit after the `#`, which browsers never send to a server and messengers leave out when they build a link preview.

## What the app protects against

The app protects the draw from a passive host, from server logs, from link previews in messengers and from accidental reading. Someone in the round who deliberately takes a link apart to peek can do so. No app prevents that, and usability is not sacrificed to try.

## Limits

- Whoever can change what GitHub Pages serves (a compromised account, a manipulated build chain) can read draws as they are opened. That holds for every web app. The public repository and the release attestation show what is served.
- The GCM tag detects altered links. It does not prove that a link came from the organizer: anyone can build a valid link with their own key. The draw number in the draw makes a faked draw stand out in the group.
- The organizer's device holds the assignment. The stored links contain their keys, so anyone with the device and the developer tools can read who drew whom.
- PIN and log of the emergency view are barriers in the app, not encryption. Clearing the site data removes both. The app relies on fair play here.
- Before the app removes it from the address bar, a link can land in the browser history, in browser sync, in a messenger's in-app browser or in the clipboard history. The full link also stays in the chat history and in chat backups.
- Last year's round, in the yearly file and on the device, holds who gave to whom and the hints in plain text, unless the file has a password. On the device it stays until a new round starts from it or "Forget last year" removes it.
- The expiry date is enforced by the app, not by the cryptography. Someone who decrypts a link by hand ignores it.

## Randomness

The draw uses only `crypto.getRandomValues`. Every valid draw is exactly equally likely, with all rules applied. If the rules are too strict for a fair draw, the app says so instead of drawing unfairly.

## Reporting a problem

Please report security issues privately through [GitHub's vulnerability reporting](https://github.com/creo08/SecretEngerl/security/advisories/new).
