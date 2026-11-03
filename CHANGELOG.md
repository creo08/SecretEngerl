# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Templates "Engerl-Bengerl klassisch", "Schrottwichteln" (no budget, buy nothing), "Familien-Wichteln" and "Büro-Wichteln".
- Fair draw for up to 50 people: every valid draw is exactly equally likely, with households, one-way and two-way exclusions, must rules, last year's pairings, "no mutual pairs" (on by default) and "one big chain".
- Clear reasons when rules cannot be met, such as "Anna, Bernd and Clara may only give to two people between them".
- Drop-out repair: the Engerl of the person who left takes over their Bengerl, with a warning when that breaks a rule.
- One private link per person, handed to the share sheet one at a time, or copied where sharing is not available.
- "Add to calendar" for the exchange day, without the Bengerl's name.
- The round stays on the organizer's device for "Send again" and deletes itself 14 days after the exchange.
- Emergency view of one person at a time after typing "Ich spicke", with an optional PIN and a log of every view.

### Security

- Link format v1: every draw is encrypted with AES-GCM under its own 128-bit key that travels only in the part after `#`; the format version is authenticated, every draw is padded to 256 bytes so all links look alike, and draws expire 14 days after the exchange.
