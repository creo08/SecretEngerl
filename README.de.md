# SecretEngerl

[English](README.md)

Engerl-Bengerl, Wichteln und Secret Santa ohne Server. Das Los steckt hinterm `#`.

SecretEngerl lost Engerl-Bengerl, Wichteln oder Secret Santa im Browser aus. Die organisierende Person gibt die Namen ein, die App zieht eine faire Zuordnung und erzeugt pro Person einen verschlüsselten Link. Jeder Link geht über das Teilen-Menü des Handys in einen privaten Einzelchat. Auf einem Server wird nichts gespeichert, es gibt keine Konten und keine Analytics.

App: <https://creo08.github.io/SecretEngerl/>

## Ende zu Ende

Das Los wird auf dem Gerät der organisierenden Person verschlüsselt und erst auf dem Gerät der beschenkenden Person entschlüsselt; der Hoster sieht es nie. Der Schlüssel reist im Link mit, deshalb gehört jeder Link in einen privaten Einzelchat.

## Bedrohungsmodell

Die App schützt das Los vor einem passiven Hoster, vor Server-Logs, vor Link-Vorschauen im Messenger und vor versehentlichem Mitlesen. Wer in der Runde absichtlich einen Link zerlegt, um zu spicken, kann das; dagegen schützt keine App. Die Grenzen:

- Wer ändern kann, was GitHub Pages ausliefert (gehacktes Konto, manipulierte Build-Kette), kann Lose beim Öffnen mitlesen. Das gilt für jede Web-App. Das öffentliche Repository und die Attestierung des Releases zeigen, was ausgeliefert wird.
- Der GCM-Tag erkennt veränderte Links. Wer selbst einen Link mit eigenem Schlüssel baut, kann ein Los vortäuschen; die Ziehungsnummer im Los macht das in der Gruppe auffällig.
- Das Gerät der organisierenden Person enthält die Zuordnung.
- Bevor die App ihn aus der Adresszeile entfernt, kann ein Link im Browserverlauf, in der Browser-Synchronisierung, im In-App-Browser eines Messengers oder im Zwischenablage-Verlauf landen.
- Das Ablaufdatum setzt die App durch, nicht die Kryptografie: Wer einen Link von Hand entschlüsselt, ignoriert es.

Mehr dazu in [SECURITY.md](SECURITY.md) und [docs/concept.de.md](docs/concept.de.md).

## Datenschutz auf GitHub Pages

Die App speichert nichts auf Servern. GitHub protokolliert beim Seitenaufruf IP-Adressen zu Sicherheitszwecken; das Los ist darin nicht enthalten, weil Browser den Teil hinter `#` nie mitschicken. Was man in eine Runde einträgt, bleibt auf den Geräten der Beteiligten und in den Chats, über die die Links gehen.

## Auch bekannt als

Engerl-Bengerl, Engele-Bengele, Wichteln, Julklapp, Secret Santa, Kris Kringle, Kris Kindle, amigo invisible, amigo secreto, amigo oculto, Angelito, lootjes trekken, Mikołajki, Таємний Миколай (Tajemnyj Mykolaj), Monito-Monita, NZ Secret Santa. Verwandte Spiele: Schrottwichteln, Räuberwichteln, Würfelwichteln, White Elephant, Yankee Swap, Dirty Santa, Conspiracy Santa.

Randnotiz: In Teilen von New Jersey und Pennsylvania heißt der Brauch Pollyanna.

## Entwicklung

Siehe [CONTRIBUTING.md](CONTRIBUTING.md) und [AGENTS.md](AGENTS.md) (beide englisch). Lizenz: [MIT](LICENSE).
