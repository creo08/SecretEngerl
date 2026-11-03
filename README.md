# SecretEngerl

[Deutsch](README.de.md)

Engerl-Bengerl, the Austrian Secret Santa: Wichteln and Secret Santa without a server. The draw lives behind the `#`.

SecretEngerl draws names for an Engerl-Bengerl, Wichteln or Secret Santa round in your browser. The organizer enters the names, the app draws a fair assignment and creates one encrypted link per person. Each link goes out through the phone's share sheet, in a private one-to-one chat. Nothing is stored on a server, there are no accounts and no analytics.

App: <https://creo08.github.io/SecretEngerl/>

## End to end

The draw is encrypted on the organizer's device and decrypted only on the device of the person giving the gift; the host never sees it. The key travels in the link, so every link belongs in a private one-to-one chat.

## Threat model

The app protects the draw from a passive host, from server logs, from link previews in messengers and from accidental reading. Someone in the round who deliberately takes a link apart to peek can do so; no app prevents that. Its limits:

- Whoever can change what GitHub Pages serves (a compromised account, a manipulated build chain) can read draws as they are opened. That holds for every web app. The public repository and the release attestation show what is served.
- The GCM tag detects altered links. Anyone who builds a link with their own key can fake a draw; the draw number inside the draw makes that stand out in the group.
- The organizer's device holds the assignment.
- Before the app removes it from the address bar, a link can land in the browser history, in browser sync, in a messenger's in-app browser or in the clipboard history.
- The expiry date is enforced by the app, not by the cryptography: someone who decrypts a link by hand ignores it.

Details are in [SECURITY.md](SECURITY.md) and [docs/concept.en.md](docs/concept.en.md).

## Privacy on GitHub Pages

The app stores nothing on servers. GitHub logs the IP addresses of page requests for security purposes; the draw is not part of that, because browsers never send the part after `#`. What you enter into a round stays on the devices of those taking part and in the chats the links go through.

## Also known as

Engerl-Bengerl, Engele-Bengele, Wichteln, Julklapp, Secret Santa, Kris Kringle, Kris Kindle, amigo invisible, amigo secreto, amigo oculto, Angelito, lootjes trekken, Mikołajki, Таємний Миколай (Tajemnyj Mykolaj), Monito-Monita, NZ Secret Santa. Related games: Schrottwichteln, Räuberwichteln, Würfelwichteln, White Elephant, Yankee Swap, Dirty Santa, Conspiracy Santa.

Side note: in parts of New Jersey and Pennsylvania the custom is called Pollyanna.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md). License: [MIT](LICENSE).
