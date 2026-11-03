# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] - 2026-11-03

### Added

- "Remember for next year": a yearly file with names, groups, pairings, budget and hints, optionally protected by a password. "Open file" on the start page starts next year's round from it, excludes last year's pairings and asks who is who when names changed.
- An ended round stays on the device as last year's round until a new round starts from it or "Forget last year" removes it.
- A reminder a week before a round deletes itself.
- Stage reveal: "Start reveal" shows one pair at a time on the organizer's device, following the chain. Before the exchange day it needs "Ich spicke" and is logged.
- "Save backup": the whole round as a file for another device or a second organizer, optionally protected by a password; "Open file" restores it and asks before replacing a round already on the device.

### Changed

- Sections that open on a tap ("Mehr Optionen", "Während der Runde", "PIN festlegen") now look like it: a chevron, a frame and a line saying what is inside.

### Fixed

- After "Neu laden" in one tab, other open tabs now offer a reload too, instead of failing on the updated storage.

### Security

- Yearly files and backups with a password are encrypted with AES-256-GCM under a key from PBKDF2-HMAC-SHA256 (600,000 iterations), with the file header authenticated. Without a password the app warns that anyone with the file can read the assignment and the hints.

## [0.3.0] - 2026-11-03

### Added

- Pages for each form the app supports, at readable addresses: /engerl-bengerl/, /wichteln/, /schrottwichteln/, /familien-wichteln/ and /buero-wichteln/, each with steps and the description in the original language.
- Pre-fill link `/neu#v=1&f=…&n=…&b=…&d=…`: a ready invitation fills in the setup after a confirmation page; nothing is drawn by opening it.
- `llms.txt`, `sitemap.xml`, canonical URLs and structured data, so search engines and AI assistants can find and describe the app.

### Changed

- The template pages moved from /vorlagen/… to the form pages; the old addresses forward there.

## [0.2.0] - 2026-11-03

### Added

- An optional name for each round, such as "Familie Huber" or "Team Nord", so several rounds on one device are easy to tell apart. The overview shows how many links of each round are sent. The name stays on the organizer's device and never goes into a draw.

### Changed

- People who must not draw each other are now called a group (household, couple, family or team) instead of a household: "Group Anna and Bernd".
- The start page says plainly where your data is stored: nowhere on a server, on the organizer's device, in the chats, and not when a draw is opened.

## [0.1.0] - 2026-11-03

First release of SecretEngerl: Engerl-Bengerl, the Austrian Secret Santa, together with Wichteln and Secret Santa, without a server.

### Added

- German interface: pick a template, enter who plays, set rules if wanted, draw and send.
- Templates "Engerl-Bengerl klassisch", "Schrottwichteln" (no budget, buy nothing), "Familien-Wichteln" and "Büro-Wichteln".
- Fair draw for up to 50 people: every valid draw is exactly equally likely, with households, one-way and two-way exclusions, must rules, last year's pairings entered by hand, "no mutual pairs" (on by default) and "one big chain".
- Clear reasons when rules cannot be met, such as "Anna, Bernd and Clara may only give to two people between them".
- One private link per person, handed to the share sheet one at a time, or copied where sharing is not available.
- "Tap to reveal" for the person who opens a draw, with "Add to calendar" for the exchange day, without the Bengerl's name.
- The round stays on the organizer's device for "Send again" and deletes itself 14 days after the exchange; "Seal and forget" and "Delete round now" remove it earlier.
- Drop-out repair: the Engerl of the person who left takes over their Bengerl, with a warning when that breaks a rule; "Draw again" for everyone.
- Emergency view of one person at a time after typing "Ich spicke" or holding a button, with an optional PIN and a log of every view.
- Help pages inside the app, readable without JavaScript: how it works, one page per template, privacy and threat model, FAQ and the privacy notice.
- Installable app that works offline; a new version waits until you tap "Neu laden".

### Security

- Link format v1: every draw is encrypted with AES-GCM under its own 128-bit key that travels only in the part after `#`; the format version is authenticated, every draw is padded to 256 bytes so all links look alike, and draws expire 14 days after the exchange.
- Strict Content Security Policy, no inline scripts, no requests to other origins, and no use in frames for sending and the emergency view.
- Releases are built from the tag only, with `SHA256SUMS` and an artifact attestation attached.
