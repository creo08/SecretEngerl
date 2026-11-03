# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
