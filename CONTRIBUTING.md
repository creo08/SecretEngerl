# Contributing

Thank you for helping. Corrections to translations are especially welcome: all texts are machine-generated, the maintainer reviews English and German, and every other language is unchecked.

## Setup

```sh
nvm use               # Node version from .nvmrc
npm ci
git config core.hooksPath .githooks
npm test
```

The hooks run `scripts/check-hygiene.sh` before each commit and push. CI runs it again over the whole history.

## Rules

- Read [AGENTS.md](AGENTS.md) first. The specification in `docs/concept.en.md` is binding.
- Conventional Commits, small commits, English messages.
- Commit messages carry no `Co-Authored-By` or session trailers, and files contain no email addresses.
- No runtime dependencies. Propose every new dev dependency in an issue first.
- Do not copy code from AGPL projects.
- Changes to a `docs/*.en.md` file or to `README.md` update the German counterpart in the same commit. `npm run check:docs` checks the structure.
- German texts use gender-neutral forms first (organisierende Person, Teilnehmende), otherwise the colon (Empfänger:in).
- Changes that users notice go into the "Unreleased" section of `CHANGELOG.md`. Changes to the link format or the cryptography always go under "Security".
